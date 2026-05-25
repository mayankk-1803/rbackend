import prisma from "../config/prisma.js";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { recordFinancialEntry, recordCoinEntry } from "./ledgerService.js";
import { logTransactionEvent, TXN_EVENTS } from "./transactionEventService.js";
import { claimIdempotencyKey } from "../utils/idempotency.js";
import { getFreezeStatus } from "./freezeService.js";

/**
 * Centralized Reward Engine for DiziPay.
 * Handles automatic cashback credits directly to user wallets.
 */
export const calculateReward = async (transaction, tx = null) => {
  const client = tx || prisma;
  const settings = await client.cashbackSettings.findFirst();
  if (!settings || !settings.cashbackEnabled) {
    console.log(`[CASHBACK][CHECK_START] → Disabled or no settings found for Txn #${transaction.id}`);
    return null;
  }

  const amount = new Prisma.Decimal(transaction.amount);

  // 1. Minimum Amount Check
  if (amount.lessThan(settings.minRechargeAmount)) {
    console.log(`[CASHBACK][CHECK_START] → Txn #${transaction.id} amount ₹${amount} below min ₹${settings.minRechargeAmount}`);
    return null;
  }

  console.log(`[CASHBACK][ELIGIBLE] → Txn #${transaction.id} is eligible for calculation`);

  let percentage = settings.globalPercentage || 0;

  // 3. Operator-wise override
  if (settings.operatorWiseCashback && transaction.operator) {
    const operatorRules = settings.operatorWiseCashback;
    if (operatorRules[transaction.operator]) {
      percentage = operatorRules[transaction.operator];
      console.log(`[CASHBACK][OPERATOR_OVERRIDE] → Using ${percentage}% for ${transaction.operator}`);
    }
  }

  // 4. Slab-wise override
  if (settings.slabWiseCashback && Array.isArray(settings.slabWiseCashback)) {
    const sortedSlabs = [...settings.slabWiseCashback].sort((a, b) => b.min - a.min);
    const applicableSlab = sortedSlabs.find(slab => amount.greaterThanOrEqualTo(slab.min));
    if (applicableSlab) {
      percentage = applicableSlab.percent;
      console.log(`[CASHBACK][SLAB_OVERRIDE] → Using ${percentage}% for slab min ${applicableSlab.min}`);
    }
  }

  let rewardAmount = new Prisma.Decimal(0);

  // 5. Mode Calculation
  if (settings.rewardMode === 'PERCENTAGE') {
    rewardAmount = amount.mul(percentage / 100);
  } else if (settings.rewardMode === 'RANDOM') {
    const randomFactor = Math.random();
    rewardAmount = amount.mul((percentage * randomFactor) / 100);
  }

  console.log(`[CASHBACK][CALCULATED] → Raw amount: ₹${rewardAmount.toFixed(2)} (${percentage}%)`);

  // 6. Cap check
  if (rewardAmount.greaterThan(settings.maxCashbackPerRecharge)) {
    console.log(`[CASHBACK][CAP_HIT] → Capping reward from ₹${rewardAmount} to ₹${settings.maxCashbackPerRecharge}`);
    rewardAmount = new Prisma.Decimal(settings.maxCashbackPerRecharge);
  }

  // 7. Daily Limit Check
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const dailyTotal = await client.transaction.aggregate({
    where: {
      userId: transaction.userId,
      type: 'CASHBACK',
      status: 'SUCCESS',
      createdAt: { gte: startOfDay }
    },
    _sum: { cashback: true }
  });

  const currentDailyCashback = new Prisma.Decimal(dailyTotal._sum.cashback || 0);
  if (currentDailyCashback.plus(rewardAmount).greaterThan(settings.dailyCashbackLimit)) {
    console.log(`[CASHBACK][LIMIT_HIT] → Daily limit hit for user ${transaction.userId}. Current: ₹${currentDailyCashback}`);
    rewardAmount = Prisma.Decimal.max(0, new Prisma.Decimal(settings.dailyCashbackLimit).minus(currentDailyCashback));
  }

  // Safety: Cashback cannot exceed recharge amount
  if (rewardAmount.greaterThan(amount)) {
    rewardAmount = amount;
  }

  return rewardAmount;
};

/**
 * Issues cashback and coins to user atomically after successful recharge.
 */
export const issueReward = async (transactionId) => {
  // Check global freeze first
  const globalFreeze = await getFreezeStatus();
  if (globalFreeze.isSoft) {
    console.log(`[CASHBACK][FREEZE] Skipped reward issuance for Txn #${transactionId} due to global freeze.`);
    return null;
  }

  let rewardAmount = null;
  let earnedCoins = null;
  let userId = null;
  let newCoinBalance = null;

  let attempts = 10;
  while (attempts > 0) {
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Fetch transaction with lock
        const lockedTxns = await tx.$queryRaw`SELECT * FROM transaction WHERE id = ${transactionId} FOR UPDATE`;

        if (!lockedTxns || lockedTxns.length === 0) {
          console.error(`[CASHBACK][ERROR] → Transaction #${transactionId} not found`);
          return null;
        }

        const transaction = lockedTxns[0];

        const userFreeze = await getFreezeStatus(transaction.userId);
        if (userFreeze.isSoft) {
          console.log(`[CASHBACK][FREEZE] Skipped reward issuance for User ${transaction.userId} due to user soft freeze.`);
          return null;
        }

        if (transaction.status !== 'SUCCESS') {
          console.log(`[CASHBACK][SKIPPED] → Txn #${transactionId} status is ${transaction.status}`);
          return null;
        }

        // Strict Idempotency: Check both rewardProcessed and rewardClaimed flags
        if (transaction.rewardProcessed || transaction.rewardClaimed) {
          console.log(`[CASHBACK][SKIPPED] → Txn #${transactionId} already has reward processed.`);
          return null;
        }

        // Global Idempotency Key Claim
        const correlationId = crypto.randomBytes(8).toString('hex');
        const canClaim = await claimIdempotencyKey(`reward:${transactionId}`, { transactionId }, tx);
        if (!canClaim) {
          console.log(`[CASHBACK][SKIPPED] → Idempotency key reward:${transactionId} already claimed.`);
          return null;
        }

        // Update flags first inside transaction to prevent concurrent updates
        await tx.transaction.update({
          where: { id: transactionId },
          data: {
            rewardClaimed: true,
            rewardProcessed: true,
            rewardProcessedAt: new Date()
          }
        });

        rewardAmount = await calculateReward(transaction, tx);
        userId = transaction.userId;

        // Generate random 1 or 2 coins
        earnedCoins = Math.floor(Math.random() * 2) + 1; // 1 or 2

        // Award cashback if applicable
        if (rewardAmount && rewardAmount.greaterThan(0)) {
          // Credit wallet and create ledger entry via central recordFinancialEntry service
          const { balanceAfter } = await recordFinancialEntry({
            userId,
            amount: rewardAmount,
            type: 'CASHBACK_CREDIT',
            transactionId: transactionId,
            description: `Cashback for recharge #${transactionId}`,
            context: { correlationId, ipAddress: "system" },
            tx
          });

          // Create dedicated CASHBACK transaction record for transaction log
          const cashbackTx = await tx.transaction.create({
            data: {
              userId,
              amount: rewardAmount,
              cashback: rewardAmount,
              type: 'CASHBACK',
              status: 'SUCCESS',
              direction: 'CREDIT',
              balanceAfter,
              description: `Cashback for recharge #${transactionId}`,
              idempotencyKey: `reward:${transactionId}`,
              financialSequenceId: correlationId,
              invoiceSnapshot: {
                rechargeId: transactionId,
                cashbackPercentage: (rewardAmount.toNumber() / Number(transaction.amount)) * 100,
                originalAmount: Number(transaction.amount)
              }
            }
          });
        } else {
          rewardAmount = new Prisma.Decimal(0);
        }

        // Award coins securely via central recordCoinEntry
        const { balanceAfter: updatedCoinBalance } = await recordCoinEntry({
          userId,
          amount: earnedCoins,
          type: 'EARNED',
          description: `Earned from recharge #${transactionId}`,
          rechargeTxnId: transactionId,
          sourceTransactionId: transactionId,
          context: { correlationId, ipAddress: "system" },
          tx
        });
        newCoinBalance = updatedCoinBalance;

        // Update original transaction with final details
        await tx.transaction.update({
          where: { id: transactionId },
          data: {
            cashback: rewardAmount,
            cashbackCoins: earnedCoins
          }
        });

        console.log(`[CASHBACK][SUCCESS] → Txn #${transactionId} completed with reward ₹${rewardAmount} and ${earnedCoins} coins`);

        await logTransactionEvent(transactionId, TXN_EVENTS.CASHBACK_ISSUED, { amount: rewardAmount, coins: earnedCoins }, tx);
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });
      break; // break the loop on success
    } catch (err) {
      const isDeadlock = 
        err.code === 'P2034' || 
        (err.code === 'P2010' && (err.message?.includes("1213") || err.message?.toLowerCase().includes("deadlock"))) ||
        err.message?.toLowerCase().includes("deadlock") || 
        err.message?.toLowerCase().includes("write conflict");
      if (isDeadlock && attempts > 1) {
        attempts--;
        const delay = Math.floor(Math.random() * 150) + 50 * (11 - attempts); // adaptive backoff grows with each retry
        console.warn(`[CASHBACK][DEADLOCK] Deadlock in issueReward for Txn #${transactionId}. Retrying in ${delay}ms... attempts left: ${attempts}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }

  // Emitting event bus/realtime events AFTER successful transaction commit
  if (userId) {
    const { default: eventBus } = await import("../config/eventBus.js");
    eventBus.emit("wallet_updated", { userId: userId.toString() });
    eventBus.emit("earned_coins_awarded", { 
      userId: userId.toString(), 
      amount: earnedCoins, 
      newBalance: newCoinBalance 
    });
  }

  return { rewardAmount, earnedCoins };
};
