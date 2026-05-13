import prisma from "../config/prisma.js";

/**
 * Middleware to log API requests for developer analytics
 */
export const apiLogger = async (req, res, next) => {
  if (!req.isApiRequest) return next();

  const start = Date.now();
  const originalJson = res.json;

  res.json = function (body) {
    const latency = Date.now() - start;
    
    // Log asynchronously to not block response
    prisma.apiLog.create({
      data: {
        userId: req.user.id,
        endpoint: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        latency,
        ipAddress: req.ip || req.headers["x-forwarded-for"],
        userAgent: req.headers["user-agent"],
        requestBody: req.body || null,
        responseBody: body || null
      }
    }).catch(err => console.error("[API Log Error]:", err));

    return originalJson.call(this, body);
  };

  next();
};
