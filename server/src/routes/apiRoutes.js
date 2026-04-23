import express from "express";
import { auth } from "../middlewares/auth.js";
import { addRechargeJob } from "../services/queueService.js";
import { idempotencyMiddleware } from "../middlewares/idempotency.js";
import { fraudDetectionMiddleware } from "../middlewares/fraudDetection.js";
import { isValidIndianMobile } from "../utils/validators.js";
import Transaction from "../models/Transaction.js";

const router = express.Router();

router.use(auth);

// POST /api/recharge
router.post("/recharge", idempotencyMiddleware, fraudDetectionMiddleware, async (req, res) => {
  try {
    const { mobile, amount, providerCode } = req.body;
    
    if (!isValidIndianMobile(mobile)) {
      return res.status(400).json({ success: false, message: "Invalid mobile number" });
    }

    await addRechargeJob({
      userId: req.user.id,
      ...req.body
    });

    res.json({ success: true, message: "Recharge submitted successfully", data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to submit recharge" });
  }
});

// GET /api/status/:id
router.get("/status/:id", async (req, res) => {
  try {
    const txn = await Transaction.findOne({ _id: req.params.id, userId: req.user.id })
      .select("status amount mobile operator createdAt");
      
    if (!txn) return res.status(404).json({ success: false, message: "Transaction not found" });

    res.json({ success: true, data: txn });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/history
router.get("/history", async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("status amount mobile operator type provider providerTxnId createdAt");

    res.json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
