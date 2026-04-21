import User from "../models/User.js";
import Transaction from "../models/Transaction.js";

export const processRefund = async (txn) => {
  if (txn.refundStatus === "processed" || !txn.amountDeducted) return;

  await User.findByIdAndUpdate(txn.userId, {
    $inc: { walletBalance: txn.amount }
  });

  txn.refundStatus = "processed";
  txn.refundedAt = new Date();
  await txn.save();

  console.log(`Refund processed safely for transaction: ${txn._id}`);
};
