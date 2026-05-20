import prisma from "../config/prisma.js";
import { redisClient } from "../config/redis.js";
import { sendAlert } from "./alertService.js";
import { verifyWalletIntegrity } from "./ledgerService.js";

/**
 * Automates detection of financial anomalies and applies safety freezes.
 */
export const runIntegrityMonitor = async () => {
  console.log("[IntegrityMonitor] Starting scheduled scan...");
  let highestSeverity = "NONE";

  try {
    // 1. Check for Negative Balances (CRITICAL)
    const negativeWallets = await prisma.wallet.findMany({
      where: { OR: [{ balance: { lt: 0 } }, { coinBalance: { lt: 0 } }] }
    });
    
    if (negativeWallets.length > 0) {
      highestSeverity = "CRITICAL";
      await escalate("CRITICAL", `Found ${negativeWallets.length} wallets with negative balances!`);
      for (const w of negativeWallets) await freezeUser(w.userId, "Negative balance detected");
    }

    // 2. Ledger Drift Verification (CRITICAL for large drift, HIGH for small)
    // We sample recently active users to avoid massive full-table scans
    const recentTxns = await prisma.transaction.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
      select: { userId: true },
      distinct: ['userId']
    });

    for (const { userId } of recentTxns) {
      const { success, driftBalance, driftCoins } = await verifyWalletIntegrity(userId);
      if (!success) {
        highestSeverity = "CRITICAL";
        await escalate("CRITICAL", `Ledger drift detected for user ${userId}. Balance drift: ${driftBalance}, Coin drift: ${driftCoins}`);
        await freezeUser(userId, "Ledger drift detected");
      }
    }

    // 3. Duplicate Cashback/Refunds Detection (HIGH)
    // Group by rechargeTxnId to find duplicate EARNED entries
    const duplicateCashbacks = await prisma.coinTransaction.groupBy({
      by: ['rechargeTxnId'],
      where: { type: 'EARNED', rechargeTxnId: { not: null } },
      having: { _count: { id: 'gt' }, id: { _count: { gt: 1 } } }
    });

    if (duplicateCashbacks.length > 0) {
      if (highestSeverity !== "CRITICAL") highestSeverity = "HIGH";
      await escalate("HIGH", `Found ${duplicateCashbacks.length} transactions with duplicate cashbacks!`);
      // We would ideally freeze the specific users, but for now we log.
    }

    // 4. Abnormal Redemption Velocity (MEDIUM/HIGH)
    // Find users who redeemed more than 5 times in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const rapidRedemptions = await prisma.coinTransaction.groupBy({
      by: ['userId'],
      where: { type: 'REDEEMED', createdAt: { gte: oneHourAgo } },
      having: { _count: { id: 'gt' }, id: { _count: { gt: 5 } } }
    });

    if (rapidRedemptions.length > 0) {
      if (highestSeverity === "NONE" || highestSeverity === "LOW") highestSeverity = "MEDIUM";
      await escalate("MEDIUM", `Found ${rapidRedemptions.length} users with abnormal redemption velocity.`);
      for (const { userId } of rapidRedemptions) {
        await freezeUser(userId, "Abnormal redemption velocity");
      }
    }

    // 5. Orphan Entries (LOW)
    // Ledger entries with transactionId that doesn't exist
    // Prisma referential integrity usually catches this, so we just log.
    
    console.log(`[IntegrityMonitor] Scan complete. Highest severity: ${highestSeverity}`);
  } catch (err) {
    console.error("[IntegrityMonitor] Execution failed:", err);
    await escalate("HIGH", `Integrity Monitor crashed: ${err.message}`);
  }
};

const escalate = async (severity, message) => {
  console.log(`[ESCALATION:${severity}] ${message}`);
  
  if (severity === "LOW") {
    // Log only
  } else if (severity === "MEDIUM") {
    if (sendAlert) await sendAlert(`[MEDIUM] ${message}`, "WARNING");
  } else if (severity === "HIGH") {
    if (sendAlert) await sendAlert(`[HIGH] ${message}`, "URGENT");
  } else if (severity === "CRITICAL") {
    if (sendAlert) await sendAlert(`[CRITICAL] ${message}`, "CRITICAL");
    await freezeSystem(message);
  }
};

const freezeUser = async (userId, reason) => {
  await redisClient.set(`freeze:user:${userId}`, reason, "EX", 86400); // 24hr soft lock
  console.warn(`[IntegrityMonitor] Froze user ${userId} | Reason: ${reason}`);
};

const freezeSystem = async (reason) => {
  await redisClient.set("freeze:all", reason); // Hard lock until manual intervention
  console.error(`[IntegrityMonitor] SYSTEM FROZEN (FINANCIAL MUTATIONS BLOCKED) | Reason: ${reason}`);
};

/**
 * Initializes the automated monitor to run every 10 minutes.
 */
export const startIntegrityMonitor = () => {
  setInterval(() => {
    runIntegrityMonitor();
  }, 10 * 60 * 1000);
};
