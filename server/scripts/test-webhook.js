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
import eventBus from "../src/config/eventBus.js";
import { handleApiboxCallback } from "../src/webhooks/rechargeWebhookController.js";
import { recordFinancialEntry } from "../src/services/ledgerService.js";
import { Prisma } from "@prisma/client";

async function runTest() {
  console.log("=== STARTING WEBHOOK INTEGRATION TEST (MOCKED REDIS) ===");

  // 1. Setup Test User
  console.log("[TEST] Setting up test user and wallet...");
  let user = await prisma.user.findFirst({
    where: { email: "test_webhook@dizipay.com" }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Test Webhook User",
        email: "test_webhook@dizipay.com",
        password: "testpassword123",
        phone: "9999988888",
        isPhoneVerified: true,
        isEmailVerified: true,
        role: "USER"
      }
    });
  }

  // Upsert wallet and reset balance to 500
  let wallet = await prisma.wallet.upsert({
    where: { userId: user.id },
    update: { balance: new Prisma.Decimal("500.00"), coinBalance: 0 },
    create: {
      userId: user.id,
      balance: new Prisma.Decimal("500.00"),
      coinBalance: 0,
      currency: "INR"
    }
  });

  console.log(`[TEST] Wallet initialized for user ${user.id}. Balance: ${wallet.balance}`);

  // Create event indicators to verify eventBus emissions
  let successEmitted = false;
  let failedEmitted = false;
  let txnUpdatedEmittedCount = 0;
  let walletUpdatedEmittedCount = 0;

  eventBus.on("recharge_success", (data) => {
    console.log("[EVENT_BUS] recharge_success event received:", JSON.stringify(data));
    successEmitted = true;
  });

  eventBus.on("recharge_failed", (data) => {
    console.log("[EVENT_BUS] recharge_failed event received:", JSON.stringify(data));
    failedEmitted = true;
  });

  eventBus.on("transaction_updated", (data) => {
    console.log("[EVENT_BUS] transaction_updated event received:", JSON.stringify(data));
    txnUpdatedEmittedCount++;
  });

  eventBus.on("wallet_updated", (data) => {
    console.log("[EVENT_BUS] wallet_updated event received:", JSON.stringify(data));
    walletUpdatedEmittedCount++;
  });

  // ==========================================
  // TEST SCENARIO 1: SUCCESSFUL WEBHOOK FLOW
  // ==========================================
  console.log("\n--- SCENARIO 1: Success Webhook Processing ---");

  // Create PENDING_REVIEW transaction
  console.log("[TEST] Creating a PENDING_REVIEW recharge transaction...");
  const initTxn = await prisma.$transaction(async (tx) => {
    const { balanceAfter, ledgerEntry } = await recordFinancialEntry({
      userId: user.id,
      amount: -100.00,
      type: "RECHARGE_DEBIT",
      transactionId: null,
      description: "Prepaid Recharge for mobile: 9999988888",
      tx
    });

    const transaction = await tx.transaction.create({
      data: {
        userId: user.id,
        amount: new Prisma.Decimal("100.00"),
        type: "RECHARGE",
        status: "PENDING_REVIEW",
        direction: "DEBIT",
        mobile: "9999988888",
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

  console.log(`[TEST] Created transaction ID: ${initTxn.id} | Status: ${initTxn.status}`);

  // Mock Request for success webhook (STATUS=1)
  const reqSuccess = {
    method: "GET",
    query: {
      RefTxnId: initTxn.id.toString(),
      STATUS: "1", // Success status code
      msg: "Recharge Successful",
      OPTXNID: `TEST_OP_ID_${initTxn.id}`
    }
  };

  const resMock1 = {
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

  console.log("[TEST] Calling handleApiboxCallback with SUCCESS parameters...");
  await handleApiboxCallback(reqSuccess, resMock1);
  console.log(`[TEST] Webhook response code: ${resMock1.statusCode} | body: ${resMock1.body}`);

  // Wait 1 second for asynchronous reward processing to complete
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check state changes
  const postSuccessTxn = await prisma.transaction.findUnique({
    where: { id: initTxn.id }
  });
  console.log(`[TEST] Post-webhook transaction status: ${postSuccessTxn.status} (Expected: SUCCESS)`);
  console.log(`[TEST] Post-webhook transaction providerTxnId: ${postSuccessTxn.providerTxnId} (Expected: TEST_OP_ID_${initTxn.id})`);
  console.log(`[TEST] Post-webhook apiResponse:`, JSON.stringify(postSuccessTxn.apiResponse));

  // Check user wallet
  const postSuccessWallet = await prisma.wallet.findUnique({
    where: { userId: user.id }
  });
  console.log(`[TEST] Post-webhook wallet balance: ${postSuccessWallet.balance} (Expected: 400.00)`);

  if (postSuccessTxn.status !== "SUCCESS" || resMock1.statusCode !== 200) {
    throw new Error("Scenario 1 Failed: Transaction was not successfully transitioned to SUCCESS");
  }

  // ==========================================
  // TEST SCENARIO 2: DUP REQUEST SAFETY
  // ==========================================
  console.log("\n--- SCENARIO 2: Duplicate Callback Protection ---");
  const resMock2 = {
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

  console.log("[TEST] Sending duplicate success webhook callback...");
  // Reset success indicator to monitor triggers
  successEmitted = false;
  txnUpdatedEmittedCount = 0;
  walletUpdatedEmittedCount = 0;

  await handleApiboxCallback(reqSuccess, resMock2);
  console.log(`[TEST] Duplicate webhook response code: ${resMock2.statusCode} | body: ${resMock2.body}`);

  console.log(`[TEST] Did success event emit on duplicate callback? ${successEmitted} (Expected: false)`);
  console.log(`[TEST] Did txn_updated event emit on duplicate callback? ${txnUpdatedEmittedCount} (Expected: 0)`);

  // ==========================================
  // TEST SCENARIO 3: FAILED STATUS & REFUND FLOW
  // ==========================================
  console.log("\n--- SCENARIO 3: Failure Callback & Refund Flow ---");
  
  // Reset user wallet balance before Scenario 3 to ensure independent balance assertion
  await prisma.wallet.update({
    where: { userId: user.id },
    data: { balance: new Prisma.Decimal("400.00") }
  });

  // Create another PENDING_REVIEW recharge transaction
  console.log("[TEST] Creating another PENDING_REVIEW recharge transaction...");
  const initTxnFail = await prisma.$transaction(async (tx) => {
    const { balanceAfter, ledgerEntry } = await recordFinancialEntry({
      userId: user.id,
      amount: -150.00,
      type: "RECHARGE_DEBIT",
      transactionId: null,
      description: "Prepaid Recharge for mobile: 9999977777",
      tx
    });

    const transaction = await tx.transaction.create({
      data: {
        userId: user.id,
        amount: new Prisma.Decimal("150.00"),
        type: "RECHARGE",
        status: "PENDING_REVIEW",
        direction: "DEBIT",
        mobile: "9999977777",
        operator: "Jio",
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

  console.log(`[TEST] Created transaction ID: ${initTxnFail.id} | Status: ${initTxnFail.status}`);

  // Mock Request for failed webhook (STATUS=3 / STATUS=FAILED)
  const reqFail = {
    method: "POST",
    body: {
      RefTxnId: initTxnFail.id.toString(),
      STATUS: "FAILED", // string value test
      msg: "Operator Down",
      OPTXNID: `TEST_OP_ID_FAIL_${initTxnFail.id}`
    }
  };

  const resMock3 = {
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

  console.log("[TEST] Calling handleApiboxCallback with FAILED parameters...");
  await handleApiboxCallback(reqFail, resMock3);
  console.log(`[TEST] Webhook response code: ${resMock3.statusCode} | body: ${resMock3.body}`);

  // Check state changes
  const postFailTxn = await prisma.transaction.findUnique({
    where: { id: initTxnFail.id }
  });
  console.log(`[TEST] Post-webhook transaction status: ${postFailTxn.status} (Expected: REFUNDED)`);
  console.log(`[TEST] Post-webhook transaction refundStatus: ${postFailTxn.refundStatus} (Expected: refunded)`);

  // Verify Refund Transaction is created
  const refundTxn = await prisma.transaction.findFirst({
    where: {
      userId: user.id,
      type: "REFUND",
      idempotencyKey: `refund:${initTxnFail.id}`
    }
  });

  if (!refundTxn) {
    throw new Error("Scenario 3 Failed: Refund transaction record was not created.");
  }
  console.log(`[TEST] Created Refund Transaction: ID ${refundTxn.id} | Status: ${refundTxn.status} | Amount: ${refundTxn.amount} (Expected: 150.00)`);

  // Check user wallet balance (should be restored to 400.00: 400 - 150 (debit) + 150 (refund))
  const postFailWallet = await prisma.wallet.findUnique({
    where: { userId: user.id }
  });
  console.log(`[TEST] Post-webhook wallet balance: ${postFailWallet.balance} (Expected: 400.00)`);

  if (postFailTxn.status !== "REFUNDED" || Number(postFailWallet.balance) !== 400.00) {
    throw new Error("Scenario 3 Failed: Refund was not processed or transaction status not updated");
  }

  // ==========================================
  // TEST SCENARIO 4: DUP FAILED SAFETY
  // ==========================================
  console.log("\n--- SCENARIO 4: Duplicate Failure Callback Protection ---");
  const resMock4 = {
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

  console.log("[TEST] Sending duplicate failed webhook callback...");
  failedEmitted = false;
  
  // Track ledger entries count
  const ledgerCountBefore = await prisma.ledgerEntry.count({
    where: { userId: user.id }
  });

  await handleApiboxCallback(reqFail, resMock4);
  console.log(`[TEST] Duplicate webhook response code: ${resMock4.statusCode} | body: ${resMock4.body}`);

  const ledgerCountAfter = await prisma.ledgerEntry.count({
    where: { userId: user.id }
  });

  console.log(`[TEST] Ledger entries count before: ${ledgerCountBefore} | after: ${ledgerCountAfter} (Expected diff: 0)`);
  console.log(`[TEST] Did failed event emit on duplicate callback? ${failedEmitted} (Expected: false)`);

  if (ledgerCountAfter !== ledgerCountBefore) {
    throw new Error("Scenario 4 Failed: Duplicate ledger entries were created!");
  }

  console.log("\n=== ALL TEST SCENARIOS PASSED SUCCESSFULLY ===");
}

runTest()
  .catch(e => {
    console.error("\n[TEST FAILED] Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    // Cleanup test data
    console.log("[TEST] Cleaning up test records...");
    const user = await prisma.user.findFirst({
      where: { email: "test_webhook@dizipay.com" }
    });
    if (user) {
      // Find all transaction ids for this user
      const txns = await prisma.transaction.findMany({
        where: { userId: user.id },
        select: { id: true }
      });
      const txnIds = txns.map(t => t.id);

      await prisma.coinTransaction.deleteMany({ where: { userId: user.id } });
      await prisma.ledgerEntry.deleteMany({ where: { userId: user.id } });
      await prisma.transaction.deleteMany({ where: { userId: user.id } });
      
      // Delete idempotency keys
      const keys = [`refund:${txnIds[0]}`, `refund:${txnIds[1]}`, `webhook:TEST_OP_ID_${txnIds[0]}`, `webhook:TEST_OP_ID_FAIL_${txnIds[1]}`].filter(Boolean);
      await prisma.idempotencyRecord.deleteMany({
        where: { key: { in: keys } }
      });

      await prisma.wallet.delete({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.$disconnect();
    console.log("[TEST] Cleanup done. Disconnected.");
    process.exit(0);
  });
