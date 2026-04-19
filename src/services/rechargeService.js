import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { calculateCommission } from "./commissionService.js";
import { calculateCashback } from "./cashbackService.js";
import { processRefund } from "./refundService.js";
import { primaryRecharge, backupRecharge } from "./providerService.js";

export const recharge = async (data) => {
  const { userId, amount, mobile, operator, idempotencyKey } = data;

  console.log("Processing job:", data);

  // Idempotency
  let txn = null;
  if (idempotencyKey) {
    txn = await Transaction.findOne({ idempotencyKey });
    if (txn && txn.status === "success") {
      return { success: false, message: "Duplicate transaction", data: txn };
    }
  }

  if (!txn) {
    // User check
    const user = await User.findById(userId);
    if (!user) return { success: false, message: "User not found" };
    if (user.walletBalance < amount) {
      return { success: false, message: "Insufficient balance" };
    }

    // Create transaction
    txn = await Transaction.create({
      userId,
      amount,
      mobile,
      operator,
      type: "recharge",
      status: "pending",
      idempotencyKey,
      isLocked: true,
      amountDeducted: false,
      retryCount: 0
    });
  }

  // 1. Increment retryCount on each execution
  txn.retryCount = (txn.retryCount || 0) + 1;
  txn.lastRetryAt = new Date();

  // 2. Add retry limit:
  if (txn.retryCount > 3) {
      txn.status = "failed";
      txn.isLocked = false;
      await txn.save();
      return { success: false, message: "Max retries reached", data: txn };
  }

  txn.isLocked = true;
  await txn.save();

  let result = null;

  // 🔥 TRY PRIMARY
  try {
    result = await primaryRecharge({ mobile });
  } catch (err) {
    console.log("Primary failed:", err.message);
  }

  // 🔥 TRY BACKUP IF PRIMARY FAILED
  if (!result) {
    try {
      result = await backupRecharge({ mobile });
    } catch (err) {
      console.log("Backup failed:", err.message);
    }
  }

  // ❌ BOTH FAILED
  if (!result) {
    console.log("Both providers failed");

    if (txn.retryCount >= 3) {
      txn.status = "failed";
      txn.isLocked = false;
      await txn.save();
      return { success: false, message: "Recharge failed", data: txn };
    }

    txn.isLocked = false;
    await txn.save();
    throw new Error("Provider failure, triggering BullMQ auto-retry");
  }

  // ✅ SUCCESS FLOW
  const commission = Number(calculateCommission(amount, operator).toFixed(2));
  const cashback = Number(calculateCashback(amount).toFixed(2));
  const profit = Number((commission - cashback).toFixed(2));

  txn.status = "success";
  txn.commission = commission;
  txn.cashback = cashback;
  txn.profit = profit;
  txn.provider = result.provider;
  txn.providerTxnId = result.providerTxnId;
  txn.isLocked = false;
  txn.amountDeducted = true;

  // Deduct wallet + add cashback
  await User.findByIdAndUpdate(userId, {
    $inc: {
      walletBalance: -amount,
      cashbackBalance: cashback
    }
  });

  await txn.save();

  console.log(
    `Recharge success. Provider: ${result.provider}, Comm: ${commission}, Cash: ${cashback}`
  );

  return { success: true, message: "Recharge successful", data: txn };
};