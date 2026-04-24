import express from "express";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import eventBus from "../config/eventBus.js";

const router = express.Router();

router.post("/nexgate", async (req, res) => {
  console.log("🔥 Webhook HIT:", req.body);

  const { order_id, status } = req.body;

  const txn = await Transaction.findOne({ gatewayTxnId: order_id });

  if (!txn) {
    console.log("❌ Transaction not found");
    return res.sendStatus(404);
  }

  if (status === "SUCCESS" && txn.status !== "success") {
    txn.status = "success";
    await txn.save();

    const updatedWallet = await Wallet.findOneAndUpdate(
      { userId: txn.userId },
      { $inc: { balance: txn.amount } },
      { new: true, upsert: true }
    );

    console.log("Wallet credited");

    // 🔥 EVENT BUS EMIT: WALLET UPDATE
    eventBus.emit("wallet_update", {
      userId: updatedWallet.userId,
      walletBalance: updatedWallet.balance,
      cashbackBalance: updatedWallet.cashbackBalance
    });

    eventBus.emit("wallet_updated", { userId: txn.userId.toString() });

    // 🔥 EVENT BUS EMIT: TRANSACTION UPDATE
    eventBus.emit("recharge_update", {
      txnId: txn._id,
      status: "success",
      transaction: txn
    });
  }

  if (status === "FAILED") {
    txn.status = "failed";
    await txn.save();

    console.log("Payment failed");

    // 🔥 EVENT BUS EMIT: TRANSACTION UPDATE
    eventBus.emit("recharge_update", {
      txnId: txn._id,
      status: "failed",
      transaction: txn
    });
  }

  res.json({ ok: true });
});

export default router;