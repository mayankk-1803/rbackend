import express from "express";
import { auth } from "../middlewares/auth.js";
import { rechargeQueue } from "../config/rechargeQueue.js";
import { idempotencyMiddleware } from "../middlewares/idempotency.js";
import { fraudDetectionMiddleware } from "../middlewares/fraudDetection.js";

const router = express.Router();

router.post("/", auth, idempotencyMiddleware, fraudDetectionMiddleware, async (req, res) => {
  try {
    await rechargeQueue.add("recharge", {
      userId: req.user.id,
      ...req.body
    });

    console.log("✅ Job added");

    res.json({ success: true, message: "Recharge processing in background", data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to queue job" });
  }
});

export default router;