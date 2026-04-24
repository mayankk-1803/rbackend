import { createPaymentOrder } from "../services/paymentService.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import eventBus from "../config/eventBus.js";
import crypto from "crypto";
import mongoose from "mongoose";

export const createOrder = async (req, res) => {
  try {
    const { amount, upiId, intent } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    const idempotencyKey = req.headers["x-idempotency-key"] || crypto.randomUUID();

    const payment = await createPaymentOrder(userId, amount, idempotencyKey, upiId, intent);

    res.json({
      success: true,
      message: "Order created successfully",
      data: payment
    });
  } catch (error) {
    console.error("[CreateOrder Error]:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { paymentId } = req.body;
    const userId = req.user.id;

    const payment = await Payment.findOne({ _id: paymentId, userId });
    if (!payment) {
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

    const payment = await Payment.findOne({ _id: paymentId, userId });
    if (!payment) {
      console.error(`[Payment] Order not found: ${paymentId}`);
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    // Call paymentWebhook logic internally to simulate success
    const webhookReq = {
      headers: { "x-webhook-secret": process.env.WEBHOOK_SECRET || "internal_secret" },
      body: {
        paymentId: payment._id,
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
    // Basic internal webhook auth
    const secret = req.headers["x-webhook-secret"];
    if (secret !== (process.env.WEBHOOK_SECRET || "internal_secret")) {
      return res.status(401).json({ success: false, message: "Unauthorized webhook caller" });
    }

    const { paymentId, status, gatewayTxnId, errorMessage } = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    // Prevent double processing
    if (payment.webhookReceived) {
      return res.json({ success: true, message: "Webhook already processed" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      payment.status = status;
      payment.gatewayTxnId = gatewayTxnId;
      payment.errorMessage = errorMessage;
      payment.webhookReceived = true;
      await payment.save({ session });

      if (status === "SUCCESS") {
        let updatedWallet = null;

        if (payment.intent === "WALLET_TOPUP") {
          console.log(`[Payment Webhook] WALLET_TOPUP detected. Updating wallet for userId: ${payment.userId}, amount: +${payment.amount}`);
          // Update user wallet atomically using Wallet model
          updatedWallet = await Wallet.findOneAndUpdate(
            { userId: payment.userId },
            { $inc: { balance: payment.amount } },
            { new: true, upsert: true, session }
          );

          // Create Transaction record for WALLET_TOPUP
          await Transaction.create([{
            userId: payment.userId,
            amount: payment.amount,
            type: "wallet",
            status: "success",
            gatewayTxnId: gatewayTxnId,
            paymentGateway: "simulated_upi",
            idempotencyKey: payment.idempotencyKey,
            intent: "WALLET_TOPUP"
          }], { session });

          console.log(`[Payment Webhook] Wallet credited. New Balance: ${updatedWallet.balance}`);
        } else {
          console.log(`[Payment Webhook] RECHARGE intent detected. Skipping wallet credit.`);
        }

        // Notify via eventBus
        if (payment.intent === "WALLET_TOPUP" && updatedWallet) {
          eventBus.emit("wallet_updated", {
            userId: payment.userId.toString(),
            amount: payment.amount,
            type: "CREDIT"
          });
          
          eventBus.emit("wallet_update", {
            userId: payment.userId,
            walletBalance: updatedWallet.balance
          });
        }
        
        eventBus.emit("payment_status", {
          paymentId: payment._id,
          status: "SUCCESS"
        });
      } else {
        console.log(`[Payment Webhook] Payment failed for ${payment.userId}`);
        // Notify via eventBus for failure
        eventBus.emit("payment_status", {
          paymentId: payment._id,
          status: "FAILED"
        });
      }

      await session.commitTransaction();
      res.json({ success: true, message: "Webhook processed" });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("[Webhook Error]:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
