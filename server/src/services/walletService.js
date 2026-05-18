import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { recordFinancialEntry } from "./ledgerService.js";
import AppError from "../utils/AppError.js";

/**
 * Fintech-safe balance update using the unified ledger architecture.
 */
export const updateWalletBalance = async (userId, amountChange, type, metadata = {}) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Idempotency Check
    if (metadata.idempotencyKey) {
      const existingTxn = await tx.transaction.findUnique({
        where: { idempotencyKey: metadata.idempotencyKey }
      });
      if (existingTxn) {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        return { wallet, transaction: existingTxn };
      }
    }

    // 2. Map transaction type to ledger type
    const ledgerTypeMap = {
      'RECHARGE': 'RECHARGE_DEBIT',
      'TOPUP': 'TOPUP_CREDIT',
      'REFUND': 'REFUND_CREDIT',
      'CASHBACK': 'CASHBACK_CREDIT',
      'REDEMPTION': 'REDEMPTION_DEBIT'
    };

    const ledgerType = ledgerTypeMap[type] || 'ADMIN_ADJUSTMENT';

    // 3. Create Transaction Record (Financial Shell)
    const transaction = await tx.transaction.create({
      data: {
        userId,
        amount: new Prisma.Decimal(Math.abs(amountChange)),
        type: type || "WALLET",
        status: metadata.status || "SUCCESS",
        direction: amountChange >= 0 ? "CREDIT" : "DEBIT",
        providerTxnId: metadata.providerTxnId || `TXN_${Date.now()}`,
        idempotencyKey: metadata.idempotencyKey || null,
        mobile: metadata.mobile || null,
        operator: metadata.operator || null,
        description: metadata.description || null
      }
    });

    // 4. Record Financial Entry (Wallet Update + Ledger)
    const { balanceAfter } = await recordFinancialEntry({
      userId,
      amount: amountChange,
      type: ledgerType,
      transactionId: transaction.id,
      description: metadata.description,
      tx
    });

    // 5. Update transaction with final balance
    const updatedTransaction = await tx.transaction.update({
      where: { id: transaction.id },
      data: { balanceAfter }
    });

    const updatedWallet = await tx.wallet.findUnique({ where: { userId } });

    return { wallet: updatedWallet, transaction: updatedTransaction };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
};

export const getWallet = async (userId) => {
  return await prisma.wallet.findUnique({
    where: { userId }
  });
};
