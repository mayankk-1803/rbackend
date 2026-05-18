import prisma from "../config/prisma.js";
import { getProviderService } from "./providers/providerFactory.js";
import { normalizeTransactionStatus } from "../utils/statusHelper.js";
import { logTransactionEvent, TXN_EVENTS } from "./transactionEventService.js";
import { issueReward } from "./rewardEngine.js";
import { recordFinancialEntry } from "./ledgerService.js";
import eventBus from "../config/eventBus.js";

/**
 * Reconciliation Service to sync pending transactions with providers.
 */
export const reconcilePendingTransactions = async () => {
  console.log("[Reconciliation] Starting sync...");

  const pendingTxns = await prisma.transaction.findMany({
    where: {
      status: 'PENDING',
      type: 'RECHARGE',
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        lte: new Date(Date.now() - 60 * 1000)      // Older than 1 min
      }
    },
    include: { user: true }
  });

  console.log(`[Reconciliation] Found ${pendingTxns.length} pending transactions.`);

  for (const txn of pendingTxns) {
    try {
      // Safety: If transaction is > 2 hours old and still pending, mark as FAILED
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      if (txn.createdAt < twoHoursAgo) {
        console.log(`[Reconciliation] TXN:${txn.id} timed out (> 2hrs). Force failing.`);
        await handleFailedSync(txn, { message: "System Timeout: No provider response for 2 hours." });
        continue;
      }

      if (!txn.provider) {
        console.log(`[Reconciliation] TXN:${txn.id} has no provider. Force failing.`);
        await handleFailedSync(txn, { message: "Internal Error: No provider assigned." });
        continue;
      }

      const providerService = getProviderService(txn.provider);
      const statusResponse = await providerService.checkStatus(txn.id, txn.providerTxnId);

      const normalizedStatus = normalizeTransactionStatus(statusResponse.status);

      if (normalizedStatus === 'success') {
        await handleSuccessfulSync(txn, statusResponse);
      } else if (normalizedStatus === 'failed') {
        await handleFailedSync(txn, statusResponse);
      } else if (normalizedStatus === 'pending') {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (txn.createdAt < fiveMinutesAgo && txn.status !== 'STUCK') {
          console.log(`[Reconciliation] TXN:${txn.id} is stuck. Marking STUCK.`);
          const updatedTxn = await prisma.transaction.update({
            where: { id: txn.id },
            data: { status: 'STUCK' }
          });
          eventBus.emit("transaction_updated", {
            transactionId: txn.id,
            status: 'STUCK',
            transaction: updatedTxn,
            amount: txn.amount,
            userId: txn.userId
          });
        }
      }
    } catch (err) {
      console.error(`[Reconciliation Error] TXN:${txn.id}:`, err.message);
    }
  }
};

async function handleSuccessfulSync(txn, response) {
  let updatedTxn;
  await prisma.$transaction(async (tx) => {
    updatedTxn = await tx.transaction.update({
      where: { id: txn.id },
      data: { 
        status: 'SUCCESS',
        providerTxnId: response.operatorTxnId || txn.providerTxnId
      }
    });

    await logTransactionEvent(txn.id, TXN_EVENTS.SUCCESS, { source: "reconciliation" });
    await issueReward(txn.id);
  });
  
  eventBus.emit("transaction_updated", {
    transactionId: txn.id,
    status: 'SUCCESS',
    transaction: updatedTxn,
    amount: txn.amount,
    providerTxnId: updatedTxn.providerTxnId,
    userId: txn.userId
  });
  console.log(`[Reconciliation] TXN:${txn.id} marked SUCCESS`);
}

async function handleFailedSync(txn, response) {
  let updatedTxn;
  let updatedWallet;
  await prisma.$transaction(async (tx) => {
    updatedTxn = await tx.transaction.update({
      where: { id: txn.id },
      data: { status: 'FAILED', refundStatus: 'refunded', refundedAt: new Date() }
    });

    updatedWallet = await tx.wallet.update({
      where: { userId: txn.userId },
      data: { balance: { increment: txn.amount } }
    });

    await recordFinancialEntry({
      userId: txn.userId,
      amount: txn.amount,
      type: 'REFUND_CREDIT',
      transactionId: txn.id,
      description: `Auto-Refund (Reconciliation): ${response.message || 'Provider failed'}`,
      tx
    });

    await logTransactionEvent(txn.id, TXN_EVENTS.FAILED, { source: "reconciliation" });
    await logTransactionEvent(txn.id, TXN_EVENTS.REFUNDED, { amount: txn.amount });
  });

  eventBus.emit("transaction_updated", {
    transactionId: txn.id,
    status: 'FAILED',
    transaction: updatedTxn,
    amount: txn.amount,
    userId: txn.userId
  });
  eventBus.emit("wallet_updated", { userId: txn.userId.toString() });
  console.log(`[Reconciliation] TXN:${txn.id} marked FAILED and REFUNDED`);
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

