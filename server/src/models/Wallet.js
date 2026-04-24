import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    balance: { type: Number, default: 0 },
    cashbackBalance: { type: Number, default: 0 },
    currency: { type: String, default: "INR" }
  },
  { timestamps: true }
);

export default mongoose.model("Wallet", schema);
