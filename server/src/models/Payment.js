import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["PENDING", "SUCCESS", "FAILED"], default: "PENDING" },
    idempotencyKey: { type: String, unique: true, required: true },
    upiId: { type: String },
    intent: { type: String, enum: ["WALLET_TOPUP", "RECHARGE"], default: "WALLET_TOPUP" },
    gatewayTxnId: { type: String },
    errorMessage: { type: String },
    webhookReceived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Payment", schema);
