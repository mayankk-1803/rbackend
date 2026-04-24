import { Worker } from "bullmq";
import { redis } from "../config/redis.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const workerOptions = {
  connection: redis,
  concurrency: 5, // Process up to 5 payments concurrently
};

export const startPaymentWorker = () => {
  const worker = new Worker(
    "paymentQueue",
    async (job) => {
      const { paymentId, idempotencyKey } = job.data;

      // Simulate provider decision (80% success rate)
      const isSuccess = Math.random() < 0.8;
      const status = isSuccess ? "SUCCESS" : "FAILED";
      const gatewayTxnId = `TXN_${Math.floor(Math.random() * 1000000000)}`;
      
      const payload = {
        paymentId,
        idempotencyKey,
        status,
        gatewayTxnId,
        errorMessage: isSuccess ? null : "Bank declined the transaction"
      };

      try {
        // Trigger webhook internally
        const webhookUrl = process.env.API_URL 
            ? `${process.env.API_URL}/api/payment/webhook` 
            : "http://localhost:5000/api/payment/webhook";
            
        await axios.post(webhookUrl, payload, {
          // You might add an internal secret here for security
          headers: { "x-webhook-secret": process.env.WEBHOOK_SECRET || "internal_secret" }
        });
        
        console.log(`[PaymentWorker] Webhook sent for payment ${paymentId} with status ${status}`);
      } catch (error) {
        console.error(`[PaymentWorker] Failed to trigger webhook for ${paymentId}:`, error.message);
        throw error; // Will be retried by BullMQ if configured
      }
    },
    workerOptions
  );

  worker.on("completed", (job) => {
    console.log(`[PaymentWorker] Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[PaymentWorker] Job ${job.id} failed:`, err);
  });

  return worker;
};
