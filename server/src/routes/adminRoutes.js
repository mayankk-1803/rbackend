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
  getAdminWallet
} from "../controllers/adminController.js";

const router = express.Router();

router.use(auth, isAdmin); 

router.get("/dashboard", getDashboard);
router.get("/top-users", getTopUsers);
router.post("/retry/:id", retryTxn);
router.get("/retry-stats", getRetryStats);
router.get("/transactions", getTransactions);
router.get("/alerts", getAlerts);
router.get("/providers", getProviders);
router.post("/providers/set-active", setActiveProvider);
router.get("/charts", getCharts);
router.post("/compare-recharge", compareRecharge);
router.post("/topup", topUpWallet);
router.get("/wallet", getAdminWallet);

export default router;
