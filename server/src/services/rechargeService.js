import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { getCommissionDetails } from "./commissionEngine.js";
import { connection as redis } from "../config/redis.js";
import eventBus from "../config/eventBus.js";
import { executeIntelligentRecharge } from "./routingService.js";

export const recharge = async (data) => {
  const { userId, amount, mobile, operator, idempotencyKey, providerCode } = data;

  console.log("Processing job:", data);

  // Distributed Lock
  const lockKey = `lock:recharge:${idempotencyKey || userId + mobile + Date.now()}`;
  const lock = await redis.setnx(lockKey, "1");
  if (!lock) {
      console.log(`[PROCESS] Job already processing for lock ${lockKey}`);
      return { success: false, message: "Concurrently processing" };
  }
  // Set TTL for safety so lock doesn't stay forever if process crashes
  await redis.expire(lockKey, 30);

  try {
      // Idempotency DB check as final safety
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
          eventBus.emit("recharge_failed", { mobile, amount, alert: "Max retries reached" });
          return { success: false, message: "Max retries reached", data: txn };
      }

      txn.isLocked = true;
      await txn.save();

      let result = null;

      // 🔥 SMART ROUTING
      try {
          result = await executeIntelligentRecharge({ mobile, amount, operator, providerCode });
      } catch (err) {
          console.log("Routing Layer failed:", err.message);
      }

      // ❌ FAILED
      if (!result) {
        if (txn.retryCount >= 3) {
          txn.status = "failed";
          txn.isLocked = false;
          await txn.save();
          eventBus.emit("recharge_failed", { mobile, amount, msg: "Recharge permanently failed" });
          return { success: false, message: "Recharge failed", data: txn };
        }

        txn.isLocked = false;
        await txn.save();
        throw new Error("Provider failure, triggering BullMQ auto-retry");
      }

      // SUCCESS FLOW
      // Dynamic Commission
      const userDoc = await User.findById(userId).select("tier").lean();
      const userTier = userDoc?.tier || "Standard";
      
      const { commission, cashback, profit } = await getCommissionDetails(amount, operator, userTier);

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
      
      // Emit Success Event
      eventBus.emit("recharge_success", { mobile, amount, provider: result.provider });

      return { success: true, message: "Recharge successful", data: txn };
  } finally {
      // Always release lock
      await redis.del(lockKey);
  }
};