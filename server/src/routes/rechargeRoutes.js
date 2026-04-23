import express from "express";
import { auth } from "../middlewares/auth.js";
import { addRechargeJob } from "../services/queueService.js";
import { idempotencyMiddleware } from "../middlewares/idempotency.js";
import { fraudDetectionMiddleware } from "../middlewares/fraudDetection.js";
import { isValidIndianMobile } from "../utils/validators.js";

import Transaction from "../models/Transaction.js";

const router = express.Router();

router.post("/", auth, idempotencyMiddleware, fraudDetectionMiddleware, async (req, res) => {
  try {
    const { mobile, amount, operator, idempotencyKey } = req.body;
    
    if (!isValidIndianMobile(mobile)) {
      return res.status(400).json({ success: false, message: "Invalid mobile number" });
    }

    // 🔥 CREATE TRANSACTION BEFORE QUEUE (To avoid UI 404/pending issues)
    const txn = await Transaction.create({
      userId: req.user.id,
      mobile,
      amount,
      operator,
      type: "recharge",
      status: "pending",
      idempotencyKey,
      retryCount: 0
    });

    await addRechargeJob({
      userId: req.user.id,
      txnId: txn._id, // Pass txnId to worker
      ...req.body
    });

    console.log(`✅ Job added for Transaction: ${txn._id}`);

    res.json({ 
      success: true, 
      message: "Recharge processing in background", 
      data: { transactionId: txn._id } 
    });
  } catch (err) {
    console.error("Queue error:", err);
    res.status(500).json({ success: false, message: "Failed to queue job" });
  }
});

export default router;