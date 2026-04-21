import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import rechargeRoutes from "./routes/rechargeRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import webhookRoutes from "./webhooks/webhookRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import walletRoutes from "./routes/walletRoutes.js"; //ADD THIS

const app = express();

app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());

app.get("/test", (req, res) => {
  res.send("Server working");
});

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/wallet", walletRoutes); // ADD THIS
app.use("/recharge", rechargeRoutes);
app.use("/admin", adminRoutes);
app.use("/webhook", webhookRoutes);

export default app;