import express from "express";
import { auth } from "../middlewares/auth.js";
import { createPaymentLink } from "../services/walletService.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { getIO } from "../config/socket.js";

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

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.walletBalance += Number(amount);
    await user.save();

    // Create a successful transaction record
    await Transaction.create({
      userId,
      amount,
      type: "wallet",
      status: "success",
      gatewayTxnId: "SIM_" + Date.now(),
      paymentGateway: "simulated"
    });

    const io = getIO();
    io.emit("wallet_update", {
      userId: user._id,
      walletBalance: user.walletBalance,
      cashbackBalance: user.cashbackBalance
    });

    res.json({ success: true, message: "Money added successfully", balance: user.walletBalance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;