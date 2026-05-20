import { Worker, Queue } from "bullmq";
import dotenv from "dotenv";
import { redis } from "../config/redis.js";
import eventBus from "../config/eventBus.js";
import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { getProviderService } from "../services/providers/providerFactory.js";
import { getProviderOperatorCode, normalizeOperator } from "../config/operators.js";
import { normalizeTransactionStatus } from "../utils/statusHelper.js";
import { logTransactionEvent, TXN_EVENTS } from "../services/transactionEventService.js";
import { issueReward } from "../services/rewardEngine.js";
import { recordFinancialEntry } from "../services/ledgerService.js";

dotenv.config();

console.log("DiziPay V3 Recharge Worker starting...");

export const dlqQueue = new Queue("recharge_dlq", { connection: redis });

const worker = new Worker("recharge", async (job) => {
    const { txnId, userId, amount, mobile, operator: frontendOperator, retryCount = 0 } = job.data;
    console.log(`[QUEUE][JOB_RECEIVED] → Job: ${job.id} | Txn: ${txnId} | Retry: ${retryCount}`);
    
    let attempts = [];
    let successfulProvider = null;
    let finalStatus = "pending";
    let operatorTxnId = null;
    let rechargeSuccessful = false; 

    try {
        console.log(`[WORKER][PROCESSING] → Executing Txn #${txnId} | Attempt ${retryCount}`);
        await logTransactionEvent(txnId, TXN_EVENTS.PROVIDER_PENDING, { mobile, operator: frontendOperator, retryCount });

        // 1. FETCH TRANSACTION & ACTIVE PROVIDERS
        const activeProviders = await prisma.provider.findMany({
          where: { isActive: true },
          orderBy: { priority: "desc" } 
        });

        if (activeProviders.length === 0) {
          console.error(`[WORKER][FAILED] → No active providers for Txn #${txnId}`);
          throw new Error("No active recharge providers available.");
        }

        const txn = await prisma.transaction.findUnique({ where: { id: txnId } });
        if (!txn) {
          console.error(`[WORKER][FAILED] → Txn #${txnId} not found in database`);
          return;
        }

        // Only block if status is already SUCCESS or if it's NOT pending and NOT a manual retry
        const normalizedStatus = normalizeTransactionStatus(txn.status);
        if (normalizedStatus === "success") {
          console.log(`[WORKER][SKIPPED] → Txn #${txnId} is already SUCCESS`);
          return;
        }

        // 2. FAILOVER LOOP
        for (const provider of activeProviders) {
          console.log(`[PROVIDER_SELECTED] Provider: ${provider.code} for Txn #${txnId}`);
          const startTime = Date.now();
          const normalizedOperator = normalizeOperator(frontendOperator);
          const providerOperatorCode = getProviderOperatorCode(normalizedOperator);
          
          if (!providerOperatorCode) {
             console.error(`[WORKER][ERROR] → Unsupported operator ${frontendOperator} for provider ${provider.code}`);
             throw new Error(`Unsupported operator: ${frontendOperator}`);
          }

          try {
            const providerService = getProviderService(provider.code);
            console.log(`[PROVIDER_RESOLVED] Provider: ${provider.code} | Name: ${provider.name} | BaseURL: ${provider.baseUrl} | AuthKey: ***${provider.apiKey?.slice(-4)}`);
            
            console.log(`[RECHARGE_REQUEST] TxnId: ${txnId} | Mobile: ${mobile} | Amount: ${amount} | OperatorCode: ${providerOperatorCode}`);
            console.log(`[PROVIDER_REQUEST] Provider: ${provider.code} | TxnId: ${txnId} | Mobile: ${mobile} | Amount: ${amount}`);
            const providerResponse = await providerService.recharge({
              mobile,
              amount,
              operator: providerOperatorCode,
              txnId
            });

            console.log(`[RECHARGE_RESPONSE] Provider: ${provider.code} | Status: ${providerResponse.status} | TxnId: ${txnId} | ProviderTxnId: ${providerResponse.providerTxnId || providerResponse.operatorTxnId}`);
            console.log(`[PROVIDER_RESPONSE] Provider: ${provider.code} | TxnId: ${txnId} | Status: ${providerResponse.status} | Msg: ${providerResponse.message}`);

            const currentStatus = normalizeTransactionStatus(providerResponse.status);
            operatorTxnId = providerResponse.operatorTxnId || providerResponse.providerTxnId;

            if (currentStatus === "success" || currentStatus === "pending") {
              rechargeSuccessful = true;
              successfulProvider = provider.code;
              // CRITICAL: NEVER auto-success pending txns from worker. Callback is primary source of truth.
              finalStatus = "pending"; 

              attempts.push({ 
                provider: provider.name, 
                code: provider.code, 
                status: currentStatus, 
                latency: Date.now() - startTime 
              });
              break; 
            } else {
              throw new Error(providerResponse.message || "Provider returned FAILED status"); 
            }
          } catch (err) {
            console.warn(`[WORKER][FAILED] → Provider ${provider.code} failed for Txn #${txnId}: ${err.message}`);
            attempts.push({ 
              provider: provider.name, 
              code: provider.code, 
              status: "failed", 
              reason: err.message,
              latency: Date.now() - startTime 
            });
            const isTerminal = /operator|mobile|amount|invalid|missing/i.test(err.message);
            if (isTerminal) break;
            continue;
          }
        }

        if (!rechargeSuccessful) {
          console.error(`[WORKER][FAILED] → All providers failed for Txn #${txnId}`);
          throw new Error("All active recharge providers failed.");
        }

        // 3. PERSIST FINAL SUCCESS & SNAPSHOT
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, phone: true, email: true } });
        
        const invoiceSnapshot = {
          customer: { name: user?.name, phone: user?.phone, email: user?.email },
          operator: normalizeOperator(frontendOperator),
          mobile,
          amount,
          timestamp: new Date().toISOString(),
          providerRef: operatorTxnId
        };

        await prisma.transaction.update({
          where: { id: txnId },
          data: { 
            status: "PENDING", // Always PENDING initially, let callback finalize
            provider: successfulProvider,
            providerTxnId: operatorTxnId,
            operator: normalizeOperator(frontendOperator),
            invoiceSnapshot: invoiceSnapshot
          }
        });

        console.log(`[WORKER][PENDING] → Txn #${txnId} saved as PENDING. Awaiting callback.`);

        await logTransactionEvent(txnId, TXN_EVENTS.PROVIDER_PENDING, { provider: successfulProvider });
        eventBus.emit(`recharge_pending`, { txnId, userId, status: "pending", provider: successfulProvider, attempts });

        console.log(`[WORKER][COMPLETED] → Worker finished job for Txn #${txnId}`);
        return { success: true, providerUsed: successfulProvider, attempts };

    } catch (error) {
      if (rechargeSuccessful) {
        console.warn(`[RECHARGE SAFETY] Post-success error. Skipping refund: ${error.message}`);
        return { success: true, providerUsed: successfulProvider, attempts };
      }

      console.error(`[TXN FAILED] Txn ${txnId}: ${error.message}`);
      await processFailureRefund({ txnId, userId, amount, attempts, reason: error.message });
      throw error;
    }
  },
  { connection: redis, concurrency: 10, removeOnComplete: { count: 500 }, removeOnFail: { count: 1000 } }
);

worker.on("completed", (job) => {
  console.log(`[WORKER][JOB_SUCCESS] → Job ${job.id} completed successfully.`);
});

worker.on("failed", (job, err) => {
  console.error(`[WORKER][JOB_FAILED] → Job ${job?.id} failed: ${err.message}`);
});

worker.on("error", (err) => {
  console.error(`[WORKER][CRITICAL_ERROR] → Worker error: ${err.message}`);
});

async function processFailureRefund({ txnId, userId, amount, attempts, reason }) {
    try {
        await prisma.$transaction(async (tx) => {
            const txn = await tx.transaction.findUnique({ where: { id: txnId } });
            
            if (!txn || txn.status === "SUCCESS" || txn.refundStatus === "refunded") return;

            await tx.transaction.update({
                where: { id: txnId },
                data: { status: "FAILED", refundStatus: "refunded", refundedAt: new Date() }
            });

            // Use Ledger Service for Refund
            await recordFinancialEntry({
                userId,
                amount,
                type: 'REFUND_CREDIT',
                transactionId: txnId,
                description: `Refund: ${reason.slice(0, 50)}`,
                tx
            });

            await logTransactionEvent(txnId, TXN_EVENTS.FAILED, { reason });
            await logTransactionEvent(txnId, TXN_EVENTS.REFUNDED, { amount });
        }, { timeout: 10000 });
        
        eventBus.emit("recharge_failed", { txnId, status: "failed", reason });
    } catch (refundErr) {
        console.error(`[CRITICAL REFUND ERROR] Txn ${txnId}:`, refundErr.message);
    }
}

export default worker;
