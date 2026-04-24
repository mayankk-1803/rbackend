import express from "express";
import { auth } from "../middlewares/auth.js";
import { addRechargeJob } from "../services/queueService.js";
import { idempotencyMiddleware } from "../middlewares/idempotency.js";
import { fraudDetectionMiddleware } from "../middlewares/fraudDetection.js";
import { isValidIndianMobile } from "../utils/validators.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import { getOperator } from "../controllers/operatorController.js";
import { validateRechargeInput } from "../middlewares/validateInput.js";
import eventBus from "../config/eventBus.js";

const router = express.Router();

/**
 * @swagger
 * /api/operator-detect/{mobile}:
 *   get:
 *     summary: Detect mobile operator (Real + Fallback)
 *     tags: [Recharge]
 *     parameters:
 *       - in: path
 *         name: mobile
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Operator details
 */
// Public route for operator detection
router.get("/operator-detect/:mobile", getOperator);

router.use(auth);

/**
 * @swagger
 * /api/recharge:
 *   post:
 *     summary: Initiate a mobile recharge
 *     tags: [Recharge]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-idempotency-key
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mobile:
 *                 type: string
 *               amount:
 *                 type: number
 *               providerCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Recharge initiated
 */
// POST /api/recharge
router.post("/recharge", auth, validateRechargeInput, idempotencyMiddleware, fraudDetectionMiddleware, async (req, res) => {
  try {
    console.log("[API Recharge] Request body:", req.body);
    console.log("[API Recharge] User:", req.user);

    const { mobile, amount, operator } = req.body;

    if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: "Unauthorized: User context missing" });
    }

    const providerCode = req.body.providerCode ? String(req.body.providerCode) : null;
    const userId = req.user.id;

    console.log(`[Recharge] Checking balance for userId: ${userId}, amount: ${amount}`);

    // 1. ATOMIC WALLET DEDUCTION
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
      console.log(`[Recharge] Insufficient balance for userId: ${userId}`);
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    console.log(`[Recharge] Wallet deducted. New Balance: ${updatedWallet.balance}`);

    // 🔥 Notify via eventBus
    eventBus.emit("wallet_updated", { userId: userId.toString() });

    // 2. Create transaction (PENDING)
    const transaction = await Transaction.create({
      userId,
      amount,
      type: "recharge",
      status: "pending",
      mobile,
      operator: operator || "Unknown",
      provider: providerCode || "auto",
      amountDeducted: true,
      idempotencyKey: req.headers["x-idempotency-key"] || Date.now().toString()
    });

    // 3. Push to BullMQ queue
    await addRechargeJob({
      txnId: transaction._id,
      userId,
      mobile,
      amount,
      operator,
      providerCode
    });

    res.json({ 
      success: true, 
      message: "Recharge initiated", 
      data: { transactionId: transaction._id, newBalance: updatedWallet.balance } 
    });
  } catch (err) {
    console.error("[Recharge Init Error]:", err);
    res.status(500).json({ success: false, message: "Failed to initiate recharge" });
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

// GET /api/wallet
router.get("/wallet", async (req, res) => {
  try {
    console.log(`[API] Fetching wallet for userId: ${req.user.id}`);
    const wallet = await Wallet.findOne({ userId: req.user.id });
    
    if (!wallet) {
      // Upsert if missing (as requested by user)
      const newWallet = await Wallet.findOneAndUpdate(
        { userId: req.user.id },
        { $setOnInsert: { balance: 0, cashbackBalance: 0 } },
        { upsert: true, new: true }
      );
      return res.json(newWallet);
    }

    res.json(wallet);
  } catch (err) {
    console.error("[API Wallet Error]:", err);
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
