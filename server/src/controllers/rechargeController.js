import prisma from "../config/prisma.js";
import crypto from "crypto";
import { claimIdempotencyKey } from "../utils/idempotency.js";
import { APIBOX_OPERATORS } from "../config/operators.js";
import eventBus from "../config/eventBus.js";
import { Prisma } from "@prisma/client";
import { getCommissionDetails } from "../services/commissionEngine.js";
import { detectEzytmHLR } from "../services/hlr/ezytmHlrService.js";
import { mapEzytmToMplan } from "../config/mplanMappings.js";
import { fetchMPlanPlans } from "../services/mplan/mplanService.js";
import { recordFinancialEntry } from "../services/ledgerService.js";
import { TXN_EVENTS } from "../services/transactionEventService.js";
import { rechargeQueue } from "../config/rechargeQueue.js";
import { isFinalizedStatus } from "../utils/transactionStateGuard.js";
import { reconcileSingleTransaction } from "../services/reconciliationService.js";
import { redisClient } from "../config/redis.js";
import { getIO } from "../config/socket.js";

const summarizePlanPayload = (plans = {}) => {
  const categories = Object.keys(plans).filter((key) => Array.isArray(plans[key]) && plans[key].length > 0);
  const totalPlans = categories.reduce((sum, key) => sum + plans[key].length, 0);
  return { totalPlans, categories };
};


/**
 * Fetch recharge plans for an operator
 */
export const getPlans = async (req, res) => {
  try {
    const { operatorCode, circleCode, operatorName, circleName } = req.query;
    if (!operatorCode) return res.status(400).json({ success: false, message: "operatorCode is required" });

    const operatorObj = {
      name: operatorName || "Mobile",
      code: Number(operatorCode)
    };
    const circleObj = {
      name: circleName || "Delhi NCR",
      code: Number(circleCode || 5)
    };

    console.log("[MPLAN_FETCH]", {
      operator: operatorObj.name,
      circle: circleObj.name,
      mplanCode: operatorObj.code
    });

    const plansResponse = await fetchMPlanPlans(operatorObj, circleObj);
    const planSummary = summarizePlanPayload(plansResponse.plans);
    console.log("[PLAN_FETCH_SUCCESS]", planSummary);

    return res.json(plansResponse);
  } catch (error) {
    console.error("[Plans Error]:", error);
    res.status(500).json({ success: false, message: "Failed to fetch plans" });
  }
};

/**
 * SYNC Recharge Controller (Apibox)
 * Optimized for exact operatorCode mapping and robust parsing
 */
export const recharge = async (req, res) => {
  console.log("NEW APIBOX CONTROLLER RUNNING");

  try {
    const { mobile, amount, operatorCode } = req.body;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const correlationId = crypto.randomBytes(8).toString('hex');
    const idempotencyKey = req.headers["x-idempotency-key"] || `recharge_${userId}_${mobile}_${Date.now()}`;

    console.log(`[RECHARGE_INIT][${correlationId}] User: ${userId} | Mobile: ${mobile} | Amount: ${amount} | OperatorCode: ${operatorCode}`);

    // 0. VALIDATE OPERATOR
    const operatorName = APIBOX_OPERATORS[String(operatorCode)];
    if (!operatorName) {
      return res.status(400).json({
        success: false,
        message: `Unsupported operator: ${operatorCode}`
      });
    }

    // 1. VALIDATE BASIC INPUT
    if (!mobile || !amount || mobile.length !== 10) {
      return res.status(400).json({ success: false, message: "Valid 10-digit mobile and amount required" });
    }

    // 2. PREVENT DUPLICATE RECHARGES
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentTxn = await prisma.transaction.findFirst({
      where: {
        mobile,
        amount: new Prisma.Decimal(amount),
        status: { in: ["SUCCESS", "PENDING", "PENDING_REVIEW", "PROCESSING"] },
        createdAt: { gte: fiveMinutesAgo }
      }
    });

    if (recentTxn && !isAdmin) {
      return res.status(400).json({ 
        success: false, 
        message: "Duplicate recharge attempt. Please wait 5 minutes." 
      });
    }

    // 2.5 FETCH USER TIER & CALC COMMISSION
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } });
    const commDetails = await getCommissionDetails(amount, operatorName, user?.tier || "Standard", { userId, idempotencyKey });

    // 3. ATOMIC WALLET DEDUCTION & PENDING TXN
    const initResult = await prisma.$transaction(async (tx) => {
      // Claim idempotency securely inside tx
      const canClaim = await claimIdempotencyKey(idempotencyKey, req.body, tx);
      if (!canClaim) {
        throw new Error("Duplicate recharge request. Request is already being processed.");
      }

      const { balanceAfter, ledgerEntry } = await recordFinancialEntry({
        userId,
        amount: -amount,
        type: 'RECHARGE_DEBIT',
        transactionId: null,
        description: `Recharge for mobile: ${mobile}`,
        allowNegative: isAdmin,
        context: { correlationId, ipAddress: req.ip },
        tx
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount: new Prisma.Decimal(amount),
          type: "RECHARGE",
          status: "PENDING_REVIEW",
          direction: "DEBIT",
          mobile,
          operator: operatorName,
          provider: "APIBOX",
          idempotencyKey,
          financialSequenceId: correlationId,
          balanceAfter: balanceAfter,
          commission: commDetails.commission,
          cashback: commDetails.cashback,
          profit: commDetails.profit,
          commissionSnapshot: commDetails.snapshot || null,
          rechargeProcessing: false,
          reviewStatus: "PENDING_REVIEW",
          invoiceSnapshot: {
            timeline: [{
              event: TXN_EVENTS.PENDING_REVIEW,
              timestamp: new Date().toISOString(),
              details: { mobile, operator: operatorName }
            }]
          }
        }
      });


      console.log(`[TXN_ID_GENERATED]\ninternalTxnId: ${transaction.id}`);

      await tx.ledgerEntry.update({
        where: { id: ledgerEntry.id },
        data: { transactionId: transaction.id }
      });

      return { transaction, updatedWallet: { balance: balanceAfter } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 });

    if (!initResult) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    const { transaction } = initResult;

    console.log("[QUEUE_DEBUG] About to add recharge job for txn:", transaction.id);
    console.log("[QUEUE_DEBUG] Queue object exists:", !!rechargeQueue);

    try {
      await rechargeQueue.add(
        "processRecharge",
        {
          txnId: transaction.id
        },
        {
          attempts: 3,
          removeOnComplete: 100,
          removeOnFail: 100
        }
      );
      console.log("[QUEUE_JOB_CREATED] Recharge job added successfully for txn:", transaction.id);
    } catch (err) {
      console.error("[QUEUE_ADD_ERROR]", err);
    }

    // 4. Notify only. Real provider execution is admin-triggered via retry.
    eventBus.emit("wallet_updated", { userId: userId.toString() });
    eventBus.emit("recharge_queued", {
      userId: userId.toString(),
      txnId: transaction.id,
      status: "PENDING_REVIEW",
      transaction
    });
    eventBus.emit("transaction_updated", {
      userId: userId.toString(),
      transactionId: transaction.id,
      status: "PENDING_REVIEW",
      transaction
    });

    return res.json({
      success: true,
      operator: operatorName,
      status: "PENDING_REVIEW",
      transactionId: transaction.id,
      message: "Recharge queued"
    });

  } catch (error) {
    console.error("[CRITICAL] RECHARGE CONTROLLER ERROR:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


/**
 * Pay Postpaid Bill (Real APIBOX)
 */
export const payPostpaidBill = async (req, res) => {
  try {
    const { mobile, amount, operatorCode } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const correlationId = crypto.randomBytes(8).toString('hex');
    const idempotencyKey = req.headers["x-idempotency-key"] || `postpaid_${userId}_${mobile}_${Date.now()}`;

    // Validate Input
    if (!mobile || !amount || !operatorCode) {
      return res.status(400).json({ success: false, message: "Invalid payment details" });
    }

    const operatorName = APIBOX_OPERATORS[String(operatorCode)];
    
    // 2.5 FETCH USER TIER & CALC COMMISSION
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } });
    const commDetails = await getCommissionDetails(amount, operatorName || String(operatorCode), user?.tier || "Standard", { userId, idempotencyKey });

    // Atomic Wallet Deduction & Transaction Creation
    const initResult = await prisma.$transaction(async (tx) => {
      // Claim idempotency securely inside tx
      const canClaim = await claimIdempotencyKey(idempotencyKey, req.body, tx);
      if (!canClaim) {
        throw new Error("Duplicate postpaid payment request. Request is already being processed.");
      }

      const { balanceAfter, ledgerEntry } = await recordFinancialEntry({
        userId,
        amount: -amount,
        type: 'RECHARGE_DEBIT',
        transactionId: null,
        description: `Postpaid Bill Payment for ${mobile}`,
        context: { correlationId, ipAddress: req.ip },
        tx
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount: new Prisma.Decimal(amount),
          type: "BILL_PAYMENT",
          status: "PENDING_REVIEW",
          direction: "DEBIT",
          mobile,
          operator: operatorName || `OpCode: ${operatorCode}`,
          provider: "APIBOX",
          idempotencyKey,
          financialSequenceId: correlationId,
          balanceAfter: balanceAfter,
          description: `Postpaid Bill Payment for ${mobile}`,
          commission: commDetails.commission,
          cashback: commDetails.cashback,
          profit: commDetails.profit,
          commissionSnapshot: commDetails.snapshot || null,
          rechargeProcessing: false,
          reviewStatus: "PENDING_REVIEW",
          invoiceSnapshot: {
            timeline: [{
              event: TXN_EVENTS.PENDING_REVIEW,
              timestamp: new Date().toISOString(),
              details: { mobile, operator: operatorName || `OpCode: ${operatorCode}` }
            }]
          }
        }
      });


      console.log(`[TXN_ID_GENERATED]\ninternalTxnId: ${transaction.id}`);

      await tx.ledgerEntry.update({
        where: { id: ledgerEntry.id },
        data: { transactionId: transaction.id }
      });

      return { transaction, updatedWallet: { balance: balanceAfter } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (!initResult) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    const { transaction } = initResult;

    console.log("[QUEUE_DEBUG] About to add recharge job for txn:", transaction.id);
    console.log("[QUEUE_DEBUG] Queue object exists:", !!rechargeQueue);

    try {
      await rechargeQueue.add(
        "processRecharge",
        {
          txnId: transaction.id
        },
        {
          attempts: 3,
          removeOnComplete: 100,
          removeOnFail: 100
        }
      );
      console.log("[QUEUE_JOB_CREATED] Recharge job added successfully for txn:", transaction.id);
    } catch (err) {
      console.error("[QUEUE_ADD_ERROR]", err);
    }

    eventBus.emit("wallet_updated", { userId: userId.toString() });
    eventBus.emit("recharge_queued", {
      userId: userId.toString(),
      txnId: transaction.id,
      status: "PENDING_REVIEW",
      transaction
    });
    eventBus.emit("transaction_updated", {
      userId: userId.toString(),
      transactionId: transaction.id,
      status: "PENDING_REVIEW",
      transaction
    });

    return res.json({
      success: true,
      status: "PENDING_REVIEW",
      message: "Recharge queued",
      transactionId: transaction.id
    });

  } catch (error) {
    console.error("[Pay Postpaid Bill Error]:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * INIT Prepaid Recharge Flow (HLR + Plans + Normalizer)
 * POST /api/recharge/prepaid/init
 */
export const initPrepaidRecharge = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: "Invalid 10-digit mobile number" });
    }

    // 1. Detect HLR via EzyTM (Operator + Circle)
    const hlrResult = await detectEzytmHLR(mobile);

    if (!hlrResult || !hlrResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: hlrResult?.message || "Unable to detect network currently. Please retry in a few seconds.",
        fallbackFlags: { revealDropdown: true, revealAmount: true }
      });
    }

    const { operator, circle, source: hlrSource } = hlrResult;
    console.log("[HLR_DETECTED]", { mobile, operator, circle });

    // 2. Map EzyTM names to MPlan codes
    const mapResult = mapEzytmToMplan(operator, circle);
    if (!mapResult.success) {
      return res.status(400).json({
        success: false,
        message: mapResult.message,
        fallbackFlags: { revealDropdown: true, revealAmount: true }
      });
    }

    const operatorObj = { name: operator, code: Number(mapResult.operatorCode) };
    const circleObj = { name: circle, code: Number(mapResult.circleCode) };

    // 3. Fetch Live Plans from MPlan & Normalize
    console.log("[MPLAN_FETCH]", {
      operator: operatorObj.name,
      circle: circleObj.name,
      mplanCode: operatorObj.code
    });
    const mplanResponse = await fetchMPlanPlans(operatorObj, circleObj);
    const planSummary = summarizePlanPayload(mplanResponse.plans);
    console.log("[PLAN_FETCH_SUCCESS]", planSummary);

    // 4. Attach Frontend Source Badge
    mplanResponse.source = {
      hlr: hlrSource || "ezytm-live",
      plans: mplanResponse.source || "mplan-live"
    };

    return res.json(mplanResponse);

  } catch (error) {
    console.error("[INIT Prepaid Error]:", error.message || error);
    // NEVER expose raw errors to UI
    return res.status(500).json({ 
      success: false, 
      message: "Unable to detect network currently. Please retry in a few seconds.",
      fallbackFlags: { revealDropdown: true, revealAmount: true }
    });
  }
};

/**
 * INIT Postpaid Recharge Flow (HLR + Bill Fetch)
 * POST /api/recharge/postpaid/init
 */
export const initPostpaidRecharge = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: "Invalid 10-digit mobile number" });
    }

    // 1. Detect HLR via EzyTM (Operator + Circle)
    const hlrResult = await detectEzytmHLR(mobile);

    if (!hlrResult || !hlrResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: hlrResult?.message || "Unable to detect network currently. Please retry in a few seconds.", 
        fallbackFlags: { revealDropdown: true, revealAmount: true } 
      });
    }

    const { operator, circle, source: hlrSource } = hlrResult;

    // Map EzyTM names to MPlan codes for consistent frontend rendering
    const mapResult = mapEzytmToMplan(operator, circle);
    const operatorObj = mapResult.success ? { name: operator, code: Number(mapResult.operatorCode) } : { name: operator, code: 5 };
    const circleObj = mapResult.success ? { name: circle, code: Number(mapResult.circleCode) } : { name: circle, code: 5 };

    // 2. Simulate BBPS Bill Fetch Attempt
    const isBillFound = Math.random() > 0.4;

    if (isBillFound) {
      const mockBillAmount = Math.floor(Math.random() * 500) + 399;
      const dueDate = new Date(Date.now() + 10 * 86400000).toLocaleDateString("en-IN");
      return res.json({
        success: true,
        operator: operatorObj,
        circle: circleObj,
        source: { hlr: hlrSource || "ezytm-live" },
        billDetails: {
          customerName: "Dizipay User",
          billAmount: mockBillAmount,
          dueDate,
          billNumber: `BP_${Date.now().toString().slice(-6)}`
        }
      });
    } else {
      return res.json({
        success: true,
        operator: operatorObj,
        circle: circleObj,
        source: { hlr: hlrSource || "ezytm-live" },
        message: "No pending bill found or direct fetch unavailable",
        fallbackFlags: { revealDropdown: true, revealAmount: true }
      });
    }

  } catch (error) {
    console.error("[INIT Postpaid Error]:", error.message || error);
    // NEVER expose raw errors to UI
    return res.status(500).json({ 
      success: false, 
      message: "Unable to detect network currently. Please retry in a few seconds.", 
      fallbackFlags: { revealDropdown: true, revealAmount: true } 
    });
  }
};

/**
 * GET /api/recharge/:txnId/refresh-status
 * Syncs status of a single active transaction with the provider with rate-limiting.
 */
export const refreshStatus = async (req, res) => {
  const { txnId } = req.params;
  const txnIdNum = Number(txnId);

  try {
    if (isNaN(txnIdNum) || !Number.isInteger(txnIdNum)) {
      return res.status(400).json({ success: false, message: "Invalid transaction ID" });
    }

    const txn = await prisma.transaction.findUnique({
      where: { id: txnIdNum }
    });

    if (!txn) {
      console.log(`[MANUAL_REFRESH_SKIPPED] Txn finalized: not found`);
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    // FINALIZED GUARD
    if (
      txn.status === 'SUCCESS' ||
      txn.status === 'FAILED' ||
      txn.status === 'REFUNDED'
    ) {
      console.log(
        `[MANUAL_REFRESH_SKIPPED] Txn finalized: ${txn.id}`
      );

      return res.json({
        success: true,
        finalized: true,
        transaction: txn
      });
    }

    // Rate limiting cooldown check (max 1 refresh per txn every 10 seconds)
    const cooldownKey = `refresh_cooldown:${txnIdNum}`;
    const acquired = await redisClient.set(cooldownKey, "1", "NX", "EX", 10);
    if (!acquired) {
      console.log(`[REFRESH_RATE_LIMITED] Rate limited refresh request for txn: ${txnIdNum}`);
      return res.status(429).json({
        success: false,
        message: "Too many refresh requests. Please wait 10 seconds.",
        transaction: txn
      });
    }

    console.log(`[MANUAL_REFRESH] Refresh requested for txn: ${txnIdNum}`);

    // Perform reconciliation status sync (safely reuse active-only reconciliation)
    await reconcileSingleTransaction(txnIdNum);

    const updatedTxn = await prisma.transaction.findUnique({
      where: { id: txnIdNum }
    });

    // SOCKET EMISSION
    const io = getIO();
    io.emit('transaction_updated', updatedTxn);
    io.emit('recharge_update', updatedTxn);

    console.log(`[MANUAL_REFRESH_SUCCESS] Updated txn: ${txnIdNum}`);

    return res.json({
      success: true,
      transaction: updatedTxn || txn
    });

  } catch (error) {
    console.error(`[TXN_REFRESH_FAILED] Error refreshing txn ${txnId}:`, error.message);
    let currentTxn = null;
    if (!isNaN(txnIdNum)) {
      currentTxn = await prisma.transaction.findUnique({ where: { id: txnIdNum } });
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to refresh transaction status",
      transaction: currentTxn
    });
  }
};
