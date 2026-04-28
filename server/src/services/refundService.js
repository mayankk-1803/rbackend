import prisma from "../config/prisma.js";

export const processRefund = async (txn) => {
  if (txn.refundStatus === "processed" || !txn.amountDeducted) return;

  await prisma.$transaction(async (tx) => {
    // Increment wallet balance
    await tx.wallet.update({
      where: { userId: txn.userId },
      data: { balance: { increment: txn.amount } }
    });

    // Update transaction status
    await tx.transaction.update({
      where: { id: txn.id },
      data: {
        refundStatus: "processed",
        refundedAt: new Date(),
        status: "FAILED" // Usually refund happens on failure
      }
    });
  });

  console.log(`Refund processed safely for transaction: ${txn.id}`);
};
