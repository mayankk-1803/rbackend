import prisma from "../config/prisma.js";
import crypto from "crypto";
import { normalizeTransactionStatus } from "../utils/statusHelper.js";
import { logTransactionEvent, TXN_EVENTS } from "../services/transactionEventService.js";
import { issueReward } from "../services/rewardEngine.js";
import { recordFinancialEntry } from "../services/ledgerService.js";
import { redisClient } from "../config/redis.js";
import { acquireLock, releaseLock } from "../utils/redisLock.js";
import { pushToDLQ } from "../services/dlqService.js";
import { claimIdempotencyKey } from "../utils/idempotency.js";
import eventBus from "../config/eventBus.js";
import { isFinalizedStatus, isValidStatusTransition } from "../utils/transactionStateGuard.js";

/**
 * Universal Webhook Controller for Provider Callbacks.
 */
export const handleProviderWebhook = async (req, res) => {
  const { providerCode } = req.params;
  const data = req.method === 'GET' ? req.query : req.body;
  const correlationId = crypto.randomBytes(8).toString('hex');

  const isLegacyProvider = (code) => {
    return ["APIBOX", "P1", "NEXGATE", "MPLAN", "EZYTM"].includes(String(code).toUpperCase().trim());
  };
  const isDynamic = !isLegacyProvider(providerCode);

  if (isDynamic && process.env.ENABLE_DYNAMIC_RECHARGE !== "true") {
    console.log(`[Webhook][${correlationId}][SAFE_MODE] Webhook acknowledged for dynamic provider: ${providerCode}`, JSON.stringify(data));
    return res.status(200).json({
      success: true,
      message: "Webhook acknowledged"
    });
  }

  let lockToken = null;

  try {
    console.log(`[Webhook][${correlationId}] Received from ${providerCode}:`, JSON.stringify(data));

    // Webhook Security Validation
    const incomingSignature = req.headers["x-webhook-signature"];
    const incomingTimestamp = req.headers["x-webhook-timestamp"];
    const incomingNonce = req.headers["x-webhook-nonce"];
    const expectedSecret = process.env.WEBHOOK_SECRET || "internal_secret";

    if (!incomingSignature || !incomingTimestamp || !incomingNonce) {
      console.warn(`[Webhook][${correlationId}] REJECTED: Missing security headers. [WEBHOOK_AUTH_FAILED]`);
      return res.status(401).send("MISSING_SECURITY_HEADERS");
    }

    const now = Date.now();
    const timestampMs = Number(incomingTimestamp);
    if (isNaN(timestampMs) || now - timestampMs > 300000) {
      console.warn(`[Webhook][${correlationId}] REJECTED: Timestamp expired. [WEBHOOK_AUTH_FAILED]`);
      return res.status(400).send("TIMESTAMP_EXPIRED");
    }
    if (timestampMs - now > 5000) {
      console.warn(`[Webhook][${correlationId}] REJECTED: Timestamp in future. [WEBHOOK_AUTH_FAILED]`);
      return res.status(400).send("TIMESTAMP_FUTURE");
    }

    const payloadString = incomingTimestamp + "." + incomingNonce + "." + JSON.stringify(data);
    const expectedHmac = crypto.createHmac("sha256", expectedSecret).update(payloadString).digest("hex");
    if (incomingSignature !== expectedHmac) {
      console.warn(`[Webhook][${correlationId}] REJECTED: Invalid HMAC signature. [WEBHOOK_AUTH_FAILED]`);
      return res.status(401).send("INVALID_SIGNATURE");
    }

    const nonceKey = `nonce:${incomingNonce}`;
    const nonceClaimed = await redisClient.set(nonceKey, "1", "NX", "EX", 300);
    if (!nonceClaimed) {
      console.warn(`[Webhook][${correlationId}] REJECTED: Duplicate webhook nonce. [WEBHOOK_AUTH_FAILED]`);
      return res.status(429).send("DUPLICATE_NONCE");
    }

    const rawTxnId = data.txnId || data.AGENTID || data.client_id;
    const providerTxnId = data.operator_id || data.OPID || data.provider_id;
    const status = normalizeTransactionStatus(data.status || data.STATUS);

    if (!rawTxnId) return res.status(400).send("MISSING_TXN_ID");

    const webhookTxnId = String(rawTxnId).trim();
    let txn = null;

    const txnIdNum = Number(webhookTxnId);
    if (!isNaN(txnIdNum) && Number.isInteger(txnIdNum)) {
      txn = await prisma.transaction.findUnique({
        where: { id: txnIdNum }
      });
    }

    if (!txn) {
      console.warn(`[Webhook][${correlationId}] REJECTED: Transaction not found for txnId: ${webhookTxnId}`);
      return res.status(404).send("TXN_NOT_FOUND");
    }

    const parsedTxnId = txn.id;

    console.log(`[WEBHOOK_MATCH]\nwebhookTxnId: ${webhookTxnId}\nmatchedTxn: ${parsedTxnId}`);

    if (isFinalizedStatus(txn.status)) {
      console.log(`[FINAL_STATE_BLOCKED] Webhook ignored for finalized txn ${txn.id}`);
      return res.status(200).send("OK");
    }

    // Acquire lock to prevent race conditions during concurrent webhook callbacks
    lockToken = await acquireLock(`provider_webhook:${parsedTxnId}`, 15000);
    if (!lockToken) {
      console.warn(`[Webhook][${correlationId}] Could not acquire lock for txn ${parsedTxnId}.`);
      return res.status(429).send("CONCURRENT_PROCESSING");
    }

    let finalTxn = null;

    await prisma.$transaction(async (tx) => {
      const txns = await tx.$queryRaw`SELECT * FROM transaction WHERE id = ${parsedTxnId} FOR UPDATE`;
      if (!txns || txns.length === 0) throw new Error("TXN_NOT_FOUND");
      const currentTxn = txns[0];

      if (isFinalizedStatus(currentTxn.status)) {
        console.log(`[FINAL_STATE_BLOCKED] Webhook ignored for finalized txn inside lock ${currentTxn.id}`);
        finalTxn = currentTxn;
        return;
      }

      if (currentTxn.status !== 'PROCESSING' && currentTxn.status !== 'PENDING') {
        console.log(`[Webhook][${correlationId}] TXN:${currentTxn.id} already ${currentTxn.status}. Skipping.`);
        finalTxn = currentTxn;
        return; // Already processed
      }

      const mappedTargetStatus = status === 'success' ? 'SUCCESS' : (status === 'failed' ? 'FAILED' : null);
      if (mappedTargetStatus && !isValidStatusTransition(currentTxn.status, mappedTargetStatus)) {
        console.log(`[INVALID_TRANSITION_BLOCKED] ${currentTxn.status} -> ${mappedTargetStatus} blocked for txn ${currentTxn.id}`);
        finalTxn = currentTxn;
        return;
      }

      const idempotencyKey = `provider_hook:${currentTxn.id}:${status}`;
      const canClaim = await claimIdempotencyKey(idempotencyKey, data, tx);
      if (!canClaim) {
        console.log(`[Webhook][${correlationId}] Idempotency key ${idempotencyKey} already claimed.`);
        finalTxn = currentTxn;
        return;
      }

      if (status === 'success') {
        const updateResult = await tx.transaction.updateMany({
          where: {
            id: currentTxn.id,
            status: { in: ['PENDING', 'PENDING_REVIEW', 'PROCESSING'] }
          },
          data: {
            status: 'SUCCESS',
            reviewStatus: 'SUCCESS',
            providerTxnId,
            rechargeProcessing: false,
            processedAt: new Date()
          }
        });

        if (updateResult.count === 0) {
          console.log(`[FINAL_STATE_BLOCKED] Txn already finalized: ${currentTxn.id}`);
          finalTxn = currentTxn;
          return;
        }

        finalTxn = await tx.transaction.findUnique({ where: { id: currentTxn.id } });

        await logTransactionEvent(currentTxn.id, TXN_EVENTS.SUCCESS, { source: "webhook", provider: providerCode }, tx);
        await issueReward(currentTxn.id, tx);
        
        eventBus.emit("recharge_success", {
          userId: currentTxn.userId,
          txnId: currentTxn.id,
          transactionId: currentTxn.id,
          status: "SUCCESS"
        });

        console.log(`[SOCKET_ROW_UPDATE] Emitting SUCCESS update for TXN:${currentTxn.id}`);
        eventBus.emit("transaction_updated", {
          transactionId: currentTxn.id,
          status: 'SUCCESS',
          transaction: finalTxn,
          amount: currentTxn.amount,
          providerTxnId,
          userId: currentTxn.userId
        });

      } else if (status === 'failed') {
        // Check duplicate refund ledger/transaction
        const existingRefundLedger = await tx.ledgerEntry.findFirst({
          where: {
            transactionId: currentTxn.id,
            type: 'REFUND_CREDIT'
          }
        });

        if (existingRefundLedger) {
          console.log(`[DUPLICATE_REFUND_PREVENTED] Refund ledger already exists for txn ${currentTxn.id}`);
          finalTxn = currentTxn;
          return;
        }

        const refundIdempotencyKey = `refund:${currentTxn.id}`;
        const existingRefundTx = await tx.transaction.findFirst({
          where: {
            type: "REFUND",
            idempotencyKey: refundIdempotencyKey
          }
        });

        if (existingRefundTx) {
          console.log(`[DUPLICATE_REFUND_PREVENTED] Refund transaction already exists for txn ${currentTxn.id}`);
          finalTxn = currentTxn;
          return;
        }

        const canClaimRefund = await claimIdempotencyKey(refundIdempotencyKey, tx);
        if (!canClaimRefund) {
          console.log(`[DUPLICATE_REFUND_PREVENTED] Refund key ${refundIdempotencyKey} already claimed.`);
          finalTxn = currentTxn;
          return;
        }

        // Step 1: transition to FAILED
        const updateFailed = await tx.transaction.updateMany({
          where: {
            id: currentTxn.id,
            status: { in: ['PENDING', 'PENDING_REVIEW', 'PROCESSING'] }
          },
          data: {
            status: 'FAILED',
            reviewStatus: 'FAILED',
            providerTxnId,
            rechargeProcessing: false
          }
        });

        if (updateFailed.count === 0) {
          console.log(`[FINAL_STATE_BLOCKED] FAILED transition blocked or already finalized: ${currentTxn.id}`);
          finalTxn = currentTxn;
          return;
        }

        // Step 2: transition from FAILED to REFUNDED
        const updateRefunded = await tx.transaction.updateMany({
          where: {
            id: currentTxn.id,
            status: 'FAILED'
          },
          data: {
            status: 'REFUNDED',
            reviewStatus: 'REFUNDED',
            refundStatus: 'refunded',
            refundedAt: new Date(),
            processedAt: new Date()
          }
        });

        if (updateRefunded.count === 0) {
          console.log(`[FINAL_STATE_BLOCKED] REFUNDED transition blocked or already finalized: ${currentTxn.id}`);
          finalTxn = currentTxn;
          return;
        }

        finalTxn = await tx.transaction.findUnique({ where: { id: currentTxn.id } });

        const res = await recordFinancialEntry({
          userId: currentTxn.userId,
          amount: currentTxn.amount,
          type: 'REFUND_CREDIT',
          transactionId: currentTxn.id,
          description: `Auto-Refund (Webhook): ${data.message || 'Provider failed'}`,
          context: { correlationId, ipAddress: req.ip },
          tx
        });

        await tx.transaction.create({
          data: {
            userId: currentTxn.userId,
            amount: currentTxn.amount,
            type: "REFUND",
            status: "SUCCESS",
            direction: "CREDIT",
            description: `Refund for recharge ${currentTxn.id}: ${data.message || 'Provider failed'}`,
            balanceAfter: res.balanceAfter,
            idempotencyKey: refundIdempotencyKey
          }
        });

        await logTransactionEvent(currentTxn.id, TXN_EVENTS.FAILED, { source: "webhook", provider: providerCode }, tx);
        await logTransactionEvent(currentTxn.id, TXN_EVENTS.REFUNDED, { source: "webhook" }, tx);

        eventBus.emit("recharge_failed", {
          userId: currentTxn.userId,
          txnId: currentTxn.id,
          transactionId: currentTxn.id,
          status: "REFUNDED"
        });
        eventBus.emit("refund_completed", {
          userId: currentTxn.userId,
          txnId: currentTxn.id,
          transactionId: currentTxn.id,
          status: "REFUNDED"
        });
        eventBus.emit("wallet_updated", { userId: currentTxn.userId.toString() });

        console.log(`[SOCKET_ROW_UPDATE] Emitting REFUNDED update for TXN:${currentTxn.id}`);
        eventBus.emit("transaction_updated", {
          transactionId: currentTxn.id,
          status: 'REFUNDED',
          transaction: finalTxn,
          amount: currentTxn.amount,
          providerTxnId,
          userId: currentTxn.userId
        });
      }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    res.status(200).send("OK");
  } catch (err) {
    console.error(`[Webhook Error][${correlationId}] ${providerCode}:`, err.message);
    if (err.message !== "TXN_NOT_FOUND") {
      await pushToDLQ("PROVIDER_WEBHOOK_FAILURE", data, err);
    }
    res.status(500).send("INTERNAL_ERROR");
  } finally {
    if (lockToken) {
      const rawTxnId = data.txnId || data.AGENTID || data.client_id || 0;
      const parsedTxnId = parseInt(rawTxnId);
      await releaseLock(`provider_webhook:${parsedTxnId}`, lockToken);
    }
  }
};

