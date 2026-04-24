import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { setupSwagger } from "./config/swagger.js";

import authRoutes from "./routes/authRoutes.js";
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

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes"
});

// ✅ Proper CORS (multiple frontends)
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173"],
  credentials: true
}));

app.use(express.json());
app.use("/api", apiLimiter);

app.get("/test", (req, res) => {
  res.send("Server working");
});

// Routes
app.use("/api/payment", paymentRoutes);
app.use("/api", apiRoutes);
app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/wallet", walletRoutes);
app.use("/recharge", rechargeRoutes);
app.use("/admin", adminRoutes);
app.use("/webhook", webhookRoutes);

export default app;