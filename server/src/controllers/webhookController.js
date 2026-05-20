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

/**
 * Universal Webhook Controller for Provider Callbacks.
 */
export const handleProviderWebhook = async (req, res) => {
  const { providerCode } = req.params;
  const data = req.method === 'GET' ? req.query : req.body;
  const correlationId = crypto.randomBytes(8).toString('hex');
  let lockToken = null;

  try {
    console.log(`[Webhook][${correlationId}] Received from ${providerCode}:`, JSON.stringify(data));

    // Webhook Security Validation
    const incomingSignature = req.headers["x-webhook-signature"];
    const incomingTimestamp = req.headers["x-webhook-timestamp"];
    const incomingNonce = req.headers["x-webhook-nonce"];
    const expectedSecret = process.env.WEBHOOK_SECRET || "internal_secret";

    if (!incomingSignature || !incomingTimestamp || !incomingNonce) {
      console.warn(`[Webhook][${correlationId}] REJECTED: Missing security headers.`);
      return res.status(401).send("MISSING_SECURITY_HEADERS");
    }

    const now = Date.now();
    const timestampMs = Number(incomingTimestamp);
    if (isNaN(timestampMs) || now - timestampMs > 300000) {
      console.warn(`[Webhook][${correlationId}] REJECTED: Timestamp expired.`);
      return res.status(400).send("TIMESTAMP_EXPIRED");
    }
    if (timestampMs - now > 5000) {
      console.warn(`[Webhook][${correlationId}] REJECTED: Timestamp in future.`);
      return res.status(400).send("TIMESTAMP_FUTURE");
    }

    const payloadString = incomingTimestamp + "." + incomingNonce + "." + JSON.stringify(data);
    const expectedHmac = crypto.createHmac("sha256", expectedSecret).update(payloadString).digest("hex");
    if (incomingSignature !== expectedHmac) {
      console.warn(`[Webhook][${correlationId}] REJECTED: Invalid HMAC signature.`);
      return res.status(401).send("INVALID_SIGNATURE");
    }

    const nonceKey = `nonce:${incomingNonce}`;
    const nonceClaimed = await redisClient.set(nonceKey, "1", "NX", "EX", 300);
    if (!nonceClaimed) {
      console.warn(`[Webhook][${correlationId}] REJECTED: Duplicate webhook nonce.`);
      return res.status(429).send("DUPLICATE_NONCE");
    }

    const txnId = data.txnId || data.AGENTID || data.client_id;
    const providerTxnId = data.operator_id || data.OPID || data.provider_id;
    const status = normalizeTransactionStatus(data.status || data.STATUS);

    if (!txnId) return res.status(400).send("MISSING_TXN_ID");

    const parsedTxnId = parseInt(txnId);

    // Acquire lock to prevent race conditions during concurrent webhook callbacks
    lockToken = await acquireLock(`provider_webhook:${parsedTxnId}`, 15000);
    if (!lockToken) {
      console.warn(`[Webhook][${correlationId}] Could not acquire lock for txn ${parsedTxnId}.`);
      return res.status(429).send("CONCURRENT_PROCESSING");
    }

    await prisma.$transaction(async (tx) => {
      const txns = await tx.$queryRaw`SELECT * FROM transaction WHERE id = ${parsedTxnId} FOR UPDATE`;
      if (!txns || txns.length === 0) throw new Error("TXN_NOT_FOUND");
      const txn = txns[0];

      if (txn.status !== 'PENDING') {
        console.log(`[Webhook][${correlationId}] TXN:${txnId} already ${txn.status}. Skipping.`);
        return; // Already processed
      }

      const idempotencyKey = `provider_hook:${txnId}:${status}`;
      const canClaim = await claimIdempotencyKey(idempotencyKey, data, tx);
      if (!canClaim) {
        console.log(`[Webhook][${correlationId}] Idempotency key ${idempotencyKey} already claimed.`);
        return;
      }

      if (status === 'success') {
        await tx.transaction.update({
          where: { id: txn.id },
          data: { status: 'SUCCESS', providerTxnId }
        });
        await logTransactionEvent(txn.id, TXN_EVENTS.SUCCESS, { source: "webhook", provider: providerCode }, tx);
        await issueReward(txn.id, tx);
      } else if (status === 'failed') {
        await tx.transaction.update({
          where: { id: txn.id },
          data: { status: 'FAILED', refundStatus: 'refunded', refundedAt: new Date() }
        });

        await recordFinancialEntry({
          userId: txn.userId,
          amount: txn.amount,
          type: 'REFUND_CREDIT',
          transactionId: txn.id,
          description: `Auto-Refund (Webhook): ${data.message || 'Provider failed'}`,
          context: { correlationId, ipAddress: req.ip },
          tx
        });

        await logTransactionEvent(txn.id, TXN_EVENTS.FAILED, { source: "webhook", provider: providerCode }, tx);
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
      const parsedTxnId = parseInt(data.txnId || data.AGENTID || data.client_id || 0);
      await releaseLock(`provider_webhook:${parsedTxnId}`, lockToken);
    }
  }
};
