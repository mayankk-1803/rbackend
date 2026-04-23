import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import rechargeRoutes from "./routes/rechargeRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import webhookRoutes from "./webhooks/webhookRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import apiRoutes from "./routes/apiRoutes.js";

const app = express();

// ✅ Proper CORS (multiple frontends)
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173"],
  credentials: true
}));

app.use(express.json());

app.get("/test", (req, res) => {
  res.send("Server working");
});

// Routes
app.use("/api", apiRoutes);
app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/wallet", walletRoutes);
app.use("/recharge", rechargeRoutes);
app.use("/admin", adminRoutes);
app.use("/webhook", webhookRoutes);

export default app;