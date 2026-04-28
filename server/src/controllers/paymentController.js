import { createPaymentOrder } from "../services/paymentService.js";
import prisma from "../config/prisma.js";
import eventBus from "../config/eventBus.js";
import crypto from "crypto";
import { Prisma } from "@prisma/client";

export const createOrder = async (req, res) => {
  try {
    console.log("CREATE ORDER INPUT:", req.body);
    console.log("USER:", req.user);

    let { amount, upiId, intent } = req.body;
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "USER_NOT_AUTHENTICATED" });
    }
    
    const userId = req.user.id;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    // Normalize intent
    intent = intent === "RECHARGE" ? "RECHARGE" : "TOPUP";

    const idempotencyKey = req.headers["x-idempotency-key"];
    if (!idempotencyKey) {
      return res.status(400).json({ success: false, message: "x-idempotency-key header is required" });
    }

    const payment = await createPaymentOrder(userId, Number(amount), idempotencyKey, upiId, intent);

    return res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error("🔥 PAYMENT ERROR FULL:", error);
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { paymentId } = req.body;
    const userId = req.user.id;

    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(paymentId) }
    });

    if (!payment || payment.userId !== userId) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const confirmPayment = async (req, res) => {
  try {
    const { paymentId } = req.body;
    const userId = req.user.id;

    console.log(`[Payment] Confirming payment order: ${paymentId} for user: ${userId}`);

    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(paymentId) }
    });

    if (!payment || payment.userId !== userId) {
      console.error(`[Payment] Order not found: ${paymentId}`);
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    // Call paymentWebhook logic internally to simulate success
    const webhookReq = {
      headers: { "x-webhook-secret": process.env.WEBHOOK_SECRET || "internal_secret" },
      body: {
        paymentId: payment.id,
        status: "SUCCESS",
        gatewayTxnId: `MOCK_TXN_${Date.now()}`,
        errorMessage: ""
      }
    };

    const webhookRes = {
      json: (data) => {
        console.log(`[Payment] Confirmation response for ${paymentId}: success=${data.success}`);
        return res.json(data);
      },
      status: (code) => ({
        json: (data) => {
          console.log(`[Payment] Confirmation error for ${paymentId}: code=${code}, message=${data.message}`);
          return res.status(code).json(data);
        }
      })
    };

    return await paymentWebhook(webhookReq, webhookRes);
  } catch (error) {
    console.error("[ConfirmPayment Error]:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const paymentWebhook = async (req, res) => {
  try {
    const secret = req.headers["x-webhook-secret"];
    if (secret !== (process.env.WEBHOOK_SECRET || "internal_secret")) {
      return res.status(401).json({ success: false, message: "Unauthorized webhook caller" });
    }

    const { paymentId, status, gatewayTxnId, errorMessage } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock payment record
      const payment = await tx.payment.findUnique({
        where: { id: parseInt(paymentId) }
      });

      if (!payment) throw new Error("Payment not found");
      if (payment.status !== "PENDING") return { alreadyProcessed: true, payment };

      // 2. Lock wallet record
      await tx.$executeRaw`SELECT * FROM Wallet WHERE userId = ${payment.userId} FOR UPDATE`;

      // 3. Update payment status
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: status === "SUCCESS" ? "SUCCESS" : "FAILED",
          gatewayTxnId,
          errorMessage,
          webhookReceived: true
        }
      });

      if (status === "SUCCESS") {
        // 4. Credit Wallet
        const wallet = await tx.wallet.update({
          where: { userId: payment.userId },
          data: { balance: { increment: payment.amount } }
        });

        // 5. Create Transaction Record
        await tx.transaction.create({
          data: {
            userId: payment.userId,
            amount: payment.amount,
            type: "TOPUP",
            status: "SUCCESS",
            direction: "CREDIT",
            gatewayTxnId,
            balanceAfter: wallet.balance
          }
        });
      }

      return { alreadyProcessed: false, payment: updatedPayment };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    if (!result.alreadyProcessed && status === "SUCCESS") {
      eventBus.emit("wallet_updated", { userId: result.payment.userId, amount: result.payment.amount });
    }

    return res.json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("[Webhook Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
