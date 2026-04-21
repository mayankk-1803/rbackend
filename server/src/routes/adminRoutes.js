import express from "express";
import { auth } from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/admin.js"; 
import { getDashboard, getTopUsers, retryTxn, getRetryStats, getTransactions, getAlerts, getProviders, getCharts } from "../controllers/adminController.js";

const router = express.Router();

router.use(auth, isAdmin); 

router.get("/dashboard", getDashboard);
router.get("/top-users", getTopUsers);
router.post("/retry/:id", retryTxn);
router.get("/retry-stats", getRetryStats);
router.get("/transactions", getTransactions);
router.get("/alerts", getAlerts);
router.get("/providers", getProviders);
router.get("/charts", getCharts);

export default router;