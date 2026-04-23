import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    type: { type: String, required: true },
    status: { type: String, enum: ["success", "failed", "pending"], default: "pending" },
    mobile: Number,
    operator: String,
    cashback: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    provider: String,
    providerTxnId: String,
    amountDeducted: { type: Boolean, default: false },
    refundStatus: { type: String, enum: ["none", "processed"], default: "none" },
    refundedAt: Date,
    idempotencyKey: { type: String, unique: true, sparse: true },
    gatewayTxnId: String,
    paymentGateway: String,
    retryCount: { type: Number, default: 0 },
    lastRetryAt: Date,
    isLocked: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", schema);