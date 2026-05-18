import express from "express";
import eventBus from "../config/eventBus.js";
import prisma from "../config/prisma.js";
import { handleApiboxCallback } from "./rechargeWebhookController.js";
import { paymentWebhook } from "../controllers/paymentController.js";
import { webhookLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

// Apply webhook limiter to all routes in this router
router.use(webhookLimiter);

// Debug: Log all incoming webhook attempts
router.use((req, res, next) => {
  console.log(`[WEBHOOK ATTEMPT] ${req.method} ${req.originalUrl}`);
  console.log(`[WEBHOOK HEADERS]`, JSON.stringify(req.headers));
  next();
});

// Apibox callback support (GET & POST)
router.get("/apibox", handleApiboxCallback);
router.post("/apibox", handleApiboxCallback);

// NexGate Webhook - Use hardened controller logic
router.post("/nexgate", paymentWebhook);

export default router;