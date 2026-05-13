import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV !== "production";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 1000 : 100,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes"
  }
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
