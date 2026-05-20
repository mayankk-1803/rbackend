import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import AppError from "../utils/AppError.js";
import { redisClient } from "../config/redis.js";
import crypto from "crypto";
import { getFreezeStatus } from "./freezeService.js";

const generateSequenceId = (prefix = "SEQ") => `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;


/**
 * Unified Ledger Service for all financial operations.
 * Ensures atomicity between wallet updates and immutable ledger entries.
 */
export const recordFinancialEntry = async ({
  userId,
  amount,
  type,
  transactionId = null,
  description = null,
  metadata = {},
  allowNegative = false,
  context = {}, // For audit logging: ipAddress, userAgent, requestHash, correlationId
  tx = null // Optional Prisma transaction client
}) => {
  const execute = async (client) => {
    // 0. Check soft/hard freeze mode
    const freezeStatus = await getFreezeStatus(userId);
    if (freezeStatus.isHard) {
      throw new AppError(freezeStatus.reason || "Financial operations are temporarily frozen for security review.", 403, "ACCOUNT_FROZEN");
    }
    if (freezeStatus.isSoft) {
      // SOFT FREEZE blocks reward credits and redemptions
      const blockedTypes = ["CASHBACK_CREDIT", "REDEMPTION_DEBIT", "REDEMPTION_CREDIT"];
      if (blockedTypes.includes(type)) {
        throw new AppError("Rewards and redemptions are temporarily suspended.", 403, "ACCOUNT_SOFT_FROZEN");
      }
    }

    // 1. Fetch wallet with lock to prevent race conditions
    const wallets = await client.$queryRaw`SELECT * FROM wallet WHERE userId = ${userId} FOR UPDATE`;
    if (!wallets || wallets.length === 0) throw new AppError("Wallet not found", 404, "WALLET_NOT_FOUND");
    const wallet = wallets[0];

    const amountDecimal = new Prisma.Decimal(amount);
    const balanceBefore = new Prisma.Decimal(wallet.balance);
    const balanceAfter = balanceBefore.plus(amountDecimal);

    // 2. Check for insufficient balance on debits
    if (!allowNegative && amountDecimal.isNegative() && balanceAfter.isNegative()) {
      throw new AppError("Insufficient wallet balance", 400, "INSUFFICIENT_BALANCE");
    }

    // Capture coin snapshots
    const coinBefore = Number(wallet.coinBalance);
    const coinAfter = Number(wallet.coinBalance);

    const finalMetadata = {
      ...(metadata || {}),
      walletBefore: balanceBefore.toString(),
      walletAfter: balanceAfter.toString(),
      coinBefore,
      coinAfter
    };

    // 3. Update Wallet Balance
    await client.wallet.update({
      where: { userId },
      data: { balance: balanceAfter }
    });

    // 4. Create Immutable Ledger Entry
    const financialSequenceId = generateSequenceId("FIN");
    const ledgerEntry = await client.ledgerEntry.create({
      data: {
        userId,
        amount: amountDecimal,
        balanceBefore,
        balanceAfter,
        type,
        transactionId,
        description,
        metadata: finalMetadata,
        financialSequenceId
      }
    });

    // 5. Create Immutable Audit Log
    await client.auditLog.create({
      data: {
        action: "LEDGER_WRITE",
        userId,
        entity: "ledgerEntry",
        entityId: ledgerEntry.id,
        ipAddress: context.ipAddress || "system",
        userAgent: context.userAgent || "internal",
        details: {
          walletBefore: balanceBefore.toString(),
          walletAfter: balanceAfter.toString(),
          requestHash: context.requestHash,
          correlationId: context.correlationId || financialSequenceId,
          type
        }
      }
    });


    console.log(`[LEDGER_CREATED] Ledger Entry ID: ${ledgerEntry.id} | User: ${userId} | Type: ${type} | Amount: ${amountDecimal} | BalanceAfter: ${balanceAfter}`);
    return { balanceAfter, ledgerEntry };
  };

  if (tx) {
    return await execute(tx);
  }

  return await prisma.$transaction(async (client) => {
    return await execute(client);
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
};

/**
 * Unified Ledger Service for all coin operations.
 * Ensures atomicity between wallet updates and immutable coin ledger entries.
 */
export const recordCoinEntry = async ({
  userId,
  amount,
  type, // 'EARNED' or 'REDEEMED'
  description = null,
  rechargeTxnId = null,
  sourceTransactionId = null,
  context = {},
  tx = null
}) => {
  const execute = async (client) => {
    // 0. Check soft/hard freeze mode
    const freezeStatus = await getFreezeStatus(userId);
    if (freezeStatus.isHard) {
      throw new AppError(freezeStatus.reason || "Financial operations are temporarily frozen for security review.", 403, "ACCOUNT_FROZEN");
    }
    if (freezeStatus.isSoft) {
      // SOFT FREEZE blocks all coin actions (EARNED, REDEEMED)
      throw new AppError("Rewards and redemptions are temporarily suspended.", 403, "ACCOUNT_SOFT_FROZEN");
    }

    // 1. Fetch wallet with lock to prevent race conditions
    const wallets = await client.$queryRaw`SELECT * FROM wallet WHERE userId = ${userId} FOR UPDATE`;
    if (!wallets || wallets.length === 0) throw new AppError("Wallet not found", 404, "WALLET_NOT_FOUND");
    const wallet = wallets[0];

    const coinAmount = Number(amount);
    const balanceBefore = Number(wallet.coinBalance);
    const isDebit = type === 'REDEEMED';
    const balanceAfter = isDebit ? balanceBefore - coinAmount : balanceBefore + coinAmount;

    // 2. Check for insufficient balance on debits
    if (isDebit && balanceAfter < 0) {
      throw new AppError("Insufficient coin balance", 400, "INSUFFICIENT_COIN_BALANCE");
    }

    // Capture snapshots
    const walletBefore = wallet.balance.toString();
    const walletAfter = wallet.balance.toString();

    const finalMetadata = {
      walletBefore,
      walletAfter,
      coinBefore: balanceBefore,
      coinAfter: balanceAfter
    };

    // 3. Update Wallet Balance
    await client.wallet.update({
      where: { userId },
      data: { coinBalance: balanceAfter }
    });

    // 4. Create Immutable Coin Transaction
    const financialSequenceId = generateSequenceId("COIN");
    const coinTxn = await client.coinTransaction.create({
      data: {
        userId,
        amount: coinAmount,
        type,
        description,
        rechargeTxnId,
        sourceTransactionId,
        metadata: finalMetadata,
        financialSequenceId
      }
    });

    // 5. Create Immutable Audit Log
    await client.auditLog.create({
      data: {
        action: "COIN_WRITE",
        userId,
        entity: "coinTransaction",
        entityId: coinTxn.id,
        ipAddress: context.ipAddress || "system",
        userAgent: context.userAgent || "internal",
        details: {
          coinBefore: balanceBefore,
          coinAfter: balanceAfter,
          requestHash: context.requestHash,
          correlationId: context.correlationId || financialSequenceId,
          type
        }
      }
    });


    console.log(`[COINS_${type}] Amount: ${coinAmount} | User: ${userId} | BalanceAfter: ${balanceAfter}`);
    return { balanceAfter, coinTxn };
  };

  if (tx) {
    return await execute(tx);
  }

  return await prisma.$transaction(async (client) => {
    return await execute(client);
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
};

/**
 * Creates a wallet snapshot for audit/performance.
 */
export const createWalletSnapshot = async (userId) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) return null;

  return await prisma.walletSnapshot.create({
    data: {
      userId,
      balance: wallet.balance,
      coinBalance: wallet.coinBalance
    }
  });
};

/**
 * Audit tool to verify that the wallet matches ledger history.
 */
export const verifyWalletIntegrity = async (userId, tx = null) => {
  const client = tx || prisma;
  
  const wallet = await client.wallet.findUnique({ where: { userId } });
  if (!wallet) return { success: true, driftBalance: new Prisma.Decimal(0), driftCoins: 0 };

  const ledgerSumObj = await client.ledgerEntry.aggregate({
    where: { userId },
    _sum: { amount: true }
  });
  const ledgerSum = new Prisma.Decimal(ledgerSumObj._sum.amount || 0);

  const earnedSum = await client.coinTransaction.aggregate({
    where: { userId, type: 'EARNED' },
    _sum: { amount: true }
  });
  const redeemedSum = await client.coinTransaction.aggregate({
    where: { userId, type: 'REDEEMED' },
    _sum: { amount: true }
  });
  const coinSum = (earnedSum._sum.amount || 0) - (redeemedSum._sum.amount || 0);

  const walletBalance = new Prisma.Decimal(wallet.balance);
  const walletCoinBalance = Number(wallet.coinBalance);

  const balanceMatches = walletBalance.equals(ledgerSum);
  const coinMatches = walletCoinBalance === coinSum;

  const driftBalance = walletBalance.minus(ledgerSum);
  const driftCoins = walletCoinBalance - coinSum;

  if (!balanceMatches || !coinMatches) {
    console.error(`[INTEGRITY_DRIFT] User: ${userId} | Wallet Bal: ${walletBalance} vs Ledger Sum: ${ledgerSum} (Drift: ${driftBalance}) | Wallet Coins: ${walletCoinBalance} vs Coin Sum: ${coinSum} (Drift: ${driftCoins})`);
  }

  return {
    success: balanceMatches && coinMatches,
    walletBalance,
    ledgerSum,
    walletCoinBalance,
    coinSum,
    driftBalance,
    driftCoins
  };
};

