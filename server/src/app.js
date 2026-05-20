import express from "express";
import cors from "cors";
import helmet from "helmet";
import { setupSwagger } from "./config/swagger.js";
import { apiLimiter, webhookLimiter } from "./middlewares/rateLimiter.js";
import { apiLogger } from "./middlewares/apiLogger.js";

import authRoutes from "./routes/authRoutes.js";
import otpRoutes from "./routes/otpRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import webhookRoutes from "./webhooks/webhookRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import { handleProviderWebhook } from "./controllers/webhookController.js";

import apiRoutes from "./routes/apiRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import developerRoutes from "./routes/developerRoutes.js";
import testApiRoutes from "./routes/testApiRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import apiDevRoutes from "./routes/apiDevRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import adminReportRoutes from "./routes/adminReportRoutes.js";

import cookieParser from "cookie-parser";
import { globalErrorHandler } from "./middlewares/errorHandler.js";
import { idempotency } from "./middlewares/idempotency.js";

const app = express();

/**
 * =========================================================
 * CORS CONFIGURATION
 * =========================================================
 */

const allowedOrigins = [
  "https://irecharge.in",
  "https://www.irecharge.in",
  "https://rchserver.irecharge.in",
  "http://localhost:3000",
  "http://localhost:5173"
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.error("CORS BLOCKED:", origin);
    return callback(new Error(`CORS not allowed for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-admin-request",
    "x-idempotency-key",
    "x-api-key",
    "x-client-id",
    "x-api-secret",
    "Cookie"
  ],
  exposedHeaders: ["Authorization", "Set-Cookie"],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

/**
 * =========================================================
 * TRUST PROXY + SECURITY
 * =========================================================
 */

app.set("trust proxy", 1); // Trust first proxy (Nginx)
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cookieParser(process.env.COOKIE_SECRET || "dizipay_secret"));

/**
 * =========================================================
 * BODY PARSERS
 * =========================================================
 */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(apiLogger);

/**
 * =========================================================
 * RAW LOGGER & WEBHOOKS
 * =========================================================
 */

app.use((req, res, next) => {
  if (req.url.includes("webhook") || req.url.includes("payment")) {
    console.log(`[RAW REQUEST] ${req.method} ${req.url}`);
  }
  next();
});

app.use("/api/webhook", webhookRoutes);

/**
 * =========================================================
 * SWAGGER
 * =========================================================
 */

setupSwagger(app);

/**
 * =========================================================
 * PAYMENT SUCCESS REDIRECT HANDLER
 * =========================================================
 */

app.all("/payment-success", async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "https://irecharge.in";
  const params = new URLSearchParams({ ...req.query, ...req.body });
  const orderId = params.get("order_id") || params.get("paymentId");
  const status = params.get("status");

  console.log(`[Redirector] Processing ${req.method} | Order: ${orderId} | Status: ${status}`);

  if (orderId && (status === "SUCCESS" || status === "PAID")) {
    (async () => {
      try {
        const { checkNexgateStatus } = await import("./services/providers/nexgateService.js");
        const { paymentWebhook } = await import("./controllers/paymentController.js");
        const gatewayStatus = await checkNexgateStatus(orderId);

        if (gatewayStatus.success && gatewayStatus.status === "SUCCESS") {
          await paymentWebhook(
            { body: { order_id: orderId, status: "SUCCESS", transaction_id: gatewayStatus.operatorTxnId, amount: gatewayStatus.raw?.amount, message: "Proactive Verification" } },
            { json: () => {}, status: () => ({ json: () => {} }) }
          );
        }
      } catch (err) {
        console.error(`[Redirector Fallback Error] Order ${orderId}:`, err.message);
      }
    })();
  }

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.redirect(`${frontendUrl}/payment-success?${params.toString()}`);
});

/**
 * =========================================================
 * ROUTES
 * =========================================================
 */

app.use("/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);

// Apply rate limiting and idempotency to all protected APIs
app.use("/api", apiLimiter, idempotency);

app.use("/api/payment", paymentRoutes);
app.use("/api/user", userRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/reports", adminReportRoutes);
app.use("/api/developer", developerRoutes);
app.use("/api/v1/dev", apiDevRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api", apiRoutes);


// Universal Webhook
app.post("/api/webhooks/:providerCode", webhookLimiter, handleProviderWebhook);
app.get("/api/webhooks/:providerCode", webhookLimiter, handleProviderWebhook);

/**
 * =========================================================
 * GLOBAL ERROR HANDLER
 * =========================================================
 */

app.use(globalErrorHandler);

export default app;