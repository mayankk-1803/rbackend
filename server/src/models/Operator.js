import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // e.g. JIO, AIRTEL, VI, BSNL
    codes: [{ type: String }], // Array of starting codes like "98", "99", "70"
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model("Operator", schema);
