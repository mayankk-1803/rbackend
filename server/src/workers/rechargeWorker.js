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
import { isFinalizedStatus, isValidStatusTransition } from "../utils/transactionStateGuard.js";

dotenv.config();

console.log("DiziPay V3 Recharge Worker starting...");

export const dlqQueue = new Queue("recharge_dlq", { connection: redis });

const worker = new Worker("recharge", async (job) => {
    console.log("[WORKER_START] Processing recharge job:", job.data);
    const { txnId } = job.data;
    const retryCount = job.data.retryCount || 0;
    console.log(`[QUEUE][JOB_RECEIVED] → Job: ${job.id} | Txn: ${txnId} | Retry: ${retryCount}`);
    
    let attempts = [];
    let successfulProvider = null;
    let finalStatus = "pending";
    let operatorTxnId = null;
    let rechargeSuccessful = false; 
    let lockAcquired = false;

    let userId;
    let amount;
    let mobile;
    let frontendOperator;

    try {
        console.log(`[WORKER][PROCESSING] → Executing Txn #${txnId} | Attempt ${retryCount}`);

        const txn = await prisma.transaction.findUnique({ where: { id: txnId } });
        if (!txn) {
          console.error(`[WORKER][FAILED] → Txn #${txnId} not found in database`);
          return;
        }

        userId = job.data.userId || txn.userId;
        amount = job.data.amount !== undefined ? Number(job.data.amount) : Number(txn.amount);
        mobile = job.data.mobile || txn.mobile;
        frontendOperator = job.data.operator || txn.operator;

        if (isFinalizedStatus(txn.status)) {
          console.log(`[FINAL_STATE_BLOCKED] Txn already finalized: ${txn.id}`);
          return;
        }

        // Acquire processing lock atomically
        const acquired = await prisma.transaction.updateMany({
          where: {
            id: txnId,
            processingLock: false,
            status: { in: ['PENDING', 'PENDING_REVIEW', 'PROCESSING'] }
          },
          data: {
            processingLock: true,
            processingStartedAt: new Date()
          }
        });

        if (acquired.count === 0) {
          console.log(`[WORKER_LOCK_SKIPPED] Txn ${txnId} already processing or finalized.`);
          return;
        }
        lockAcquired = true;
        console.log(`[WORKER_LOCK_ACQUIRED] Txn ${txnId} lock acquired.`);

        await logTransactionEvent(txnId, TXN_EVENTS.PROVIDER_PENDING, { mobile, operator: frontendOperator, retryCount });

        // 1. FETCH ACTIVE PROVIDERS
        const activeProviders = await prisma.provider.findMany({
          where: { isActive: true },
          orderBy: { priority: "desc" } 
        });

        if (activeProviders.length === 0) {
          console.error(`[WORKER][FAILED] → No active providers for Txn #${txnId}`);
          throw new Error("No active recharge providers available.");
        }

        // Only admin-approved retries may execute real provider APIs.
        const normalizedStatus = normalizeTransactionStatus(txn.status);
        if (normalizedStatus === "success") {
          console.log(`[WORKER][SKIPPED] → Txn #${txnId} is already SUCCESS`);
          return;
        }

        const allowedStatuses = ["PROCESSING", "PENDING_REVIEW", "PENDING"];
        if (!allowedStatuses.includes(txn.status)) {
          console.log(`[WORKER][SKIPPED] Txn #${txnId} status=${txn.status}; admin retry is required for real API execution.`);
          return;
        }

        // 2. FAILOVER LOOP
        const providerOrderNames = activeProviders.map((p, idx) => `${idx + 1}. ${p.code} (Priority: ${p.priority})`).join(", ");
        console.log(`[PROVIDER_FALLBACK_FLOW] Selection Order: [ ${providerOrderNames} ] | Total Active Providers: ${activeProviders.length} | Current Job Retry Attempt: ${retryCount}`);

        for (let i = 0; i < activeProviders.length; i++) {
          const provider = activeProviders[i];
          console.log(
            `[PROVIDER_SELECTED] Provider: ${provider.code} for Txn #${txnId}`
          );
          const startTime = Date.now();
          const normalizedOperator = normalizeOperator(frontendOperator);
          const providerOperatorCode = getProviderOperatorCode(normalizedOperator);
          
          if (!providerOperatorCode) {
             console.error(`[WORKER][ERROR] → Unsupported operator ${frontendOperator} for provider ${provider.code}`);
             throw new Error(`Unsupported operator: ${frontendOperator}`);
          }

          try {
            const providerService = getProviderService(provider.code);
            console.log(`[PROVIDER_RESOLVED] Provider: ${provider.code} | Name: ${provider.name}`);
            
            console.log(`[RECHARGE_REQUEST] TxnId: ${txnId} | Mobile: ${mobile} | Amount: ${amount} | OperatorCode: ${providerOperatorCode}`);
            console.log(`[PROVIDER_REQUEST] Provider: ${provider.code} | TxnId: ${txnId} | Mobile: ${mobile} | Amount: ${amount}`);

            const providerResponse =
              await providerService.recharge({
                mobile,
                amount,
                operator: providerOperatorCode,
                txnId: txnId
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
            console.error(
              `[WORKER_ERROR] Provider ${provider.code} failed for Txn #${txnId}: ${err.message}`
            );
            console.warn(`[WORKER][FAILED] → Provider ${provider.code} failed for Txn #${txnId}: ${err.message}`);
            attempts.push({ 
              provider: provider.name, 
              code: provider.code, 
              status: "failed", 
              reason: err.message,
              latency: Date.now() - startTime 
            });
            const isTerminal = /operator|mobile|amount|invalid|missing/i.test(err.message);
            if (isTerminal) {
              console.error(`[PROVIDER_TERMINAL_ERROR] Error is terminal: "${err.message}". Aborting fallback loop.`);
              break;
            }
            if (i < activeProviders.length - 1) {
              console.warn(`[PROVIDER_SWITCH] Switching provider for Txn #${txnId} from ${provider.code} to ${activeProviders[i + 1].code} due to error.`);
            }
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

        const updateResult = await prisma.transaction.updateMany({
          where: {
            id: txnId,
            status: { in: ['PENDING', 'PENDING_REVIEW', 'PROCESSING'] }
          },
          data: { 
            status: "PROCESSING",
            rechargeProcessing: false,
            provider: successfulProvider,
            providerTxnId: operatorTxnId,
            operator: normalizeOperator(frontendOperator),
            invoiceSnapshot: invoiceSnapshot
          }
        });

        if (updateResult.count === 0) {
          console.log(`[FINAL_STATE_BLOCKED] Txn already finalized or not found: ${txnId}`);
          return;
        }

        console.log(`[WORKER][PENDING] → Txn #${txnId} saved as PENDING/PROCESSING. Awaiting callback.`);

        await logTransactionEvent(txnId, TXN_EVENTS.PROVIDER_PENDING, { provider: successfulProvider });
        eventBus.emit(`recharge_processing`, { txnId, userId, status: "PROCESSING", provider: successfulProvider, attempts });
        
        console.log(`[SOCKET_ROW_UPDATE] Emitting processing update for TXN:${txnId}`);
        eventBus.emit(`transaction_updated`, { txnId, transactionId: txnId, userId, status: "PROCESSING" });

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
    } finally {
      if (lockAcquired) {
        // Release processing lock
        await prisma.transaction.updateMany({
          where: { id: txnId },
          data: { processingLock: false }
        });
        console.log(`[WORKER_LOCK_RELEASED] Txn ${txnId} lock released.`);
      }
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
            
            if (!txn) return;

            if (isFinalizedStatus(txn.status)) {
                console.log(`[FINAL_STATE_BLOCKED] Txn already finalized: ${txn.id}`);
                return;
            }

            if (!isValidStatusTransition(txn.status, "FAILED")) {
                console.log(`[INVALID_TRANSITION_BLOCKED] ${txn.status} -> FAILED blocked for txn ${txn.id}`);
                return;
            }

            if (txn.status === "FAILED" || txn.status === "REFUNDED") {
                console.log(`[DUPLICATE_STATUS_SKIPPED] Txn ${txn.id} already FAILED/REFUNDED`);
                return;
            }

            // Check if refund ledger already exists
            const existingRefundLedger = await tx.ledgerEntry.findFirst({
              where: {
                transactionId: txnId,
                type: 'REFUND_CREDIT'
              }
            });

            if (existingRefundLedger) {
              console.log(`[DUPLICATE_REFUND_PREVENTED] Refund ledger already exists for txn ${txnId}`);
              return;
            }

            // Transition from active status to FAILED
            const updateFailed = await tx.transaction.updateMany({
                where: {
                    id: txnId,
                    status: { in: ['PENDING', 'PENDING_REVIEW', 'PROCESSING'] }
                },
                data: {
                    status: 'FAILED',
                }
            });

            if (updateFailed.count === 0) {
                console.log(`[FINAL_STATE_BLOCKED] FAILED transition blocked or already finalized: ${txnId}`);
                return;
            }

            // Transition from FAILED to REFUNDED
            const updateRefunded = await tx.transaction.updateMany({
                where: {
                    id: txnId,
                    status: 'FAILED'
                },
                data: {
                  status: "REFUNDED",
                  reviewStatus: "REFUNDED",
                  rechargeProcessing: false,
                  refundStatus: "refunded",
                  refundedAt: new Date(),
                  processedAt: new Date()
                }
            });

            if (updateRefunded.count === 0) {
                console.log(`[FINAL_STATE_BLOCKED] REFUNDED transition blocked or already finalized: ${txnId}`);
                return;
            }

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
        
        eventBus.emit("recharge_failed", { txnId, userId, status: "REFUNDED", reason });
        eventBus.emit("refund_completed", { txnId, userId, status: "REFUNDED" });
        eventBus.emit("wallet_updated", { userId: userId.toString() });

        console.log(`[SOCKET_ROW_UPDATE] Emitting failed update for TXN:${txnId}`);
        const updatedTxn = await prisma.transaction.findUnique({ where: { id: txnId } });
        eventBus.emit("transaction_updated", {
          transactionId: txnId,
          status: 'REFUNDED',
          transaction: updatedTxn,
          amount: amount,
          userId: userId
        });
    } catch (refundErr) {
        console.error(`[CRITICAL REFUND ERROR] Txn ${txnId}:`, refundErr.message);
    }
}

export default worker;
