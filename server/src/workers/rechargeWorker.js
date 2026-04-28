import { Worker, Queue } from "bullmq";
import dotenv from "dotenv";
import { redis } from "../config/redis.js";
import { recharge } from "../services/rechargeService.js";
import eventBus from "../config/eventBus.js";

dotenv.config();

console.log("Worker started...");

export const dlqQueue = new Queue("recharge_dlq", { connection: redis });

import prisma from "../config/prisma.js";

const worker = new Worker("rechargeQueue", async (job) => {
    console.log(`[JOB] Processing ${job.id}:`, job.data);
    
    try {
      await prisma.transaction.update({
        where: { id: job.data.txnId },
        data: { status: "SUCCESS" }
      });
      return { success: true };
    } catch (error) {
      console.error(`[JOB ERROR] ${job.id}:`, error.message);
      await prisma.transaction.update({
        where: { id: job.data.txnId },
        data: { status: "FAILED" }
      });
      throw error;
    }
  },
  { 
    connection: redis,
    concurrency: 5,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    settings: {
      backoffStrategies: {
        exponential: (attemptsMade) => {
          return Math.pow(2, attemptsMade) * 1000;
        }
      }
    }
  }
);

worker.on("active", (job) => {
  console.log("Job active:", job.id);
});

worker.on("completed", (job) => {
  console.log("Job completed:", job.id);
});

worker.on("failed", (job, err) => {
  console.error("Job failed:", job.id, err.message);
});

export default worker;
