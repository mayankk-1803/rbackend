import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const isDev = process.env.NODE_ENV !== "production";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    // If it's an admin route or has admin headers, allow more
    if (req.originalUrl.includes("/admin") || req.headers["x-admin-request"]) {
      return isDev ? 5000 : 1000; // 1000 requests per 15 mins for admin
    }
    return isDev ? 1000 : 100; // 100 for users
  },
  keyGenerator: (req, res) => {
    // Use IP + User ID if available to be more specific
    return ipKeyGenerator(req, res) + (req.headers["x-client-id"] || "");
  },
  message: {
    success: false,
    message: "Too many requests. Please wait 15 minutes or contact support if this is an error."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for payment status checks (polling protection)
export const paymentStatusLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDev ? 100 : 30, // 30 requests per minute
  message: {
    success: false,
    message: "Too many status checks. Please wait."
  }
});

// Webhook protection
export const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDev ? 500 : 100,
  message: {
    success: false,
    message: "Too many webhook events."
  }
});
