import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";

/**
 * Fintech-safe balance update with row-level locking
 * @param {number} userId 
 * @param {number} amountChange - Positive for credit, negative for debit
 * @param {string} type - TransactionType (e.g., RECHARGE, TOPUP)
 * @param {object} metadata - Extra fields for the transaction record
 */
export const updateWalletBalance = async (userId, amountChange, type, metadata = {}) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Check idempotency if key provided
    if (metadata.idempotencyKey) {
      const existingTxn = await tx.transaction.findUnique({
        where: { idempotencyKey: metadata.idempotencyKey }
      });
      if (existingTxn) {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        return { wallet, transaction: existingTxn };
      }
    }

    // 2. Fetch wallet (Prisma ORM replaces raw SQL, Serializable handles locking)

    const wallet = await tx.wallet.findUnique({
      where: { userId }
    });

    if (!wallet) throw new Error("WALLET_NOT_FOUND");

    const changeDecimal = new Prisma.Decimal(amountChange);
    const newBalance = wallet.balance.plus(changeDecimal);

    // 3. Check for insufficient balance if debiting
    if (amountChange < 0 && newBalance.isNegative()) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    // 4. Update Wallet
    const updatedWallet = await tx.wallet.update({
      where: { userId },
      data: { balance: newBalance }
    });

    // 5. Create Transaction Record
    const transaction = await tx.transaction.create({
      data: {
        userId,
        amount: changeDecimal.abs(),
        type: type || metadata.type || "WALLET",
        status: metadata.status || "SUCCESS",
        balanceAfter: newBalance,
        direction: amountChange >= 0 ? "CREDIT" : "DEBIT",
        providerTxnId: metadata.providerTxnId || metadata.gatewayTxnId || `TXN_${Date.now()}`,
        idempotencyKey: metadata.idempotencyKey || null,
        mobile: metadata.mobile || null,
        operator: metadata.operator || null
      }
    });

    return { wallet: updatedWallet, transaction };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
};

export const createPaymentLink = async (userId, amount) => {
  const orderId = "ORD_" + Date.now();

  await prisma.transaction.create({
    data: {
      userId,
      amount: new Prisma.Decimal(amount),
      type: "TOPUP",
      status: "PENDING",
      providerTxnId: orderId,
      direction: "CREDIT"
    }
  });

  return `https://fake-payment.com/pay/${orderId}`;
};

export const getWallet = async (userId) => {
  return await prisma.wallet.findUnique({
    where: { userId }
  });
};
