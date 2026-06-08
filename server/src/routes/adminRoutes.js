  import express from "express";
import { auth } from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/admin.js"; 
import { masterKeySessionMiddleware } from "../middlewares/masterKeySessionMiddleware.js";
import { verifyMasterKey, createSuperAdmin, deleteSuperAdmin, getSuperAdmins } from "../controllers/enterpriseController.js";
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
  getPartnerUsageLogs,
  getApiMarketplaceProducts,
  getApiMarketplacePlans,
  getApiMarketplaceBilling,
  getApiMarketplaceThreats,
  getApiDocsMetadata,
  downloadApiDocs,
  getApiDocsRegistry
} from "../controllers/adminController.js";
import { getCommissionReport } from "../controllers/reportController.js";
import { resolveDispute, getAllDisputes } from "../controllers/disputeController.js";
import { 
  getKeys, 
  generateKeys, 
  toggleKeyStatus,
  getAdminDeveloperAnalytics
} from "../controllers/developerController.js";


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
router.patch("/users/:id/status", masterKeySessionMiddleware, toggleUserStatus);
router.patch("/users/:id/send-temp-password", masterKeySessionMiddleware, sendTemporaryPassword);
router.get("/top-users", getTopUsers);
router.post("/retry/:id", masterKeySessionMiddleware, retryTxn);
router.post("/reconcile/:id", masterKeySessionMiddleware, retryReconciliation);
router.get("/retry-stats", getRetryStats);
router.get("/transactions", getTransactions);
router.get("/alerts", getAlerts);
router.get("/providers", getProviders);
router.post("/providers/set-active", masterKeySessionMiddleware, setActiveProvider);
router.get("/charts", getCharts);
router.post("/compare-recharge", compareRecharge);
router.post("/topup", masterKeySessionMiddleware, topUpWallet);
router.get("/wallet", getAdminWallet);
router.post("/api-access/approve", masterKeySessionMiddleware, approveApiAccess);
router.get("/api-access/partners", getApiPartnersSummary);
router.post("/api-access/reject", masterKeySessionMiddleware, rejectApiAccess);
router.put("/api-access/toggle-active", masterKeySessionMiddleware, togglePartnerActiveState);
router.post("/api-access/rotate", masterKeySessionMiddleware, rotatePartnerKeys);
router.put("/api-access/rate-limit", masterKeySessionMiddleware, updatePartnerRateLimit);
router.put("/api-access/environment", masterKeySessionMiddleware, updatePartnerEnvironment);
router.get("/api-access/webhook-events", getPartnerWebhookEvents);
router.post("/api-access/webhook-events/replay", masterKeySessionMiddleware, replayPartnerWebhookEvent);
router.get("/api-access/usage", getPartnerUsageLogs);

// New Modular Wallet Routes
router.get("/wallet/stats", getAdminWalletStats);
router.post("/wallet/topup", masterKeySessionMiddleware, initiateAdminTopup);
router.get("/wallet/verify/:orderId", verifyAdminTopup);

// V3 Fintech Routes
router.get("/reports/commission", getCommissionReport);
router.get("/cashback/settings", getCashbackSettings);
router.patch("/cashback/settings", masterKeySessionMiddleware, updateCashbackSettings);
router.patch("/disputes/:id", masterKeySessionMiddleware, resolveDispute);
router.get("/disputes", getAllDisputes);

// API Marketplace Platform Routes
router.get("/api-marketplace/products", getApiMarketplaceProducts);
router.get("/api-marketplace/plans", getApiMarketplacePlans);
router.get("/api-marketplace/billing", getApiMarketplaceBilling);
router.get("/api-marketplace/threats", getApiMarketplaceThreats);

// API Documentation Routes
router.get("/api-docs/metadata", getApiDocsMetadata);
router.get("/api-docs/download", downloadApiDocs);
router.get("/docs/registry", getApiDocsRegistry);

// Isolated Admin Developer Credentials Management Routes
router.get("/developer/keys", getKeys);
router.post("/developer/keys/generate", masterKeySessionMiddleware, generateKeys);
router.put("/developer/keys/:clientId/toggle", masterKeySessionMiddleware, toggleKeyStatus);
router.get("/developer/analytics", getAdminDeveloperAnalytics);

// Security Center / Master Key Routes
router.post("/security/master-key/verify", verifyMasterKey);
router.get("/security/super-admins", getSuperAdmins);
router.post("/security/super-admin", masterKeySessionMiddleware, createSuperAdmin);
router.delete("/security/super-admin/:id", masterKeySessionMiddleware, deleteSuperAdmin);

export default router;
