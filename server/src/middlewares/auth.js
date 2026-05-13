import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

export const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const clientId = req.headers["x-client-id"];
  
  // 1. TRY JWT AUTHENTICATION
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
      if (decoded && decoded.id) {
        req.user = decoded;
        return next();
      }
    } catch (error) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
  }

  // 2. TRY API KEY AUTHENTICATION (Fallback)
  if (clientId) {
    const apiKey = req.headers["x-api-key"];
    const apiSecret = req.headers["x-api-secret"];

    if (!apiKey || !apiSecret) {
      return res.status(401).json({ success: false, message: "Missing API credentials" });
    }

    try {
      const keyRecord = await prisma.apiKey.findFirst({
        where: { clientId, apiKey, apiSecret, isActive: true },
        include: { user: { select: { id: true, email: true, role: true, tier: true } } }
      });

      if (keyRecord) {
        req.user = keyRecord.user;
        req.isApiRequest = true;
        
        // Update last used timestamp (async)
        prisma.apiKey.update({ where: { id: keyRecord.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
        
        return next();
      }
    } catch (err) {
      console.error("[API Auth Fallback Error]:", err);
    }
  }

  return res.status(401).json({ success: false, message: "Authentication required" });
};