import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { recordFinancialEntry } from "./ledgerService.js";
import { logTransactionEvent, TXN_EVENTS } from "./transactionEventService.js";

/**
 * Centralized Reward Engine for DiziPay.
 * Handles automatic cashback credits directly to user wallets.
 */
export const calculateReward = async (transaction) => {
  const settings = await prisma.cashbackSettings.findFirst();
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
  
  const dailyTotal = await prisma.transaction.aggregate({
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
 * Issues cashback to user atomically after successful recharge.
 */
export const issueReward = async (transactionId) => {
  return await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
      include: { user: true }
    });

    if (!transaction) {
      console.error(`[CASHBACK][ERROR] → Transaction #${transactionId} not found`);
      return null;
    }

    if (transaction.status !== 'SUCCESS') {
      console.log(`[CASHBACK][SKIPPED] → Txn #${transactionId} status is ${transaction.status}`);
      return null;
    }

    if (transaction.rewardClaimed) {
      console.log(`[CASHBACK][SKIPPED] → Txn #${transactionId} already has reward claimed.`);
      return null;
    }

    const rewardAmount = await calculateReward(transaction);
    if (!rewardAmount || rewardAmount.isZero()) {
      console.log(`[CASHBACK][FINAL] → No reward applicable for Txn #${transactionId}`);
      return null;
    }

    // 1. Credit Wallet and Create Ledger Entry
    await recordFinancialEntry({
      userId: transaction.userId,
      amount: rewardAmount,
      type: 'CASHBACK_CREDIT',
      transactionId: transactionId,
      description: `Cashback for recharge #${transactionId}`,
      tx
    });

    console.log(`[CASHBACK][WALLET_UPDATED] → User ${transaction.userId} credited with ₹${rewardAmount}`);

    // 2. Update Transaction with cashback amount
    await tx.transaction.update({
      where: { id: transactionId },
      data: {
        cashback: rewardAmount,
        rewardClaimed: true 
      }
    });

    console.log(`[CASHBACK][SUCCESS] → Txn #${transactionId} completed with reward ₹${rewardAmount}`);

    await logTransactionEvent(transactionId, TXN_EVENTS.CASHBACK_ISSUED, { amount: rewardAmount });

    return rewardAmount;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
};
