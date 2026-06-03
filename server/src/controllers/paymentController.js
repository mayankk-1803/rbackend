import { createPaymentOrder, processSuccessfulPayment } from "../services/paymentService.js";
import { verifyPayment as verifyNextgatePayment } from "../services/payments/nextgate/verifyPayment.js";
import { structuredLog, structuredAlert } from "../utils/logger.js";
import {
  recordWebhookSuccess,
  recordWebhookFailure,
  recordWebhookDuplicate,
  recordRedisFallback,
  recordSocketEmit,
  recordFailedLedgerWrite,
  recordFailedAuditWrite,
  recordPaymentVerificationLatency
} from "../services/webhookMonitoringService.js";
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
    intent = intent === "RECHARGE" ? "RECHARGE" : intent === "IMART" ? "IMART" : "TOPUP";

    const idempotencyKey = req.headers["x-idempotency-key"];
    if (!idempotencyKey) {
      return res.status(400).json({ success: false, message: "x-idempotency-key header is required" });
    }

    const payment = await createPaymentOrder(userId, Number(amount), idempotencyKey, upiId, intent);

    const rawUrl = payment.paymentUrl || payment.payment_url || payment.redirect_url || payment.checkout_url || payment.gatewayUrl;

    return res.json({
      success: true,
      paymentUrl: rawUrl,
      payment_url: rawUrl, // keep backward compatible
      status: payment.status,
      orderId: payment.id || payment.orderId,
      data: {
        ...payment,
        paymentUrl: rawUrl,
        payment_url: rawUrl,
        id: payment.id || payment.orderId
      }
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

    const finalPaymentId = paymentId || req.params.id || req.query.id || req.query.order_id;

    if (!finalPaymentId || finalPaymentId === "undefined") {
      console.warn(`[PAYMENT_STATUS_QUERY_BLOCKED] Missing payment ID in verifyPayment`);
      return res.status(400).json({ success: false, message: "Payment ID is required" });
    }

    const parsedId = Number(finalPaymentId);
    if (Number.isNaN(parsedId)) {
      console.warn(`[PAYMENT_STATUS_INVALID_ID] Invalid payment ID in verifyPayment: ${finalPaymentId}`);
      return res.status(400).json({ success: false, message: "Invalid payment ID" });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: parsedId }
    });

    if (!payment || payment.userId !== userId) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    console.error("[VerifyPayment Error]:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const confirmPayment = async (req, res) => {
  try {
    const { paymentId } = req.body;
    const userId = req.user.id;

    console.log(`[Payment] Confirming payment order: ${paymentId} for user: ${userId}`);

    const finalPaymentId = paymentId || req.params.id || req.query.id || req.query.order_id;

    if (!finalPaymentId || finalPaymentId === "undefined") {
      console.warn(`[PAYMENT_STATUS_QUERY_BLOCKED] Missing payment ID in confirmPayment`);
      return res.status(400).json({ success: false, message: "Payment ID is required" });
    }

    const parsedId = Number(finalPaymentId);
    if (Number.isNaN(parsedId)) {
      console.warn(`[PAYMENT_STATUS_INVALID_ID] Invalid payment ID in confirmPayment: ${finalPaymentId}`);
      return res.status(400).json({ success: false, message: "Invalid payment ID" });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: parsedId }
    });

    if (!payment || payment.userId !== userId) {
      console.error(`[Payment] Order not found: ${parsedId}`);
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
  let lockToken = null;
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    console.log(`[PaymentStatus] Checking status for Order ${orderId} | User ${userId}`);

    const finalOrderId = orderId || req.params.id || req.query.id || req.query.order_id;

    if (!finalOrderId || finalOrderId === "undefined") {
      console.warn(`[PAYMENT_STATUS_QUERY_BLOCKED] Missing payment ID in getPaymentStatus`);
      return res.status(400).json({ success: false, message: "Payment ID is required" });
    }

    const parsedId = Number(finalOrderId);
    if (Number.isNaN(parsedId)) {
      console.warn(`[PAYMENT_STATUS_INVALID_ID] Invalid payment ID in getPaymentStatus: ${finalOrderId}`);
      return res.status(400).json({ success: false, message: "Invalid payment ID" });
    }

    let payment = await prisma.payment.findUnique({
      where: { id: parsedId },
      include: {
        user: {
          select: {
            wallet: true
          }
        }
      }
    });

    if (!payment || payment.userId !== userId) {
      return res.status(404).json({
        success: false,
        code: "PAYMENT_NOT_FOUND",
        message: "Payment record not found"
      });
    }

    // Safe Fallback Status Reconciliation (Only if status is currently PENDING)
    if (payment.status === "PENDING") {
      let correlationId = crypto.randomBytes(8).toString('hex');
      let adminId = null;
      if (payment.idempotencyKey) {
        const parts = payment.idempotencyKey.split(":");
        if (parts.length >= 4) {
          correlationId = parts[3]; // The UUID
        }
        const adminIdPart = parts[1]?.split("=")[1];
        adminId = adminIdPart ? Number(adminIdPart) : null;
      }

      structuredLog({
        eventType: "PAYMENT_RECONCILIATION_STARTED",
        correlationId,
        paymentId: parsedId,
        message: `Status polling reconciliation started for payment ${parsedId}`
      });

      try {
        const verifyRes = await verifyNextgatePayment(parsedId);
        console.log(`[PaymentStatus] NexGate verifyPayment result for ${parsedId}:`, JSON.stringify(verifyRes));

        if (verifyRes.success && (verifyRes.status === "SUCCESS" || verifyRes.status === "PAID")) {
          // Acquire distributed lock matching webhook processing
          lockToken = await acquireLock(`payment_webhook:${parsedId}`, 15000);
          if (!lockToken) {
            structuredLog({
              eventType: "PAYMENT_RECONCILIATION_SKIPPED",
              correlationId,
              paymentId: parsedId,
              message: `Reconciliation lock skipped: lock already held for payment ${parsedId}`
            });
          } else {
            try {
              const settlement = await processSuccessfulPayment({
                paymentId: parsedId,
                gatewayTxnId: verifyRes.gatewayTxnId || "",
                gatewayAmount: verifyRes.amount ? parseFloat(verifyRes.amount) : null,
                rawPayload: verifyRes.raw || {},
                correlationId,
                ipAddress: req.ip || "127.0.0.1",
                adminId
              });

              if (settlement.alreadyProcessed) {
                structuredLog({
                  eventType: "PAYMENT_RECONCILIATION_ALREADY_SETTLED",
                  correlationId,
                  paymentId: parsedId,
                  message: `Reconciliation skipped: Payment ${parsedId} already settled`
                });
              } else if (settlement.securityAlert) {
                structuredLog({
                  eventType: "PAYMENT_RECONCILIATION_AMOUNT_MISMATCH",
                  correlationId,
                  paymentId: parsedId,
                  message: `Reconciliation failed: Amount mismatch for payment ${parsedId}`
                });
              } else {
                structuredLog({
                  eventType: "PAYMENT_RECONCILIATION_SUCCESS",
                  correlationId,
                  paymentId: parsedId,
                  message: `Reconciliation completed successfully for payment ${parsedId}`
                });
              }
            } finally {
              await releaseLock(`payment_webhook:${parsedId}`, lockToken);
              lockToken = null;
            }
          }
        } else {
          structuredLog({
            eventType: "PAYMENT_RECONCILIATION_SKIPPED",
            correlationId,
            paymentId: parsedId,
            message: `Reconciliation skipped: NexGate status is not SUCCESS (status: ${verifyRes.status})`
          });
        }
      } catch (err) {
        console.error(`[PaymentStatus] NexGate verification/settlement error for order ${parsedId}:`, err);
      }

      // Re-fetch payment post-reconciliation to return fresh DB state
      payment = await prisma.payment.findUnique({
        where: { id: parsedId },
        include: {
          user: {
            select: {
              wallet: true
            }
          }
        }
      });
    }

    // Force no-store for real-time accuracy
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    res.json({
      success: true,
      status: payment.status || "PENDING",
      paymentStatus: payment.status || "PENDING",
      orderId: payment.id,
      amount: payment.amount,
      walletBalance: payment.user.wallet?.balance ?? 0,
      payload: {
        status: payment.status || "PENDING",
        amount: payment.amount,
        intent: payment.intent,
        gatewayTxnId: payment.gatewayTxnId,
        webhookReceived: payment.webhookReceived,
        walletBalance: payment.user.wallet?.balance ?? 0,
        updatedAt: payment.updatedAt
      }
    });
  } catch (error) {
    console.error("[PaymentStatus Error]:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    if (lockToken) {
      try {
        await releaseLock(`payment_webhook:${Number(req.params.orderId || 0)}`, lockToken);
      } catch (e) {}
    }
  }
};

export const paymentWebhook = async (req, res) => {
  const body = req?.body || {};
  const query = req?.query || {};
  const headers = req?.headers || {};
  let rawPaymentId = body?.order_id || body?.paymentId;
  const initialCorrelationId = crypto.randomBytes(8).toString('hex');
  const startWebhookTime = Date.now();

  // Return HTTP 200 immediately to avoid timeouts on the provider side
  try {
    res.status(200).json({ success: true, message: "Webhook received immediately" });
  } catch (err) {
    console.error("[Webhook Immediate Response Error]:", err.message);
  }

  const safeRes = {
    status: () => ({ json: () => {} }),
    json: () => {}
  };

  // Process the webhook logic asynchronously in the background
  (async (res) => {
    let lockToken = null;
    let correlationId = initialCorrelationId;
    let adminId = null;
    let targetUserId = null;
    let paymentRecord = null;

    // Try to pre-fetch payment to extract original correlationId UUID
    if (rawPaymentId) {
      try {
        paymentRecord = await prisma.payment.findUnique({
          where: { id: Number(rawPaymentId) }
        });
        if (paymentRecord) {
          targetUserId = paymentRecord.userId;
          if (paymentRecord.idempotencyKey) {
            const parts = paymentRecord.idempotencyKey.split(":");
            if (parts.length >= 4) {
              correlationId = parts[3]; // The UUID
            }
            const adminIdPart = parts[1]?.split("=")[1];
            adminId = adminIdPart ? Number(adminIdPart) : null;
          }
        }
      } catch (err) {
        console.warn(`[WEBHOOK] Pre-fetch error:`, err.message);
      }
    }

    const webhookSignature =
      headers['x-webhook-signature'] ||
      headers['X-Webhook-Signature'] ||
      headers['x-signature'] ||
      headers['signature'] ||
      body?.signature ||
      query?.signature ||
      null;

    const incomingTimestamp =
      headers['x-webhook-timestamp'] ||
      headers['X-Webhook-Timestamp'] ||
      headers['x-timestamp'] ||
      headers['timestamp'] ||
      body?.timestamp ||
      query?.timestamp ||
      null;

    const incomingNonce =
      headers['x-webhook-nonce'] ||
      headers['X-Webhook-Nonce'] ||
      headers['x-nonce'] ||
      headers['nonce'] ||
      body?.nonce ||
      query?.nonce ||
      null;

    const paymentId = Number(rawPaymentId);

    try {
      // 1. PAYMENT_WEBHOOK_RECEIPT log
      structuredLog({
        eventType: "PAYMENT_WEBHOOK_RECEIPT",
        correlationId,
        paymentId,
        adminId,
        targetUserId,
        message: `Received webhook callback for payment ${paymentId || 'unknown'}. Status: ${body?.status}`,
        metadata: { headers, body }
      });

      if (Number.isNaN(paymentId)) {
        structuredAlert({
          level: "error",
          eventType: "PAYMENT_STATUS_INVALID_ID",
          correlationId,
          message: `Invalid payment ID format in webhook: ${rawPaymentId}`
        });
        recordWebhookFailure();
        return res.status(400).json({ success: false, message: "Invalid payment ID" });
      }

      // 2. Safe Optional Validation
      const expectedSecret = process.env.WEBHOOK_SECRET || "internal_secret";
      if (webhookSignature) {
        if (!incomingTimestamp || !incomingNonce) {
          structuredAlert({
            level: "error",
            eventType: "WEBHOOK_UNAUTHORIZED",
            correlationId,
            paymentId,
            adminId,
            targetUserId,
            message: `Webhook validation failed: missing timestamp or nonce with signature.`
          });
          recordWebhookFailure();
          return res.status(400).json({ success: false, message: "Missing timestamp or nonce for signature validation" });
        }

        const now = Date.now();
        const timestampMs = Number(incomingTimestamp);
        if (isNaN(timestampMs)) {
          recordWebhookFailure();
          return res.status(400).json({ success: false, message: "Invalid timestamp format" });
        }
        if (now - timestampMs > 300000) {
          structuredAlert({
            level: "error",
            eventType: "WEBHOOK_UNAUTHORIZED",
            correlationId,
            paymentId,
            adminId,
            targetUserId,
            message: `Webhook validation failed: timestamp expired.`
          });
          recordWebhookFailure();
          return res.status(400).json({ success: false, message: "Webhook timestamp expired" });
        }
        if (timestampMs - now > 5000) {
          structuredAlert({
            level: "error",
            eventType: "WEBHOOK_UNAUTHORIZED",
            correlationId,
            paymentId,
            adminId,
            targetUserId,
            message: `Webhook validation failed: timestamp in future.`
          });
          recordWebhookFailure();
          return res.status(400).json({ success: false, message: "Webhook timestamp in future" });
        }

        const payloadString = incomingTimestamp + "." + incomingNonce + "." + JSON.stringify(body);
        const expectedHmac = crypto.createHmac("sha256", expectedSecret).update(payloadString).digest("hex");
        if (webhookSignature !== expectedHmac) {
          structuredAlert({
            level: "error",
            eventType: "WEBHOOK_UNAUTHORIZED",
            correlationId,
            paymentId,
            adminId,
            targetUserId,
            message: `Webhook validation failed: invalid HMAC signature.`
          });
          recordWebhookFailure();
          return res.status(401).json({ success: false, message: "Invalid HMAC signature" });
        }

        // Nonce Replay Protection
        let nonceClaimed = true;
        try {
          if (redisClient.status === "ready") {
            const nonceKey = `nonce:${incomingNonce}`;
            const claim = await redisClient.set(nonceKey, "1", "NX", "EX", 300);
            if (claim === null || claim === 0 || !claim) {
              nonceClaimed = false;
            }
          }
        } catch (redisErr) {
          console.warn(`[WEBHOOK][${correlationId}] Redis connection offline for replay check:`, redisErr.message);
        }
        if (!nonceClaimed) {
          structuredAlert({
            level: "error",
            eventType: "DUPLICATE_NONCE_REPLAY",
            correlationId,
            paymentId,
            adminId,
            targetUserId,
            message: `Webhook rejected: Duplicate nonce detected (${incomingNonce})`
          });
          recordWebhookFailure();
          return res.status(429).json({ success: false, message: "Duplicate webhook nonce" });
        }
      } else {
        const incomingSecret = headers['x-webhook-secret'] || headers['X-Webhook-Secret'] || body?.secret || query?.secret || null;
        if (incomingSecret !== expectedSecret) {
          structuredAlert({
            level: "error",
            eventType: "WEBHOOK_UNAUTHORIZED",
            correlationId,
            paymentId,
            adminId,
            targetUserId,
            message: `Webhook validation failed: missing signature and invalid webhook secret.`
          });
          recordWebhookFailure();
          return res.status(401).json({ success: false, message: "Unauthorized: Invalid signature or webhook secret" });
        }
        structuredLog({
          eventType: "PAYMENT_WEBHOOK_SECRET_AUTHORIZED",
          correlationId,
          paymentId,
          adminId,
          targetUserId,
          message: `Webhook authorized internally via x-webhook-secret token.`
        });
      }

      // Status Normalization
      const status = body?.status;
      const rawStatus = status || "";
      const normalizedStatus = String(rawStatus).trim().toUpperCase();

      let mappedStatus = "PENDING";
      if (["SUCCESS", "SUCCESSFUL", "PAID", "1"].includes(normalizedStatus)) {
        mappedStatus = "SUCCESS";
      } else if (["FAILED", "FAILURE", "ERROR", "0"].includes(normalizedStatus)) {
        mappedStatus = "FAILED";
      } else if (["PENDING", "PROCESSING", "INITIATED", "HOLD", "2"].includes(normalizedStatus)) {
        mappedStatus = "PENDING";
      }

      const gatewayTxnId = (body?.transaction_id || body?.txn_id || body?.gatewayTxnId || "").toString();
      const gatewayAmount = body?.amount ? parseFloat(body.amount) : null;
      const errorMessage = body?.message || body?.errorMessage || "";

      // Acquire lock
      lockToken = await acquireLock(`payment_webhook:${paymentId}`, 15000);
      if (!lockToken) {
        structuredAlert({
          level: "warn",
          eventType: "CONCURRENT_LOCK_BLOCKED",
          correlationId,
          paymentId,
          adminId,
          targetUserId,
          message: `Could not acquire lock for payment ${paymentId}. Concurrency blocked.`
        });
        return res.status(429).json({ success: false, message: "Concurrent webhook processing" });
      }

      if (lockToken.startsWith("dummy_fallback_lock_")) {
        recordRedisFallback();
        structuredAlert({
          eventType: "REDIS_LOCK_FALLBACK_ACTIVE",
          correlationId,
          paymentId,
          adminId,
          targetUserId,
          message: `Redis is offline. Bypassing lock using DB isolation fallback for payment_webhook:${paymentId}`
        });
      }

      let result;
      try {
        if (mappedStatus === "SUCCESS") {
          result = await processSuccessfulPayment({
            paymentId,
            gatewayTxnId,
            gatewayAmount,
            rawPayload: body,
            correlationId,
            ipAddress: req.ip || "127.0.0.1",
            adminId,
            req
          });
        } else {
          result = await prisma.$transaction(async (tx) => {
            // Fetch and lock payment record
            const payments = await tx.$queryRaw`SELECT * FROM payment WHERE id = ${paymentId} FOR UPDATE`;
            if (!payments || payments.length === 0) throw new Error(`Payment ${paymentId} not found`);
            const payment = payments[0];

            // Idempotency: If already success or failed, stop
            if (["SUCCESS", "FAILED", "REFUNDED"].includes(payment.status)) {
              return { alreadyProcessed: true, payment };
            }

            if (mappedStatus === "PENDING") {
              return { alreadyProcessed: false, payment, isPending: true };
            }

            if (payment.intent === "IMART") {
              const order = await tx.order.findUnique({
                where: { paymentId: payment.id }
              });
              if (order) {
                await tx.order.update({
                  where: { id: order.id },
                  data: { paymentStatus: "FAILED", status: "CANCELLED" }
                });
              }
            }

            // Mark payment failed
            const updatedPayment = await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: "FAILED",
                gatewayTxnId: gatewayTxnId,
                errorMessage: errorMessage,
                webhookReceived: true
              }
            });

            return { alreadyProcessed: false, payment: updatedPayment };
          }, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable
          });
        }
      } catch (err) {
        structuredAlert({
          level: "error",
          eventType: "PAYMENT_RECONCILIATION_FAILED",
          correlationId,
          paymentId,
          adminId,
          targetUserId,
          message: `Database finalization transaction failed: ${err.message}`,
          metadata: { error: err.stack }
        });
        throw err;
      }

      if (result.alreadyProcessed) {
        structuredLog({
          eventType: "PAYMENT_WEBHOOK_DUPLICATE_SKIP",
          correlationId,
          paymentId,
          adminId,
          targetUserId,
          message: `Webhook finalization skipped: Payment ${paymentId} is already finalized.`,
          metadata: { status: result.payment.status }
        });
        recordWebhookDuplicate();
        return res.json({ success: true, message: "Duplicate webhook processed", correlationId });
      }

      if (result.securityAlert) {
        structuredAlert({
          level: "error",
          eventType: "PAYMENT_AMOUNT_MISMATCH",
          correlationId,
          paymentId,
          adminId,
          targetUserId,
          message: `SECURITY ALERT: Webhook amount mismatch! Gateway Amount: ${gatewayAmount}, Expected Amount: ${result.payment.amount}`
        });
        recordWebhookFailure();
        return res.json({ success: true, message: "Security alert: amount mismatch", correlationId });
      }

      if (result.payment.status === "SUCCESS") {
        recordWebhookSuccess(Date.now() - startWebhookTime);

        // Logging Ledger and Wallet Mutation details
        structuredLog({
          eventType: "WALLET_MUTATION_SUCCESS",
          correlationId,
          paymentId,
          adminId,
          targetUserId,
          message: `Wallet atomically credited. Before: ${result.balanceBefore}, After: ${result.balanceAfter}`
        });

        structuredLog({
          eventType: "LEDGER_RECONCILIATION_SUCCESS",
          correlationId,
          paymentId,
          adminId,
          targetUserId,
          message: `Ledger entry created successfully. Description: "${result.ledgerDesc || 'Wallet Topup'}"`
        });

        recordSocketEmit(true);
        structuredLog({
          eventType: "TELEMETRY_EVENT_EMITTED",
          correlationId,
          paymentId,
          adminId,
          targetUserId,
          message: `Emitted realtime telemetry updates for payment success.`
        });
      } else {
        structuredLog({
          eventType: "PAYMENT_WEBHOOK_FINALIZED_FAILED",
          correlationId,
          paymentId,
          adminId,
          targetUserId,
          message: `Payment ${paymentId} finalized as FAILED. Message: ${errorMessage}`
        });
        recordWebhookFailure();
      }

      return res.json({ success: true, message: "Webhook processed successfully", correlationId });
    } catch (error) {
      structuredAlert({
        level: "error",
        eventType: "PAYMENT_WEBHOOK_EXCEPTION",
        correlationId,
        paymentId,
        adminId,
        targetUserId,
        message: `Exception during webhook async processing: ${error.message}`,
        metadata: { error: error.stack }
      });
      recordWebhookFailure();
      await pushToDLQ("PAYMENT_WEBHOOK_FAILURE", body, error);
      return res.status(500).json({ success: false, message: "Internal server error during webhook processing" });
    } finally {
      if (lockToken) {
        await releaseLock(`payment_webhook:${parseInt(rawPaymentId || 0)}`, lockToken);
      }
    }
  })(safeRes);
};
