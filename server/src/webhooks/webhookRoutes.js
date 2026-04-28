import express from "express";
import eventBus from "../config/eventBus.js";
import prisma from "../config/prisma.js";

const router = express.Router();

router.post("/nexgate", async (req, res) => {
  console.log("🔥 Webhook HIT:", req.body);

  const { order_id, status } = req.body;

  const txn = await prisma.transaction.findUnique({
    where: { gatewayTxnId: order_id }
  });

  if (!txn) {
    console.log("❌ Transaction not found");
    return res.sendStatus(404);
  }

  if (status === "SUCCESS" && txn.status !== "SUCCESS") {
    const result = await prisma.$transaction(async (tx) => {
      // Update transaction
      const updatedTxn = await tx.transaction.update({
        where: { id: txn.id },
        data: { status: "SUCCESS" }
      });

      // Update wallet
      const updatedWallet = await tx.wallet.upsert({
        where: { userId: txn.userId },
        create: {
          userId: txn.userId,
          balance: txn.amount,
          cashbackBalance: 0
        },
        update: {
          balance: { increment: txn.amount }
        }
      });

      return { updatedTxn, updatedWallet };
    });

    console.log("Wallet credited");

    // 🔥 EVENT BUS EMIT: WALLET UPDATE
    eventBus.emit("wallet_update", {
      userId: result.updatedWallet.userId,
      walletBalance: result.updatedWallet.balance,
      cashbackBalance: result.updatedWallet.cashbackBalance
    });

    eventBus.emit("wallet_updated", { userId: txn.userId.toString() });

    // 🔥 EVENT BUS EMIT: TRANSACTION UPDATE
    eventBus.emit("recharge_update", {
      txnId: txn.id,
      status: "SUCCESS",
      transaction: result.updatedTxn
    });
  }

  if (status === "FAILED") {
    const updatedTxn = await prisma.transaction.update({
      where: { id: txn.id },
      data: { status: "FAILED" }
    });

    console.log("Payment failed");

    // 🔥 EVENT BUS EMIT: TRANSACTION UPDATE
    eventBus.emit("recharge_update", {
      txnId: txn.id,
      status: "FAILED",
      transaction: updatedTxn
    });
  }

  res.json({ ok: true });
});

export default router;