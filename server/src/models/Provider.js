import mongoose from "mongoose";

const providerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  baseUrl: { type: String, required: true },
  apiKey: { type: String, required: true },
  isActive: { type: Boolean, default: false },
  isBlacklisted: { type: Boolean, default: false },
  priority: { type: Number, default: 0 },
  avgResponseTime: { type: Number, default: 0 },
  successRate: { type: Number, default: 100 },
  costPerTxn: { type: Number, default: 0 },
  healthStatus: { type: String, enum: ["HEALTHY", "DEGRADED", "DOWN"], default: "HEALTHY" },
  createdAt: { type: Date, default: Date.now }
});

const Provider = mongoose.model("Provider", providerSchema);
export default Provider;
