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

/**
 * Reconciliation Service to sync pending transactions with providers.
 */
export const reconcilePendingTransactions = async () => {
  console.log("[RECON_START] Starting sync...");

  const pendingTxns = await prisma.transaction.findMany({
    where: {
      status: 'PENDING',
      type: 'RECHARGE',
      createdAt: {
        lte: new Date(Date.now() - 60 * 1000)      // Older than 1 min
      }
    },
    include: { user: true }
  });

  console.log(`[RECON_START] Found ${pendingTxns.length} pending transactions for reconciliation.`);

  for (const txn of pendingTxns) {
    try {
      console.log(`[RECON_TXN] Processing TXN:${txn.id} | Provider: ${txn.provider} | Amount: ${txn.amount} | CreatedAt: ${txn.createdAt}`);

      // Safety: If transaction is > 2 hours old and still pending, mark as FAILED
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      if (txn.createdAt < twoHoursAgo) {
        console.log(`[RECON_TXN] TXN:${txn.id} timed out (> 2hrs). Force failing.`);
        await handleFailedSync(txn, { message: "System Timeout: No provider response for 2 hours." });
        continue;
      }

      if (!txn.provider) {
        console.log(`[RECON_TXN] TXN:${txn.id} has no provider. Force failing.`);
        await handleFailedSync(txn, { message: "Internal Error: No provider assigned." });
        continue;
      }

      console.log(`[STATUS_CHECK] Requesting status for TXN:${txn.id} from Provider: ${txn.provider}`);
      const providerService = getProviderService(txn.provider);
      const statusResponse = await providerService.checkStatus(txn.id, txn.providerTxnId);
      console.log(`[STATUS_RESPONSE] Status response for TXN:${txn.id}:`, JSON.stringify(statusResponse));

      const normalizedStatus = normalizeTransactionStatus(statusResponse.status);
      console.log(`[STATUS_MAPPED] Status response mapped to: ${normalizedStatus} for TXN:${txn.id}`);

      if (normalizedStatus === 'success') {
        await handleSuccessfulSync(txn, statusResponse);
      } else if (normalizedStatus === 'failed') {
        await handleFailedSync(txn, statusResponse);
      } else if (normalizedStatus === 'pending') {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (txn.createdAt < fiveMinutesAgo) {
          console.log(`[RECON_TXN] TXN:${txn.id} is stuck (pending > 5 mins). No status change made in DB.`);
        }
      }
    } catch (err) {
      console.error(`[Reconciliation Error] TXN:${txn.id}:`, err.message);
    }
  }
};

async function handleSuccessfulSync(txn, response) {
  let updatedTxn;
  console.log(`[DB_UPDATED] Marking TXN:${txn.id} as SUCCESS`);
  await prisma.$transaction(async (tx) => {
    const lockedTxns = await tx.$queryRaw`SELECT * FROM transaction WHERE id = ${txn.id} FOR UPDATE`;
    
    if (!lockedTxns || lockedTxns.length === 0) {
      console.log(`[Reconciliation][SKIPPED] → TXN:${txn.id} not found during lock.`);
      return;
    }
    const lockedTxn = lockedTxns[0];

    if (lockedTxn.status !== 'PENDING') {
      console.log(`[Reconciliation][SKIPPED] → TXN:${txn.id} status is already ${lockedTxn?.status || 'UNKNOWN'}. Skipping success sync.`);
      return;
    }

    updatedTxn = await tx.transaction.update({
      where: { id: txn.id },
      data: { 
        status: 'SUCCESS',
        providerTxnId: response.operatorTxnId || txn.providerTxnId
      }
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });

  if (!updatedTxn) {
    return;
  }

  // Call timeline log and issue reward outside the transaction to avoid lock contentions & nesting deadlocks
  try {
    await logTransactionEvent(txn.id, TXN_EVENTS.SUCCESS, { source: "reconciliation" });
    await issueReward(txn.id);
  } catch (err) {
    console.error(`[Reconciliation Post-Sync Error] TXN:${txn.id}:`, err.message);
  }
  
  console.log(`[SOCKET_EMIT] Emitting success update for TXN:${txn.id}`);
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
}

async function handleFailedSync(txn, response) {
  let updatedTxn;
  console.log(`[DB_UPDATED] Marking TXN:${txn.id} as FAILED`);
  console.log(`[WALLET_UPDATED] Refunding amount ${txn.amount} to User:${txn.userId} for FAILED TXN:${txn.id}`);
  
  await prisma.$transaction(async (tx) => {
    // 1. Lock transaction and verify status to prevent duplicate refund
    const lockedTxns = await tx.$queryRaw`SELECT * FROM transaction WHERE id = ${txn.id} FOR UPDATE`;

    if (!lockedTxns || lockedTxns.length === 0) {
      console.log(`[Reconciliation][SKIPPED] → TXN:${txn.id} not found during lock.`);
      return;
    }
    const lockedTxn = lockedTxns[0];

    if (lockedTxn.status !== 'PENDING') {
      console.log(`[Reconciliation][SKIPPED] → TXN:${txn.id} status is already ${lockedTxn?.status || 'UNKNOWN'}. Skipping refund.`);
      return;
    }

    if (lockedTxn.refundStatus === 'refunded' || lockedTxn.refundStatus === 'COMPLETED') {
      console.log(`[Reconciliation][SKIPPED] → TXN:${txn.id} is already refunded. Skipping.`);
      return;
    }

    // Claim global idempotency key for refund
    const correlationId = crypto.randomBytes(8).toString('hex');
    const idempotencyKey = `refund:${txn.id}`;
    const canClaim = await claimIdempotencyKey(idempotencyKey, { txnId: txn.id, reason: "recon_failed" }, tx);
    if (!canClaim) {
      console.log(`[Reconciliation][SKIPPED] → Refund key ${idempotencyKey} already claimed.`);
      return;
    }

    updatedTxn = await tx.transaction.update({
      where: { id: txn.id },
      data: { 
        status: 'FAILED',
        refundStatus: 'refunded',
        refundedAt: new Date()
      }
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
    return;
  }

  // Call timeline log outside the transaction to avoid lock contentions & nesting deadlocks
  try {
    await logTransactionEvent(txn.id, TXN_EVENTS.FAILED, { source: "reconciliation", message: response.message });
    await logTransactionEvent(txn.id, TXN_EVENTS.REFUNDED, { source: "reconciliation" });
  } catch (err) {
    console.error(`[Reconciliation Post-Sync Failure Error] TXN:${txn.id}:`, err.message);
  }

  console.log(`[SOCKET_EMIT] Emitting failed update for TXN:${txn.id}`);
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
}

/**
 * Starts the periodic reconciliation job.
 */
export const startReconciliationCron = () => {
  // Sync every 60 seconds
  setInterval(async () => {
    try {
      await reconcilePendingTransactions();
    } catch (err) {
      console.error("[Reconciliation Cron Error]:", err.message);
    }
  }, 60 * 1000);

  console.log("[Reconciliation] Service started (Interval: 60s)");
};

