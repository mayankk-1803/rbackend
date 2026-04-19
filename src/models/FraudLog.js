import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    mobile: { type: String },
    riskScore: { type: Number, required: true },
    actionTaken: { type: String, enum: ["FLAGGED", "BLOCKED"], required: true },
    reasons: [{ type: String }],
    txnData: { type: mongoose.Schema.Types.Mixed } 
  },
  { timestamps: true }
);

schema.index({ userId: 1, createdAt: -1 });
schema.index({ actionTaken: 1 });

export default mongoose.model("FraudLog", schema);
