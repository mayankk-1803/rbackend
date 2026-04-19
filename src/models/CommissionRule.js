import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    operator: { type: String, required: true },
    userTier: { type: String, default: "Standard" },
    commissionPercent: { type: Number, required: true },
    cashbackPercent: { type: Number, required: true },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Indexes to speed up dynamic lookups
schema.index({ operator: 1, userTier: 1, isActive: 1 });
schema.index({ priority: -1 });

export default mongoose.model("CommissionRule", schema);
