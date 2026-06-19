import express from "express";
import { auth } from "../middlewares/auth.js";
import { idempotency, requireIdempotency } from "../middlewares/idempotency.js";
import { fraudDetectionMiddleware } from "../middlewares/fraudDetection.js";
import { getOperator } from "../controllers/operatorController.js";
import { getWallet } from "../controllers/walletController.js";
import { getPlans, recharge, payPostpaidBill, initPrepaidRecharge, initPostpaidRecharge, refreshStatus, getActiveOperators, getDthPlans, validateDthCustomer } from "../controllers/rechargeController.js";
import { validateRechargeInput } from "../middlewares/validateInput.js";
import { rechargeInitLimiter } from "../middlewares/rateLimiter.js";
import prisma from "../config/prisma.js";
import { requireNoHardFreeze } from "../middlewares/freezeCheck.js";
import { encodeTxnId, decodeTxnId } from "../utils/referenceHelper.js";

const router = express.Router();

/**
 * @route GET /api/operator-detect/:mobile
 */
router.get("/operator-detect/:mobile", getOperator);

/**
 * @route GET /api/recharge/operators
 */
router.get("/recharge/operators", getActiveOperators);

/**
 * @route GET /api/recharge/plans
 */
router.get("/recharge/plans", getPlans);

/**
 * @route GET /api/recharge/dth/plans
 */
router.get("/recharge/dth/plans", rechargeInitLimiter, getDthPlans);

/**
 * @route POST /api/recharge/dth/validate
 */
router.post("/recharge/dth/validate", auth, rechargeInitLimiter, validateDthCustomer);

/**
 * @route POST /api/recharge/prepaid/init
 */
router.post("/recharge/prepaid/init", requireNoHardFreeze, rechargeInitLimiter, initPrepaidRecharge);

/**
 * @route POST /api/recharge/postpaid/init
 */
router.post("/recharge/postpaid/init", requireNoHardFreeze, rechargeInitLimiter, initPostpaidRecharge);

/**
 * @route POST /api/recharge/pay-postpaid-bill
 */
router.post("/recharge/pay-postpaid-bill", auth, requireNoHardFreeze, rechargeInitLimiter, payPostpaidBill);

/**
 * @route POST /api/recharge
 * @description SYNC Recharge Execution with Apibox via rechargeController
 */
router.post("/recharge", auth, requireNoHardFreeze, validateRechargeInput, idempotency, fraudDetectionMiddleware, recharge);

/**
 * Debug Transaction Status
 */
router.get("/debug/transaction/:txnId", async (req, res) => {
  try {
    const decodedId = decodeTxnId(req.params.txnId);
    if (isNaN(decodedId)) {
      return res.status(400).json({ success: false, message: "Invalid transaction ID" });
    }
    const txn = await prisma.transaction.findUnique({
      where: { id: decodedId }
    });
    res.json({ success: true, txn });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Get Status
 */
const getStatusHandler = async (req, res) => {
  try {
    const decodedId = decodeTxnId(req.params.id);
    if (isNaN(decodedId)) {
      return res.status(400).json({ success: false, message: "Invalid transaction ID" });
    }
    const txn = await prisma.transaction.findFirst({
      where: { id: decodedId, userId: req.user.id },
      select: { id: true, status: true, amount: true, mobile: true, operator: true, createdAt: true, providerTxnId: true, providerRef: true, providerRefId: true }
    });
    if (!txn) return res.status(404).json({ success: false, message: "Transaction not found" });
    
    const responseData = {
      ...txn,
      publicRef: encodeTxnId(txn.id),
      operatorReferenceId: txn.providerRef || txn.providerRefId || txn.providerTxnId || null
    };
    
    res.json({ success: true, data: responseData });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

router.get("/status/:id", auth, getStatusHandler);
router.get("/recharge/status/:id", auth, getStatusHandler);

router.get("/recharge/:txnId/refresh-status", auth, refreshStatus);

router.get("/wallet", auth, getWallet);

router.get("/history", auth, async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    const mappedTransactions = transactions.map(tx => ({
      ...tx,
      publicRef: encodeTxnId(tx.id)
    }));
    res.json({ success: true, data: mappedTransactions });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
