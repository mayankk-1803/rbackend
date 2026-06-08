import express from "express";
import { auth } from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/admin.js";
import { masterKeySessionMiddleware } from "../middlewares/masterKeySessionMiddleware.js";
import { 
  getTransactionHistory, 
  getReportSummary, 
  getCommissionReport, 
  exportTransactions, 
  searchRecharge,
  getWebhookMetrics
} from "../controllers/reportController.js";

const router = express.Router();

// Ensure all routes in this file are admin-only and use the ADMIN_PANEL token type
router.use(auth, isAdmin);

/**
 * @route GET /api/admin/reports/transactions
 */
router.get("/transactions", getTransactionHistory);

/**
 * @route GET /api/admin/reports/summary
 */
router.get("/summary", getReportSummary);

/**
 * @route GET /api/admin/reports/commissions
 */
router.get("/commissions", getCommissionReport);

/**
 * @route GET /api/admin/reports/export
 */
router.get("/export", masterKeySessionMiddleware, exportTransactions);

/**
 * @route GET /api/admin/reports/search
 */
router.get("/search", searchRecharge);

/**
 * @route GET /api/admin/reports/webhook-metrics
 */
router.get("/webhook-metrics", getWebhookMetrics);

export default router;
