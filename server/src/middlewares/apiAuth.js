import prisma from "../config/prisma.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

/**
 * Middleware to authenticate external API requests
 * Supports:
 * 1. x-api-key header (External Devs) - new ApiAccess with hashed secrets & legacy apiKey fallback
 * 2. Authorization Bearer token (Dashboard/Tester UI)
 */
export const apiAuth = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  const apiSecret = req.headers["x-api-secret"];
  const authHeader = req.headers["authorization"];

  console.log(`[API AUTH] Request: ${req.method} ${req.url}`);

  // 1. TRY API KEY AUTHENTICATION
  if (apiKey) {
    try {
      // A. Try the new ApiAccess model (hashed secrets, sandbox / production, rate limit aware)
      const apiAccess = await prisma.apiAccess.findFirst({
        where: { apiKey, isActive: true },
        include: { user: { select: { id: true, email: true, role: true, tier: true } } }
      });

      if (apiAccess) {
        if (!apiSecret) {
          return res.status(401).json({ success: false, message: "Missing API Secret" });
        }
        
        const isMatch = await bcrypt.compare(apiSecret, apiAccess.apiSecretHash);
        if (isMatch) {
          if (!apiAccess.user || !["API_USER", "ADMIN", "SUPER_ADMIN"].includes(apiAccess.user.role)) {
            return res.status(403).json({ success: false, message: "Forbidden: Account does not have API Partner privileges" });
          }
          req.user = apiAccess.user;
          req.apiAccessId = apiAccess.id;
          req.isApiRequest = true;
          req.isSandbox = apiAccess.environment === "SANDBOX";
          
          // Log telemetry usage asynchronously
          prisma.apiUsage.create({
            data: {
              apiAccessId: apiAccess.id,
              endpoint: req.originalUrl,
              method: req.method,
              statusCode: 200,
              latency: 0,
              ipAddress: req.ip || "127.0.0.1"
            }
          }).catch(() => {});
          
          return next();
        }
      }

      // B. Fallback to legacy apiKey table for backward compatibility
      const keyRecord = await prisma.apiKey.findFirst({
        where: { OR: [{ apiKey }, { clientId: apiKey }] },
        include: { user: { select: { id: true, email: true, role: true, tier: true } } }
      });

      if (keyRecord && keyRecord.isActive) {
        req.user = keyRecord.user;
        req.apiKeyId = keyRecord.id;
        req.isApiRequest = true;
        req.isSandbox = false; // Legacy keys are always production or have no sandbox mode

        // Update last used timestamp (async)
        prisma.apiKey.update({ where: { id: keyRecord.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
        return next();
      }
    } catch (err) {
      console.error("[API Key Auth Error]:", err.message);
    }
  }

  // 2. TRY JWT AUTHENTICATION (For Tester UI inside Dashboard)
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, role: true }
      });

      if (user) {
        req.user = user;
        req.isApiRequest = true;
        req.isSandbox = false;
        return next();
      }
    } catch (err) {
      console.error("[JWT Auth Error]:", err.message);
    }
  }

  // 3. FAIL
  return res.status(401).json({ 
    success: false, 
    status: 401,
    message: "Invalid API credentials or missing token" 
  });
};
