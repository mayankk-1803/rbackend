import { Worker } from "bullmq";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { connection } from "../config/redis.js";
import { recharge } from "../services/rechargeService.js";

dotenv.config();

//  CONNECT MONGODB (VERY IMPORTANT)
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ Worker DB Connected"))
.catch(err => console.log("❌ DB Error:", err));

console.log(" Worker started...");

const worker = new Worker(
  "recharge",
  async (job) => {
    console.log(" Processing job:", job.data);
    await recharge(job.data);
  },
  { connection }
);

worker.on("active", (job) => {
  console.log(" Job active:", job.id);
});

worker.on("completed", (job) => {
  console.log(` Job completed: ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.log(`Job failed: ${job.id}, attemptsMade: ${job.attemptsMade}, error: ${err.message}`);
});