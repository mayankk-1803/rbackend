import express from "express";
import { apiAuth } from "../middlewares/apiAuth.js";
import { getOperator } from "../controllers/operatorController.js";
import { getPlans, recharge } from "../controllers/rechargeController.js";
import { validateRechargeInput } from "../middlewares/validateInput.js";
import { idempotency } from "../middlewares/idempotency.js";
import { fraudDetectionMiddleware } from "../middlewares/fraudDetection.js";
import { apiKeyRateLimiter } from "../middlewares/rateLimiter.js";
import prisma from "../config/prisma.js";
import axios from "axios";

const router = express.Router();

/**
 * Dedicated Developer API Routes (v1)
 * All routes here use x-api-key authentication and rate limiter
 */
router.use(apiAuth);
router.use(apiKeyRateLimiter);

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
    if (req.isSandbox) {
      return res.json({
        success: true,
        data: {
          balance: 50000.00,
          currency: "INR",
          environment: "SANDBOX"
        }
      });
    }

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
        currency: wallet.currency,
        environment: "PRODUCTION"
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
    const txnIdStr = req.params.id;
    
    // Sandbox Mock Response
    if (req.isSandbox || isNaN(Number(txnIdStr))) {
      return res.json({
        success: true,
        data: {
          id: parseInt(req.params.id) || 999999,
          amount: 10,
          mobile: "9876543210",
          operator: "JIO",
          status: "SUCCESS",
          provider: "SANDBOX_MOCK",
          providerTxnId: `SANDBOX_${Math.floor(100000 + Math.random() * 900000)}`,
          createdAt: new Date()
        }
      });
    }

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
  if (req.isSandbox) {
    const mockTxnId = Math.floor(100000 + Math.random() * 900000);
    
    // Simulate background mock webhook callback after 2 seconds
    setTimeout(async () => {
      try {
        const apiAccess = await prisma.apiAccess.findFirst({
          where: { userId: req.user.id }
        });
        
        if (apiAccess && apiAccess.webhookUrl) {
          const payload = {
            transactionId: mockTxnId,
            status: "SUCCESS",
            mobile: req.body.mobile,
            amount: req.body.amount,
            operatorCode: req.body.operatorCode,
            environment: "SANDBOX",
            timestamp: new Date().toISOString()
          };

          // Save Webhook Log
          const event = await prisma.webhookEvent.create({
            data: {
              apiAccessId: apiAccess.id,
              eventType: "recharge.success",
              payload: payload,
              deliveryStatus: "SUCCESS",
              responseCode: 200,
              retryCount: 0
            }
          });

          console.log(`[SANDBOX_WEBHOOK] Dispatching callback to ${apiAccess.webhookUrl} for txn ${mockTxnId}`);
          
          await axios.post(apiAccess.webhookUrl, payload, {
            headers: {
              "Content-Type": "application/json",
              "x-webhook-signature": "sandbox_signature_mock"
            }
          }).catch(err => {
            console.error("[SANDBOX_WEBHOOK_DELIVERY_FAILED] Error:", err.message);
            prisma.webhookEvent.update({
              where: { id: event.id },
              data: { 
                deliveryStatus: "FAILED", 
                responseCode: err.response?.status || 500 
              }
            }).catch(() => {});
          });
        }
      } catch (err) {
        console.error("[Sandbox Webhook Error]:", err.message);
      }
    }, 2000);

    return res.json({
      success: true,
      message: "Sandbox recharge processed successfully",
      data: {
        transactionId: mockTxnId
      }
    });
  }

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
