import { redisClient } from "../config/redis.js";

/**
 * Creates a distributed Redis-backed rate limiter middleware.
 * @param {string} prefix - The Redis key prefix
 * @param {number} maxRequests - Maximum allowed requests in the window
 * @param {number} windowSeconds - Time window in seconds
 */
export const createRateLimiter = (prefix, maxRequests, windowSeconds) => {
  return async (req, res, next) => {
    try {
      const identifier = req.user?.id ? req.user.id : req.ip;
      const key = `ratelimit:${prefix}:${identifier}`;

      // Use an atomic multi block to INCR and set EXPIRE if it's the first request
      const multi = redisClient.multi();
      multi.incr(key);
      multi.ttl(key);

      const [incrResult, ttlResult] = await multi.exec();
      const requestCount = incrResult[1];
      const ttl = ttlResult[1];

      // If key was just created (ttl is -1 or -2), set its expiration
      if (ttl < 0) {
        await redisClient.expire(key, windowSeconds);
      }

      if (requestCount > maxRequests) {
        console.warn(`[RATE_LIMIT] Blocked ${identifier} on ${prefix} (${requestCount}/${maxRequests})`);
        return res.status(429).json({
          success: false,
          message: "Too many requests. Please try again later."
        });
      }

      next();
    } catch (err) {
      console.error("[RateLimiter Error]:", err);
      // Fail-open strategy to prevent widespread outages if Redis blips, 
      // though for high-security endpoints we might want to fail-closed.
      next();
    }
  };
};

const isDev = process.env.NODE_ENV !== "production";

export const redeemLimiter = createRateLimiter("redeem_coins", 5, 60 * 60); // 5 times per hour
export const rechargeInitLimiter = createRateLimiter("recharge_init", 10, 60); // 10 times per minute
export const topupLimiter = createRateLimiter("wallet_topup", 10, 60 * 60); // 10 topups per hour
export const webhookLimiter = createRateLimiter("webhook", 100, 60); // 100 callbacks per minute per IP
export const paymentStatusLimiter = createRateLimiter("payment_status", 30, 60);

const adminApiLimiter = createRateLimiter("api_admin", isDev ? 5000 : 1000, 15 * 60);
const userApiLimiter = createRateLimiter("api_user", isDev ? 1000 : 100, 15 * 60);

export const apiLimiter = (req, res, next) => {
  const isAdmin = req.originalUrl.includes("/admin") || req.headers["x-admin-request"];
  return isAdmin ? adminApiLimiter(req, res, next) : userApiLimiter(req, res, next);
};

