import express from "express";
import { auth } from "../middlewares/auth.js";
import { addRechargeJob } from "../services/queueService.js";
import { idempotencyMiddleware } from "../middlewares/idempotency.js";
import { fraudDetectionMiddleware } from "../middlewares/fraudDetection.js";
import { isValidIndianMobile } from "../utils/validators.js";
import { validateRechargeInput } from "../middlewares/validateInput.js";
import eventBus from "../config/eventBus.js";

import Transaction from "../models/Transaction.js";
import Wallet from "../models/Wallet.js";

const router = express.Router();

router.post("/", auth, validateRechargeInput, idempotencyMiddleware, fraudDetectionMiddleware, async (req, res) => {
  try {
    console.log("[Recharge] Incoming request body:", req.body);
    console.log("[Recharge] Authenticated user:", req.user);

    // Validation handled by middleware, but let's double check critical fields
    const { mobile, amount, operator, idempotencyKey } = req.body;
    
    if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: "User not authenticated correctly" });
    }

    const providerCode = req.body.providerCode ? String(req.body.providerCode) : null;
    const userId = req.user.id;

    console.log(`[Recharge] Attempting wallet deduction for user: ${userId}, amount: ${amount}`);

    // 1. ATOMIC WALLET DEDUCTION (Deduct BEFORE processing)
    let updatedWallet = null;
    const isAdmin = req.user?.role === 'admin';

    if (isAdmin) {
      // Admin bypass: Just deduct without balance check
      updatedWallet = await Wallet.findOneAndUpdate(
        { userId },
        { $inc: { balance: -amount } },
        { new: true, upsert: true }
      );
    } else {
      updatedWallet = await Wallet.findOneAndUpdate(
        { userId, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { new: true }
      );
    }

    if (!updatedWallet && !isAdmin) {
      console.log(`[Recharge] Insufficient balance for user: ${userId}`);
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    console.log(`[Recharge] Wallet deducted. New balance: ${updatedWallet.balance}`);

    // 🔥 Notify via eventBus
    eventBus.emit("wallet_updated", { userId: userId.toString() });
    
    eventBus.emit("wallet_update", {
        userId: updatedWallet.userId,
        walletBalance: updatedWallet.balance,
        cashbackBalance: updatedWallet.cashbackBalance
    });

    // 2. CREATE TRANSACTION (status: PENDING)
    const txn = await Transaction.create({
      userId: req.user.id,
      mobile,
      amount,
      operator,
      type: "recharge",
      status: "pending",
      idempotencyKey,
      retryCount: 0,
      amountDeducted: true // Mark that we've already deducted the money
    });

    // 3. PUSH JOB TO QUEUE
    await addRechargeJob({
      userId: req.user.id,
      txnId: txn._id,
      ...req.body
    });

    console.log(`✅ Job added for Transaction: ${txn._id}`);

    console.log(`[Recharge] Sending success response for txn: ${txn._id}`);
    res.json({ 
      success: true, 
      message: "Recharge processing in background", 
      data: { transactionId: txn._id, newBalance: updatedWallet.balance } 
    });
  } catch (err) {
    console.error("[Recharge Error] Failed to initiate:", err);
    res.status(500).json({ success: false, message: "Failed to initiate recharge" });
  }
});

router.get("/status/:id", auth, async (req, res) => {
  try {
    const txn = await Transaction.findOne({ _id: req.params.id, userId: req.user.id })
      .select("status amount mobile operator createdAt");
      
    if (!txn) return res.status(404).json({ success: false, message: "Transaction not found" });

    res.json({ success: true, data: txn });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;