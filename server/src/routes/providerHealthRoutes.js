import express from "express";
import { auth } from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/admin.js";
import {
  getProviderHealthMetrics,
  getProviderHealthLogs
} from "../controllers/providerHealthController.js";

const router = express.Router();

// Require Admin Authorization for all health monitoring endpoints
router.use(auth, isAdmin);

/**
 * @route GET /api/admin/provider-health/metrics
 */
router.get("/metrics", getProviderHealthMetrics);

/**
 * @route GET /api/admin/provider-health/logs
 */
router.get("/logs", getProviderHealthLogs);

export default router;
