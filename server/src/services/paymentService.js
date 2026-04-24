import Payment from "../models/Payment.js";
import { Queue } from "bullmq";
import { redis } from "../config/redis.js";

// Ensure queue name matches the worker
export const paymentQueue = new Queue("paymentQueue", { connection: redis });

export const createPaymentOrder = async (userId, amount, idempotencyKey, upiId, intent = "WALLET_TOPUP") => {
  // Check idempotency
  const existingPayment = await Payment.findOne({ idempotencyKey });
  if (existingPayment) {
    return existingPayment;
  }

  // Create new payment order in PENDING state
  const payment = new Payment({
    userId,
    amount,
    idempotencyKey,
    upiId,
    intent,
    status: "PENDING",
  });
  await payment.save();

  // Add a delay (e.g., 2 to 5 seconds) before processing the webhook
  const delay = Math.floor(Math.random() * 3000) + 2000; // 2000ms to 5000ms

  await paymentQueue.add(
    "simulateWebhook",
    {
      paymentId: payment._id.toString(),
      idempotencyKey
    },
    { delay }
  );

  return payment;
};
