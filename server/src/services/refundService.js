import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { recordFinancialEntry } from "./ledgerService.js";

export const processRefund = async (txn) => {
  if (txn.refundStatus === "processed" || !txn.amountDeducted) return;

  await prisma.$transaction(async (tx) => {
    // 1. Double check and lock transaction status
    const lockedTxn = await tx.transaction.findUnique({
      where: { id: txn.id }
    });

    if (!lockedTxn || lockedTxn.refundStatus === "processed") {
      console.log(`[REFUND][SKIPPED] → Transaction #${txn.id} refund already processed.`);
      return;
    }

    // 2. Increment wallet balance and create ledger entry via recordFinancialEntry
    await recordFinancialEntry({
      userId: txn.userId,
      amount: txn.amount,
      type: 'REFUND_CREDIT',
      transactionId: txn.id,
      description: `Refund processed for transaction #${txn.id}`,
      tx
    });

    // 3. Update transaction status
    await tx.transaction.update({
      where: { id: txn.id },
      data: {
        refundStatus: "processed",
        refundedAt: new Date(),
        status: "FAILED"
      }
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });

  console.log(`Refund processed safely for transaction: ${txn.id}`);
};
