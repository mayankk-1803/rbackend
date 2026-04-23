import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { getCommissionDetails } from "./commissionEngine.js";
import { connection as redis } from "../config/redis.js";
import eventBus from "../config/eventBus.js";
import { getSortedProviders, updateProviderMetrics } from "./routingService.js";
import { simulateProviderAPI } from "./providerSimulator.js";
import { getIO } from "../config/socket.js";

export const recharge = async (data) => {
    const { userId, amount, mobile, operator, idempotencyKey, providerCode, txnId } = data;
    const io = getIO();

    console.log(`[PROCESS] Processing job for txnId: ${txnId}`);

    // Distributed Lock
    const lockKey = `lock:recharge:${txnId || idempotencyKey || userId + mobile + Date.now()}`;
    const lock = await redis.setnx(lockKey, "1");
    if (!lock) {
        console.log(`[PROCESS] Job already processing for lock ${lockKey}`);
        return { success: false, message: "Concurrently processing" };
    }
    await redis.expire(lockKey, 60);

    let txn = null;
    try {
        // 1. FIND TRANSACTION
        txn = await Transaction.findById(txnId);
        if (!txn && idempotencyKey) {
            txn = await Transaction.findOne({ idempotencyKey });
        }

        if (txn && txn.status === "success") {
            console.log(`[PROCESS] Transaction ${txn._id} already succeeded.`);
            return { success: true, message: "Already succeeded", data: txn };
        }

        if (!txn) {
            throw new Error("Transaction not found in database.");
        }

        // 2. FETCH PROVIDER LIST FOR FALLBACK
        let providers = await getSortedProviders();
        
        // Priority 1: Manual provider (if specified)
        if (providerCode) {
            const manualIdx = providers.findIndex(p => p.code === providerCode);
            if (manualIdx > -1) {
                const manualProvider = providers.splice(manualIdx, 1)[0];
                providers.unshift(manualProvider);
            }
        }

        if (!providers.length) {
            throw new Error("No active providers available");
        }

        let result = null;
        let selectedProvider = null;
        let lastError = null;

        // 3. AUTO-FALLBACK LOOP
        for (const provider of providers) {
            console.log(`🔁 Trying provider: ${provider.name} (${provider.code})`);
            
            const startTime = Date.now();
            try {
                result = await simulateProviderAPI(provider);
                const duration = Date.now() - startTime;

                const isSuccess = result.status?.toLowerCase() === "success";
                await updateProviderMetrics(provider.code, isSuccess, duration);

                if (isSuccess) {
                    selectedProvider = provider;
                    console.log(`✅ SUCCESS via: ${provider.name}`);
                    break;
                } else {
                    console.warn(`[PROCESS] Provider ${provider.code} failed: ${result.message}`);
                    lastError = new Error(result.message || "Provider failed");
                }
            } catch (err) {
                console.error(`[PROCESS] Critical provider error (${provider.code}): ${err.message}`);
                lastError = err;
            }
        }

        // 4. FINAL STATUS HANDLING
        if (result && result.status?.toLowerCase() === "success") {
            const user = await User.findById(userId);
            if (!user) throw new Error("User not found");
            
            if (user.walletBalance < amount) {
                txn.status = "failed";
                txn.failureReason = "Insufficient balance at execution";
                await txn.save();
                eventBus.emit("recharge_failed", { txnId: txn._id, mobile, amount, reason: "Insufficient balance" });
                return { success: false, message: "Insufficient balance" };
            }

            const userTier = user.tier || "Standard";
            const { commission, cashback, profit } = await getCommissionDetails(amount, operator, userTier);

            // Update Wallet and Cashback
            user.walletBalance -= amount;
            user.cashbackBalance = (user.cashbackBalance || 0) + cashback;
            await user.save();

            // 🔥 SOCKET EMIT: WALLET UPDATE
            io.emit("wallet_update", {
                userId: user._id,
                walletBalance: user.walletBalance,
                cashbackBalance: user.cashbackBalance
            });

            // Update Transaction
            txn.status = "success";
            txn.provider = selectedProvider.name;
            txn.providerTxnId = result.operatorId;
            txn.apiResponse = result;
            txn.commission = commission;
            txn.cashback = cashback;
            txn.profit = profit;
            txn.amountDeducted = true;
            await txn.save();

            // 🔥 SOCKET EMIT (Strict as per user request)
            io.emit("recharge_update", { 
                txnId: txn._id, 
                status: "success",
                transaction: txn
            });

            // 🔥 SOCKET EMIT via EventBus
            eventBus.emit("recharge_success", { txnId: txn._id, mobile, amount, transaction: txn });
            
            // Save recent success for smart duplicate delay
            await redis.set(`recent_success:${mobile}`, "1", "EX", 120);

            return { success: true, data: txn };
        } else {
            // ❌ ALL PROVIDERS FAILED
            txn.status = "failed";
            txn.failureReason = lastError?.message || "All providers failed";
            txn.provider = "SYSTEM_FAILURE";
            await txn.save();
            
            // 🔥 SOCKET EMIT (Strict as per user request)
            io.emit("recharge_update", { 
                txnId: txn._id, 
                status: "failed",
                reason: txn.failureReason
            });

            // 🔥 SOCKET EMIT via EventBus
            eventBus.emit("recharge_failed", { txnId: txn._id, mobile, amount, reason: txn.failureReason });
            
            return { success: false, message: txn.failureReason };
        }

    } catch (err) {
        console.error(`❌ WORKER ERROR: ${err.message}`);
        if (txn) {
            txn.status = "failed";
            txn.failureReason = err.message;
            await txn.save();
            eventBus.emit("recharge_failed", { txnId: txn._id, mobile, amount, reason: err.message });
        }
        return { success: false, message: err.message };
    } finally {
        await redis.del(lockKey);
    }
};
