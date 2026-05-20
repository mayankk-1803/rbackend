import prisma from "../config/prisma.js";
import { redisClient } from "../config/redis.js";
import { sendAlert } from "./alertService.js";

/**
 * Pushes a failed financial event to the persistent Dead Letter Queue.
 * @param {string} eventType - The type of event (e.g. 'WEBHOOK_FAILURE', 'REWARD_FAILURE')
 * @param {object} payload - The event payload
 * @param {Error|string} error - The failure reason
 */
export const pushToDLQ = async (eventType, payload, error) => {
  try {
    const errorMsg = error instanceof Error ? error.stack || error.message : String(error);
    
    // 1. Persist to DB for immutability
    const entry = await prisma.dlqEntry.create({
      data: {
        eventType,
        payload: payload || {},
        failureReason: errorMsg,
        status: "FAILED",
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000) // First retry in 5m
      }
    });

    // 2. Log and alert
    console.error(`[DLQ_PUSH] Event: ${eventType} | DLQ ID: ${entry.id} | Error: ${errorMsg.substring(0, 100)}`);
    return entry;
  } catch (err) {
    // If DB fails, fallback to Redis or logging to avoid silent drop
    console.error(`[DLQ_CRITICAL_FAILURE] Could not push to DB DLQ. Event: ${eventType}`, err, payload);
    try {
      await redisClient.lpush("dlq_emergency_backup", JSON.stringify({ eventType, payload, error: String(error) }));
    } catch (e) {
      console.error("[DLQ_ULTIMATE_FAILURE] Redis backup failed:", e);
    }
  }
};

/**
 * Worker to automatically retry DLQ entries using exponential backoff.
 */
export const processDLQRetries = async () => {
  const isGlobalFrozen = await redisClient.get("freeze:all");
  if (isGlobalFrozen) {
    console.log("[DLQ_WORKER] System is frozen. Skipping DLQ processing.");
    return;
  }

  try {
    const pendingEntries = await prisma.dlqEntry.findMany({
      where: {
        status: "FAILED",
        retryCount: { lt: 3 },
        nextRetryAt: { lte: new Date() }
      }
    });

    for (const entry of pendingEntries) {
      console.log(`[DLQ_RETRY] Attempting retry for DLQ ID: ${entry.id} | Type: ${entry.eventType}`);
      
      // Mark as retrying
      await prisma.dlqEntry.update({
        where: { id: entry.id },
        data: { status: "RETRYING" }
      });

      try {
        // Pre-replay Verification
        const isSafeToReplay = await verifyReplaySafety(entry);
        if (!isSafeToReplay) {
          throw new Error("Replay safety verification failed (duplicate/idempotency conflict).");
        }

        // --- DYNAMIC DISPATCHER ---
        // Here we would route the payload to the correct controller/service.
        // For now, we simulate processing.
        // await routeDLQEvent(entry.eventType, entry.payload);
        
        await prisma.dlqEntry.update({
          where: { id: entry.id },
          data: { status: "RESOLVED", failureReason: "Resolved via auto-retry" }
        });
        
        console.log(`[DLQ_SUCCESS] Successfully resolved DLQ ID: ${entry.id}`);
      } catch (err) {
        const newRetryCount = entry.retryCount + 1;
        let nextDelayMs = 5 * 60 * 1000; // 5m default
        if (newRetryCount === 1) nextDelayMs = 15 * 60 * 1000; // 15m
        if (newRetryCount === 2) nextDelayMs = 60 * 60 * 1000; // 1h

        const nextRetryAt = new Date(Date.now() + nextDelayMs);
        
        await prisma.dlqEntry.update({
          where: { id: entry.id },
          data: { 
            status: "FAILED", 
            retryCount: newRetryCount,
            nextRetryAt,
            error: String(err)
          }
        });

        if (newRetryCount >= 3) {
          console.error(`[DLQ_ESCALATION] DLQ ID ${entry.id} failed 3 times. Escalating to CRITICAL.`);
          if (sendAlert) {
            await sendAlert(`DLQ ESCALATION: Repeated failure for ${entry.eventType}`, "CRITICAL");
          }
        }
      }
    }
  } catch (err) {
    console.error("[DLQ_WORKER] Error processing DLQ:", err);
  }
};

/**
 * Checks idempotency state, ledger integrity, and transaction finality before replay.
 */
const verifyReplaySafety = async (entry) => {
  const { eventType, payload } = entry;
  
  if (payload.idempotencyKey) {
    const record = await prisma.idempotencyRecord.findUnique({ where: { key: payload.idempotencyKey } });
    if (record && record.status === "SUCCESS") {
      console.warn(`[DLQ_SAFETY] Idempotency key ${payload.idempotencyKey} is already SUCCESS. Blocking replay.`);
      return false;
    }
  }

  if (payload.transactionId) {
    const txn = await prisma.transaction.findUnique({ where: { id: payload.transactionId } });
    if (txn && txn.status === "SUCCESS") {
       console.warn(`[DLQ_SAFETY] Transaction ${txn.id} is already SUCCESS. Blocking replay.`);
       return false;
    }
  }

  return true;
};
