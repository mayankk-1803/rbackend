import { createPaymentOrder } from "../services/paymentService.js";
import prisma from "../config/prisma.js";
import eventBus from "../config/eventBus.js";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { recordFinancialEntry } from "../services/ledgerService.js";
import { claimIdempotencyKey } from "../utils/idempotency.js";
import { redisClient } from "../config/redis.js";
import { acquireLock, releaseLock } from "../utils/redisLock.js";
import { pushToDLQ } from "../services/dlqService.js";

export const createOrder = async (req, res) => {
  try {
    console.log("CREATE ORDER INPUT:", req.body);
    console.log("USER:", req.user);

    let { amount, upiId, intent } = req.body;
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "USER_NOT_AUTHENTICATED" });
    }
    
    const userId = req.user.id;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    // Normalize intent
    intent = intent === "RECHARGE" ? "RECHARGE" : "TOPUP";

    const idempotencyKey = req.headers["x-idempotency-key"];
    if (!idempotencyKey) {
      return res.status(400).json({ success: false, message: "x-idempotency-key header is required" });
    }

    const payment = await createPaymentOrder(userId, Number(amount), idempotencyKey, upiId, intent);

    return res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error("[CRITICAL] PAYMENT ERROR FULL:", error);
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { paymentId } = req.body;
    const userId = req.user.id;

    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(paymentId) }
    });

    if (!payment || payment.userId !== userId) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const confirmPayment = async (req, res) => {
  try {
    const { paymentId } = req.body;
    const userId = req.user.id;

    console.log(`[Payment] Confirming payment order: ${paymentId} for user: ${userId}`);

    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(paymentId) }
    });

    if (!payment || payment.userId !== userId) {
      console.error(`[Payment] Order not found: ${paymentId}`);
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    const expectedSecret = process.env.WEBHOOK_SECRET || "internal_secret";
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const payload = {
      paymentId: payment.id,
      status: "SUCCESS",
      gatewayTxnId: `MOCK_TXN_${Date.now()}`,
      errorMessage: ""
    };
    
    const payloadString = timestamp + "." + nonce + "." + JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", expectedSecret).update(payloadString).digest("hex");

    const webhookReq = {
      headers: { 
        "x-webhook-signature": signature,
        "x-webhook-timestamp": timestamp,
        "x-webhook-nonce": nonce
      },
      body: payload
    };

    const webhookRes = {
      json: (data) => {
        console.log(`[Payment] Confirmation response for ${paymentId}: success=${data.success}`);
        return res.json(data);
      },
      status: (code) => ({
        json: (data) => {
          console.log(`[Payment] Confirmation error for ${paymentId}: code=${code}, message=${data.message}`);
          return res.status(code).json(data);
        }
      })
    };

    return await paymentWebhook(webhookReq, webhookRes);
  } catch (error) {
    console.error("[ConfirmPayment Error]:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    console.log(`[PaymentStatus] Checking status for Order ${orderId} | User ${userId}`);

    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(orderId) },
      include: {
        user: {
          select: {
            wallet: true
          }
        }
      }
    });

    if (!payment || payment.userId !== userId) {
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }

    // Force no-store for real-time accuracy
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    res.json({
      success: true,
      payload: {
        status: payment.status,
        amount: payment.amount,
        intent: payment.intent,
        gatewayTxnId: payment.gatewayTxnId,
        webhookReceived: payment.webhookReceived,
        walletBalance: payment.user.wallet?.balance,
        updatedAt: payment.updatedAt
      }
    });
  } catch (error) {
    console.error("[PaymentStatus Error]:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const paymentWebhook = async (req, res) => {
  let lockToken = null;
  const correlationId = crypto.randomBytes(8).toString('hex');
  const body = req.body;

  try {
    console.log(`[WEBHOOK][${correlationId}] RECEIVED:`, JSON.stringify(body));

    // Webhook Security Validation
    const incomingSignature = req.headers["x-webhook-signature"];
    const incomingTimestamp = req.headers["x-webhook-timestamp"];
    const incomingNonce = req.headers["x-webhook-nonce"];
    const expectedSecret = process.env.WEBHOOK_SECRET || "internal_secret";

    if (!incomingSignature || !incomingTimestamp || !incomingNonce) {
      console.warn(`[WEBHOOK][${correlationId}] REJECTED: Missing security headers.`);
      return res.status(401).json({ success: false, message: "Missing security headers" });
    }

    // Timestamp Freshness Validation (5 minutes = 300000ms)
    const now = Date.now();
    const timestampMs = Number(incomingTimestamp);
    if (isNaN(timestampMs)) {
      return res.status(400).json({ success: false, message: "Invalid timestamp format" });
    }
    if (now - timestampMs > 300000) {
      console.warn(`[WEBHOOK][${correlationId}] REJECTED: Timestamp expired.`);
      return res.status(400).json({ success: false, message: "Webhook timestamp expired" });
    }
    if (timestampMs - now > 5000) { // 5s tolerance for clock drift
      console.warn(`[WEBHOOK][${correlationId}] REJECTED: Timestamp in future.`);
      return res.status(400).json({ success: false, message: "Webhook timestamp in future" });
    }

    // HMAC Signature Validation
    const payloadString = incomingTimestamp + "." + incomingNonce + "." + JSON.stringify(body);
    const expectedHmac = crypto.createHmac("sha256", expectedSecret).update(payloadString).digest("hex");
    if (incomingSignature !== expectedHmac) {
      console.warn(`[WEBHOOK][${correlationId}] REJECTED: Invalid HMAC signature.`);
      return res.status(401).json({ success: false, message: "Invalid HMAC signature" });
    }

    // Nonce Replay Protection
    const nonceKey = `nonce:${incomingNonce}`;
    const nonceClaimed = await redisClient.set(nonceKey, "1", "NX", "EX", 300); // 5 min TTL
    if (!nonceClaimed) {
      console.warn(`[WEBHOOK][${correlationId}] REJECTED: Duplicate webhook nonce.`);
      return res.status(429).json({ success: false, message: "Duplicate webhook nonce" });
    }

    // NexGate uses order_id for our payment ID
    const rawPaymentId = body.order_id || body.paymentId;
    const status = (body.status || "").toUpperCase();
    const gatewayTxnId = (body.transaction_id || body.txn_id || body.gatewayTxnId || "").toString();
    const gatewayAmount = body.amount ? parseFloat(body.amount) : null;
    const errorMessage = body.message || body.errorMessage || "";

    if (!rawPaymentId) {
      console.error(`[WEBHOOK][${correlationId}] ERROR: Missing order_id/paymentId`);
      return res.status(400).json({ success: false, message: "Missing identifier" });
    }

    const paymentId = parseInt(rawPaymentId);

    // Acquire lock to prevent race conditions during concurrent webhook callbacks
    lockToken = await acquireLock(`payment_webhook:${paymentId}`, 15000);
    if (!lockToken) {
      console.warn(`[WEBHOOK][${correlationId}] Could not acquire lock for payment ${paymentId}. Concurrency blocked.`);
      return res.status(429).json({ success: false, message: "Concurrent webhook processing" });
    }

    // Atomic Transaction with Serializable Isolation for maximum consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch and Lock payment record
      const payments = await tx.$queryRaw`SELECT * FROM payment WHERE id = ${paymentId} FOR UPDATE`;
      if (!payments || payments.length === 0) throw new Error(`Payment ${paymentId} not found`);
      const payment = payments[0];

      if (!payment) throw new Error(`Payment ${paymentId} not found`);
      
      // 2. Strict Idempotency: If already success or failed, stop (Replay Protection)
      if (payment.status !== "PENDING") {
        console.log(`[WEBHOOK][${correlationId}] ALREADY PROCESSED: Status=${payment.status}`);
        return { alreadyProcessed: true, payment };
      }

      // 3. Security Checks: Amount Integrity
      if (gatewayAmount !== null && Math.abs(gatewayAmount - Number(payment.amount)) > 0.01) {
        console.error(`[WEBHOOK][${correlationId}] SECURITY ALERT: Amount mismatch! Gateway=${gatewayAmount}, DB=${payment.amount}`);
        // We mark as failed if amount is tampered
        const tamperedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED", errorMessage: "Amount mismatch detected", webhookReceived: true }
        });
        return { alreadyProcessed: false, payment: tamperedPayment, securityAlert: true };
      }

      const isSuccess = status === "SUCCESS" || status === "PAID" || status === "COMPLETED";
      
      // 4. Update payment status
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: isSuccess ? "SUCCESS" : "FAILED",
          gatewayTxnId: gatewayTxnId,
          errorMessage: isSuccess ? null : errorMessage,
          webhookReceived: true
        }
      });

      if (isSuccess) {
        // Claim global idempotency key: topup:{paymentId}
        const idempotencyKey = `topup:${payment.id}`;
        // Use new idempotency hash format
        const canClaim = await claimIdempotencyKey(idempotencyKey, body, tx);
        if (!canClaim) {
          console.log(`[WEBHOOK][${correlationId}] Topup key ${idempotencyKey} already claimed.`);
          return { alreadyProcessed: true, payment };
        }

        // 5. Credit Wallet Atomically & Create Immutable Ledger using recordFinancialEntry
        // REMOVED direct tx.wallet.update to ensure ledger/wallet balance consistency
        const resWallet = await recordFinancialEntry({
          userId: payment.userId,
          amount: payment.amount,
          type: 'TOPUP_CREDIT',
          transactionId: null,
          description: `Wallet topup | Order: ${payment.id}`,
          context: { correlationId, ipAddress: req.ip },
          tx
        });

        // 6. Detailed Transaction Record
        await tx.transaction.create({
          data: {
            userId: payment.userId,
            amount: payment.amount,
            type: "TOPUP",
            status: "SUCCESS",
            direction: "CREDIT",
            gatewayTxnId: gatewayTxnId,
            balanceAfter: resWallet.balanceAfter,
            description: `Wallet topup | Order: ${payment.id} | Before: ${resWallet.balanceBefore}`,
            idempotencyKey,
            financialSequenceId: correlationId
          }
        });

        console.log(`[WEBHOOK][${correlationId}] SUCCESS: Credited ₹${payment.amount} to User ${payment.userId}`);
      } else {
        console.warn(`[WEBHOOK][${correlationId}] FAILED: Status=${status} | Msg=${errorMessage}`);
      }

      return { alreadyProcessed: false, payment: updatedPayment };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    // 7. Real-time Synchronization (Post-Commit)
    if (!result.alreadyProcessed && result.payment.status === "SUCCESS") {
      console.log(`[WEBHOOK] Payment verified | Order: ${result.payment.id}`);
      console.log(`[WEBHOOK] Wallet credited | User: ${result.payment.userId}`);
      console.log(`[WEBHOOK] Payment SUCCESS | Correlation: ${correlationId}`);
      eventBus.emit("wallet_updated", { userId: result.payment.userId, amount: result.payment.amount });
    }

    return res.json({ success: true, message: "Webhook processed successfully", correlationId });
  } catch (error) {
    console.error(`[WEBHOOK] EXCEPTION:`, error);
    await pushToDLQ("PAYMENT_WEBHOOK_FAILURE", body, error);
    return res.status(500).json({ success: false, message: "Internal server error during webhook processing" });
  } finally {
    if (lockToken) {
      await releaseLock(`payment_webhook:${parseInt(rawPaymentId || 0)}`, lockToken);
    }
  }
};
