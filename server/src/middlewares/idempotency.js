import { redisClient } from "../config/redis.js";
import AppError from "../utils/AppError.js";

/**
 * Middleware to prevent duplicate requests using Idempotency-Key header.
 * Stores keys in Redis for a limited time (e.g., 24 hours).
 */
export const idempotency = async (req, res, next) => {
  const key = req.headers['x-idempotency-key'];

  if (!key) {
    // If key is missing, we proceed, but critical routes should enforce it separately
    return next();
  }

  const userId = req.user?.id || 'anonymous';
  const redisKey = `idempotency:${userId}:${key}`;

  try {
    const existingResult = await redisClient.get(redisKey);

    if (existingResult) {
      const parsed = JSON.parse(existingResult);
      console.log(`[Idempotency] Duplicate request detected: ${redisKey}`);
      return res.status(200).json(parsed);
    }

    // Capture the original res.json to store the result
    const originalJson = res.json;
    res.json = async function (data) {
      // Only cache successful or specific operational responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          await redisClient.set(redisKey, JSON.stringify(data), 'EX', 86400); // 24 hours

        } catch (err) {
          console.error("[Idempotency Cache Error]:", err);
        }
      }
      return originalJson.call(this, data);
    };

    next();
  } catch (err) {
    console.error("[Idempotency Error]:", err);
    next(); // Fallback: allow request if Redis fails
  }
};

/**
 * Higher-order function to enforce idempotency on specific routes.
 */
export const requireIdempotency = (req, res, next) => {
  if (!req.headers['x-idempotency-key']) {
    return next(new AppError("Idempotency-Key header is required for this operation", 400, "IDEMPOTENCY_KEY_REQUIRED"));
  }
  next();
};
