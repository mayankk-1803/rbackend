import { Worker, Queue } from "bullmq";
import dotenv from "dotenv";
import { redis } from "../config/redis.js";
import eventBus from "../config/eventBus.js";
import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";

dotenv.config();

console.log("Recharge Worker starting...");

export const dlqQueue = new Queue("recharge_dlq", { connection: redis });

const worker = new Worker("rechargeQueue", async (job) => {
    const { txnId, userId, amount } = job.data;
    console.log(`[JOB] ${job.id} | Txn: ${txnId} | User: ${userId} | Amt: ${amount}`);
    
    let attempts = [];
    let successfulProvider = null;

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Idempotency Check
        const txn = await tx.transaction.findUnique({ where: { id: txnId } });
        if (!txn || txn.status !== "PENDING") {
          console.log(`[JOB] Txn ${txnId} already processed or not found.`);
          return;
        }

        // --- ROUTING LOGIC ---
        let activeProviders = [];
        
        // Handle Provider Overrides (Test Mode)
        if (job.data.testProviders && Array.isArray(job.data.testProviders) && job.data.testProviders.length > 0) {
          console.log(`[ADMIN MODE] Using providers: ${job.data.testProviders.join(", ")}`);
          const providersData = await tx.provider.findMany({
            where: { code: { in: job.data.testProviders } }
          });
          
          activeProviders = job.data.testProviders
            .map(code => providersData.find(p => p.code === code))
            .filter(Boolean);

          if (activeProviders.length === 0 || activeProviders.length !== job.data.testProviders.length) {
            throw new Error("Invalid providers selected");
          }
        } else {
          // Standard Priority Routing
          activeProviders = await tx.provider.findMany({
            where: { isActive: true },
            orderBy: { priority: "asc" } 
          });
        }

        if (activeProviders.length === 0) throw new Error("No active recharge providers available.");

        let isSuccess = false;

        // Failover Loop
        for (const provider of activeProviders) {
          const startTime = Date.now();
          try {
            console.log(`[Recharge] Attempting API: ${provider.code}`);
            
            // SIMULATED API CALL
            // In production, this would be: await axios.post(provider.baseUrl, ...)
            const simSuccess = Math.random() > 0.3; // 70% Success Rate for simulation
            if (!simSuccess) throw new Error("API Connection Timeout");
            
            isSuccess = true;
            successfulProvider = provider.code;
            attempts.push({ 
              provider: provider.name, 
              code: provider.code, 
              status: "SUCCESS", 
              latency: Date.now() - startTime 
            });
            break; 
          } catch (err) {
            console.error(`[Recharge] ${provider.code} failed: ${err.message}`);
            attempts.push({ 
              provider: provider.name, 
              code: provider.code, 
              status: "FAILED", 
              reason: err.message,
              latency: Date.now() - startTime 
            });
            continue;
          }
        }

        if (!isSuccess) throw new Error("All active recharge providers failed.");

        // 2. Update Status to SUCCESS
        await tx.transaction.update({
          where: { id: txnId },
          data: { 
            status: "SUCCESS", 
            provider: successfulProvider,
            // We can store attempts as JSON if schema supports it, but for now we emit it
          }
        });

        // 3. Cashback Logic (1% up to ₹10)
        const cashbackAmount = Math.min(Number(amount) * 0.01, 10);
        if (cashbackAmount > 0) {
          await tx.wallet.update({
            where: { userId },
            data: { cashbackBalance: { increment: cashbackAmount } }
          });
          await tx.transaction.create({
            data: { userId, amount: cashbackAmount, type: "CASHBACK", status: "SUCCESS", direction: "CREDIT" }
          });
        }

        // 4. Referral Reward (₹50 on first recharge >= 100)
        if (Number(amount) >= 100) {
          const user = await tx.user.findUnique({ where: { id: userId } });
          if (user?.referredBy) {
            const successCount = await tx.transaction.count({
              where: { userId, type: "RECHARGE", status: "SUCCESS" }
            });
            if (successCount === 1) {
              await tx.wallet.update({ where: { userId }, data: { cashbackBalance: { increment: 20 } } });
              await tx.transaction.create({ data: { userId, amount: 20, type: "REFERRAL", status: "SUCCESS", direction: "CREDIT" } });
              await tx.wallet.update({ where: { userId: user.referredBy }, data: { cashbackBalance: { increment: 20 } } });
              await tx.transaction.create({ data: { userId: user.referredBy, amount: 20, type: "REFERRAL", status: "SUCCESS", direction: "CREDIT" } });
            }
          }
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      
      console.log(`[SUCCESS] Txn ${txnId} completed using ${successfulProvider}`);

      // Notify Frontend
      console.log(`[EVENT] recharge_success emitted for Txn ${txnId}`);
      eventBus.emit("recharge_success", {
        txnId,
        status: "success",
        transaction: { 
          transactionId: txnId, 
          status: "SUCCESS", 
          provider: successfulProvider,
          attempts 
        }
      });

      console.log(`[FINAL] Txn ${txnId} | Status: SUCCESS | Attempts: ${JSON.stringify(attempts)}`);
      return { success: true, providerUsed: successfulProvider, attempts };
    } catch (error) {
      console.error(`[JOB ERROR] ${job.id}:`, error.message);
      console.log(`[FAILURE] All providers failed for Txn ${txnId}`);
      
      // FAILURE & REFUND LOGIC
      try {
        await prisma.$transaction(async (tx) => {
          const txn = await tx.transaction.findUnique({ where: { id: txnId } });
          if (!txn || txn.status !== "PENDING" || txn.refundStatus === "refunded") return;

          await tx.transaction.update({
            where: { id: txnId },
            data: { status: "FAILED", refundStatus: "refunded", refundedAt: new Date() }
          });

          await tx.wallet.update({
            where: { userId },
            data: { balance: { increment: amount } }
          });

          await tx.transaction.create({
            data: { userId, amount, type: "REFUND", status: "SUCCESS", direction: "CREDIT" }
          });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        
        console.log(`[REFUND] Txn ${txnId} refunded to user ${userId}`);

        eventBus.emit("recharge_failed", {
          txnId,
          status: "failed",
          transaction: { 
            transactionId: txnId, 
            status: "FAILED",
            attempts 
          },
          reason: error.message
        });
      } catch (refundErr) {
        console.error(`[CRITICAL REFUND ERROR] ${job.id}:`, refundErr.message);
      }

      console.log(`[FINAL] Txn ${txnId} | Status: FAILED | Attempts: ${JSON.stringify(attempts)}`);
      throw error;
    }
  },
  { 
    connection: redis,
    concurrency: 5,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    settings: {
      backoffStrategies: {
        exponential: (attemptsMade) => Math.pow(2, attemptsMade) * 1000
      }
    }
  }
);

export default worker;
