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
