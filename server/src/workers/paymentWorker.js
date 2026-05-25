import { Worker, Queue } from "bullmq";
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
        
        // Check if circuit breaker is open
        if (isCircuitBreakerOpen()) {
          console.warn(`[NEXGATE_WORKER_SKIPPED_CIRCUIT_OPEN] Payment ${paymentId} verification skipped. Circuit breaker is open. Rescheduling...`);
          
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
              console.log(`[PaymentWorker] Requeued verification job for payment ${paymentId} (attempt ${attempt}) with 15000ms delay`);
            }
            await paymentQueue.close();
          }
          return;
        }
        
        // 1. Fetch payment
        const payment = await prisma.payment.findUnique({ where: { id: Number(paymentId) } });
        if (!payment) {
          console.warn(`[PaymentWorker] Payment ${paymentId} not found.`);
          return;
        }

        // 2. State Guard: Skip if already finalized
        if (["SUCCESS", "FAILED"].includes(payment.status)) {
          console.log(`[VERIFY_SKIPPED_FINALIZED] Payment ${paymentId} already in final status ${payment.status}`);
          return;
        }

        console.log(`[PaymentWorker] Verifying status for Payment ${paymentId} | Attempt ${attempt}/3`);

        try {
          const statusResult = await checkNexgateStatus(paymentId);
          const providerStatus = statusResult.providerStatus || statusResult.status || "PENDING";
          
          console.log(
            `[NEXGATE_STATUS_RESULT] Payment ${paymentId} => ${providerStatus}`
          );

          if (statusResult.success && providerStatus === "SUCCESS") {
            const lockToken = await acquireLock(`payment_webhook:${paymentId}`, 15000);
            if (!lockToken) {
              console.warn(`[PaymentWorker] Could not acquire lock for payment ${paymentId}. Requeuing verification job.`);
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

            try {
              const correlationId = crypto.randomBytes(8).toString('hex');
              let result;
              try {
                result = await prisma.$transaction(async (tx) => {
                  const payments = await tx.$queryRaw`SELECT * FROM payment WHERE id = ${paymentId} FOR UPDATE`;
                  if (!payments || payments.length === 0) throw new Error(`Payment ${paymentId} not found`);
                  const dbPayment = payments[0];

                  if (["SUCCESS", "FAILED", "REFUNDED"].includes(dbPayment.status)) {
                    console.log(`[PaymentWorker][DUPLICATE_FINALIZATION_PREVENTED] Already processed with status: ${dbPayment.status}`);
                    return { alreadyProcessed: true, payment: dbPayment };
                  }

                  const idempotencyKey = `topup:${dbPayment.id}`;
                  const canClaim = await claimIdempotencyKey(idempotencyKey, statusResult.raw || {}, tx);
                  if (!canClaim) {
                    console.log(`[PaymentWorker] Topup key ${idempotencyKey} already claimed.`);
                    return { alreadyProcessed: true, payment: dbPayment };
                  }

                  // 1. Fetch wallet with lock to prevent race conditions
                  const wallets = await tx.$queryRaw`SELECT * FROM wallet WHERE userId = ${dbPayment.userId} FOR UPDATE`;
                  if (!wallets || wallets.length === 0) throw new Error(`Wallet not found for user ${dbPayment.userId}`);
                  const wallet = wallets[0];
                  const balanceBefore = wallet.balance;

                  console.log(`[WALLET_BEFORE] User ${dbPayment.userId} balance: ${balanceBefore}`);

                  const finalGatewayTxnId = statusResult.operatorTxnId || statusResult.gatewayTxnId || dbPayment.gatewayTxnId || `NEXGATE_VERIFY_${Date.now()}`;
                  let balanceAfter;

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

                    // Explicit logs
                    const updatedWallet = await tx.wallet.findUnique({
                      where: { userId: dbPayment.userId }
                    });
                    console.log(`[WALLET_AFTER] User ${dbPayment.userId} balance: ${updatedWallet.balance}`);

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

                    // Atomic increment
                    await tx.wallet.update({
                      where: { userId: dbPayment.userId },
                      data: {
                        balance: {
                          increment: Number(dbPayment.amount)
                        }
                      }
                    });

                    const updatedWallet = await tx.wallet.findUnique({
                      where: { userId: dbPayment.userId }
                    });
                    console.log(`[WALLET_AFTER] User ${dbPayment.userId} balance: ${updatedWallet.balance}`);

                    await recordFinancialEntry({
                      userId: dbPayment.userId,
                      amount: dbPayment.amount,
                      type: 'TOPUP_CREDIT',
                      transactionId: null,
                      description: `Wallet topup | Order: ${dbPayment.id}`,
                      context: { correlationId, ipAddress: "127.0.0.1" },
                      tx,
                      skipWalletUpdate: true,
                      overrideBalanceBefore: balanceBefore,
                      overrideBalanceAfter: balanceAfter
                    });

                    await tx.transaction.create({
                      data: {
                        userId: dbPayment.userId,
                        amount: dbPayment.amount,
                        type: "TOPUP",
                        status: "SUCCESS",
                        direction: "CREDIT",
                        gatewayTxnId: finalGatewayTxnId,
                        balanceAfter: balanceAfter,
                        description: `Wallet topup | Order: ${dbPayment.id} | Before: ${balanceBefore}`,
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
                console.error(
                  `[PAYMENT_FINALIZATION_FAILED] Payment ${paymentId}`,
                  err
                );
                throw err;
              }

              if (result && !result.alreadyProcessed) {
                console.log(`[PAYMENT_FINALIZED] Payment ${paymentId} verified and finalized via worker.`);
                console.log(`[PAYMENT_CREDIT_SUCCESS] Payment ${paymentId} credited successfully`);
                
                // Fetch updated wallet balance post-commit to emit fresh data
                const updatedWallet = await prisma.wallet.findUnique({
                  where: { userId: result.payment.userId }
                });

                eventBus.emit("wallet_updated", {
                  userId: result.payment.userId,
                  amount: result.payment.amount,
                  balance: updatedWallet ? updatedWallet.balance : undefined
                });
              }
            } finally {
              await releaseLock(`payment_webhook:${paymentId}`, lockToken);
            }
          } else if (providerStatus === "FAILED") {
            console.log(`[NEXGATE_STATUS_RESULT] Payment ${paymentId} => FAILED`);

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

            console.log(`[PAYMENT_FINALIZED] Payment ${paymentId} marked as FAILED via worker.`);
          } else {
            console.log(`[NEXGATE_STATUS_PENDING_RETRY] Payment ${paymentId} verification returned status ${providerStatus}. Requeuing...`);
            
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
                console.log(`[PaymentWorker] Enqueued verify attempt ${nextAttempt} with delay 15000ms`);
              }
              await paymentQueue.close();
            } else {
              await prisma.payment.update({
                where: { id: paymentId },
                data: { status: "PROCESSING_REVIEW" }
              });
              console.warn(`[NEXGATE_MANUAL_REVIEW_REQUIRED] Payment ${paymentId} still pending after 3 attempts. Kept as PROCESSING_REVIEW.`);
            }
          }
        } catch (error) {
          console.error(`[NEXGATE_STATUS_PENDING_RETRY] Error checking status for payment ${paymentId}:`, error.message);
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
                console.log(`[PaymentWorker] Requeued verification job for payment ${paymentId} (attempt ${attempt}) with 15000ms delay due to error`);
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
