import { Worker, Queue } from "bullmq";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { connection } from "../config/redis.js";
import { recharge } from "../services/rechargeService.js";
import eventBus from "../config/eventBus.js";

dotenv.config();

// MONGODB CONNECT
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ Worker DB Connected"))
.catch(err => console.log("❌ DB Error:", err));

console.log(" Worker started...");

export const dlqQueue = new Queue("recharge_dlq", { connection });

const worker = new Worker(
  "recharge",
  async (job) => {
    console.log("Incoming job:", job.data);
    await recharge(job.data);
  },
  { 
    connection,
    settings: {
      backoffStrategies: {
         // Custom backoff if needed
      }
    }
  }
);

worker.on("active", (job) => {
  console.log(" Job active:", job.id);
  eventBus.emit("provider_status", { status: "PROCESSING", jobId: job.id });
});

worker.on("completed", (job) => {
  console.log(` Job completed: ${job.id}`);
});

worker.on("failed", async (job, err) => {
  console.log(`Job failed: ${job.id}, attemptsMade: ${job.attemptsMade}, error: ${err.message}`);
  
  if (job.attemptsMade >= job.opts.attempts || err.message.includes("Max retries reached")) {
      console.log(`[DLQ] Sending job ${job.id} to Dead Letter Queue`);
      await dlqQueue.add("failed_recharge", job.data);
      eventBus.emit("recharge_failed", { jobId: job.id, data: job.data, reason: err.message, status: 'DLQ' });
  } else {
      eventBus.emit("provider_status", { status: "RETRYING", jobId: job.id, message: err.message });
  }
});