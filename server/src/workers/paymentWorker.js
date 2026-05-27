import { Worker, Queue } from "bullmq";
import { structuredLog, structuredAlert } from "../utils/logger.js";
import {
  recordWebhookSuccess,
  recordWebhookFailure,
  recordWebhookDuplicate,
  recordRedisFallback,
  recordSocketEmit,
  recordFailedLedgerWrite,
  recordFailedAuditWrite,
  recordPaymentVerificationLatency
} from "../services/webhookMonitoringService.js";
import { redis } from "../config/redis.js";
import axios from "axios";
import dotenv from "dotenv";
import crypto from "crypto";
import prisma from "../config/prisma.js";
import { checkNexgateStatus, isCircuitBreakerOpen } from "../services/providers/nexgateService.js";
import { acquireLock, releaseLock } from "../utils/redisLock.js";
import { recordFinancialEntry } from "../services/ledgerService.js";
import { claimIdempotencyKey } from "../utils/idempotency.js";
import eventBus from "../config/eventBus.js";
import { Prisma } from "@prisma/client";

dotenv.config();

const workerOptions = {
  connection: redis,
  concurrency: 5, // Process up to 5 payments concurrently
};

const sendInternalWebhook = async (paymentId, idempotencyKey, status, gatewayTxnId, errorMessage = "") => {
  const expectedSecret = process.env.WEBHOOK_SECRET || "internal_secret";
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  
  const payload = {
    paymentId: Number(paymentId),
    idempotencyKey: idempotencyKey,
    status: status,
    gatewayTxnId: gatewayTxnId || `NEXGATE_VERIFY_${Date.now()}`,
    errorMessage: errorMessage || null
  };
  
  const payloadString = timestamp + "." + nonce + "." + JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", expectedSecret).update(payloadString).digest("hex");

  const webhookUrl = process.env.API_URL 
      ? `${process.env.API_URL}/api/payment/webhook` 
      : "http://localhost:5000/api/payment/webhook";

  await axios.post(webhookUrl, payload, {
    headers: {
      "Content-Type": "application/json",
      "x-webhook-signature": signature,
      "x-webhook-timestamp": timestamp,
      "x-webhook-nonce": nonce,
      "x-webhook-secret": expectedSecret
    }
  });
};

export const startPaymentWorker = () => {
  const worker = new Worker(
    "paymentQueue",
    async (job) => {
      // Handle verify status check for Nexgate timeouts
      if (job.name === "verifyNexgateStatus") {
        const { paymentId, attempt } = job.data;
        const startVerificationTime = Date.now();
        
        // 1. Fetch payment
        const payment = await prisma.payment.findUnique({ where: { id: Number(paymentId) } });
        if (!payment) {
          structuredAlert({
            level: "error",
            eventType: "PAYMENT_WORKER_NOT_FOUND",
            paymentId,
            message: `Payment ${paymentId} not found in worker`
          });
          return;
        }

        // Extract correlationId, adminId, targetUserId from payment.idempotencyKey
        let correlationId = crypto.randomBytes(8).toString('hex');
        let adminId = null;
        let targetUserId = payment.userId;
        let isAdminFunding = false;

        if (payment.idempotencyKey) {
          const parts = payment.idempotencyKey.split(":");
          if (parts.length >= 4) {
            correlationId = parts[3]; // The UUID
          }
          const adminIdPart = parts[1]?.split("=")[1];
          adminId = adminIdPart ? Number(adminIdPart) : null;
          isAdminFunding = payment.idempotencyKey.startsWith("admin_funding:");
        }

        // Check if circuit breaker is open
        if (isCircuitBreakerOpen()) {
          structuredAlert({
            level: "warn",
            eventType: "NEXGATE_WORKER_SKIPPED_CIRCUIT_OPEN",
            correlationId,
            paymentId,
            adminId,
            targetUserId,
            message: `Payment ${paymentId} verification skipped. Circuit breaker is open. Rescheduling...`
          });
          
          if (attempt <= 3) {
            const paymentQueue = new Queue("paymentQueue", { connection: redis });
            const existingJobs = await paymentQueue.getJobs(["delayed", "waiting", "active"]);
            const alreadyEnqueued = existingJobs.some(
              (j) => j.data?.paymentId === paymentId && j.name === "verifyNexgateStatus" && j.data?.attempt === attempt
            );

            if (!alreadyEnqueued) {
              await paymentQueue.add(
                "verifyNexgateStatus",
                { paymentId, attempt },
                { delay: 15000, removeOnComplete: true }
              );
              structuredLog({
                eventType: "PAYMENT_WORKER_REQUEUED",
                correlationId,
                paymentId,
                adminId,
                targetUserId,
                message: `Requeued verification job for payment ${paymentId} (attempt ${attempt}) with 15000ms delay due to circuit breaker`
              });
            }
            await paymentQueue.close();
          }
          return;
        }

        // 2. State Guard: Skip if already finalized
        if (["SUCCESS", "FAILED"].includes(payment.status)) {
          structuredLog({
            eventType: "PAYMENT_WORKER_VERIFY_SKIPPED_FINALIZED",
            correlationId,
            paymentId,
            adminId,
            targetUserId,
            message: `Payment ${paymentId} already in final status ${payment.status}`
          });
          return;
        }

        structuredLog({
          eventType: "PAYMENT_WORKER_VERIFY_START",
          correlationId,
          paymentId,
          adminId,
          targetUserId,
          message: `Verifying status for Payment ${paymentId} | Attempt ${attempt}/3`
        });

        try {
          const statusResult = await checkNexgateStatus(paymentId);
          const providerStatus = statusResult.providerStatus || statusResult.status || "PENDING";
          
          // Record payment verification latency
          recordPaymentVerificationLatency(Date.now() - startVerificationTime);

          structuredLog({
            eventType: "NEXGATE_STATUS_RESULT",
            correlationId,
            paymentId,
            adminId,
            targetUserId,
            message: `Payment ${paymentId} status from provider => ${providerStatus}`
          });

          if (statusResult.success && providerStatus === "SUCCESS") {
            const lockToken = await acquireLock(`payment_webhook:${paymentId}`, 15000);
            if (!lockToken) {
              structuredAlert({
                level: "warn",
                eventType: "CONCURRENT_LOCK_BLOCKED",
                correlationId,
                paymentId,
                adminId,
                targetUserId,
                message: `Could not acquire lock for payment ${paymentId}. Requeuing verification job.`
              });
              // Requeue with delay to try lock again
              const paymentQueue = new Queue("paymentQueue", { connection: redis });
              await paymentQueue.add(
                "verifyNexgateStatus",
                { paymentId, attempt },
                { delay: 15000, removeOnComplete: true }
              );
              await paymentQueue.close();
              return;
            }

            if (lockToken.startsWith("dummy_fallback_lock_")) {
              recordRedisFallback();
              structuredAlert({
                eventType: "REDIS_LOCK_FALLBACK_ACTIVE",
                correlationId,
                paymentId,
                adminId,
                targetUserId,
                message: `Redis is offline. Bypassing lock using DB isolation fallback for payment_webhook:${paymentId} in worker`
              });
            }

            try {
              let createdTx = null;
              let ledgerDesc = null;
              let balanceBefore = null;
              let balanceAfter = null;
              let result;

              try {
                result = await prisma.$transaction(async (tx) => {
                  const payments = await tx.$queryRaw`SELECT * FROM payment WHERE id = ${paymentId} FOR UPDATE`;
                  if (!payments || payments.length === 0) throw new Error(`Payment ${paymentId} not found`);
                  const dbPayment = payments[0];

                  if (["SUCCESS", "FAILED", "REFUNDED"].includes(dbPayment.status)) {
                    structuredLog({
                      eventType: "PAYMENT_WORKER_DUPLICATE_SKIP",
                      correlationId,
                      paymentId,
                      adminId,
                      targetUserId,
                      message: `Already processed with status: ${dbPayment.status}`
                    });
                    return { alreadyProcessed: true, payment: dbPayment };
                  }

                  const idempotencyKey = `topup:${dbPayment.id}`;
                  const canClaim = await claimIdempotencyKey(idempotencyKey, statusResult.raw || {}, tx);
                  if (!canClaim) {
                    structuredLog({
                      eventType: "PAYMENT_WORKER_DUPLICATE_SKIP",
                      correlationId,
                      paymentId,
                      adminId,
                      targetUserId,
                      message: `Topup key ${idempotencyKey} already claimed.`
                    });
                    return { alreadyProcessed: true, payment: dbPayment };
                  }

                  // Fetch wallet with lock to prevent race conditions
                  const wallets = await tx.$queryRaw`SELECT * FROM wallet WHERE userId = ${dbPayment.userId} FOR UPDATE`;
                  if (!wallets || wallets.length === 0) throw new Error(`Wallet not found for user ${dbPayment.userId}`);
                  const wallet = wallets[0];
                  balanceBefore = wallet.balance;

                  const finalGatewayTxnId = statusResult.operatorTxnId || statusResult.gatewayTxnId || dbPayment.gatewayTxnId || `NEXGATE_VERIFY_${Date.now()}`;

                  if (dbPayment.intent === "IMART") {
                    const balanceAfterCredit = new Prisma.Decimal(balanceBefore).plus(new Prisma.Decimal(dbPayment.amount));
                    balanceAfter = balanceBefore; // Net change is zero

                    // Credit wallet
                    await tx.wallet.update({
                      where: { userId: dbPayment.userId },
                      data: {
                        balance: {
                          increment: Number(dbPayment.amount)
                        }
                      }
                    });

                    // Debit wallet
                    await tx.wallet.update({
                      where: { userId: dbPayment.userId },
                      data: {
                        balance: {
                          decrement: Number(dbPayment.amount)
                        }
                      }
                    });

                    await recordFinancialEntry({
                      userId: dbPayment.userId,
                      amount: dbPayment.amount,
                      type: 'TOPUP_CREDIT',
                      transactionId: null,
                      description: `iMart Topup credit | Order: ${dbPayment.id}`,
                      context: { correlationId, ipAddress: "127.0.0.1" },
                      tx,
                      skipWalletUpdate: true,
                      overrideBalanceBefore: balanceBefore,
                      overrideBalanceAfter: balanceAfterCredit
                    });

                    await recordFinancialEntry({
                      userId: dbPayment.userId,
                      amount: dbPayment.amount.negated(),
                      type: 'IMART_DEBIT',
                      transactionId: null,
                      description: `iMart Purchase debit | Order: ${dbPayment.id}`,
                      context: { correlationId, ipAddress: "127.0.0.1" },
                      tx,
                      skipWalletUpdate: true,
                      overrideBalanceBefore: balanceAfterCredit,
                      overrideBalanceAfter: balanceBefore
                    });

                    await tx.transaction.create({
                      data: {
                        userId: dbPayment.userId,
                        amount: dbPayment.amount,
                        type: "TOPUP",
                        status: "SUCCESS",
                        direction: "CREDIT",
                        gatewayTxnId: finalGatewayTxnId,
                        balanceAfter: balanceAfterCredit,
                        description: `iMart payment credit | Order: ${dbPayment.id}`,
                        idempotencyKey: `topup:${dbPayment.id}`,
                        financialSequenceId: correlationId + "_credit"
                      }
                    });

                    await tx.transaction.create({
                      data: {
                        userId: dbPayment.userId,
                        amount: dbPayment.amount,
                        type: "IMART_BUY",
                        status: "SUCCESS",
                        direction: "DEBIT",
                        gatewayTxnId: finalGatewayTxnId,
                        balanceAfter: balanceBefore,
                        description: `iMart purchase debit | Order: ${dbPayment.id}`,
                        idempotencyKey: `imart:${dbPayment.id}`,
                        financialSequenceId: correlationId + "_debit"
                      }
                    });

                    const order = await tx.order.findUnique({
                      where: { paymentId: dbPayment.id },
                      include: { items: true }
                    });

                    if (order) {
                      await tx.order.update({
                        where: { id: order.id },
                        data: {
                          paymentStatus: "SUCCESS",
                          status: "PROCESSING"
                        }
                      });

                      for (const item of order.items) {
                        await tx.product.update({
                          where: { id: item.productId },
                          data: {
                            stock: {
                              decrement: item.quantity
                            }
                          }
                        });
                      }
                    }
                  } else {
                    balanceAfter = new Prisma.Decimal(balanceBefore).plus(new Prisma.Decimal(dbPayment.amount));

                    ledgerDesc = `Wallet topup | Order: ${dbPayment.id}`;
                    let txDesc = `Wallet topup | Order: ${dbPayment.id} | Before: ${balanceBefore}`;

                    if (isAdminFunding) {
                      try {
                        const parts = dbPayment.idempotencyKey.split(":");
                        const reasonPart = parts[2]?.split("=")[1];
                        if (reasonPart) {
                          ledgerDesc = decodeURIComponent(reasonPart);
                          txDesc = `${ledgerDesc} | Before: ${balanceBefore}`;
                        } else {
                          ledgerDesc = `Admin Wallet Funding | Order: ${dbPayment.id}`;
                          txDesc = `Admin Wallet Funding | Order: ${dbPayment.id} | Before: ${balanceBefore}`;
                        }
                      } catch (e) {
                        console.error("Failed to parse admin funding key in worker:", e);
                      }
                    }

                    // Atomic increment
                    await tx.wallet.update({
                      where: { userId: dbPayment.userId },
                      data: {
                        balance: {
                          increment: Number(dbPayment.amount)
                        }
                      }
                    });

                    await recordFinancialEntry({
                      userId: dbPayment.userId,
                      amount: dbPayment.amount,
                      type: 'TOPUP_CREDIT',
                      transactionId: null,
                      description: ledgerDesc,
                      context: { correlationId, ipAddress: "127.0.0.1" },
                      tx,
                      skipWalletUpdate: true,
                      overrideBalanceBefore: balanceBefore,
                      overrideBalanceAfter: balanceAfter
                    });

                    createdTx = await tx.transaction.create({
                      data: {
                        userId: dbPayment.userId,
                        amount: dbPayment.amount,
                        type: "TOPUP",
                        status: "SUCCESS",
                        direction: "CREDIT",
                        gatewayTxnId: finalGatewayTxnId,
                        balanceAfter: balanceAfter,
                        description: txDesc,
                        idempotencyKey,
                        financialSequenceId: correlationId
                      }
                    });
                  }

                  // Finally, mark payment SUCCESS as the final database write
                  const updatedPayment = await tx.payment.update({
                    where: { id: dbPayment.id },
                    data: {
                      status: "SUCCESS",
                      gatewayTxnId: finalGatewayTxnId,
                      webhookReceived: true
                    }
                  });

                  return { alreadyProcessed: false, payment: updatedPayment };
                }, {
                  isolationLevel: Prisma.TransactionIsolationLevel.Serializable
                });
              } catch (err) {
                structuredAlert({
                  level: "error",
                  eventType: "PAYMENT_RECONCILIATION_FAILED",
                  correlationId,
                  paymentId,
                  adminId,
                  targetUserId,
                  message: `Database finalization transaction failed in worker: ${err.message}`,
                  metadata: { error: err.stack }
                });
                throw err;
              }

              if (result && !result.alreadyProcessed) {
                // Fetch updated wallet balance post-commit to emit fresh data
                const updatedWallet = await prisma.wallet.findUnique({
                  where: { userId: result.payment.userId }
                });

                const finalBalanceAfter = updatedWallet ? updatedWallet.balance : balanceAfter;

                structuredLog({
                  eventType: "WALLET_MUTATION_SUCCESS",
                  correlationId,
                  paymentId,
                  adminId,
                  targetUserId,
                  message: `Wallet atomically credited in worker. Before: ${balanceBefore}, After: ${finalBalanceAfter}`
                });

                structuredLog({
                  eventType: "LEDGER_RECONCILIATION_SUCCESS",
                  correlationId,
                  paymentId,
                  adminId,
                  targetUserId,
                  message: `Ledger entry created successfully in worker. Description: "${ledgerDesc || 'Wallet Topup'}"`
                });
                
                try {
                  eventBus.emit("wallet_updated", {
                    userId: result.payment.userId,
                    amount: result.payment.amount,
                    balance: finalBalanceAfter || undefined
                  });

                  // Emit transaction_updated so the admin dashboard live telemetry gets refreshed
                  if (createdTx) {
                    eventBus.emit("transaction_updated", {
                      userId: result.payment.userId,
                      txnId: createdTx.id,
                      status: "SUCCESS",
                      transaction: createdTx,
                      correlationId
                    });
                  }

                  recordSocketEmit(true);
                  structuredLog({
                    eventType: "TELEMETRY_EVENT_EMITTED",
                    correlationId,
                    paymentId,
                    adminId,
                    targetUserId,
                    message: `Worker emitted realtime telemetry updates for payment success.`
                  });
                } catch (socketErr) {
                  recordSocketEmit(false);
                  console.warn("[WORKER] Realtime event emit failed:", socketErr.message);
                }

                // Write audit log for admin wallet adjustment
                if (isAdminFunding && adminId) {
                  try {
                    const { logAction } = await import("../services/auditService.js");
                    await logAction({
                      action: "WALLET_ADJUSTMENT",
                      adminId,
                      userId: result.payment.userId,
                      entity: "WALLET",
                      entityId: result.payment.id,
                      details: { amount: result.payment.amount, description: ledgerDesc, paymentId: result.payment.id },
                      req: null
                    });
                    structuredLog({
                      eventType: "AUDIT_LOG_SUCCESS",
                      correlationId,
                      paymentId,
                      adminId,
                      targetUserId,
                      message: `Audit WALLET_ADJUSTMENT logged in worker for admin ${adminId} and payment ${paymentId}`
                    });
                  } catch (auditErr) {
                    recordFailedAuditWrite();
                    console.error("Failed to log admin funding audit action in worker:", auditErr);
                  }
                }
              }
            } finally {
              await releaseLock(`payment_webhook:${paymentId}`, lockToken);
            }
          } else if (providerStatus === "FAILED") {
            await prisma.$transaction(async (tx) => {
              await tx.payment.update({
                where: { id: paymentId },
                data: {
                  status: "FAILED",
                  errorMessage: statusResult.message || "Payment verification failed"
                }
              });

              const dbPayment = await tx.payment.findUnique({ where: { id: paymentId } });
              if (dbPayment && dbPayment.intent === "IMART") {
                const order = await tx.order.findUnique({ where: { paymentId: dbPayment.id } });
                if (order) {
                  await tx.order.update({
                    where: { id: order.id },
                    data: {
                      paymentStatus: "FAILED",
                      status: "CANCELLED"
                    }
                  });
                }
              }
            });

            structuredLog({
              eventType: "PAYMENT_WORKER_FINALIZED_FAILED",
              correlationId,
              paymentId,
              adminId,
              targetUserId,
              message: `Payment ${paymentId} finalized as FAILED via worker. Message: ${statusResult.message || "Payment verification failed"}`
            });
            recordWebhookFailure();
          } else {
            structuredLog({
              eventType: "NEXGATE_STATUS_PENDING_RETRY",
              correlationId,
              paymentId,
              adminId,
              targetUserId,
              message: `Payment ${paymentId} verification returned status ${providerStatus}. Requeuing (attempt ${attempt}/3)`
            });
            
            if (attempt < 3) {
              const nextAttempt = attempt + 1;
              const paymentQueue = new Queue("paymentQueue", { connection: redis });
              const existingJobs = await paymentQueue.getJobs(["delayed", "waiting", "active"]);
              const alreadyEnqueued = existingJobs.some(
                (j) => j.data?.paymentId === paymentId && j.name === "verifyNexgateStatus" && j.data?.attempt === nextAttempt
              );

              if (!alreadyEnqueued) {
                await paymentQueue.add(
                  "verifyNexgateStatus",
                  { paymentId, attempt: nextAttempt },
                  { delay: 15000, removeOnComplete: true }
                );
                structuredLog({
                  eventType: "PAYMENT_WORKER_REQUEUED",
                  correlationId,
                  paymentId,
                  adminId,
                  targetUserId,
                  message: `Enqueued verify attempt ${nextAttempt} with delay 15000ms`
                });
              }
              await paymentQueue.close();
            } else {
              await prisma.payment.update({
                where: { id: paymentId },
                data: { status: "PROCESSING_REVIEW" }
              });
              structuredAlert({
                level: "warn",
                eventType: "NEXGATE_MANUAL_REVIEW_REQUIRED",
                correlationId,
                paymentId,
                adminId,
                targetUserId,
                message: `Payment ${paymentId} still pending after 3 attempts. Kept as PROCESSING_REVIEW.`
              });
            }
          }
        } catch (error) {
          structuredAlert({
            level: "error",
            eventType: "PAYMENT_WORKER_EXCEPTION",
            correlationId,
            paymentId,
            adminId,
            targetUserId,
            message: `Error checking status for payment ${paymentId} in worker: ${error.message}`,
            metadata: { error: error.stack }
          });
          if (attempt <= 3) {
             const paymentQueue = new Queue("paymentQueue", { connection: redis });
             const existingJobs = await paymentQueue.getJobs(["delayed", "waiting", "active"]);
             const alreadyEnqueued = existingJobs.some(
               (j) => j.data?.paymentId === paymentId && j.name === "verifyNexgateStatus" && j.data?.attempt === attempt
             );

             if (!alreadyEnqueued) {
                await paymentQueue.add(
                  "verifyNexgateStatus",
                  { paymentId, attempt },
                  { delay: 15000, removeOnComplete: true }
                );
                structuredLog({
                  eventType: "PAYMENT_WORKER_REQUEUED",
                  correlationId,
                  paymentId,
                  adminId,
                  targetUserId,
                  message: `Requeued verification job for payment ${paymentId} (attempt ${attempt}) with 15000ms delay due to error`
                });
             }
             await paymentQueue.close();
          }
        }
        return;
      }

      // Original mock payment processing fallback
      const { paymentId, idempotencyKey } = job.data;

      // Simulate provider decision (80% success rate)
      const isSuccess = Math.random() < 0.8;
      const status = isSuccess ? "SUCCESS" : "FAILED";
      const gatewayTxnId = `TXN_${Math.floor(Math.random() * 1000000000)}`;
      
      const payload = {
        paymentId,
        idempotencyKey,
        status,
        gatewayTxnId,
        errorMessage: isSuccess ? null : "Bank declined the transaction"
      };

      try {
        // Trigger webhook internally
        const webhookUrl = process.env.API_URL 
            ? `${process.env.API_URL}/api/payment/webhook` 
            : "http://localhost:5000/api/payment/webhook";
            
        await axios.post(webhookUrl, payload, {
          headers: { "x-webhook-secret": process.env.WEBHOOK_SECRET || "internal_secret" }
        });
        
        console.log(`[PaymentWorker] Webhook sent for payment ${paymentId} with status ${status}`);
      } catch (error) {
        console.error(`[PaymentWorker] Failed to trigger webhook for ${paymentId}:`, error.message);
        throw error;
      }
    },
    workerOptions
  );

  worker.on("completed", (job) => {
    console.log(`[PaymentWorker] Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[PaymentWorker] Job ${job.id} failed:`, err);
  });

  return worker;
};
