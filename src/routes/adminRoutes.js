import express from "express";
import { auth } from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/admin.js"; 
import { getDashboard, getTopUsers, retryTxn, getRetryStats } from "../controllers/adminController.js";

const router = express.Router();

router.use(auth, isAdmin); 

router.get("/dashboard", getDashboard);
router.get("/top-users", getTopUsers);
router.post("/retry/:id", retryTxn);
router.get("/retry-stats", getRetryStats);

export default router;