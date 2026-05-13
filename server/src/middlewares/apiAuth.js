import prisma from "../config/prisma.js";
import jwt from "jsonwebtoken";

/**
 * Middleware to authenticate external API requests
 * Supports:
 * 1. x-api-key header (External Devs)
 * 2. Authorization Bearer token (Dashboard/Tester UI)
 */
export const apiAuth = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  const authHeader = req.headers["authorization"];

  console.log(`[API AUTH] Request: ${req.method} ${req.url}`);

  // 1. TRY API KEY AUTHENTICATION
  if (apiKey) {
    try {
      const keyRecord = await prisma.apiKey.findFirst({
        where: { OR: [{ apiKey }, { clientId: apiKey }] },
        include: { user: { select: { id: true, email: true, role: true, tier: true } } }
      });

      if (keyRecord && keyRecord.isActive) {
        req.user = keyRecord.user;
        req.apiKeyId = keyRecord.id;
        req.isApiRequest = true;
        
        // Update usage analytics (async)
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
