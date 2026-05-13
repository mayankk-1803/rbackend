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
    console.error("[CRITICAL] PAYMENT ERROR FULL:", error);
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

export const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    console.log(`[PaymentStatus] Checking status for Order ${orderId} | User ${userId}`);

    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(orderId) },
      include: {
        user: {
          select: {
            wallet: true
          }
        }
      }
    });

    if (!payment || payment.userId !== userId) {
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }

    // Force no-store for real-time accuracy
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    res.json({
      success: true,
      payload: {
        status: payment.status,
        amount: payment.amount,
        intent: payment.intent,
        gatewayTxnId: payment.gatewayTxnId,
        webhookReceived: payment.webhookReceived,
        walletBalance: payment.user.wallet?.balance,
        updatedAt: payment.updatedAt
      }
    });
  } catch (error) {
    console.error("[PaymentStatus Error]:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const paymentWebhook = async (req, res) => {
  try {
    // correlationId for observability
    const correlationId = crypto.randomBytes(8).toString('hex');
    const body = req.body;
    console.log(`[WEBHOOK][${correlationId}] RECEIVED:`, JSON.stringify(body));

    // NexGate uses order_id for our payment ID
    const rawPaymentId = body.order_id || body.paymentId;
    const status = (body.status || "").toUpperCase();
    const gatewayTxnId = (body.transaction_id || body.txn_id || body.gatewayTxnId || "").toString();
    const gatewayAmount = body.amount ? parseFloat(body.amount) : null;
    const errorMessage = body.message || body.errorMessage || "";

    if (!rawPaymentId) {
      console.error(`[WEBHOOK][${correlationId}] ERROR: Missing order_id/paymentId`);
      return res.status(400).json({ success: false, message: "Missing identifier" });
    }

    const paymentId = parseInt(rawPaymentId);

    // Atomic Transaction with Serializable Isolation for maximum consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch and Lock payment record
      const payment = await tx.payment.findUnique({
        where: { id: paymentId }
      });

      if (!payment) throw new Error(`Payment ${paymentId} not found`);
      
      // 2. Strict Idempotency: If already success or failed, stop (Replay Protection)
      if (payment.status !== "PENDING") {
        console.log(`[WEBHOOK][${correlationId}] ALREADY PROCESSED: Status=${payment.status}`);
        return { alreadyProcessed: true, payment };
      }

      // 3. Security Checks: Amount Integrity
      if (gatewayAmount !== null && Math.abs(gatewayAmount - Number(payment.amount)) > 0.01) {
        console.error(`[WEBHOOK][${correlationId}] SECURITY ALERT: Amount mismatch! Gateway=${gatewayAmount}, DB=${payment.amount}`);
        // We mark as failed if amount is tampered
        const tamperedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED", errorMessage: "Amount mismatch detected", webhookReceived: true }
        });
        return { alreadyProcessed: false, payment: tamperedPayment, securityAlert: true };
      }

      const isSuccess = status === "SUCCESS" || status === "PAID" || status === "COMPLETED";
      
      // 4. Update payment status
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: isSuccess ? "SUCCESS" : "FAILED",
          gatewayTxnId: gatewayTxnId,
          errorMessage: isSuccess ? null : errorMessage,
          webhookReceived: true
        }
      });

      if (isSuccess) {
        // 5. Credit Wallet Atomically & Create Immutable Ledger
        const oldWallet = await tx.wallet.findUnique({ where: { userId: payment.userId } });
        
        const wallet = await tx.wallet.update({
          where: { userId: payment.userId },
          data: { balance: { increment: payment.amount } }
        });

        // 6. Detailed Transaction Record (Ledger)
        await tx.transaction.create({
          data: {
            userId: payment.userId,
            amount: payment.amount,
            type: "TOPUP",
            status: "SUCCESS",
            direction: "CREDIT",
            gatewayTxnId: gatewayTxnId,
            balanceAfter: wallet.balance,
            description: `Wallet topup | Order: ${payment.id} | Before: ${oldWallet?.balance || 0}`
          }
        });

        console.log(`[WEBHOOK][${correlationId}] SUCCESS: Credited ₹${payment.amount} to User ${payment.userId}`);
      } else {
        console.warn(`[WEBHOOK][${correlationId}] FAILED: Status=${status} | Msg=${errorMessage}`);
      }

      return { alreadyProcessed: false, payment: updatedPayment };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });

    // 7. Real-time Synchronization (Post-Commit)
    if (!result.alreadyProcessed && result.payment.status === "SUCCESS") {
      console.log(`[WEBHOOK] Payment verified | Order: ${result.payment.id}`);
      console.log(`[WEBHOOK] Wallet credited | User: ${result.payment.userId}`);
      console.log(`[WEBHOOK] Payment SUCCESS | Correlation: ${correlationId}`);
      eventBus.emit("wallet_updated", { userId: result.payment.userId, amount: result.payment.amount });
    }

    return res.json({ success: true, message: "Webhook processed successfully", correlationId });
  } catch (error) {
    console.error(`[WEBHOOK] EXCEPTION:`, error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
