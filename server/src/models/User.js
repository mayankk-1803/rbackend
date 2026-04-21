import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    email: { type: String, unique: true, lowercase: true, trim: true, required: true },
    password: { type: String, required: true },
    walletBalance: { type: Number, default: 0 },
    cashbackBalance: { type: Number, default: 0 },
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    referralEarnings: { type: Number, default: 0 },
    role: { type: String, default: "user" }
  },
  { timestamps: true }
);

export default mongoose.model("User", schema);