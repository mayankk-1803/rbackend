import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    details: { type: mongoose.Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("AuditLog", schema);
