import prisma from "../config/prisma.js";
import { addRechargeJob } from "../services/queueService.js";
import { APIBOX_OPERATORS } from "../config/operators.js";
import eventBus from "../config/eventBus.js";
import { Prisma } from "@prisma/client";
import { getProvider } from "../services/providers/providerFactory.js";
import { getCommissionDetails } from "../services/commissionEngine.js";

/**
 * Fetch recharge plans for an operator
 */
export const getPlans = async (req, res) => {
  try {
    const { operatorCode } = req.query;
    if (!operatorCode) return res.status(400).json({ success: false, message: "operatorCode is required" });

    return res.json({ success: true, data: [] });
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
        status: { in: ["SUCCESS", "PENDING"] },
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
    const commDetails = await getCommissionDetails(amount, operatorName, user?.tier || "Standard");

    // 3. ATOMIC WALLET DEDUCTION & PENDING TXN
    const initResult = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet || (!isAdmin && wallet.balance.lessThan(amount))) return null;

      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: { balance: { decrement: amount } }
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount: new Prisma.Decimal(amount),
          type: "RECHARGE",
          status: "PENDING",
          direction: "DEBIT",
          mobile,
          operator: operatorName,
          provider: "APIBOX",
          idempotencyKey: req.headers["x-idempotency-key"] || `txn_${Date.now()}`,
          balanceAfter: updatedWallet.balance,
          commission: commDetails.commission,
          cashback: commDetails.cashback,
          profit: commDetails.profit
        }
      });

      return { transaction, updatedWallet };
    }, { timeout: 10000 });

    if (!initResult) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    const { transaction, updatedWallet } = initResult;

    // 4. ENQUEUE RECHARGE JOB
    await addRechargeJob({
      userId: transaction.userId,
      amount: transaction.amount,
      mobile: transaction.mobile,
      operator: transaction.operator,
      txnId: transaction.id,
      retryCount: 0,
      idempotencyKey: transaction.idempotencyKey
    });

    // 5. NOTIFY & RESPONSE
    eventBus.emit("wallet_updated", { userId: userId.toString() });

    return res.json({
      success: true,
      provider: "APIBOX",
      operator: operatorName,
      status: "PENDING",
      message: "Recharge request queued successfully"
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

    // Validate Input
    if (!mobile || !amount || !operatorCode) {
      return res.status(400).json({ success: false, message: "Invalid payment details" });
    }

    const operatorName = APIBOX_OPERATORS[String(operatorCode)];
    
    // 2.5 FETCH USER TIER & CALC COMMISSION
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } });
    const commDetails = await getCommissionDetails(amount, operatorName || String(operatorCode), user?.tier || "Standard");

    // Atomic Wallet Deduction & Transaction Creation
    const initResult = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet || wallet.balance.lessThan(amount)) return null;

      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: { balance: { decrement: amount } }
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount: new Prisma.Decimal(amount),
          type: "BILL_PAYMENT",
          status: "PENDING",
          direction: "DEBIT",
          mobile,
          operator: operatorName || `OpCode: ${operatorCode}`,
          provider: "APIBOX",
          idempotencyKey: `postpaid_${Date.now()}_${mobile}`,
          balanceAfter: updatedWallet.balance,
          description: `Postpaid Bill Payment for ${mobile}`,
          commission: commDetails.commission,
          cashback: commDetails.cashback,
          profit: commDetails.profit
        }
      });

      return { transaction, updatedWallet };
    });

    if (!initResult) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    const { transaction } = initResult;

    // 4. ENQUEUE POSTPAID JOB
    await addRechargeJob({
      userId: transaction.userId,
      amount: transaction.amount,
      mobile: transaction.mobile,
      operator: transaction.operator,
      txnId: transaction.id,
      retryCount: 0,
      idempotencyKey: transaction.idempotencyKey
    });

    eventBus.emit("wallet_updated", { userId: userId.toString() });

    return res.json({
      success: true,
      status: "PENDING",
      message: "Payment request queued successfully",
      transactionId: transaction.id
    });

  } catch (error) {
    console.error("[Pay Postpaid Bill Error]:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
