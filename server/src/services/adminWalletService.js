import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";

/**
 * Retrieves the singleton Admin Wallet (id: 1) or creates it with zero balance.
 */
export const getOrCreateAdminWallet = async (tx = prisma) => {
  let wallet = await tx.adminWallet.findUnique({
    where: { id: 1 }
  });
  if (!wallet) {
    wallet = await tx.adminWallet.create({
      data: {
        id: 1,
        balance: new Prisma.Decimal(0.00),
        reservedBalance: new Prisma.Decimal(0.00),
        minimumOperationalBalance: new Prisma.Decimal(0.00),
        totalCredits: new Prisma.Decimal(0.00),
        totalDebits: new Prisma.Decimal(0.00)
      }
    });
  }
  return wallet;
};

/**
 * Calculates current wallet statistics including availableBalance.
 */
export const getAdminWalletStats = async (tx = prisma) => {
  const wallet = await getOrCreateAdminWallet(tx);
  const balance = Number(wallet.balance);
  const reservedBalance = Number(wallet.reservedBalance);
  const minimumOperationalBalance = Number(wallet.minimumOperationalBalance);
  const availableBalance = balance - reservedBalance - minimumOperationalBalance;

  return {
    balance,
    reservedBalance,
    minimumOperationalBalance,
    availableBalance,
    totalCredits: Number(wallet.totalCredits),
    totalDebits: Number(wallet.totalDebits),
    createdAt: wallet.createdAt,
    updatedAt: wallet.updatedAt
  };
};

/**
 * Atomically updates the admin wallet balance and creates a corresponding admin ledger entry.
 * Runs within the provided Prisma transaction or defaults to main.
 */
export const updateAdminWalletBalance = async ({
  amount,
  type,
  description,
  referenceId = null,
  metadata = null,
  tx = prisma
}) => {
  const amtVal = Number(amount);

  // Lock the admin wallet record
  const wallets = await tx.$queryRaw`SELECT * FROM admin_wallet WHERE id = 1 FOR UPDATE`;
  let wallet = wallets && wallets[0];
  if (!wallet) {
    wallet = await getOrCreateAdminWallet(tx);
  }

  const currentBalance = Number(wallet.balance);
  const newBalance = currentBalance + amtVal;

  if (newBalance < 0) {
    throw new Error("Operation rejected: Admin Master Wallet balance cannot go negative.");
  }

  let totalCredits = Number(wallet.totalCredits);
  let totalDebits = Number(wallet.totalDebits);

  if (amtVal > 0) {
    totalCredits += amtVal;
  } else if (amtVal < 0) {
    totalDebits += Math.abs(amtVal);
  }

  const updatedWallet = await tx.adminWallet.update({
    where: { id: 1 },
    data: {
      balance: new Prisma.Decimal(newBalance),
      totalCredits: new Prisma.Decimal(totalCredits),
      totalDebits: new Prisma.Decimal(totalDebits)
    }
  });

  // Create Ledger Entry
  await tx.adminLedger.create({
    data: {
      type,
      amount: new Prisma.Decimal(amtVal),
      openingBalance: new Prisma.Decimal(currentBalance),
      closingBalance: new Prisma.Decimal(newBalance),
      referenceId: referenceId ? String(referenceId) : null,
      description,
      metadata: metadata || {}
    }
  });

  return updatedWallet;
};

/**
 * Updates the minimum operational balance.
 */
export const updateMinimumOperationalBalance = async (minBalance, tx = prisma) => {
  const amt = Number(minBalance);
  if (isNaN(amt) || amt < 0) {
    throw new Error("Invalid minimum operational balance. Must be non-negative.");
  }

  const wallets = await tx.$queryRaw`SELECT * FROM admin_wallet WHERE id = 1 FOR UPDATE`;
  let wallet = wallets && wallets[0];
  if (!wallet) {
    wallet = await getOrCreateAdminWallet(tx);
  }

  return await tx.adminWallet.update({
    where: { id: 1 },
    data: {
      minimumOperationalBalance: new Prisma.Decimal(amt)
    }
  });
};
