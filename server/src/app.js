import express from "express";
import cors from "cors";
import helmet from "helmet";
import { setupSwagger } from "./config/swagger.js";
import { apiLimiter } from "./middlewares/rateLimiter.js";

import authRoutes from "./routes/authRoutes.js";
import otpRoutes from "./routes/otpRoutes.js";
import rechargeRoutes from "./routes/rechargeRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import webhookRoutes from "./webhooks/webhookRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import apiRoutes from "./routes/apiRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

const app = express();

// Setup Swagger
setupSwagger(app);

// Security middlewares
app.use(helmet());

// ✅ Proper CORS (multiple frontends)
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173"],
  credentials: true
}));

app.use(express.json());

app.get("/test", (req, res) => {
  res.send("Server working");
});

// Routes - No limit on auth
app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);

// Apply limit to other routes
app.use("/api", apiLimiter);
app.use("/api/payment", paymentRoutes);
app.use("/api/user", userRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/recharge", rechargeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/webhook", webhookRoutes);
app.use("/api", apiRoutes);

export default app;