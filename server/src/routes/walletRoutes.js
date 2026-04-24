import express from "express";
import { auth } from "../middlewares/auth.js";
import { createPaymentLink } from "../services/walletService.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import eventBus from "../config/eventBus.js";

const router = express.Router();

router.post("/add-money", auth, async (req, res) => {
  const url = await createPaymentLink(req.user.id, req.body.amount);
  res.json({ paymentUrl: url });
});

// For simulation/instant update as per requirements
router.post("/top-up", auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    const updatedWallet = await Wallet.findOneAndUpdate(
      { userId },
      { $inc: { balance: Number(amount) } },
      { new: true, upsert: true }
    );

    // Create a successful transaction record
    await Transaction.create({
      userId,
      amount,
      type: "wallet",
      status: "success",
      gatewayTxnId: "SIM_" + Date.now(),
      paymentGateway: "simulated"
    });

    eventBus.emit("wallet_update", {
      userId: updatedWallet.userId,
      walletBalance: updatedWallet.balance,
      cashbackBalance: updatedWallet.cashbackBalance
    });

    eventBus.emit("wallet_updated", { userId: userId.toString() });

    res.json({ success: true, message: "Money added successfully", balance: updatedWallet.balance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;