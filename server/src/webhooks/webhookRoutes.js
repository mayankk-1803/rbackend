import express from "express";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";

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

    await User.findByIdAndUpdate(txn.userId, {
      $inc: { walletBalance: txn.amount }
    });

    console.log("Wallet credited");
  }

  if (status === "FAILED") {
    txn.status = "failed";
    await txn.save();

    console.log("Payment failed");
  }

  res.json({ ok: true });
});

export default router;