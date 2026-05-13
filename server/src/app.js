import express from "express";
import cors from "cors";
import helmet from "helmet";
import { setupSwagger } from "./config/swagger.js";
import { apiLimiter } from "./middlewares/rateLimiter.js";
import { apiLogger } from "./middlewares/apiLogger.js";

import authRoutes from "./routes/authRoutes.js";
import otpRoutes from "./routes/otpRoutes.js";
// import rechargeRoutes from "./routes/rechargeRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import webhookRoutes from "./webhooks/webhookRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import apiRoutes from "./routes/apiRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import developerRoutes from "./routes/developerRoutes.js";
import testApiRoutes from "./routes/testApiRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import apiDevRoutes from "./routes/apiDevRoutes.js";

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
    // Allow Postman / server-side / mobile apps
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.error("CORS BLOCKED:", origin);

    return callback(
      new Error(`CORS not allowed for origin: ${origin}`)
    );
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS"
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-admin-request",
    "x-idempotency-key",
    "x-api-key",
    "x-client-id",
    "x-api-secret"
  ],

  exposedHeaders: [
    "Authorization"
  ],

  optionsSuccessStatus: 200
};

// IMPORTANT:
// DO NOT USE app.options("*", cors(...))
// It crashes with newer Express/path-to-regexp versions

app.use(cors(corsOptions));

/**
 * =========================================================
 * TRUST PROXY + SECURITY
 * =========================================================
 */

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

/**
 * =========================================================
 * RAW LOGGER
 * =========================================================
 */

app.use((req, res, next) => {
  if (
    req.url.includes("webhook") ||
    req.url.includes("payment")
  ) {
    console.log(
      `[RAW REQUEST] ${req.method} ${req.url}`
    );
  }

  next();
});

/**
 * =========================================================
 * WEBHOOK ROUTES
 * =========================================================
 */

app.use("/api/webhook", webhookRoutes);

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
  const frontendUrl =
    process.env.FRONTEND_URL ||
    "https://irecharge.in";

  const query = req.query || {};
  const body = req.body || {};

  const params = new URLSearchParams({
    ...query,
    ...body
  });

  const orderId =
    params.get("order_id") ||
    params.get("paymentId");

  const status = params.get("status");

  console.log(
    `[Redirector] Processing ${req.method} | Order: ${orderId} | Status: ${status}`
  );

  /**
   * =========================================================
   * FALLBACK PAYMENT VERIFICATION
   * =========================================================
   */

  if (
    orderId &&
    (status === "SUCCESS" || status === "PAID")
  ) {
    console.log(
      `[Redirector] SUCCESS detected. Triggering fallback verification for Order ${orderId}...`
    );

    (async () => {
      try {
        const { checkNexgateStatus } =
          await import(
            "./services/providers/nexgateService.js"
          );

        const { paymentWebhook } =
          await import(
            "./controllers/paymentController.js"
          );

        const gatewayStatus =
          await checkNexgateStatus(orderId);

        if (
          gatewayStatus.success &&
          gatewayStatus.status === "SUCCESS"
        ) {
          await paymentWebhook(
            {
              body: {
                order_id: orderId,
                status: "SUCCESS",
                transaction_id:
                  gatewayStatus.operatorTxnId,
                amount:
                  gatewayStatus.raw?.amount,
                message:
                  "Proactive Verification (Redirect Fallback)"
              }
            },
            {
              json: () => {},
              status: () => ({
                json: () => {}
              })
            }
          );
        }
      } catch (err) {
        console.error(
          `[Redirector Fallback Error] Order ${orderId}:`,
          err.message
        );
      }
    })();
  }

  const redirectUrl = `${frontendUrl}/payment-success?${params.toString()}`;

  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );

  res.redirect(redirectUrl);
});

/**
 * =========================================================
 * HEALTH ROUTE
 * =========================================================
 */

app.use("/health", healthRoutes);

/**
 * =========================================================
 * AUTH ROUTES (NO RATE LIMIT)
 * =========================================================
 */

app.use("/api/auth", authRoutes);

app.use("/api/otp", otpRoutes);

/**
 * =========================================================
 * RATE LIMITED ROUTES
 * =========================================================
 */

app.use("/api", apiLimiter);

app.use("/api/payment", paymentRoutes);

app.use("/api/user", userRoutes);

app.use("/api/wallet", walletRoutes);

// app.use("/api/recharge", rechargeRoutes);

app.use("/api/admin", adminRoutes);

app.use("/api/developer", developerRoutes);

app.use("/api/v1/dev", apiDevRoutes);

app.use("/api", apiRoutes);

/**
 * =========================================================
 * EXPORT
 * =========================================================
 */

export default app;