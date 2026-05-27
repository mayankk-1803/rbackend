import express from "express";
import { auth } from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/admin.js"; 
import { 
  getDashboard, 
  getTopUsers, 
  retryTxn, 
  getRetryStats, 
  getTransactions, 
  getAlerts, 
  getProviders, 
  setActiveProvider,
  getCharts,
  compareRecharge,
  topUpWallet,
  getAdminWallet,
  getUsers,
  getUsersStats,
  getSingleUser,
  toggleUserStatus,
  sendTemporaryPassword,
  getCashbackSettings,
  updateCashbackSettings,
  retryReconciliation,
  approveApiAccess,
  rejectApiAccess,
  getApiPartnersSummary,
  togglePartnerActiveState,
  rotatePartnerKeys,
  updatePartnerRateLimit,
  updatePartnerEnvironment,
  getPartnerWebhookEvents,
  replayPartnerWebhookEvent,
  getPartnerUsageLogs
} from "../controllers/adminController.js";
import { getCommissionReport } from "../controllers/reportController.js";
import { resolveDispute, getAllDisputes } from "../controllers/disputeController.js";


import { 
  getAdminWalletStats, 
  initiateAdminTopup, 
  verifyAdminTopup 
} from "../controllers/adminWalletController.js";

const router = express.Router();

router.use(auth, isAdmin); 

router.get("/dashboard", getDashboard);
router.get("/users", getUsers);
router.get("/users/stats", getUsersStats);
router.get("/users/:id", getSingleUser);
router.patch("/users/:id/status", toggleUserStatus);
router.patch("/users/:id/send-temp-password", sendTemporaryPassword);
router.get("/top-users", getTopUsers);
router.post("/retry/:id", retryTxn);
router.post("/reconcile/:id", retryReconciliation);
router.get("/retry-stats", getRetryStats);
router.get("/transactions", getTransactions);
router.get("/alerts", getAlerts);
router.get("/providers", getProviders);
router.post("/providers/set-active", setActiveProvider);
router.get("/charts", getCharts);
router.post("/compare-recharge", compareRecharge);
router.post("/topup", topUpWallet);
router.get("/wallet", getAdminWallet);
router.post("/api-access/approve", approveApiAccess);
router.get("/api-access/partners", getApiPartnersSummary);
router.post("/api-access/reject", rejectApiAccess);
router.put("/api-access/toggle-active", togglePartnerActiveState);
router.post("/api-access/rotate", rotatePartnerKeys);
router.put("/api-access/rate-limit", updatePartnerRateLimit);
router.put("/api-access/environment", updatePartnerEnvironment);
router.get("/api-access/webhook-events", getPartnerWebhookEvents);
router.post("/api-access/webhook-events/replay", replayPartnerWebhookEvent);
router.get("/api-access/usage", getPartnerUsageLogs);

// New Modular Wallet Routes
router.get("/wallet/stats", getAdminWalletStats);
router.post("/wallet/topup", initiateAdminTopup);
router.get("/wallet/verify/:orderId", verifyAdminTopup);

// V3 Fintech Routes
router.get("/reports/commission", getCommissionReport);
router.get("/cashback/settings", getCashbackSettings);
router.patch("/cashback/settings", updateCashbackSettings);
router.patch("/disputes/:id", resolveDispute);
router.get("/disputes", getAllDisputes);



export default router;
