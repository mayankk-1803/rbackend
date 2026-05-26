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
  revokeDevAccess,
  getApiAccess,
  generateApiAccess,
  rotateApiAccessSecret,
  updateWebhookSettings,
  toggleApiAccess,
  updateEnvironment,
  getWebhookEvents,
  replayWebhookEvent,
  requestApiAccess,
  getApiAccessUsage,
  getRequestStatus
} from "../controllers/developerController.js";

import { requireApiUser } from "../middlewares/requireApiUser.js";

const router = express.Router();

// 5 verify attempts max per 15 mins to prevent brute-force attacks
const devVerifyLimiter = createRateLimiter("dev_verify", 5, 15 * 60);

// All developer routes require standard user authentication
router.use(auth);

// Allow: public lightweight manifest metadata
router.get("/manifest", getApiManifest);

// Verify Developer credentials (runs prior to developerAuth guard)
router.post("/verify-access", devVerifyLimiter, verifyDevAccess);

// Submit Upgrade Request to API Partner (requires user authentication but runs before developerAuth session)
router.post("/api-access/upgrade", requestApiAccess);
router.post("/request-access", auth, requestApiAccess);
router.get("/api-access/request-status", getRequestStatus);

// Protect all subsequent routes with requireApiUser role guard and active developer session guard
router.use(requireApiUser);
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

// Legacy keys management
router.post("/keys/generate", requireDeveloperVerification, generateKeys);
router.get("/keys", requireDeveloperVerification, getKeys);
router.post("/keys/rotate", requireDeveloperVerification, rotateSecret);
router.put("/keys/:clientId/toggle", requireDeveloperVerification, toggleKeyStatus);

router.get("/analytics", requireDeveloperVerification, getAnalytics);
router.get("/logs", requireDeveloperVerification, getLogs);

// New ApiAccess / Fintech Developer Portal Routes
router.get("/api-access", requireDeveloperVerification, getApiAccess);
router.post("/api-access/generate", requireDeveloperVerification, generateApiAccess);
router.post("/api-access/rotate", requireDeveloperVerification, rotateApiAccessSecret);
router.put("/api-access/webhook", requireDeveloperVerification, updateWebhookSettings);
router.put("/api-access/toggle", requireDeveloperVerification, toggleApiAccess);
router.put("/api-access/environment", requireDeveloperVerification, updateEnvironment);
router.get("/api-access/webhook-events", requireDeveloperVerification, getWebhookEvents);
router.post("/api-access/webhook-events/replay", requireDeveloperVerification, replayWebhookEvent);
router.get("/api-access/usage", requireDeveloperVerification, getApiAccessUsage);

export default router;
