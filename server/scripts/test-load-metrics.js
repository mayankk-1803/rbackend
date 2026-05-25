import IORedis from "ioredis";

// Mock IORedis prototype before importing any project modules that initialize Redis connections.
// This prevents connection closed errors when Redis is not running locally.
IORedis.prototype.get = async (key) => {
  return null;
};
IORedis.prototype.set = async (key, value, ...args) => {
  return "OK";
};
IORedis.prototype.del = async (key) => {
  return 1;
};
IORedis.prototype.multi = function() {
  const chain = {
    incr: () => chain,
    ttl: () => chain,
    exec: async () => [[null, 1], [null, 10]]
  };
  return chain;
};
// Stub out internal connect and command methods to prevent TCP connection attempts
IORedis.prototype.connect = async () => {};
IORedis.prototype.sendCommand = async () => {};

import prisma from "../src/config/prisma.js";
import { handleApiboxCallback } from "../src/webhooks/rechargeWebhookController.js";
import { recordFinancialEntry } from "../src/services/ledgerService.js";
import { getMetricsReport } from "../src/services/webhookMonitoringService.js";
import { Prisma } from "@prisma/client";

async function runLoadTest() {
  console.log("=== STARTING CONCURRENCY & METRICS LOAD TEST ===");

  // Pre-cleanup of any previous run leftovers
  console.log("[TEST] Doing pre-test cleanup...");
  const oldUser = await prisma.user.findFirst({
    where: { email: "test_load@dizipay.com" }
  });
  if (oldUser) {
    const oldTxns = await prisma.transaction.findMany({
      where: { userId: oldUser.id },
      select: { id: true }
    });
    const oldTxnIds = oldTxns.map(t => t.id);

    await prisma.coinTransaction.deleteMany({ where: { userId: oldUser.id } });
    await prisma.ledgerEntry.deleteMany({ where: { userId: oldUser.id } });
    await prisma.transaction.deleteMany({
      where: {
        OR: [
          { userId: oldUser.id },
          { description: { contains: "Refund for recharge" } }
        ]
      }
    });
    const keys = oldTxnIds.flatMap(id => [`refund:${id}`, `webhook:OP_SUCCESS_${id}`, `webhook:OP_FAIL_${id}`]);
    await prisma.idempotencyRecord.deleteMany({
      where: { key: { in: keys } }
    });
    await prisma.wallet.delete({ where: { userId: oldUser.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: oldUser.id } }).catch(() => {});
  }

  // 1. Setup Test User and Wallet
  console.log("[TEST] Setting up test user and wallet...");
  let user = await prisma.user.findFirst({
    where: { email: "test_load@dizipay.com" }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Test Load User",
        email: "test_load@dizipay.com",
        password: "testpassword123",
        phone: "9999955555",
        isPhoneVerified: true,
        isEmailVerified: true,
        role: "USER"
      }
    });
  }

  // Set wallet balance high enough for 20 debits
  let wallet = await prisma.wallet.upsert({
    where: { userId: user.id },
    update: { balance: new Prisma.Decimal("5000.00"), coinBalance: 0 },
    create: {
      userId: user.id,
      balance: new Prisma.Decimal("5000.00"),
      coinBalance: 0,
      currency: "INR"
    }
  });

  console.log(`[TEST] User Wallet initialized. Balance: ${wallet.balance}`);

  // 2. Generate 10 Transactions in PENDING_REVIEW
  console.log("[TEST] Generating 10 PENDING_REVIEW transactions...");
  const txns = [];
  for (let i = 0; i < 10; i++) {
    const txn = await prisma.$transaction(async (tx) => {
      const { balanceAfter, ledgerEntry } = await recordFinancialEntry({
        userId: user.id,
        amount: -100.00,
        type: "RECHARGE_DEBIT",
        transactionId: null,
        description: `Load Test Recharge #${i}`,
        tx
      });

      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          amount: new Prisma.Decimal("100.00"),
          type: "RECHARGE",
          status: "PENDING_REVIEW",
          direction: "DEBIT",
          mobile: `999991111${i}`,
          operator: "Airtel",
          provider: "APIBOX",
          balanceAfter: balanceAfter,
          reviewStatus: "PENDING_REVIEW"
        }
      });

      await tx.ledgerEntry.update({
        where: { id: ledgerEntry.id },
        data: { transactionId: transaction.id }
      });

      return transaction;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    txns.push(txn);
  }

  console.log(`[TEST] Successfully created 10 transactions. IDs: ${txns.map(t => t.id).join(", ")}`);

  // 3. Prepare 100 Webhook Hits to execute concurrently
  // We want to simulate:
  // - 10 SUCCESS callbacks (1 for each generated transaction)
  // - 40 Duplicate SUCCESS callbacks (retries)
  // - 10 FAILURE callbacks (for a subset of transactions, testing race conditions with SUCCESS)
  // - 20 Duplicate FAILURE callbacks
  // - 20 Webhooks with invalid/missing/non-existent transaction IDs
  console.log("[TEST] Preparing 100 concurrent webhook request payloads...");

  const requests = [];

  // Helper to create mock response object
  const createMockResponse = () => {
    return {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      send(body) {
        this.body = body;
        return this;
      }
    };
  };

  // 10 Valid SUCCESS webhooks
  txns.forEach((txn, index) => {
    requests.push({
      req: {
        method: "GET",
        query: {
          RefTxnId: txn.id.toString(),
          STATUS: "1",
          msg: "Recharge Success",
          OPTXNID: `OP_SUCCESS_${txn.id}`
        }
      },
      res: createMockResponse()
    });
  });

  // 40 Duplicate SUCCESS webhooks
  for (let i = 0; i < 4; i++) {
    txns.forEach((txn) => {
      requests.push({
        req: {
          method: "GET",
          query: {
            RefTxnId: txn.id.toString(),
            STATUS: "1",
            msg: "Recharge Success Duplicate",
            OPTXNID: `OP_SUCCESS_${txn.id}`
          }
        },
        res: createMockResponse()
      });
    });
  }

  // 10 Valid FAILURE webhooks (on the same transactions, testing serializability and locks)
  txns.forEach((txn) => {
    requests.push({
      req: {
        method: "POST",
        body: {
          RefTxnId: txn.id.toString(),
          STATUS: "3",
          msg: "Provider Failure Attempted",
          OPTXNID: `OP_FAIL_${txn.id}`
        }
      },
      res: createMockResponse()
    });
  });

  // 20 Duplicate FAILURE webhooks
  for (let i = 0; i < 2; i++) {
    txns.forEach((txn) => {
      requests.push({
        req: {
          method: "POST",
          body: {
            RefTxnId: txn.id.toString(),
            STATUS: "3",
            msg: "Provider Failure Duplicate",
            OPTXNID: `OP_FAIL_${txn.id}`
          }
        },
        res: createMockResponse()
      });
    });
  }

  // 20 Invalid webhooks
  for (let i = 0; i < 20; i++) {
    requests.push({
      req: {
        method: "GET",
        query: {
          RefTxnId: "99999" + i, // non-existent
          STATUS: "1",
          msg: "Fake Recharge",
          OPTXNID: `OP_FAKE_${i}`
        }
      },
      res: createMockResponse()
    });
  }

  // Shuffle requests to ensure concurrent overlapping execution order
  const shuffledRequests = requests.sort(() => Math.random() - 0.5);

  console.log(`[TEST] Launching ${shuffledRequests.length} webhooks concurrently...`);

  const startTime = Date.now();
  await Promise.all(shuffledRequests.map(r => handleApiboxCallback(r.req, r.res)));
  const totalTime = Date.now() - startTime;

  console.log(`[TEST] Concurrency storm finished in ${totalTime}ms. Average time per request: ${(totalTime / shuffledRequests.length).toFixed(2)}ms`);

  // Wait 1.5 seconds for all background async reward triggers to complete
  console.log("[TEST] Waiting 1500ms for background reward loop to settle...");
  await new Promise(resolve => setTimeout(resolve, 1500));

  // 4. Assertions & Validation
  console.log("\n=== VERIFYING DATA INTEGRITY ===");

  // Verify that all 10 transactions reached a valid final state (either SUCCESS or FAILED)
  // Under concurrent lock, one of the requests (either success or failed) will succeed and lock out the others.
  const postTestTxns = await prisma.transaction.findMany({
    where: { id: { in: txns.map(t => t.id) } }
  });

  console.log("[TEST] Final status of transactions:");
  let successCount = 0;
  let failedCount = 0;
  postTestTxns.forEach(t => {
    console.log(` - TXN #${t.id}: Status: ${t.status} | refundStatus: ${t.refundStatus}`);
    if (t.status === "SUCCESS") successCount++;
    if (t.status === "FAILED") failedCount++;
  });

  console.log(`[TEST] Out of 10 transactions, ${successCount} became SUCCESS, ${failedCount} became FAILED. (Total: ${successCount + failedCount}/10)`);

  if (successCount + failedCount !== 10) {
    throw new Error(`Data Integrity Error: Not all transactions were finalized! Found: ${successCount + failedCount}`);
  }

  // Verify wallet balance:
  // User started with 5000.00.
  // 10 transactions debited 100.00 each -> balance would be 4000.00.
  // Each failed transaction got refunded 100.00.
  // Each successful transaction got cashback rewards of 5.00.
  // So expected balance = 4000.00 + (failedCount * 100.00) + (successCount * 5.00)
  const finalWallet = await prisma.wallet.findUnique({
    where: { userId: user.id }
  });

  const expectedBalance = 5000 - 1000 + (failedCount * 100) + (successCount * 5);
  console.log(`[TEST] Wallet Final Balance: ${finalWallet.balance} | Expected: ${expectedBalance.toFixed(2)}`);

  if (Number(finalWallet.balance) !== expectedBalance) {
    throw new Error(`Wallet Balance Mismatch! Final: ${finalWallet.balance}, Expected: ${expectedBalance}`);
  }
  console.log("✓ Wallet balance is perfectly consistent with transactions and rewards.");

  // Verify duplicate webhooks did not cause duplicate ledger entries
  // Expected debit entries: 10
  // Expected refund entries: failedCount
  // Expected cashback entries: successCount
  const ledgerEntries = await prisma.ledgerEntry.findMany({
    where: { userId: user.id }
  });

  const debitLedgers = ledgerEntries.filter(l => l.type === "RECHARGE_DEBIT");
  const creditLedgers = ledgerEntries.filter(l => l.type === "REFUND_CREDIT");
  const cashbackLedgers = ledgerEntries.filter(l => l.type === "CASHBACK_CREDIT");

  console.log(`[TEST] Ledger Counts -> Debits: ${debitLedgers.length} (Expected: 10) | Refunds: ${creditLedgers.length} (Expected: ${failedCount}) | Cashbacks: ${cashbackLedgers.length} (Expected: ${successCount})`);

  if (debitLedgers.length !== 10 || creditLedgers.length !== failedCount || cashbackLedgers.length !== successCount) {
    throw new Error("Ledger Entries inconsistency detected! Double refunds or double cashbacks occurred.");
  }
  console.log("✓ Ledger accounts are clean with zero duplicate double-spend entries.");

  // 5. Expose & Validate Metrics Report
  console.log("\n=== VALIDATING METRICS MONITORING SYSTEM ===");
  const report = await getMetricsReport();
  console.log("[METRICS REPORT SUMMARY]:");
  console.log(JSON.stringify(report, null, 2));

  if (report.successCount === 0 && report.failedCount === 0) {
    throw new Error("Metrics verification failed: No successes or failures recorded.");
  }

  if (report.duplicateCount === 0) {
    throw new Error("Metrics verification failed: Duplicate count is 0 despite multiple replays.");
  }

  if (isNaN(report.p95LatencyMs) || report.p95LatencyMs < 0 || isNaN(report.p99LatencyMs) || report.p99LatencyMs < 0) {
    throw new Error("Metrics verification failed: p95/p99 latency calculations are invalid or NaN.");
  }

  console.log("✓ Metrics reporting system successfully captured percentiles, success rates, and duplicates.");

  console.log("\n=== CONCURRENCY & METRICS LOAD TEST COMPLETED SUCCESSFULLY ===");
}

let hasFailed = false;

runLoadTest()
  .catch(e => {
    console.error("\n[LOAD TEST FAILED] Error:", e);
    hasFailed = true;
  })
  .finally(async () => {
    // Cleanup test data
    console.log("[TEST] Cleaning up test records...");
    const user = await prisma.user.findFirst({
      where: { email: "test_load@dizipay.com" }
    });
    if (user) {
      const txns = await prisma.transaction.findMany({
        where: { userId: user.id },
        select: { id: true }
      });
      const txnIds = txns.map(t => t.id);

      await prisma.coinTransaction.deleteMany({ where: { userId: user.id } });
      await prisma.ledgerEntry.deleteMany({ where: { userId: user.id } });
      
      // Delete all refund transactions created during tests
      await prisma.transaction.deleteMany({
        where: {
          OR: [
            { userId: user.id },
            { description: { contains: "Refund for recharge" } }
          ]
        }
      });
      
      // Delete idempotency records
      const keys = txnIds.flatMap(id => [`refund:${id}`, `webhook:OP_SUCCESS_${id}`, `webhook:OP_FAIL_${id}`]);
      await prisma.idempotencyRecord.deleteMany({
        where: { key: { in: keys } }
      });

      await prisma.wallet.delete({ where: { userId: user.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
    await prisma.$disconnect();
    console.log("[TEST] Cleanup done. Disconnected.");
    process.exit(hasFailed ? 1 : 0);
  });
