import Transaction from "../models/Transaction.js";

export const createPaymentLink = async (userId, amount) => {
  const orderId = "ORD_" + Date.now();

  await Transaction.create({
    userId,
    amount,
    type: "wallet",
    status: "pending",
    gatewayTxnId: orderId,
    paymentGateway: "nexgate"
  });

  console.log("💰 Payment created:", orderId);

  return `https://fake-payment.com/pay/${orderId}`;
};