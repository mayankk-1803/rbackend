import express from "express";
import { auth } from "../middlewares/auth.js";
import { createOrder, verifyPayment, confirmPayment, paymentWebhook, getPaymentStatus } from "../controllers/paymentController.js";
import { idempotency } from "../middlewares/idempotency.js";
import { validatePaymentInput } from "../middlewares/validateInput.js";
import { paymentStatusLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

/**
 * @swagger
 * /api/payment/webhook:
 *   post:
 *     summary: Payment Webhook Simulation
 *     tags: [Payment]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: x-webhook-secret
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentId:
 *                 type: string
 *               status:
 *                 type: string
 *               gatewayTxnId:
 *                 type: string
 *               errorMessage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook processed
 */
router.post("/webhook", paymentWebhook);

// Payment Status API for Success Page
router.get("/status/:orderId", auth, paymentStatusLimiter, getPaymentStatus);

router.use(auth);

/**
 * @swagger
 * /api/payment/create-order:
 *   post:
 *     summary: Create a Fake UPI Payment Order
 *     tags: [Payment]
 *     parameters:
 *       - in: header
 *         name: x-idempotency-key
 *         required: false
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               upiId:
 *                 type: string
 *               intent:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order created
 */
router.post("/create-order", validatePaymentInput, idempotency, createOrder);

/**
 * @swagger
 * /api/payment/confirm:
 *   post:
 *     summary: Confirm Payment (Simulate success)
 *     tags: [Payment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment confirmed and wallet updated
 */
router.post("/confirm", confirmPayment);

/**
 * @swagger
 * /api/payment/verify:
 *   post:
 *     summary: Verify Payment Status
 *     tags: [Payment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment details returned
 */
router.post("/verify", verifyPayment);

export default router;
