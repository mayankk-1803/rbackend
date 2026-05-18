import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import AppError from "../utils/AppError.js";

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
  tx = null // Optional Prisma transaction client
}) => {
  const execute = async (client) => {
    // 1. Fetch wallet with lock
    const wallet = await client.wallet.findUnique({
      where: { userId }
    });

    if (!wallet) throw new AppError("Wallet not found", 404, "WALLET_NOT_FOUND");

    const amountDecimal = new Prisma.Decimal(amount);
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore.plus(amountDecimal);

    // 2. Check for insufficient balance on debits
    if (amountDecimal.isNegative() && balanceAfter.isNegative()) {
      throw new AppError("Insufficient wallet balance", 400, "INSUFFICIENT_BALANCE");
    }

    // 3. Update Wallet Balance
    await client.wallet.update({
      where: { userId },
      data: { balance: balanceAfter }
    });

    // 4. Create Immutable Ledger Entry
    const ledgerEntry = await client.ledgerEntry.create({
      data: {
        userId,
        amount: amountDecimal,
        balanceBefore,
        balanceAfter,
        type,
        transactionId,
        description,
        metadata
      }
    });

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
