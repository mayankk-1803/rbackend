import express from "express";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { getIO } from "../config/socket.js";

const router = express.Router();

router.post("/nexgate", async (req, res) => {
  console.log("🔥 Webhook HIT:", req.body);
  const io = getIO();

  const { order_id, status } = req.body;

  const txn = await Transaction.findOne({ gatewayTxnId: order_id });

  if (!txn) {
    console.log("❌ Transaction not found");
    return res.sendStatus(404);
  }

  if (status === "SUCCESS" && txn.status !== "success") {
    txn.status = "success";
    await txn.save();

    const user = await User.findByIdAndUpdate(
      txn.userId,
      { $inc: { walletBalance: txn.amount } },
      { new: true }
    );

    console.log("Wallet credited");

    // 🔥 SOCKET EMIT: WALLET UPDATE
    io.emit("wallet_update", {
      userId: user._id,
      walletBalance: user.walletBalance,
      cashbackBalance: user.cashbackBalance
    });

    // 🔥 SOCKET EMIT: TRANSACTION UPDATE
    io.emit("recharge_update", {
      txnId: txn._id,
      status: "success",
      transaction: txn
    });
  }

  if (status === "FAILED") {
    txn.status = "failed";
    await txn.save();

    console.log("Payment failed");

    // 🔥 SOCKET EMIT: TRANSACTION UPDATE
    io.emit("recharge_update", {
      txnId: txn._id,
      status: "failed",
      transaction: txn
    });
  }

  res.json({ ok: true });
});

export default router;