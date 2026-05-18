import express from "express";
import { auth } from "../middlewares/auth.js";
import { idempotency, requireIdempotency } from "../middlewares/idempotency.js";
import { fraudDetectionMiddleware } from "../middlewares/fraudDetection.js";
import { getOperator } from "../controllers/operatorController.js";
import { getWallet } from "../controllers/walletController.js";
import { getPlans, recharge, payPostpaidBill } from "../controllers/rechargeController.js";
import { validateRechargeInput } from "../middlewares/validateInput.js";
import prisma from "../config/prisma.js";

const router = express.Router();

/**
 * @route GET /api/operator-detect/:mobile
 */
router.get("/operator-detect/:mobile", getOperator);

/**
 * @route GET /api/recharge/plans
 */
router.get("/recharge/plans", getPlans);

/**
 * @route POST /api/recharge/pay-postpaid-bill
 */
router.post("/recharge/pay-postpaid-bill", auth, payPostpaidBill);

/**
 * @route POST /api/recharge
 * @description SYNC Recharge Execution with Apibox via rechargeController
 */
router.post("/recharge", auth, validateRechargeInput, idempotency, fraudDetectionMiddleware, recharge);

/**
 * Debug Transaction Status
 */
router.get("/debug/transaction/:txnId", async (req, res) => {
  try {
    const txn = await prisma.transaction.findUnique({
      where: { id: parseInt(req.params.txnId) }
    });
    res.json({ success: true, txn });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Get Status
 */
router.get("/status/:id", auth, async (req, res) => {
  try {
    const txn = await prisma.transaction.findFirst({
      where: { id: parseInt(req.params.id), userId: req.user.id },
      select: { status: true, amount: true, mobile: true, operator: true, createdAt: true, providerTxnId: true }
    });
    if (!txn) return res.status(404).json({ success: false, message: "Transaction not found" });
    res.json({ success: true, data: txn });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/wallet", auth, getWallet);

router.get("/history", auth, async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
