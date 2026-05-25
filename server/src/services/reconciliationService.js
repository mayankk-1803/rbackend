import prisma from "../config/prisma.js";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { getProviderService } from "./providers/providerFactory.js";
import { normalizeTransactionStatus } from "../utils/statusHelper.js";
import { logTransactionEvent, TXN_EVENTS } from "./transactionEventService.js";
import { issueReward } from "./rewardEngine.js";
import { recordFinancialEntry } from "./ledgerService.js";
import eventBus from "../config/eventBus.js";
import { claimIdempotencyKey } from "../utils/idempotency.js";
import { recordReconciliationLatency } from "./webhookMonitoringService.js";
import { isFinalizedStatus, isValidStatusTransition } from "../utils/transactionStateGuard.js";

// In-memory lock to prevent overlapping reconciliation runs
let isReconciling = false;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Reconciliation Service to sync pending transactions with providers.
 */
export const reconcilePendingTransactions = async () => {
  if (isReconciling) {
    console.warn("[RECON_WARN] Reconciliation already in progress. Overlap blocked.");
    return;
  }

  try {
    isReconciling = true;
    console.log("[RECON_START] Starting sync...");

    const pendingTxns = await prisma.transaction.findMany({
      where: {
        status: { in: ['PENDING', 'PENDING_REVIEW', 'PROCESSING'] },
        type: 'RECHARGE'
      },
      include: { user: true },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`[RECON_START] Found ${pendingTxns.length} pending/review/processing transactions for reconciliation.`);

    if (pendingTxns.length === 0) {
      return;
    }

    // Process transactions in batches of 5 to protect providers from rate limits and PM2 from CPU spikes
    const BATCH_SIZE = 5;
    for (let i = 0; i < pendingTxns.length; i += BATCH_SIZE) {
      const batch = pendingTxns.slice(i, i + BATCH_SIZE);
      console.log(`[RECON_BATCH] Processing batch index ${i} to ${i + batch.length} of ${pendingTxns.length}`);

      const validBatch = [];
      for (const txn of batch) {
        if (isFinalizedStatus(txn.status)) {
          console.log(`[RECON_SKIP_FINALIZED] Txn already finalized: ${txn.id}`);
          continue;
        }

        const totalElapsedSeconds = (Date.now() - txn.createdAt.getTime()) / 1000;
        const lastCheck = txn.lastStatusCheckAt || txn.lastRetryAt || txn.createdAt;
        const secondsSinceLastCheck = (Date.now() - lastCheck.getTime()) / 1000;

        const maxAttempts = 25;
        const maxTimeMs = 30 * 60 * 1000; // 30 minutes
        const isTimeout = (Date.now() - txn.createdAt.getTime()) > maxTimeMs;
        const isMaxRetries = (txn.retryCount || 0) >= maxAttempts;

        if (isTimeout || isMaxRetries) {
          console.log(`[RECON_TIMEOUT] Txn ${txn.id} hit ceiling. Timeout: ${isTimeout}, MaxRetries: ${isMaxRetries}`);
          console.log(`[AUTO_REFUND_TRIGGERED] Triggering auto-refund for txn ${txn.id}`);
          await handleFailedSync(txn, { message: "Reconciliation Timeout: Maximum retries/time exceeded." });
          console.log(`[RECON_STOPPED_FINALIZED] Polling stopped for txn ${txn.id}`);
          continue;
        }

        let shouldPoll = false;
        const retry = txn.retryCount || 0;

        if (retry === 0) {
          if (totalElapsedSeconds >= 10) shouldPoll = true;
        } else if (retry === 1) {
          if (totalElapsedSeconds >= 20 && secondsSinceLastCheck >= 10) shouldPoll = true;
        } else if (retry === 2) {
          if (totalElapsedSeconds >= 40 && secondsSinceLastCheck >= 20) shouldPoll = true;
        } else {
          if (secondsSinceLastCheck >= 60) shouldPoll = true;
        }

        if (shouldPoll) {
          console.log(`[RECON_FAST_POLL] Fast polling txn ${txn.id} | retryCount: ${retry} | elapsed: ${totalElapsedSeconds}s`);
          validBatch.push(txn);
        }
      }

      await Promise.allSettled(validBatch.map(async (txn) => {
        const startTxn = Date.now();
        try {
          // Log alert if transaction is stuck > 10 minutes
          const minutesStuck = Math.round((Date.now() - txn.createdAt) / 60000);
          if (minutesStuck >= 10) {
            console.warn(`[MONITORING_ALERT] Stuck transaction warning: TXN:${txn.id} has been in status "${txn.status}" for ${minutesStuck} minutes.`);
          }

          await reconcileSingleTransactionInternal(txn);
        } catch (err) {
          console.error(`[Reconciliation Batch Error] TXN:${txn.id}:`, err.message);
        } finally {
          const latency = Date.now() - startTxn;
          recordReconciliationLatency(latency);
        }
      }));

      // Throttle delay between batches
      if (i + BATCH_SIZE < pendingTxns.length && validBatch.length > 0) {
        console.log("[RECON_BATCH] Sleeping 500ms between batches to protect provider API limits...");
        await sleep(500);
      }
    }
  } catch (err) {
    console.error("[Reconciliation Error] Global loop error:", err.message);
  } finally {
    isReconciling = false;
    console.log("[RECON_END] Sync loop iteration completed.");
  }
};

/**
 * Reconciles a single transaction by querying provider status.
 * Rejects already finalized transactions (SUCCESS, FAILED, REFUNDED).
 */
export const reconcileSingleTransaction = async (txnId) => {
  const txn = await prisma.transaction.findUnique({
    where: { id: txnId },
    include: { user: true }
  });

  if (!txn) {
    throw new Error(`Transaction #${txnId} not found.`);
  }

  const allowedStatuses = ["PENDING", "PENDING_REVIEW", "PROCESSING"];
  if (!allowedStatuses.includes(txn.status)) {
    throw new Error(`Transaction #${txnId} status is "${txn.status}" and cannot be reconciled manually.`);
  }

  return await reconcileSingleTransactionInternal(txn);
};

/**
 * Internal logic for single transaction reconciliation.
 */
async function reconcileSingleTransactionInternal(txn) {
  console.log(`[RECON_TXN] Processing TXN:${txn.id} | Provider: ${txn.provider} | Amount: ${txn.amount} | CreatedAt: ${txn.createdAt}`);

  if (isFinalizedStatus(txn.status)) {
    console.log(`[RECON_SKIP_FINALIZED] Txn already finalized: ${txn.id}`);
    return { success: true, status: txn.status, message: "Transaction already finalized." };
  }

  // Safety: If transaction is > 2 hours old and still pending, mark as FAILED
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  if (txn.createdAt < twoHoursAgo) {
    console.log(`[RECON_TXN] TXN:${txn.id} timed out (> 2hrs). Force failing.`);
    const updated = await handleFailedSync(txn, { message: "System Timeout: No provider response for 2 hours." });
    return { success: true, status: 'FAILED', message: "Force failed due to 2 hour timeout.", data: updated };
  }

  if (!txn.provider) {
    console.log(`[RECON_TXN] TXN:${txn.id} has no provider. Force failing.`);
    const updated = await handleFailedSync(txn, { message: "Internal Error: No provider assigned." });
    return { success: true, status: 'FAILED', message: "Force failed due to missing provider.", data: updated };
  }

  console.log(`[STATUS_CHECK] Requesting status for TXN:${txn.id} from Provider: ${txn.provider}`);

  await prisma.transaction.update({
    where: { id: txn.id },
    data: {
      retryCount: { increment: 1 },
      lastStatusCheckAt: new Date(),
      lastRetryAt: new Date()
    }
  });

  const providerService = getProviderService(txn.provider);
  const statusResponse = await providerService.checkStatus(txn.id, txn.providerTxnId);
  console.log(`[STATUS_RESPONSE] Status response for TXN:${txn.id}:`, JSON.stringify(statusResponse));

  const normalizedStatus = normalizeTransactionStatus(statusResponse.status);
  console.log(`[STATUS_MAPPED] Status response mapped to: ${normalizedStatus} for TXN:${txn.id}`);

  if (normalizedStatus === 'success') {
    const updated = await handleSuccessfulSync(txn, statusResponse);
    return { success: true, status: 'SUCCESS', data: updated };
  } else if (normalizedStatus === 'failed') {
    const updated = await handleFailedSync(txn, statusResponse);
    return { success: true, status: 'FAILED', data: updated };
  } else {
    return { success: true, status: 'PENDING', message: "Transaction remains pending at provider.", response: statusResponse };
  }
}

export async function handleSuccessfulSync(txn, response) {
  if (isFinalizedStatus(txn.status)) {
    console.log(`[FINAL_STATE_BLOCKED] Txn already finalized: ${txn.id}`);
    return null;
  }

  if (!isValidStatusTransition(txn.status, "SUCCESS")) {
    console.log(`[INVALID_TRANSITION_BLOCKED] ${txn.status} -> SUCCESS blocked for txn ${txn.id}`);
    return null;
  }

  if (txn.status === "SUCCESS") {
    console.log(`[DUPLICATE_STATUS_SKIPPED] Txn ${txn.id} already SUCCESS`);
    return txn;
  }

  let updatedTxn;
  console.log(`[DB_UPDATED] Marking TXN:${txn.id} as SUCCESS`);
  console.log(`[RECON_STOPPED_FINALIZED] Polling stopped for txn ${txn.id}`);

  await prisma.$transaction(async (tx) => {
    const lockedTxns = await tx.$queryRaw`SELECT * FROM transaction WHERE id = ${txn.id} FOR UPDATE`;
    
    if (!lockedTxns || lockedTxns.length === 0) {
      console.log(`[Reconciliation][SKIPPED] → TXN:${txn.id} not found during lock.`);
      return;
    }
    const lockedTxn = lockedTxns[0];

    if (isFinalizedStatus(lockedTxn.status)) {
      console.log(`[FINAL_STATE_BLOCKED] Txn already finalized inside lock: ${txn.id}`);
      return;
    }

    const updateResult = await tx.transaction.updateMany({
      where: {
        id: txn.id,
        status: { in: ['PENDING', 'PENDING_REVIEW', 'PROCESSING'] }
      },
      data: { 
        status: 'SUCCESS',
        providerTxnId: response.operatorTxnId || txn.providerTxnId
      }
    });

    if (updateResult.count === 0) {
      console.log(`[FINAL_STATE_BLOCKED] Txn already finalized or not found: ${txn.id}`);
      return;
    }

    updatedTxn = await tx.transaction.findUnique({
      where: { id: txn.id }
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });

  if (!updatedTxn) {
    return null;
  }

  // Call timeline log and issue reward outside the transaction to avoid lock contentions & nesting deadlocks
  try {
    await logTransactionEvent(txn.id, TXN_EVENTS.SUCCESS, { source: "reconciliation" });
    // Asynchronous non-blocking reward issuance
    issueReward(txn.id).catch(err => console.error("Reward Error:", err));
  } catch (err) {
    console.error(`[Reconciliation Post-Sync Error] TXN:${txn.id}:`, err.message);
  }
  
  console.log(`[SOCKET_ROW_UPDATE] Emitting success update for TXN:${txn.id}`);
  eventBus.emit("transaction_updated", {
    transactionId: txn.id,
    status: 'SUCCESS',
    transaction: updatedTxn,
    amount: txn.amount,
    providerTxnId: updatedTxn.providerTxnId,
    userId: txn.userId
  });

  // Emit recharge_success event
  eventBus.emit("recharge_success", {
    userId: txn.userId.toString(),
    transactionId: txn.id,
    amount: txn.amount,
    operator: txn.operator,
    mobile: txn.mobile
  });

  console.log(`[Reconciliation] TXN:${txn.id} marked SUCCESS`);
  return updatedTxn;
}

export async function handleFailedSync(txn, response) {
  if (isFinalizedStatus(txn.status)) {
    console.log(`[FINAL_STATE_BLOCKED] Txn already finalized: ${txn.id}`);
    return null;
  }

  if (!isValidStatusTransition(txn.status, "FAILED")) {
    console.log(`[INVALID_TRANSITION_BLOCKED] ${txn.status} -> FAILED blocked for txn ${txn.id}`);
    return null;
  }

  if (txn.status === "FAILED" || txn.status === "REFUNDED") {
    console.log(`[DUPLICATE_STATUS_SKIPPED] Txn ${txn.id} already FAILED/REFUNDED`);
    return txn;
  }

  let updatedTxn;
  console.log(`[DB_UPDATED] Marking TXN:${txn.id} as FAILED`);
  console.log(`[WALLET_UPDATED] Refunding amount ${txn.amount} to User:${txn.userId} for FAILED TXN:${txn.id}`);
  console.log(`[RECON_STOPPED_FINALIZED] Polling stopped for txn ${txn.id}`);
  
  await prisma.$transaction(async (tx) => {
    // 1. Lock transaction and verify status to prevent duplicate refund
    const lockedTxns = await tx.$queryRaw`SELECT * FROM transaction WHERE id = ${txn.id} FOR UPDATE`;

    if (!lockedTxns || lockedTxns.length === 0) {
      console.log(`[Reconciliation][SKIPPED] → TXN:${txn.id} not found during lock.`);
      return;
    }
    const lockedTxn = lockedTxns[0];

    if (isFinalizedStatus(lockedTxn.status)) {
      console.log(`[FINAL_STATE_BLOCKED] Txn already finalized inside lock: ${txn.id}`);
      return;
    }

    if (lockedTxn.refundStatus === 'refunded' || lockedTxn.refundStatus === 'COMPLETED') {
      console.log(`[Reconciliation][SKIPPED] → TXN:${txn.id} is already refunded. Skipping.`);
      return;
    }

    // Check if refund ledger already exists
    const existingRefundLedger = await tx.ledgerEntry.findFirst({
      where: {
        transactionId: txn.id,
        type: 'REFUND_CREDIT'
      }
    });

    if (existingRefundLedger) {
      console.log(`[DUPLICATE_REFUND_PREVENTED] Refund ledger already exists for txn ${txn.id}`);
      return;
    }

    const idempotencyKey = `refund:${txn.id}`;
    const existingRefundTx = await tx.transaction.findFirst({
      where: {
        type: "REFUND",
        idempotencyKey
      }
    });

    if (existingRefundTx) {
      console.log(`[DUPLICATE_REFUND_PREVENTED] Refund transaction already exists for txn ${txn.id}`);
      return;
    }

    // Claim global idempotency key for refund
    const correlationId = crypto.randomBytes(8).toString('hex');
    const canClaim = await claimIdempotencyKey(idempotencyKey, { txnId: txn.id, reason: "recon_failed" }, tx);
    if (!canClaim) {
      console.log(`[Reconciliation][SKIPPED] → Refund key ${idempotencyKey} already claimed.`);
      return;
    }

    const updateResult = await tx.transaction.updateMany({
      where: {
        id: txn.id,
        status: { in: ['PENDING', 'PENDING_REVIEW', 'PROCESSING'] }
      },
      data: { 
        status: 'FAILED',
        refundStatus: 'refunded',
        refundedAt: new Date()
      }
    });

    if (updateResult.count === 0) {
      console.log(`[FINAL_STATE_BLOCKED] Txn already finalized or not found: ${txn.id}`);
      return;
    }

    updatedTxn = await tx.transaction.findUnique({
      where: { id: txn.id }
    });

    // 2. recordFinancialEntry automatically credits wallet balance and creates ledger record atomically.
    const res = await recordFinancialEntry({
      userId: txn.userId,
      amount: txn.amount,
      type: 'REFUND_CREDIT',
      transactionId: txn.id,
      description: `Refund for failed recharge ${txn.id} via reconciliation`,
      context: { correlationId, ipAddress: "system" },
      tx
    });

    // Create transaction log for the REFUND credit
    await tx.transaction.create({
      data: {
        userId: txn.userId,
        amount: txn.amount,
        type: "REFUND",
        status: "SUCCESS",
        direction: "CREDIT",
        description: `Refund for failed recharge ${txn.id}: ${response.message || 'Failed via reconciliation'}`,
        balanceAfter: res.balanceAfter,
        idempotencyKey,
        financialSequenceId: correlationId
      }
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });

  if (!updatedTxn) {
    return null;
  }

  // Call timeline log outside the transaction to avoid lock contentions & nesting deadlocks
  try {
    await logTransactionEvent(txn.id, TXN_EVENTS.FAILED, { source: "reconciliation", message: response.message });
    await logTransactionEvent(txn.id, TXN_EVENTS.REFUNDED, { source: "reconciliation" });
  } catch (err) {
    console.error(`[Reconciliation Post-Sync Failure Error] TXN:${txn.id}:`, err.message);
  }

  console.log(`[SOCKET_ROW_UPDATE] Emitting failed update for TXN:${txn.id}`);
  eventBus.emit("transaction_updated", {
    transactionId: txn.id,
    status: 'FAILED',
    transaction: updatedTxn,
    amount: txn.amount,
    providerTxnId: updatedTxn.providerTxnId,
    userId: txn.userId
  });

  // Emit recharge_failed event
  eventBus.emit("recharge_failed", {
    userId: txn.userId.toString(),
    transactionId: txn.id,
    amount: txn.amount,
    error: response.message || "Failed"
  });

  console.log(`[Reconciliation] TXN:${txn.id} marked FAILED`);
  return updatedTxn;
}

/**
 * Starts the periodic reconciliation job.
 * Only runs on the primary instance (0) if PM2 clustering is used.
 */
export const startReconciliationCron = () => {
  const appInstance = process.env.NODE_APP_INSTANCE;
  
  // Singleton checks for PM2 Cluster mode
  if (appInstance !== undefined && appInstance !== '0' && appInstance !== 0) {
    console.log(`[Reconciliation] Running on instance ${appInstance}. Loop disabled.`);
    return;
  }

  // Sync every 10 seconds for fast-first polling
  const INTERVAL_MS = 10 * 1000;
  setInterval(async () => {
    try {
      await reconcilePendingTransactions();
    } catch (err) {
      console.error("[Reconciliation Cron Error]:", err.message);
    }
  }, INTERVAL_MS);

  console.log(`[Reconciliation] Service started (Interval: 10s, Instance: ${appInstance || 'Leader'})`);
};
