import express from "express";
import { auth } from "../middlewares/auth.js";
import { addRechargeJob } from "../services/queueService.js";
import { idempotencyMiddleware } from "../middlewares/idempotency.js";
import { fraudDetectionMiddleware } from "../middlewares/fraudDetection.js";
import { isValidIndianMobile } from "../utils/validators.js";

const router = express.Router();

router.post("/", auth, idempotencyMiddleware, fraudDetectionMiddleware, async (req, res) => {
  try {
    const { mobile } = req.body;
    
    if (!isValidIndianMobile(mobile)) {
      return res.status(400).json({ success: false, message: "Invalid mobile number" });
    }

    await addRechargeJob({
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