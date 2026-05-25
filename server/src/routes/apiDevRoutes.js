import express from "express";
import { apiAuth } from "../middlewares/apiAuth.js";
import { getOperator } from "../controllers/operatorController.js";
import { getPlans, recharge } from "../controllers/rechargeController.js";
import { validateRechargeInput } from "../middlewares/validateInput.js";
import { idempotency } from "../middlewares/idempotency.js";
import { fraudDetectionMiddleware } from "../middlewares/fraudDetection.js";
import prisma from "../config/prisma.js";

const router = express.Router();

/**
 * Dedicated Developer API Routes (v1)
 * All routes here use x-api-key authentication
 */
router.use(apiAuth);

/**
 * @route GET /api/v1/operator/:mobile
 * @desc Detect mobile operator
 */
router.get("/operator/:mobile", getOperator);

/**
 * @route GET /api/v1/plans
 * @desc Fetch recharge plans
 */
router.get("/plans", getPlans);

/**
 * @route GET /api/v1/wallet
 * @desc Get developer wallet balance
 */
router.get("/wallet", async (req, res) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id }
    });
    
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Wallet not found" });
    }

    res.json({
      success: true,
      data: {
        balance: wallet.balance,
        currency: wallet.currency
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/**
 * @route GET /api/v1/status/:id
 * @desc Get transaction status
 */
router.get("/status/:id", async (req, res) => {
  try {
    const txn = await prisma.transaction.findFirst({
      where: { 
        id: parseInt(req.params.id),
        userId: req.user.id 
      },
      select: {
        id: true,
        amount: true,
        mobile: true,
        operator: true,
        status: true,
        provider: true,
        providerTxnId: true,
        createdAt: true
      }
    });
      
    if (!txn) return res.status(404).json({ success: false, message: "Transaction not found" });
    res.json({ success: true, data: txn });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * Custom wrapper to transform standard recharge controller output into developer format
 */
const devRechargeWrapper = async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body && body.success && body.transactionId) {
      return originalJson({
        success: true,
        message: body.message || "Recharge initiated",
        data: {
          transactionId: body.transactionId
        }
      });
    }
    return originalJson(body);
  };
  return recharge(req, res, next);
};

/**
 * @route POST /api/v1/recharge
 * @desc Execute SYNC recharge (Apibox)
 */
router.post("/recharge", validateRechargeInput, idempotency, fraudDetectionMiddleware, devRechargeWrapper);

export default router;
