import express from "express";
import cors from "cors";
import helmet from "helmet";
import { setupSwagger } from "./config/swagger.js";
import { apiLimiter, webhookLimiter } from "./middlewares/rateLimiter.js";
import { apiLogger } from "./middlewares/apiLogger.js";

import authRoutes from "./routes/authRoutes.js";
import otpRoutes from "./routes/otpRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import enterpriseRoutes from "./routes/enterpriseRoutes.js";
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
import path from "path";
import imartRoutes from "./routes/imartRoutes.js";
import disputesRoutes from "./routes/disputesRoutes.js";
import apiSettingsRoutes from "./routes/apiSettingsRoutes.js";
import { requireApiUser } from "./middlewares/requireApiUser.js";

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
  "https://nexgate.in",
  "http://localhost:3000",
  "http://localhost:5173"
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow server-to-server requests, mobile webviews, redirects
    if (!origin) {
      return callback(null, true);
    }

    // Allow trusted origins
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
    "x-api-secret",
    "Cookie"
  ],

  exposedHeaders: [
    "Authorization",
    "Set-Cookie"
  ],

  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

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

const cleanClientMessage = (message = "") => {
  const raw = String(message || "").toLowerCase();
  if (raw.includes("password") || raw.includes("mustchangepassword")) return message;
  if (raw.includes("refund")) return "Refund processed";
  if (raw.includes("queued") || raw.includes("pending_review") || raw.includes("pending review")) return "Recharge queued";
  if (raw.includes("processing")) return "Recharge processing";
  if (raw.includes("recharge") && raw.includes("failed")) return "Recharge failed";
  if (raw.includes("recharge") && raw.includes("success")) return "Recharge Successful";
  if (
    raw.includes("payment") ||
    raw.includes("gateway") ||
    raw.includes("order") ||
    raw.includes("declined") ||
    raw.includes("insufficient")
  ) return "Payment Failed";
  if (raw.includes("success")) return "Order Placed Successfully";
  return "Something went wrong";
};

app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === "object" && body.success === false) {
      body = {
        ...body,
        message: cleanClientMessage(body.message),
        data: undefined,
        stack: undefined,
        error: undefined
      };
    }
    return originalJson(body);
  };
  next();
});

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

  console.log(
    `[PAYMENT_SUCCESS_REDIRECT] Origin=${req.headers.origin} | Referer=${req.headers.referer} | Order=${orderId}`
  );

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

  // Detect and route admin-funded payments to the Admin Panel instead of the user panel
  let targetUrl = `${frontendUrl}/payment-success?${params.toString()}`;

  if (orderId) {
    try {
      const { default: prisma } = await import("./config/prisma.js");
      let payment = await prisma.payment.findUnique({
        where: { id: Number(orderId) }
      });

      if (payment && payment.idempotencyKey && payment.idempotencyKey.startsWith("admin_funding:")) {
        // If the payment is still pending but URL claims success, verify synchronously
        if (payment.status === "PENDING" && (status === "SUCCESS" || status === "PAID" || req.query.status === "SUCCESS")) {
          try {
            const { checkNexgateStatus } = await import("./services/providers/nexgateService.js");
            const { paymentWebhook } = await import("./controllers/paymentController.js");
            const gatewayStatus = await checkNexgateStatus(orderId);

            if (gatewayStatus.success && gatewayStatus.status === "SUCCESS") {
              const expectedSecret = process.env.WEBHOOK_SECRET || "internal_secret";
              await paymentWebhook(
                {
                  body: {
                    order_id: orderId,
                    status: "SUCCESS",
                    transaction_id: gatewayStatus.operatorTxnId,
                    amount: gatewayStatus.raw?.amount || payment.amount.toString(),
                    message: "Synchronous Verification for Admin redirect",
                    secret: expectedSecret
                  }
                },
                { json: () => {}, status: () => ({ json: () => {} }) }
              );

              // Poll database state for a maximum of 1.5 seconds (15 * 100ms) until it transitions
              for (let i = 0; i < 15; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                payment = await prisma.payment.findUnique({
                  where: { id: Number(orderId) }
                });
                if (payment.status !== "PENDING") {
                  break;
                }
              }
            }
          } catch (verifyErr) {
            console.error(`[Redirector Sync Verify Error] Order ${orderId}:`, verifyErr.message);
          }
        }

        const adminUrl = (process.env.ADMIN_PANEL_URL || "https://irecharge.in/87564/admin").replace(/\/$/, "");
        const redirectParams = new URLSearchParams(params);
        redirectParams.set("status", payment.status);
        targetUrl = `${adminUrl}?${redirectParams.toString()}`;
      }
    } catch (dbErr) {
      console.error(`[Redirector DB Check Error] Order ${orderId}:`, dbErr.message);
    }
  }

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.redirect(targetUrl);
});

/**
 * =========================================================
 * ROUTES
 * =========================================================
 */

app.use("/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);

// Serve static uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Apply rate limiting and idempotency to all protected APIs
app.use("/api", apiLimiter, idempotency);

app.use("/api/payment", paymentRoutes);
app.use("/api/user", userRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/enterprise", enterpriseRoutes);
app.use("/api/admin/reports", adminReportRoutes);
app.use("/api/developer", developerRoutes);
app.use("/api/v1/dev", apiDevRoutes);
app.use("/api/keys", requireApiUser, developerRoutes);
app.use("/api/webhooks", requireApiUser, developerRoutes);
app.use("/api/docs", requireApiUser, developerRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/imart", imartRoutes);
app.use("/api/disputes", disputesRoutes);
app.use("/api/admin/api-settings", apiSettingsRoutes);
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
