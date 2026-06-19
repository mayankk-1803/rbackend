import express from "express";
import { auth } from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/admin.js";
import { masterKeySessionMiddleware } from "../middlewares/masterKeySessionMiddleware.js";
import {
  getCommissionAnalytics,
  getOperatorPerformance,
  getFinancialAnalytics,
  globalSearch,
  generateSummaryReport
} from "../controllers/analyticsController.js";

const router = express.Router();

// Secure all reporting endpoints with Admin JWT authorization
router.use(auth, isAdmin);

/**
 * @route GET /api/admin/analytics/commissions
 */
router.get("/commissions", getCommissionAnalytics);

/**
 * @route GET /api/admin/analytics/operators
 */
router.get("/operators", getOperatorPerformance);

/**
 * @route GET /api/admin/analytics/financials
 */
router.get("/financials", getFinancialAnalytics);

/**
 * @route GET /api/admin/analytics/search
 */
router.get("/search", globalSearch);

/**
 * @route GET /api/admin/analytics/reports/generate
 */
router.get("/reports/generate", masterKeySessionMiddleware, generateSummaryReport);

export default router;
