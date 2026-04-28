import prisma from "../config/prisma.js";
import { Queue } from "bullmq";
import { redis } from "../config/redis.js";
import { Prisma } from "@prisma/client";

// Ensure queue name matches the worker
export const paymentQueue = new Queue("paymentQueue", { connection: redis });

export const createPaymentOrder = async (userId, amount, idempotencyKey, upiId, intent = "TOPUP") => {
  if (!userId) {
    throw new Error("userId is required");
  }
  
  if (!amount || Number(amount) <= 0) {
    throw new Error("Invalid amount. Must be greater than 0.");
  }

  if (!idempotencyKey) {
    throw new Error("idempotencyKey is required");
  }

  const finalIntent = intent === "RECHARGE" ? "RECHARGE" : "TOPUP";

  console.log("CREATE PAYMENT:", {
    userId,
    amount,
    intent,
    finalIntent
  });

  // Check idempotency
  const existing = await prisma.payment.findUnique({
    where: { idempotencyKey }
  });
  
  if (existing) return existing;

  // Create new payment order in PENDING state
  const payment = await prisma.payment.create({
    data: {
      userId: Number(userId),
      amount: new Prisma.Decimal(amount),
      idempotencyKey,
      upiId: upiId || "demo@upi",
      intent: finalIntent,
      status: "PENDING",
      webhookReceived: false
    }
  });

  // Add a delay (e.g., 2 to 5 seconds) before processing the webhook
  const delay = Math.floor(Math.random() * 3000) + 2000;

  await paymentQueue.add(
    "simulateWebhook",
    {
      paymentId: payment.id,
      idempotencyKey
    },
    { 
      delay,
      jobId: `payment_${idempotencyKey}`, // Prevent duplicate jobs
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      }
    }
  );

  return payment;
};
