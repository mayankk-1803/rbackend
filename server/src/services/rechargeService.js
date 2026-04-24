import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import { calculateCommission } from "../utils/calculateCommission.js";
import { redis } from "../config/redis.js";
import eventBus from "../config/eventBus.js";
import { getSortedProviders, updateProviderMetrics } from "./routingService.js";
import { simulateProviderAPI } from "./providerSimulator.js";

export const recharge = async (data) => {
    const { userId, amount, mobile, operator, idempotencyKey, providerCode, txnId } = data;

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
            console.log(`[Worker Success] Recharge succeeded for txnId: ${txnId}`);
            const user = await User.findById(userId);
            
            const userTier = user?.tier || "Standard";
            const commission = calculateCommission(amount, operator);

            // Give Cashback (balance is already deducted in controller)
            if (commission > 0) {
                console.log(`[Recharge Service] Crediting cashback for userId: ${userId}, amount: +${commission}`);
                const updatedWallet = await Wallet.findOneAndUpdate(
                    { userId },
                    { $inc: { cashbackBalance: commission } },
                    { new: true, upsert: true }
                );
                
                if (updatedWallet) {
                    eventBus.emit("wallet_updated", { userId: userId.toString() });
                    
                    eventBus.emit("wallet_update", {
                        userId: updatedWallet.userId,
                        walletBalance: updatedWallet.balance,
                        cashbackBalance: updatedWallet.cashbackBalance
                    });
                }
            }

            // Update Transaction
            txn.status = "success";
            txn.provider = selectedProvider.name;
            txn.providerTxnId = result.operatorId;
            txn.apiResponse = result;
            txn.commission = commission;
            txn.cashback = commission; // In this context, cashback = commission given to user
            txn.profit = 0; // Baseline profit or calculated differently if needed
            await txn.save();

            // 🔥 EVENT BUS EMIT
            eventBus.emit("recharge_update", { 
                txnId: txn._id, 
                status: "success",
                transaction: txn
            });
            
            eventBus.emit("recharge_status", {
                userId,
                txnId: txn._id,
                status: "success",
                transaction: txn
            });

            eventBus.emit("recharge_success", { txnId: txn._id, mobile, amount, transaction: txn });
            await redis.set(`recent_success:${mobile}`, "1", "EX", 120);

            return { success: true, data: txn };
        } else {
            // ❌ ALL PROVIDERS FAILED
            console.log(`[Worker Failure] Recharge failed for txnId: ${txnId}. Failure reason: ${lastError?.message || "All providers failed"}`);
            
            txn.status = "failed";
            txn.failureReason = lastError?.message || "All providers failed";
            txn.provider = "SYSTEM_FAILURE";
            await txn.save();
            
            // AUTO REFUND (Atomic)
            if (txn.amountDeducted && txn.refundStatus === "none") {
                console.log(`[Refund Execution] Refunding userId: ${userId}, amount: +${amount} for failed txn: ${txnId}`);
                const updatedWallet = await Wallet.findOneAndUpdate(
                    { userId },
                    { $inc: { balance: amount } },
                    { new: true, upsert: true }
                );
                
                if (updatedWallet) {
                    txn.refundStatus = "processed";
                    txn.refundedAt = new Date();
                    await txn.save();
                    
                    eventBus.emit("wallet_updated", { userId: userId.toString() });
                    
                    eventBus.emit("wallet_update", {
                        userId: updatedWallet.userId,
                        walletBalance: updatedWallet.balance,
                        cashbackBalance: updatedWallet.cashbackBalance
                    });
                }
            }

            // 🔥 EVENT BUS EMIT
            eventBus.emit("recharge_update", { 
                txnId: txn._id, 
                status: "failed",
                reason: txn.failureReason
            });

            eventBus.emit("recharge_status", {
                userId,
                txnId: txn._id,
                status: "failed",
                reason: txn.failureReason
            });

            eventBus.emit("recharge_failed", { txnId: txn._id, mobile, amount, reason: txn.failureReason });
            
            if (lastError?.message?.includes("timeout")) {
                throw new Error("Provider timeout, triggering retry");
            }

            return { success: false, message: txn.failureReason };
        }

    } catch (err) {
        console.error(`❌ WORKER CRITICAL ERROR: ${err.message}`);
        if (txn && err.message !== "Provider timeout, triggering retry") {
            txn.status = "failed";
            txn.failureReason = err.message;
            await txn.save();
            
            // AUTO REFUND on unhandled non-retryable error
            if (txn.amountDeducted && txn.refundStatus === "none") {
                console.log(`[Refund Execution] Catch block refunding userId: ${userId}, amount: +${amount} for txn: ${txnId}`);
                const updatedWallet = await Wallet.findOneAndUpdate(
                    { userId },
                    { $inc: { balance: amount } },
                    { new: true, upsert: true }
                );
                if (updatedWallet) {
                    txn.refundStatus = "processed";
                    txn.refundedAt = new Date();
                    await txn.save();
                    
                    io.to(userId.toString()).emit("wallet_updated");
                    
                    io.emit("wallet_update", {
                        userId: updatedWallet.userId,
                        walletBalance: updatedWallet.balance,
                        cashbackBalance: updatedWallet.cashbackBalance
                    });
                }
            }
            
            eventBus.emit("recharge_failed", { txnId: txn._id, mobile, amount, reason: err.message });
        }
        
        throw err;
    } finally {
        await redis.del(lockKey);
    }
};
