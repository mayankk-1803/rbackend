import express from "express";
import { auth } from "../middlewares/auth.js";
import { 
  getTransactionHistory, 
  getReportSummary, 
  getWalletLedger, 
  getCommissionReport, 
  exportTransactions, 
  searchRecharge 
} from "../controllers/reportController.js";
import { adminOnly } from "../middlewares/rbac.js";

const router = express.Router();

router.use(auth);

router.get("/transactions", getTransactionHistory);
router.get("/summary", getReportSummary);
router.get("/wallet-ledger", getWalletLedger);
router.get("/commissions", adminOnly, getCommissionReport);
router.get("/export", exportTransactions);
router.get("/search-recharge", searchRecharge);

export default router;
