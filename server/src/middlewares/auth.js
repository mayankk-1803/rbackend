import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

export const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const clientId = req.headers["x-client-id"];
  const cookieToken = req.cookies?.token || req.cookies?.dizipay_token;
  
  let token = null;

  // 1. EXTRACT TOKEN
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
    console.log("[AUTH][TRACE] → Token extracted from Authorization Header");
  } else if (cookieToken) {
    token = cookieToken;
    console.log("[AUTH][TRACE] → Token extracted from Cookie");
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
      
      if (decoded && decoded.id) {
        const isAdminRoute = req.originalUrl.includes('/api/admin');
        const tokenType = decoded.tokenType;

        // Stage-based Log
        console.log(`[AUTH][TRACE] → Decoded ID: ${decoded.id} | Type: ${tokenType} | Path: ${req.originalUrl}`);

        if (isAdminRoute && tokenType !== "ADMIN_PANEL") {
          console.warn(`[AUTH][ROUTE_GUARD_REJECTED] → Admin route accessed with ${tokenType}`);
          return res.status(403).json({ success: false, message: "Admin session required. Please relogin to Admin Panel." });
        }

        const isDeveloperRoute = req.originalUrl.includes('/api/developer') || req.originalUrl.includes('/developer/manifest');
        
        if (!isAdminRoute && !isDeveloperRoute && tokenType === "ADMIN_PANEL") {
          console.warn(`[AUTH][ROUTE_GUARD_REJECTED] → User route accessed with ${tokenType}`);
          return res.status(403).json({ success: false, message: "User session required. Please relogin to User Panel." });
        }

        req.user = decoded;
        return next();
      }
    } catch (error) {
      console.error("[AUTH][JWT_FAILED] →", error.message);
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