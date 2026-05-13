import prisma from "../config/prisma.js";
import { Queue } from "bullmq";
import { redis } from "../config/redis.js";
import { Prisma } from "@prisma/client";
import { createNexgateOrder } from "./providers/nexgateService.js";

// Ensure queue name matches the worker
export const paymentQueue = new Queue("paymentQueue", { connection: redis });

/**
 * Creates a real production payment order via NexGate
 */
export const createPaymentOrder = async (userId, amount, idempotencyKey, upiId, intent = "TOPUP") => {
  if (!userId) throw new Error("userId is required");
  if (!amount || Number(amount) <= 0) throw new Error("Invalid amount. Must be greater than 0.");
  if (!idempotencyKey) throw new Error("idempotencyKey is required");

  const finalIntent = intent === "RECHARGE" ? "RECHARGE" : "TOPUP";

  try {
    // 1. DUPLICATE PREVENTION CHECK (Last 5 mins PENDING)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingPending = await prisma.payment.findFirst({
      where: {
        userId: Number(userId),
        amount: new Prisma.Decimal(amount),
        status: "PENDING",
        createdAt: { gte: fiveMinutesAgo },
        gatewayUrl: { not: null }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existingPending) {
      console.log(`[DUPLICATE PAYMENT BLOCKED] User ${userId} | Amount ${amount} | Reusing ID ${existingPending.id}`);
      return {
        ...existingPending,
        payment_url: existingPending.gatewayUrl,
        qr_image: existingPending.qrCode,
        success: true,
        reused: true
      };
    }

    // 2. IDEMPOTENCY CHECK (Explicit key)
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    // 2. INITIAL DATABASE RECORD
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

    // 3. GATEWAY INITIALIZATION
    try {
      const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
      const nexgateOrder = await createNexgateOrder({
        amount: Number(amount),
        txnId: payment.id,
        mobile: user?.phone,
        name: user?.name,
        email: user?.email
      });

      console.log(`[PAYMENT SERVICE] NexGate Resp: success=${nexgateOrder.success} | url=${!!nexgateOrder.payment_url} | qr=${!!nexgateOrder.qr_image}`);

      if (nexgateOrder.success && (nexgateOrder.payment_url || nexgateOrder.qr_image)) {
         // Persist gateway specific fields
         const updatedPayment = await prisma.payment.update({
           where: { id: payment.id },
           data: { 
             gatewayUrl: nexgateOrder.payment_url || null,
             qrCode: nexgateOrder.qr_image || null,
             gatewayTxnId: nexgateOrder.order_id?.toString() || null,
             status: "PENDING"
           }
         });

         return { 
           ...updatedPayment,
           payment_url: nexgateOrder.payment_url,
           qr_image: nexgateOrder.qr_image,
           success: true 
         };
      } else {
         const errorMsg = nexgateOrder.message || "Gateway failed to return payment links";
         console.warn(`[PAYMENT SERVICE] ${errorMsg}`);
         
         await prisma.payment.update({
           where: { id: payment.id },
           data: { errorMessage: errorMsg, status: "FAILED" }
         });

         return {
           success: false,
           message: errorMsg,
           gatewayError: nexgateOrder.gatewayError || "GATEWAY_FAILURE"
         };
      }
    } catch (gatewayErr) {
      console.error("[PAYMENT SERVICE] Gateway Error:", gatewayErr.message);
      
      await prisma.payment.update({
        where: { id: payment.id },
        data: { errorMessage: gatewayErr.message, status: "FAILED" }
      }).catch(e => console.error("Critical: Failed to update error status", e.message));

      throw gatewayErr;
    }
  } catch (error) {
    console.error("[PAYMENT SERVICE] Order Creation Failure:", error.message);
    throw error;
  }
};
