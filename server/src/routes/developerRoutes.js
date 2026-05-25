import express from "express";
import { auth } from "../middlewares/auth.js";
import { developerAuth } from "../middlewares/developerAuth.js";
import { createRateLimiter } from "../middlewares/rateLimiter.js";
import { 
  generateKeys, 
  getKeys, 
  rotateSecret, 
  toggleKeyStatus, 
  getAnalytics, 
  getLogs,
  getApiManifest,
  verifyDevAccess,
  revokeDevAccess
} from "../controllers/developerController.js";

const router = express.Router();

// 5 verify attempts max per 15 mins to prevent brute-force attacks
const devVerifyLimiter = createRateLimiter("dev_verify", 5, 15 * 60);

// All developer routes require standard user authentication
router.use(auth);

// Allow: public lightweight manifest metadata
router.get("/manifest", getApiManifest);

// Verify Developer credentials (runs prior to developerAuth guard)
router.post("/verify-access", devVerifyLimiter, verifyDevAccess);

// Protect all subsequent routes with active developer session guard
router.use(developerAuth);

router.post("/revoke-access", revokeDevAccess);

// Helper to block keys, analytics, logs unless req.isDeveloperVerified === true
const requireDeveloperVerification = (req, res, next) => {
  if (req.isDeveloperVerified !== true) {
    return res.status(403).json({
      success: false,
      code: 'DEVELOPER_AUTH_REQUIRED',
      message: 'Developer verification required'
    });
  }
  next();
};

router.post("/keys/generate", requireDeveloperVerification, generateKeys);
router.get("/keys", requireDeveloperVerification, getKeys);
router.post("/keys/rotate", requireDeveloperVerification, rotateSecret);
router.put("/keys/:clientId/toggle", requireDeveloperVerification, toggleKeyStatus);

router.get("/analytics", requireDeveloperVerification, getAnalytics);
router.get("/logs", requireDeveloperVerification, getLogs);

export default router;
