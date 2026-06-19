import prisma from "../config/prisma.js";
import { Queue } from "bullmq";
import { redis } from "../config/redis.js";
import { Prisma } from "@prisma/client";
import { createNexgateOrder } from "./providers/nexgateService.js";
import { resolveActiveMerchant, validateMerchant, getMerchantCredentials } from "./merchantIntegrationService.js";
import eventBus from "../config/eventBus.js";
import { recordFinancialEntry } from "./ledgerService.js";
import { claimIdempotencyKey } from "../utils/idempotency.js";
import { structuredLog, structuredAlert } from "../utils/logger.js";
import { validateMasterKeyAndRoutes } from "./masterKeyValidationService.js";
import { getAdminWalletStats, updateAdminWalletBalance } from "./adminWalletService.js";
import { notifyAdmins } from "./pendingWalletCreditService.js";

// Ensure queue name matches the worker
export const paymentQueue = new Queue("paymentQueue", { connection: redis });

/**
 * Creates a real production payment order via NexGate
 */
export const createPaymentOrder = async (userId, amount, idempotencyKey, upiId, intent = "TOPUP") => {
  if (!userId) throw new Error("userId is required");
  if (!amount || Number(amount) <= 0) throw new Error("Invalid amount. Must be greater than 0.");
  if (!idempotencyKey) throw new Error("idempotencyKey is required");

  const finalIntent = intent === "RECHARGE" ? "RECHARGE" : intent === "IMART" ? "IMART" : "TOPUP";

  try {
    // 1. DUPLICATE PREVENTION CHECK (Last 5 mins PENDING)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingPending = await prisma.payment.findFirst({
      where: {
        userId: Number(userId),
        amount: new Prisma.Decimal(amount),
        status: "PENDING",
        createdAt: { gte: fiveMinutesAgo },
        gatewayUrl: { not: null }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existingPending) {
      console.log(`[DUPLICATE PAYMENT BLOCKED] User ${userId} | Amount ${amount} | Reusing ID ${existingPending.id}`);
      return {
        ...existingPending,
        payment_url: existingPending.gatewayUrl,
        qr_image: existingPending.qrCode,
        success: true,
        reused: true
      };
    }

    // 2. IDEMPOTENCY CHECK (Explicit key)
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    // 2. INITIAL DATABASE RECORD
    const payment = await prisma.payment.create({
      data: {
        userId: Number(userId),
        amount: new Prisma.Decimal(amount),
        idempotencyKey,
        upiId: upiId || "demo@upi",
        intent: finalIntent,
        status: "PENDING",
        webhookReceived: false
      }
    });

    // 3. GATEWAY INITIALIZATION
    try {
      console.log("[NEXGATE_MERCHANT_LOOKUP] Resolving active payment merchant from database...");
      const activeMerchant = await resolveActiveMerchant();
      console.log(`[NEXGATE_MERCHANT_FOUND] Active merchant found: ${activeMerchant.code}`);
      validateMerchant(activeMerchant);
      const credentials = getMerchantCredentials(activeMerchant);
      console.log(`[NEXGATE_PROVIDER_SELECTED] Routing to gateway: ${credentials.code} (${credentials.name})`);

      const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
      const nexgateOrder = await createNexgateOrder({
        amount: Number(amount),
        txnId: payment.id,
        mobile: user?.phone,
        name: user?.name,
        email: user?.email,
        apiKey: credentials.apiKey,
        baseUrl: credentials.baseUrl
      });

      console.log(`[PAYMENT SERVICE] NexGate Resp: success=${nexgateOrder.success} | url=${!!nexgateOrder.payment_url} | qr=${!!nexgateOrder.qr_image}`);

      const paymentUrl = nexgateOrder.paymentUrl || nexgateOrder.payment_url;

      if (nexgateOrder.success && (paymentUrl || nexgateOrder.qr_image)) {
         // Persist gateway specific fields
         const updatedPayment = await prisma.payment.update({
           where: { id: payment.id },
           data: { 
             gatewayUrl: paymentUrl || null,
             qrCode: nexgateOrder.qr_image || null,
             gatewayTxnId: nexgateOrder.order_id?.toString() || null,
             status: "PENDING"
           }
         });

         return { 
           ...updatedPayment,
           paymentUrl,
           payment_url: paymentUrl,
           qr_image: nexgateOrder.qr_image,
           success: true,
           status: "PENDING",
           orderId: payment.id,
           provider: "NEXGATE"
         };
      } else {
         const errorMsg = nexgateOrder.message || "Gateway failed to return payment links";
         console.warn(`[PAYMENT SERVICE] ${errorMsg}`);
         
         await prisma.payment.update({
           where: { id: payment.id },
           data: { errorMessage: errorMsg, status: "FAILED" }
         });

         return {
           success: false,
           message: errorMsg,
           gatewayError: nexgateOrder.gatewayError || "GATEWAY_FAILURE"
         };
      }
    } catch (gatewayErr) {
      console.error("[PAYMENT SERVICE] Gateway Error:", gatewayErr.message);
      
      const isTimeout = gatewayErr.code === "ETIMEDOUT" || 
                        gatewayErr.message?.toLowerCase().includes("timeout") ||
                        gatewayErr.message?.toLowerCase().includes("network error") ||
                        gatewayErr.message?.toLowerCase().includes("connreset") ||
                        gatewayErr.message?.toLowerCase().includes("socket hang up");

      if (isTimeout) {
        const updatedPayment = await prisma.payment.update({
          where: { id: payment.id },
          data: { errorMessage: gatewayErr.message, status: "PROCESSING" }
        }).catch(e => console.error("Critical: Failed to update error status", e.message));

        eventBus.emit("payment_processing", {
          userId: Number(userId),
          paymentId: payment.id,
          status: "PROCESSING"
        });

        const existingJobs = await paymentQueue.getJobs(["delayed", "waiting", "active"]);
        const alreadyEnqueued = existingJobs.some(
          (j) => j.data?.paymentId === payment.id && j.name === "verifyNexgateStatus"
        );

        if (!alreadyEnqueued) {
          await paymentQueue.add(
            "verifyNexgateStatus",
            { paymentId: payment.id, attempt: 1 },
            { delay: 15000, removeOnComplete: true }
          );
        }

        return {
          ...updatedPayment,
          success: true,
          status: "PROCESSING",
          isTimeout: true,
          message: "Payment is being verified"
        };
      }
      
      await prisma.payment.update({
        where: { id: payment.id },
        data: { errorMessage: gatewayErr.message, status: "FAILED" }
      }).catch(e => console.error("Critical: Failed to update error status", e.message));

      throw gatewayErr;
    }
  } catch (error) {
    console.error("[PAYMENT SERVICE] Order Creation Failure:", error.message);
    throw error;
  }
};

/**
 * Unified payment settlement service for successful payments.
 * Shared by both the Webhook and Status Poll Reconciliation flows.
 */
export const processSuccessfulPayment = async ({
  paymentId,
  gatewayTxnId,
  gatewayAmount,
  rawPayload,
  correlationId,
  ipAddress,
  adminId,
  req = null
}) => {
  console.log(`[PAYMENT_SETTLEMENT] Initiating settlement for Payment: ${paymentId} | Txn: ${gatewayTxnId}`);

  let createdTx = null;
  let ledgerDesc = null;
  let balanceBefore = null;
  let balanceAfter = null;
  let isAdminFunding = false;

  const result = await prisma.$transaction(async (tx) => {
    // Fetch and lock payment record
    const payments = await tx.$queryRaw`SELECT * FROM payment WHERE id = ${paymentId} FOR UPDATE`;
    if (!payments || payments.length === 0) throw new Error(`Payment ${paymentId} not found`);
    const payment = payments[0];

    // Idempotency: If already success or failed, stop
    if (["SUCCESS", "FAILED", "REFUNDED"].includes(payment.status)) {
      return { alreadyProcessed: true, payment };
    }

    // Amount integrity check
    if (gatewayAmount !== null && Math.abs(gatewayAmount - Number(payment.amount)) > 0.01) {
      // Amount tampered! Fail payment record.
      const tamperedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", errorMessage: "Amount mismatch detected", webhookReceived: true }
      });
      return { alreadyProcessed: false, payment: tamperedPayment, securityAlert: true };
    }

    const idempotencyKey = `topup:${payment.id}`;
    const canClaim = await claimIdempotencyKey(idempotencyKey, rawPayload, tx);
    if (!canClaim) {
      return { alreadyProcessed: true, payment };
    }

    const wallets = await tx.$queryRaw`SELECT * FROM wallet WHERE userId = ${payment.userId} FOR UPDATE`;
    if (!wallets || wallets.length === 0) throw new Error(`Wallet not found for user ${payment.userId}`);
    const wallet = wallets[0];
    balanceBefore = wallet.balance;

    // Step 2 — Master Key Validation
    const isMasterValid = await validateMasterKeyAndRoutes(tx);
    if (!isMasterValid) {
      await tx.pendingWalletCredit.create({
        data: {
          userId: payment.userId,
          paymentId: payment.id,
          amount: payment.amount,
          settlementStatus: "FAILED",
          remarks: "Master Key validation failed or provider route unavailable"
        }
      });

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCESS",
          gatewayTxnId: gatewayTxnId,
          errorMessage: "Settlement validation failed",
          webhookReceived: true
        }
      });

      await notifyAdmins(
        "MASTER KEY FAILURE",
        `Master Key/Route validation check failed for User #${payment.userId} top-up payment #${payment.id}.`,
        "MASTER_KEY_FAILURE",
        tx
      );

      return {
        alreadyProcessed: false,
        payment: updatedPayment,
        settlementFailed: true
      };
    }

    // Step 3 — Admin Wallet Balance Check
    const adminStats = await getAdminWalletStats(tx);
    const amountNum = Number(payment.amount);

    if (adminStats.availableBalance < amountNum) {
      await tx.pendingWalletCredit.create({
        data: {
          userId: payment.userId,
          paymentId: payment.id,
          amount: payment.amount,
          settlementStatus: "PENDING",
          remarks: "Insufficient Admin Wallet Balance"
        }
      });

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCESS",
          gatewayTxnId: gatewayTxnId,
          errorMessage: "Insufficient admin wallet balance. Pending approval.",
          webhookReceived: true
        }
      });

      await notifyAdmins(
        "LOW WALLET BALANCE",
        `Insufficient Admin Wallet Balance to auto-settle user top-up of ₹${amountNum}.`,
        "LOW_WALLET_BALANCE",
        tx
      );

      await tx.notification.create({
        data: {
          userId: payment.userId,
          title: "Wallet Credit Pending",
          message: `Payment of ₹${amountNum} received successfully. Your wallet credit is pending administrative approval.`,
          type: "WALLET_CREDIT_PENDING"
        }
      });

      return {
        alreadyProcessed: false,
        payment: updatedPayment,
        settlementPending: true
      };
    }

    // Scenario A — Sufficient Balance
    await updateAdminWalletBalance({
      amount: -amountNum,
      type: "SETTLEMENT_DEBIT",
      description: `Auto-settlement debit for User #${payment.userId} top-up payment`,
      referenceId: String(payment.id),
      metadata: { paymentId: payment.id },
      tx
    });

    await tx.pendingWalletCredit.create({
      data: {
        userId: payment.userId,
        paymentId: payment.id,
        amount: payment.amount,
        settlementStatus: "APPROVED",
        remarks: "Auto-approved",
        approvedAt: new Date()
      }
    });

    if (payment.intent === "IMART") {
      const balanceAfterCredit = new Prisma.Decimal(balanceBefore).plus(new Prisma.Decimal(payment.amount));
      balanceAfter = balanceBefore;

      await tx.wallet.update({
        where: { userId: payment.userId },
        data: { balance: { increment: Number(payment.amount) } }
      });

      await tx.wallet.update({
        where: { userId: payment.userId },
        data: { balance: { decrement: Number(payment.amount) } }
      });

      await recordFinancialEntry({
        userId: payment.userId,
        amount: payment.amount,
        type: 'TOPUP_CREDIT',
        transactionId: null,
        description: `iMart Topup credit | Order: ${payment.id}`,
        context: { correlationId, ipAddress },
        tx,
        skipWalletUpdate: true,
        overrideBalanceBefore: balanceBefore,
        overrideBalanceAfter: balanceAfterCredit
      });

      await recordFinancialEntry({
        userId: payment.userId,
        amount: payment.amount.negated(),
        type: 'IMART_DEBIT',
        transactionId: null,
        description: `iMart Purchase debit | Order: ${payment.id}`,
        context: { correlationId, ipAddress },
        tx,
        skipWalletUpdate: true,
        overrideBalanceBefore: balanceAfterCredit,
        overrideBalanceAfter: balanceBefore
      });

      await tx.transaction.create({
        data: {
          userId: payment.userId,
          amount: payment.amount,
          type: "TOPUP",
          status: "SUCCESS",
          direction: "CREDIT",
          gatewayTxnId: gatewayTxnId,
          balanceAfter: balanceAfterCredit,
          description: `iMart payment credit | Order: ${payment.id}`,
          idempotencyKey: `topup:${payment.id}`,
          financialSequenceId: correlationId + "_credit"
        }
      });

      await tx.transaction.create({
        data: {
          userId: payment.userId,
          amount: payment.amount,
          type: "IMART_BUY",
          status: "SUCCESS",
          direction: "DEBIT",
          gatewayTxnId: gatewayTxnId,
          balanceAfter: balanceBefore,
          description: `iMart purchase debit | Order: ${payment.id}`,
          idempotencyKey: `imart:${payment.id}`,
          financialSequenceId: correlationId + "_debit"
        }
      });

      const order = await tx.order.findUnique({
        where: { paymentId: payment.id },
        include: { items: true }
      });

      if (order) {
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: "PAID", status: "PROCESSING" }
        });

        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } }
          });
        }

        // Delete wishlist items for the customer
        await tx.wishlistItem.deleteMany({
          where: {
            wishlist: { userId: order.userId }
          }
        });
      }
    } else {
      balanceAfter = new Prisma.Decimal(balanceBefore).plus(new Prisma.Decimal(payment.amount));
      isAdminFunding = payment.idempotencyKey && payment.idempotencyKey.startsWith("admin_funding:");
      ledgerDesc = `Wallet topup | Order: ${payment.id}`;
      let txDesc = `Wallet topup | Order: ${payment.id} | Before: ${balanceBefore}`;

      if (isAdminFunding) {
        try {
          const parts = payment.idempotencyKey.split(":");
          const reasonPart = parts[2]?.split("=")[1];
          if (reasonPart) {
            ledgerDesc = decodeURIComponent(reasonPart);
            txDesc = `${ledgerDesc} | Before: ${balanceBefore}`;
          } else {
            ledgerDesc = `Admin Wallet Funding | Order: ${payment.id}`;
            txDesc = `Admin Wallet Funding | Order: ${payment.id} | Before: ${balanceBefore}`;
          }
        } catch (e) {
          console.error("Failed to parse admin funding key in settlement service:", e);
        }
      }

      // Update wallet balance
      await tx.wallet.update({
        where: { userId: payment.userId },
        data: { balance: { increment: Number(payment.amount) } }
      });

      // Create Ledger Entry
      await recordFinancialEntry({
        userId: payment.userId,
        amount: payment.amount,
        type: 'TOPUP_CREDIT',
        transactionId: null,
        description: ledgerDesc,
        context: { correlationId, ipAddress },
        tx,
        skipWalletUpdate: true,
        overrideBalanceBefore: balanceBefore,
        overrideBalanceAfter: balanceAfter
      });

      // Create Transaction
      createdTx = await tx.transaction.create({
        data: {
          userId: payment.userId,
          amount: payment.amount,
          type: "TOPUP",
          status: "SUCCESS",
          direction: "CREDIT",
          gatewayTxnId: gatewayTxnId,
          balanceAfter: balanceAfter,
          description: txDesc,
          idempotencyKey,
          financialSequenceId: correlationId
        }
      });
    }

    // Mark payment success
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESS",
        gatewayTxnId: gatewayTxnId,
        errorMessage: null,
        webhookReceived: true
      }
    });

    return {
      alreadyProcessed: false,
      payment: updatedPayment,
      balanceBefore,
      balanceAfter,
      createdTx,
      isAdminFunding,
      ledgerDesc
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });

  if (!result.alreadyProcessed && !result.securityAlert && result.payment.status === "SUCCESS" && !result.settlementPending && !result.settlementFailed) {
    // Emit socket events
    try {
      const updatedWallet = await prisma.wallet.findUnique({
        where: { userId: result.payment.userId }
      });

      eventBus.emit("wallet_updated", {
        userId: result.payment.userId,
        amount: result.payment.amount,
        balance: updatedWallet ? updatedWallet.balance : undefined
      });

      if (result.createdTx) {
        eventBus.emit("transaction_updated", {
          userId: result.payment.userId,
          txnId: result.createdTx.id,
          status: "SUCCESS",
          transaction: result.createdTx,
          correlationId
        });
      }
    } catch (socketErr) {
      console.warn("[PAYMENT_SETTLEMENT] Realtime event emit failed:", socketErr.message);
    }

    // Operational Audit Log for Admin Funding
    if (result.isAdminFunding && adminId) {
      try {
        const { logAction } = await import("./auditService.js");
        await logAction({
          action: "WALLET_ADJUSTMENT",
          adminId,
          userId: result.payment.userId,
          entity: "WALLET",
          entityId: result.payment.id,
          details: { amount: result.payment.amount, description: result.ledgerDesc, paymentId: result.payment.id },
          req
        });
      } catch (auditErr) {
        console.error("Failed to write audit action in settlement service:", auditErr);
      }
    }
  }

  return result;
};
