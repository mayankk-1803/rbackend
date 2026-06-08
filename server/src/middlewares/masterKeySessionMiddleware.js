import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../config/prisma.js";
import { redisClient } from "../config/redis.js";
import { logMasterKeyAction } from "../services/masterKeyAuditService.js";

// Lockout map fallback in RAM
const lockoutMap = new Map();

/**
 * Check if the admin is currently locked out of Master Key operations.
 */
export const checkMasterKeyLockout = async (adminId) => {
  if (!adminId) return false;
  const now = Date.now();
  if (redisClient && redisClient.status === "ready") {
    const isLocked = await redisClient.get(`masterkey:lockout:${adminId}`);
    return !!isLocked;
  } else {
    const record = lockoutMap.get(adminId);
    if (record && record.resetTime > now && record.count >= 5) {
      return true;
    }
  }
  return false;
};

/**
 * Increment failed attempts and trigger lockout if they exceed 5.
 */
export const recordMasterKeyFailure = async (adminId) => {
  if (!adminId) return;
  const now = Date.now();
  if (redisClient && redisClient.status === "ready") {
    const key = `masterkey:attempts:${adminId}`;
    const attempts = await redisClient.incr(key);
    if (attempts === 1) {
      await redisClient.expire(key, 900); // 15 mins window
    }
    if (attempts >= 5) {
      await redisClient.setex(`masterkey:lockout:${adminId}`, 900, "locked");
      await redisClient.del(key);
    }
  } else {
    let record = lockoutMap.get(adminId);
    if (!record || record.resetTime <= now) {
      record = { count: 0, resetTime: now + 900000 };
    }
    record.count++;
    lockoutMap.set(adminId, record);
  }
};

/**
 * Clear failure attempts and active lockouts for the admin.
 */
export const clearMasterKeyFailures = async (adminId) => {
  if (!adminId) return;
  if (redisClient && redisClient.status === "ready") {
    await redisClient.del(`masterkey:attempts:${adminId}`);
    await redisClient.del(`masterkey:lockout:${adminId}`);
  } else {
    lockoutMap.delete(adminId);
  }
};

/**
 * Constant-time comparison using HMAC-SHA256 hashes to prevent timing attacks.
 */
export const safeCompare = (input, secret) => {
  if (typeof input !== "string" || typeof secret !== "string") return false;
  const inputHash = crypto.createHmac("sha256", secret).update(input).digest();
  const secretHash = crypto.createHmac("sha256", secret).update(secret).digest();
  return crypto.timingSafeEqual(inputHash, secretHash);
};

/**
 * Helper to sanitize sensitive fields from audit log payloads.
 */
export const sanitizeData = (data) => {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  const sanitized = {};
  const keysToRedact = ["password", "token", "secret", "apikey", "clientsecret", "masterkey"];

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const shouldRedact = keysToRedact.some(redact => lowerKey.includes(redact));
    
    if (shouldRedact) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

/**
 * Helper to extract a resource ID from request parameters or body.
 */
const getTargetResourceId = (req) => {
  if (req.params?.id) return String(req.params.id);
  if (req.body?.id) return String(req.body.id);
  if (req.params?.key) return String(req.params.key);
  if (req.body?.key) return String(req.body.key);
  return null;
};

/**
 * Master Key Session Verification Middleware.
 */
export const masterKeySessionMiddleware = async (req, res, next) => {
  if (process.env.ENABLE_MASTER_KEY !== "true") {
    return next();
  }

  const path = req.path || req.originalUrl || "";

  // 1. Conditional Bypass: send-temp-password for USER/API_USER
  if (path.includes("/send-temp-password")) {
    try {
      const targetUserId = parseInt(req.params.id);
      if (!isNaN(targetUserId)) {
        const targetUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: { role: true }
        });
        // Only protect ADMIN/SUPER_ADMIN target credentials
        if (!targetUser || !["ADMIN", "SUPER_ADMIN"].includes(targetUser.role)) {
          return next();
        }
      }
    } catch (err) {
      console.error("[MasterKeySessionMiddleware] Target role check error:", err.message);
    }
  }

  // 2. Conditional Bypass: users/bulk-action
  if (path.includes("/users/bulk-action")) {
    if (req.body?.actionType !== "debit_credit") {
      return next();
    }
  }

  // Check session token
  const token = req.headers["x-master-key-session"];

  if (!token) {
    await logMasterKeyAction(req.user?.id, "MASTER_KEY_DENIED", req, { reason: "Missing session token" });
    return res.status(403).json({
      success: false,
      code: "MASTER_KEY_REQUIRED",
      message: "Master Key validation required"
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.MASTER_KEY_SESSION_SECRET || "fallback_master_secret");
    
    // Verify token type
    if (decoded.type !== "MASTER_KEY_SESSION") {
      throw new Error("Invalid session token type");
    }

    // Verify admin identity matches current authenticated user
    if (Number(decoded.adminId) !== Number(req.user?.id)) {
      throw new Error("Admin ID mismatch");
    }

    // Intercept res.json to audit log the action once completed
    const originalJson = res.json;
    let logged = false;

    res.json = function (body) {
      if (!logged && !req.skipMasterKeyMiddlewareLog) {
        logged = true;
        try {
          const originalPath = req.originalUrl || req.url || "N/A";
          const method = req.method || "N/A";
          const timestamp = new Date().toISOString();
          const targetResourceId = getTargetResourceId(req);
          const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || "N/A";
          const userAgent = req.headers?.['user-agent'] || "N/A";

          const isDestructive = 
            method === "DELETE" ||
            originalPath.includes("/status") ||
            originalPath.includes("/revoke") ||
            originalPath.includes("/toggle") ||
            originalPath.includes("/delete") ||
            originalPath.includes("/remove");

          const logDetails = {
            route: originalPath,
            method,
            timestamp,
            targetResourceId,
            ipAddress,
            userAgent
          };

          if (isDestructive) {
            logDetails.beforeState = sanitizeData(req.body);
            logDetails.afterState = sanitizeData(body);
          }

          logMasterKeyAction(req.user?.id, "MASTER_KEY_USED", req, logDetails);
        } catch (logErr) {
          console.error("[MasterKeySessionMiddleware] Interceptor logging error:", logErr);
        }
      }
      return originalJson.apply(this, arguments);
    };

    // Session validated successfully
    return next();
  } catch (err) {
    const isExpired = err.name === "TokenExpiredError";
    if (isExpired) {
      await logMasterKeyAction(req.user?.id, "MASTER_KEY_SESSION_EXPIRED", req);
      return res.status(403).json({
        success: false,
        code: "MASTER_KEY_EXPIRED",
        message: "Master Key session expired"
      });
    } else {
      await logMasterKeyAction(req.user?.id, "MASTER_KEY_DENIED", req, { reason: err.message });
      return res.status(403).json({
        success: false,
        code: "MASTER_KEY_INVALID",
        message: "Invalid Master Key session"
      });
    }
  }
};
