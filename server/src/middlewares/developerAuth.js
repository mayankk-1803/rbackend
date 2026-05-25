import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

/**
 * Middleware to protect developer-only endpoints.
 * Verifies the temporary developer JWT session token.
 */
export const developerAuth = async (req, res, next) => {
  const devTokenHeader = req.headers["x-developer-token"];
  const devTokenCookie = req.cookies?.dizipay_developer_token;
  const developerToken = devTokenHeader || devTokenCookie;

  if (!developerToken) {
    req.isDeveloperVerified = false;
    return res.status(403).json({
      success: false,
      code: 'DEVELOPER_AUTH_REQUIRED',
      message: 'Developer verification required'
    });
  }

  try {
    const decoded = jwt.verify(
      developerToken, 
      process.env.DEVELOPER_JWT_SECRET || process.env.JWT_SECRET || "fallback_secret"
    );

    // Validate that the request context matches the logged in user
    if (!req.user || decoded.userId !== req.user.id) {
      req.isDeveloperVerified = false;
      return res.status(403).json({
        success: false,
        message: "Developer session user mismatch"
      });
    }

    // If session was verified via API keys, verify the key is still active in database (supports revocation)
    if (decoded.apiKeyId) {
      const keyRecord = await prisma.apiKey.findFirst({
        where: {
          id: decoded.apiKeyId,
          userId: decoded.userId,
          isActive: true
        }
      });

      if (!keyRecord) {
        req.isDeveloperVerified = false;
        return res.status(403).json({
          success: false,
          message: "Developer credentials revoked or deactivated"
        });
      }
    }

    req.developerSession = decoded;
    req.isDeveloperVerified = true;
    next();
  } catch (error) {
    console.error("[DEV AUTH ERROR]:", error.message);
    req.isDeveloperVerified = false;
    return res.status(403).json({
      success: false,
      message: "Invalid or expired developer session"
    });
  }
};
