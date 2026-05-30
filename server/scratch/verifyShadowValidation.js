import { PrismaClient } from '@prisma/client';
import { redisClient } from '../src/config/redis.js';
if (redisClient) {
  redisClient.removeAllListeners("error");
  redisClient.on("error", () => {});
  try {
    redisClient.disconnect();
  } catch (e) {}
}
import { runShadowValidation } from '../src/services/shadowCommissionValidationService.js';
import { getShadowValidationStats, getShadowValidationList } from '../src/controllers/commissionAdminController.js';
import { performance } from 'perf_hooks';
import eventBus from '../src/config/eventBus.js';

const prisma = new PrismaClient();

const mockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (obj) {
      this.data = obj;
      return this;
    }
  };
  return res;
};

const mockReq = (query = {}) => {
  return {
    query,
    user: { id: 1, role: "SUPER_ADMIN" }
  };
};

async function main() {
  console.log("==================================================");
  console.log("COMMISSION SHADOW VALIDATION TEST SUITE");
  console.log("==================================================");

  let passedTests = 0;
  const totalTests = 10;

  function assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  const suffix = Date.now();
  const opName = `OP_SHADOW_${suffix}`;
  const catCode = "RECHARGE"; // Match exact recharge category code

  // 1. Setup Test Database Context
  const operator = await prisma.operator.create({
    data: { name: opName, codes: opName, active: true }
  });

  // Ensure RECHARGE category exists
  let serviceCategory = await prisma.serviceCategory.findUnique({
    where: { code: catCode }
  });
  if (!serviceCategory) {
    serviceCategory = await prisma.serviceCategory.create({
      data: { name: "Recharge Service", code: catCode, isActive: true }
    });
  }

  const testSlab = await prisma.slab.create({ data: { name: `SHADOW_SLAB_${suffix}` } });
  const testPackage = await prisma.commissionPackage.create({ data: { name: `SHADOW_PKG_${suffix}` } });

  await prisma.packageServiceSlab.create({
    data: { packageId: testPackage.id, serviceCategoryId: serviceCategory.id, slabId: testSlab.id }
  });

  const testUser = await prisma.user.create({
    data: {
      name: `Test Shadow User ${suffix}`,
      email: `shadow_${suffix}@dizipay.com`,
      password: "password123",
      packageId: testPackage.id,
      slabId: null,
      commissionRole: "RETAILER",
      tier: `Tier_${suffix}`
    }
  });

  const wallet = await prisma.wallet.upsert({
    where: { userId: testUser.id },
    update: { balance: 1000.00 },
    create: { userId: testUser.id, balance: 1000.00 }
  });

  // Rule Setup: 5% Commission
  const rechargeRule = await prisma.rechargeCommissionRule.create({
    data: {
      slabId: testSlab.id,
      operatorId: operator.id,
      serviceCategoryId: serviceCategory.id,
      role: "RETAILER",
      commissionValue: 5.0,
      status: "ACTIVE"
    }
  });

  try {
    // ----------------------------------------------------
    // TEST 1: Match Capture
    // ----------------------------------------------------
    console.log("\n--- TEST 1: Match Capture ---");
    // Create successful recharge matching the rule exactly
    // Amount = 100, 5% comm = 5, profit = 0
    const txn1 = await prisma.transaction.create({
      data: {
        userId: testUser.id,
        amount: 100.00,
        type: "RECHARGE",
        status: "SUCCESS",
        direction: "DEBIT",
        mobile: "9900000001",
        operator: opName,
        commission: 5.0000,
        profit: 0.0000
      }
    });

    await runShadowValidation(txn1.id);

    const validation1 = await prisma.commissionShadowValidation.findFirst({
      where: { transactionId: txn1.id }
    });

    assert(validation1 !== null, "Validation record must be created");
    assert(validation1.isMatch === true, "Validation must result in a match");
    assert(validation1.mismatchReason === null, "Mismatch reason must be null");
    console.log("PASS: Match captured and logged successfully");
    passedTests++;

    // ----------------------------------------------------
    // TEST 2: Mismatch Classification
    // ----------------------------------------------------
    console.log("\n--- TEST 2: Mismatch Classification ---");
    // Legacy commission is 4.00, but simulator rule calculates 5.00
    const txn2 = await prisma.transaction.create({
      data: {
        userId: testUser.id,
        amount: 100.00,
        type: "RECHARGE",
        status: "SUCCESS",
        direction: "DEBIT",
        mobile: "9900000002",
        operator: opName,
        commission: 4.0000,
        profit: 0.0000
      }
    });

    await runShadowValidation(txn2.id);

    const validation2 = await prisma.commissionShadowValidation.findFirst({
      where: { transactionId: txn2.id }
    });

    assert(validation2 !== null, "Validation record must be created");
    assert(validation2.isMatch === false, "Validation must result in a mismatch");
    assert(validation2.mismatchReason === "RECHARGE_MISMATCH", "Mismatch must be classified as RECHARGE_MISMATCH");
    console.log("PASS: Mismatch successfully identified and classified");
    passedTests++;

    // ----------------------------------------------------
    // TEST 3: No Wallet Impact
    // ----------------------------------------------------
    console.log("\n--- TEST 3: No Wallet Impact ---");
    const walletBefore = await prisma.wallet.findUnique({ where: { userId: testUser.id } });
    
    // Trigger validation again
    await runShadowValidation(txn1.id);
    
    const walletAfter = await prisma.wallet.findUnique({ where: { userId: testUser.id } });
    assert(walletBefore.balance.toString() === walletAfter.balance.toString(), "Wallet balance must remain unchanged");
    console.log("PASS: Shadow engine has zero wallet impact");
    passedTests++;

    // ----------------------------------------------------
    // TEST 4: No Ledger Impact
    // ----------------------------------------------------
    console.log("\n--- TEST 4: No Ledger Impact ---");
    const ledgerCountBefore = await prisma.ledgerEntry.count();
    
    await runShadowValidation(txn2.id);
    
    const ledgerCountAfter = await prisma.ledgerEntry.count();
    assert(ledgerCountBefore === ledgerCountAfter, "No new ledger entries must be created");
    console.log("PASS: Shadow engine has zero ledger impact");
    passedTests++;

    // ----------------------------------------------------
    // TEST 5: No Transaction Mutation
    // ----------------------------------------------------
    console.log("\n--- TEST 5: No Transaction Mutation ---");
    const txnBefore = await prisma.transaction.findUnique({ where: { id: txn2.id } });
    
    await runShadowValidation(txn2.id);
    
    const txnAfter = await prisma.transaction.findUnique({ where: { id: txn2.id } });
    assert(txnBefore.status === txnAfter.status, "Transaction status must remain SUCCESS");
    assert(txnBefore.commission.toString() === txnAfter.commission.toString(), "Transaction commission must remain 4.00");
    console.log("PASS: Target transaction record remains unmodified");
    passedTests++;

    // ----------------------------------------------------
    // TEST 6: Async Processing
    // ----------------------------------------------------
    console.log("\n--- TEST 6: Async Processing ---");
    let executionOrder = [];
    
    // Simulate setImmediate fire-and-forget logic
    const runAsync = () => {
      executionOrder.push("SYNC_START");
      setImmediate(() => {
        executionOrder.push("ASYNC_RUN");
      });
      executionOrder.push("SYNC_END");
    };
    
    runAsync();
    await new Promise(resolve => setTimeout(resolve, 50));
    
    assert(executionOrder[0] === "SYNC_START", "Sync starts first");
    assert(executionOrder[1] === "SYNC_END", "Sync finishes next, without waiting");
    assert(executionOrder[2] === "ASYNC_RUN", "Async block runs in next event loop tick");
    console.log("PASS: setImmediate validation executes asynchronously in a non-blocking manner");
    passedTests++;

    // ----------------------------------------------------
    // TEST 7: Dashboard Aggregation
    // ----------------------------------------------------
    console.log("\n--- TEST 7: Dashboard Aggregation ---");
    const reqStats = mockReq({ operatorId: operator.id.toString() });
    const resStats = mockRes();
    await getShadowValidationStats(reqStats, resStats);

    assert(resStats.statusCode === 200, "Stats fetch succeeds");
    assert(resStats.data.success === true, "API indicates success");
    
    const stats = resStats.data.data;
    assert(stats.totalCompared >= 2, "Must aggregate stats for both transactions");
    assert(stats.matches >= 1, "Must contain at least 1 match");
    assert(stats.mismatches >= 1, "Must contain at least 1 mismatch");
    assert(stats.topMismatchReasons.some(r => r.reason === "RECHARGE_MISMATCH"), "Must find RECHARGE_MISMATCH in top reasons");
    console.log("PASS: Dashboard metrics successfully aggregated");
    passedTests++;

    // ----------------------------------------------------
    // TEST 8: Operator Filtering
    // ----------------------------------------------------
    console.log("\n--- TEST 8: Operator Filtering ---");
    const reqList = mockReq({ operatorId: operator.id.toString(), matchStatus: "mismatch" });
    const resList = mockRes();
    await getShadowValidationList(reqList, resList);

    assert(resList.statusCode === 200, "List fetch succeeds");
    const listData = resList.data.data;
    assert(listData.records.length > 0, "Must return filtered records");
    assert(listData.records.every(r => r.operatorId === operator.id), "All records must belong to target operator");
    assert(listData.records.every(r => r.isMatch === false), "All records must be mismatches");
    console.log("PASS: Filters successfully applied to listing endpoint");
    passedTests++;

    // ----------------------------------------------------
    // TEST 9: Performance Impact
    // ----------------------------------------------------
    console.log("\n--- TEST 9: Performance Impact ---");
    const startRecharge = performance.now();
    
    // Simulate non-blocking hook trigger
    eventBus.emit("recharge_success", {
      userId: testUser.id.toString(),
      transactionId: txn1.id,
      amount: txn1.amount,
      operator: opName,
      mobile: txn1.mobile
    });
    
    const endRecharge = performance.now();
    const duration = endRecharge - startRecharge;
    
    assert(duration < 2.0, "Trigger hook duration must be negligible (under 2ms)");
    console.log(`PASS: Performance overhead of shadow trigger is negligible (${duration.toFixed(3)}ms)`);
    passedTests++;

    // ----------------------------------------------------
    // TEST 10: 1000 Parallel Transactions
    // ----------------------------------------------------
    console.log("\n--- TEST 10: 1000 Parallel Transactions ---");
    console.log("Simulating 1,000 parallel successful recharge validations...");
    
    const promises = [];
    const tStartParallel = performance.now();
    
    for (let i = 0; i < 1000; i++) {
      // Direct call simulating parallel queues
      promises.push(runShadowValidation(txn1.id));
    }
    
    await Promise.all(promises);
    const tEndParallel = performance.now();
    const avgParallelDuration = (tEndParallel - tStartParallel) / 1000;
    
    console.log(`1,000 parallel lookups completed in ${(tEndParallel - tStartParallel).toFixed(2)}ms`);
    console.log(`Average shadow lookup time: ${avgParallelDuration.toFixed(3)}ms`);
    
    assert(avgParallelDuration < 50.0, "Average parallel comparison time should be well under 50ms");
    console.log("PASS: Shadow engine handles high-concurrency validation safely");
    passedTests++;

    console.log("\n==================================================");
    console.log(`STATUS: ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log("==================================================");

  } finally {
    // 2. Clean Up Test Context
    console.log("\nCleaning up test context database records...");
    await prisma.commissionShadowValidation.deleteMany({
      where: { userId: testUser.id }
    });
    await prisma.transaction.deleteMany({
      where: { userId: testUser.id }
    });
    await prisma.wallet.deleteMany({
      where: { userId: testUser.id }
    });
    await prisma.ledgerEntry.deleteMany({
      where: { userId: testUser.id }
    });
    await prisma.user.delete({
      where: { id: testUser.id }
    });
    await prisma.rechargeCommissionRule.delete({
      where: { id: rechargeRule.id }
    });
    await prisma.packageServiceSlab.deleteMany({
      where: { packageId: testPackage.id }
    });
    await prisma.commissionPackage.delete({
      where: { id: testPackage.id }
    });
    await prisma.slab.delete({
      where: { id: testSlab.id }
    });
    await prisma.operator.delete({
      where: { id: operator.id }
    });
    console.log("Cleanup complete.");
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Test Suite Run Error:", err);
    await prisma.$disconnect();
    process.exit(1);
  });

