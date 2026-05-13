import { Worker, Queue } from "bullmq";
import dotenv from "dotenv";
import { redis } from "../config/redis.js";
import eventBus from "../config/eventBus.js";
import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { getProviderService } from "../services/providers/providerFactory.js";
import { getProviderOperatorCode, normalizeOperator } from "../config/operators.js";

dotenv.config();

console.log("Recharge Worker starting...");

const COIN_REWARD_CHANCE = 0.30;
const MIN_EARNED_COINS = 1;
const MAX_EARNED_COINS = 2;

export const dlqQueue = new Queue("recharge_dlq", { connection: redis });

const worker = new Worker("rechargeQueue", async (job) => {
    const { txnId, userId, amount, mobile, operator: frontendOperator } = job.data;
    console.log(`[RECHARGE START] Job: ${job.id} | Txn: ${txnId} | Mobile: ${mobile}`);
    
    let attempts = [];
    let successfulProvider = null;
    let finalProviderStatus = "FAILED";
    let operatorTxnId = null;
    let rechargeSuccessful = false; // CRITICAL STATUS LOCK

    try {
        // 1. FETCH TRANSACTION & ACTIVE PROVIDERS
        const activeProviders = await prisma.provider.findMany({
          where: { isActive: true },
          orderBy: { priority: "desc" } 
        });

        if (activeProviders.length === 0) throw new Error("No active recharge providers available.");

        const txn = await prisma.transaction.findUnique({ where: { id: txnId } });
        if (!txn || txn.status !== "PENDING") {
          console.log(`[JOB] Txn ${txnId} already processed or not found.`);
          return;
        }

        // 2. FAILOVER LOOP (OUTSIDE TRANSACTION)
        for (const provider of activeProviders) {
          const startTime = Date.now();
          const normalizedOperator = normalizeOperator(frontendOperator);
          const providerOperatorCode = getProviderOperatorCode(normalizedOperator);
          
          if (!providerOperatorCode) {
             console.error(`[Recharge] UNKNOWN OPERATOR: ${frontendOperator}`);
             throw new Error("Unsupported operator");
          }

          console.log(`[PROVIDER REQUEST] ${provider.code} | Txn: ${txnId} | Mobile: ${mobile}`);

          try {
            const requestParams = {
              mobile: mobile || "9999999999",
              amount: amount,
              operator: providerOperatorCode,
              txnId: txnId
            };
            console.log(`[PROVIDER REQUEST] ${provider.code} params:`, JSON.stringify(requestParams));

            const providerRegistry = getProvider(provider.code);
            const providerResponse = await providerRegistry.recharge(requestParams);

            console.log(`[PROVIDER RESPONSE] ${provider.code}:`, JSON.stringify(providerResponse));

            const currentStatus = (providerResponse.status || "FAILED").toUpperCase();
            const providerMessage = providerResponse.message || "";
            operatorTxnId = providerResponse.operatorTxnId || providerResponse.providerTxnId;

            if (currentStatus === "SUCCESS" || currentStatus === "PENDING") {
              rechargeSuccessful = true; // LOCK STATUS
              successfulProvider = provider.code;
              finalProviderStatus = currentStatus;

              attempts.push({ 
                provider: provider.name, 
                code: provider.code, 
                status: currentStatus, 
                latency: Date.now() - startTime 
              });
              
              console.log(`[PROVIDER SUCCESS] ${provider.code} | Txn: ${txnId} | Status: ${currentStatus}`);
              break; 
            } else {
              const isTerminal = /operator|mobile|amount|invalid|missing/i.test(providerMessage);
              if (isTerminal) {
                console.error(`[PROVIDER FAILURE] Terminal Error from ${provider.code}: ${providerMessage}`);
                throw new Error(providerMessage); 
              }
              throw new Error(providerMessage || "Provider returned FAILED status"); 
            }
          } catch (err) {
            const isTerminal = /operator|mobile|amount|invalid|missing/i.test(err.message);
            attempts.push({ 
              provider: provider.name, 
              code: provider.code, 
              status: "FAILED", 
              reason: err.message,
              latency: Date.now() - startTime 
            });

            if (isTerminal) {
              console.warn(`[RECHARGE] Stopping retries due to terminal failure: ${err.message}`);
              break; 
            }
            console.error(`[PROVIDER FAILURE] ${provider.code} failed: ${err.message}`);
            continue;
          }
        }

        if (!rechargeSuccessful) throw new Error("All active recharge providers failed.");

        // 3. PERSIST FINAL SUCCESS (Isolated Status Update)
        const normalizedOperatorName = normalizeOperator(frontendOperator);
        
        await prisma.transaction.update({
          where: { id: txnId },
          data: { 
            status: finalProviderStatus, 
            provider: successfulProvider,
            providerTxnId: operatorTxnId,
            operator: normalizedOperatorName // UPDATE OPERATOR NAME
          }
        });
        console.log(`[TXN SUCCESS] Txn ${txnId} marked ${finalProviderStatus} via ${successfulProvider}`);

        // 4. ISOLATED POST-SUCCESS LOGIC (Optional rewards/events)
        try {
            await processPostSuccessLogic({ txnId, userId, amount, finalProviderStatus, successfulProvider, operatorTxnId, attempts });
        } catch (postErr) {
            console.error("[POST SUCCESS ERROR] Optional logic failed but recharge remains SUCCESS:", postErr.message);
        }

        return { success: true, providerUsed: successfulProvider, attempts };

    } catch (error) {
      if (rechargeSuccessful) {
        console.warn(`[RECHARGE SAFETY] Error occurred after successful recharge. Skipping refund. Error: ${error.message}`);
        return { success: true, providerUsed: successfulProvider, attempts };
      }

      console.error(`[TXN FAILED] Txn ${txnId}: ${error.message}`);
      await processFailureRefund({ txnId, userId, amount, attempts, reason: error.message });
      throw error;
    }
  },
  { 
    connection: redis,
    concurrency: 10,
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 }
  }
);

/**
 * Handles rewards, commissions, and frontend notifications
 * Isolated to prevent affecting main recharge status
 */
async function processPostSuccessLogic({ txnId, userId, amount, finalProviderStatus, successfulProvider, operatorTxnId, attempts }) {
    await prisma.$transaction(async (tx) => {
        if (finalProviderStatus === "SUCCESS") {
            // Rewards Logic
            const existingReward = await tx.coinTransaction.findFirst({
                where: { rechargeTxnId: txnId, type: "EARNED" }
            });

            if (!existingReward && Math.random() < COIN_REWARD_CHANCE) {
                const coinsRewarded = Math.floor(Math.random() * (MAX_EARNED_COINS - MIN_EARNED_COINS + 1)) + MIN_EARNED_COINS;
                await tx.wallet.update({
                    where: { userId },
                    data: { coinBalance: { increment: coinsRewarded } }
                });
                await tx.coinTransaction.create({
                    data: {
                        userId,
                        amount: coinsRewarded,
                        type: "EARNED",
                        description: "Earned Coins - Recharge Reward",
                        rechargeTxnId: txnId
                    }
                });
                console.log(`[REWARD SUCCESS] User ${userId} earned ${coinsRewarded} coins`);
            }
        }
    }, { timeout: 10000 });

    // Emit Events
    const emittedStatus = finalProviderStatus.toLowerCase();
    eventBus.emit(`recharge_${emittedStatus}`, {
        txnId,
        status: emittedStatus,
        transaction: { 
            transactionId: txnId, 
            status: finalProviderStatus, 
            provider: successfulProvider,
            providerTxnId: operatorTxnId,
            attempts 
        }
    });
}

/**
 * Centralized failure and refund handler
 */
async function processFailureRefund({ txnId, userId, amount, attempts, reason }) {
    try {
        await prisma.$transaction(async (tx) => {
            const txn = await tx.transaction.findUnique({ where: { id: txnId } });
            
            // SECURITY: Never refund if already successful
            if (!txn || txn.status === "SUCCESS" || txn.refundStatus === "refunded") {
                console.warn(`[REFUND SAFETY] Skipping refund for Txn ${txnId}. Status: ${txn?.status}`);
                return;
            }

            await tx.transaction.update({
                where: { id: txnId },
                data: { status: "FAILED", refundStatus: "refunded", refundedAt: new Date() }
            });

            await tx.wallet.update({
                where: { userId },
                data: { balance: { increment: amount } }
            });

            await tx.transaction.create({
                data: { 
                    userId, 
                    amount, 
                    type: "REFUND", 
                    status: "SUCCESS", 
                    direction: "CREDIT",
                    description: `Refund for recharge ${txnId}: ${reason.slice(0, 50)}`
                }
            });
        }, { timeout: 10000 });
        
        console.log(`[REFUND] Txn ${txnId} processed successfully.`);

        eventBus.emit("recharge_failed", {
            txnId,
            status: "failed",
            transaction: { transactionId: txnId, status: "FAILED", attempts },
            reason
        });
    } catch (refundErr) {
        console.error(`[CRITICAL REFUND ERROR] Txn ${txnId}:`, refundErr.message);
    }
}

export default worker;
