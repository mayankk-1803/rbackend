import prisma from "../config/prisma.js";

/**
 * Standardized events for transaction timeline.
 */
export const TXN_EVENTS = {
  INITIATED: "INITIATED",
  WALLET_DEBITED: "WALLET_DEBITED",
  PROVIDER_PENDING: "PROVIDER_PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
  CASHBACK_ISSUED: "CASHBACK_ISSUED"
};

/**
 * Appends an event to the transaction's lifecycle timeline.
 * Stores events in the description or a dedicated metadata field.
 */
export const logTransactionEvent = async (transactionId, event, details = {}) => {
  try {
    const txn = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { invoiceSnapshot: true }
    });

    const timeline = txn?.invoiceSnapshot?.timeline || [];
    const newEvent = {
      event,
      timestamp: new Date().toISOString(),
      details
    };

    const updatedTimeline = [...timeline, newEvent];

    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        invoiceSnapshot: {
          ...(txn?.invoiceSnapshot || {}),
          timeline: updatedTimeline
        }
      }
    });

    console.log(`[Txn Timeline] ${event} logged for TXN:${transactionId}`);
  } catch (err) {
    console.error("[Timeline Log Error]:", err.message);
  }
};
