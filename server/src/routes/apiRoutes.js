import express from "express";
import { auth } from "../middlewares/auth.js";
import { addRechargeJob } from "../services/queueService.js";
import { idempotencyMiddleware } from "../middlewares/idempotency.js";
import { fraudDetectionMiddleware } from "../middlewares/fraudDetection.js";
import { getOperator } from "../controllers/operatorController.js";
import { getWallet } from "../controllers/walletController.js";
import { validateRechargeInput } from "../middlewares/validateInput.js";
import eventBus from "../config/eventBus.js";
import prisma from "../config/prisma.js";

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
router.get("/operator-detect/:mobile", getOperator);

import { rechargeQueue } from "../services/rechargeService.js";

router.get("/test-job", async (req, res) => {
  await rechargeQueue.add("rechargeJob", {
    userId: 1,
    txnId: 999,
    mobile: "9999999999",
    operator: "JIO",
    amount: 10
  });

  res.send("Job added");
});

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
router.post("/recharge", auth, validateRechargeInput, idempotencyMiddleware, fraudDetectionMiddleware, async (req, res) => {
  try {
    const { mobile, amount, operator } = req.body;

    if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: "Unauthorized: User context missing" });
    }

    const providerCode = req.body.providerCode ? String(req.body.providerCode) : "auto";
    const userId = req.user.id;
    const isAdmin = req.user?.role === 'admin';

    // 1. ATOMIC WALLET DEDUCTION
    const result = await prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({
        where: { userId }
      });

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId, balance: 0, cashbackBalance: 0 }
        });
      }

      if (!isAdmin && wallet.balance.lessThan(amount)) {
        return null;
      }

      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: { balance: { decrement: amount } }
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount: new Prisma.Decimal(amount),
          type: "RECHARGE",
          status: "PENDING",
          direction: "DEBIT",
          mobile,
          operator: operator || "Unknown",
          provider: providerCode,
          idempotencyKey: req.headers["x-idempotency-key"] || Date.now().toString(),
          balanceAfter: updatedWallet.balance
        }
      });

      return { updatedWallet, transaction };
    });
    
    if (!result) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    const { updatedWallet, transaction } = result;

    // 🔥 Notify via eventBus
    eventBus.emit("wallet_updated", { userId: userId.toString() });

    // 3. Push to BullMQ queue
    await addRechargeJob({
      txnId: transaction.id,
      userId,
      mobile,
      amount,
      operator,
      providerCode
    });

    res.json({ 
      success: true, 
      message: "Recharge initiated", 
      data: { transactionId: transaction.id, newBalance: updatedWallet.balance } 
    });
  } catch (err) {
    console.error("[Recharge Init Error]:", err);
    res.status(500).json({ success: false, message: "Failed to initiate recharge" });
  }
});

router.get("/debug/transaction/:txnId", async (req, res) => {
  try {
    const txn = await prisma.transaction.findUnique({
      where: { id: parseInt(req.params.txnId) }
    });
    if (!txn) return res.status(404).json({ success: false, message: "Transaction not found" });
    res.json({ success: true, txn });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @swagger
 * /api/status/{id}:
 *   get:
 *     summary: Get transaction status
 *     tags: [Recharge]
 */
router.get("/status/:id", async (req, res) => {
  try {
    const txn = await prisma.transaction.findFirst({
      where: { 
        id: parseInt(req.params.id),
        userId: req.user.id 
      },
      select: {
        status: true,
        amount: true,
        mobile: true,
        operator: true,
        createdAt: true
      }
    });
      
    if (!txn) return res.status(404).json({ success: false, message: "Transaction not found" });

    res.json({ success: true, data: txn });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/wallet", getWallet);

router.get("/history", async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        status: true,
        amount: true,
        mobile: true,
        operator: true,
        type: true,
        provider: true,
        providerTxnId: true,
        createdAt: true
      }
    });

    res.json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
