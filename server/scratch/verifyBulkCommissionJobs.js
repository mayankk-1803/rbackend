import { PrismaClient } from '@prisma/client';
import {
  getBulkJobs,
  getBulkPreview,
  executeBulkJob,
  rollbackBulkJob
} from '../src/controllers/commissionAdminController.js';
import { redisClient } from '../src/config/redis.js';
import { acquireLock, releaseLock } from '../src/utils/redisLock.js';
import { checkCommissionPermission } from '../src/routes/commissionAdminRoutes.js';

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

const mockReq = (body = {}, params = {}, query = {}, user = { id: 1, role: "SUPER_ADMIN" }) => {
  return {
    body,
    params,
    query,
    user,
    ip: "127.0.0.1",
    headers: { "user-agent": "verification-script" }
  };
};

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING BULK COMMISSION JOBS VERIFICATION SUITE");
  console.log("==================================================");

  let passedTests = 0;
  const totalTests = 15;

  function assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  const suffix = Date.now();
  const opName = `OP_BULK_${suffix}`;
  const catCode = `CAT_BULK_${suffix}`;

  const operator = await prisma.operator.create({
    data: { name: opName, codes: opName, active: true }
  });
  
  const serviceCategory = await prisma.serviceCategory.create({
    data: { name: `Bulk Cat ${suffix}`, code: catCode, isActive: true }
  });

  const slabA = await prisma.slab.create({ data: { name: `SLAB_A_${suffix}` } });
  const slabB = await prisma.slab.create({ data: { name: `SLAB_B_${suffix}` } });
  const testPackage = await prisma.commissionPackage.create({ data: { name: `PKG_BULK_${suffix}` } });

  await prisma.packageServiceSlab.create({
    data: { packageId: testPackage.id, serviceCategoryId: serviceCategory.id, slabId: slabB.id }
  });

  let increaseJobId;
  let decreaseJobId;
  let replaceJobId;
  let copyJobBId;
  let copyJobCId;
  let resetJobId;
  let slabC;

  const createdRechargeRuleIds = [];
  const createdRangeRuleIds = [];

  try {
    const rechargeRule1 = await prisma.rechargeCommissionRule.create({
      data: {
        slabId: slabA.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        commissionValue: 2.0,
        status: "ACTIVE",
        version: 1
      }
    });
    createdRechargeRuleIds.push(rechargeRule1.id);

    const rechargeRule2 = await prisma.rechargeCommissionRule.create({
      data: {
        slabId: slabA.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "DISTRIBUTOR",
        commissionValue: 3.0,
        status: "ACTIVE",
        version: 1
      }
    });
    createdRechargeRuleIds.push(rechargeRule2.id);

    const rangeRule1 = await prisma.rangeCommissionRule.create({
      data: {
        slabId: slabA.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        amountFrom: 0,
        amountTo: 1000,
        mode: "GENERAL",
        commissionValue: 4.0,
        status: "ACTIVE",
        version: 1
      }
    });
    createdRangeRuleIds.push(rangeRule1.id);

    const rangeRule2 = await prisma.rangeCommissionRule.create({
      data: {
        slabId: slabA.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        amountFrom: 0,
        amountTo: 1000,
        mode: "REAL",
        commissionValue: 5.0,
        status: "ACTIVE",
        version: 1
      }
    });
    createdRangeRuleIds.push(rangeRule2.id);

    let config = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    if (!config) {
      config = await prisma.commissionConfig.create({ data: { id: 1, currentVersion: 1 } });
    }
    const startVersion = config.currentVersion;

    // ----------------------------------------------------
    // TEST 1: Preview Accuracy
    // ----------------------------------------------------
    console.log("\n--- TEST 1: Preview Accuracy ---");
    const res1 = mockRes();
    const req1 = mockReq({
      action: "INCREASE",
      ruleType: "RECHARGE",
      targetField: "COMMISSION",
      filters: { slabIds: [slabA.id] },
      params: { value: 10, valueType: "PERCENTAGE" }
    });

    await getBulkPreview(req1, res1);
    assert(res1.statusCode === 200, "Status must be 200");
    assert(res1.data.success === true, "Success must be true");
    assert(res1.data.data.affectedCount === 2, "Should affect 2 recharge rules");
    assert(res1.data.data.previewVersion === startVersion, "Preview version must match startVersion");
    
    const rec1 = res1.data.data.affectedRecords.find(r => r.ruleId === rechargeRule1.id);
    assert(rec1 !== undefined, "rechargeRule1 must be affected");
    assert(rec1.oldValue === 2.0, "Old value must be 2.0");
    assert(rec1.newValue === 2.2, "New value must be 2.2");
    assert(rec1.difference === 0.2, "Difference must be 0.2");
    console.log("PASS: Preview calculations are 100% accurate");
    passedTests++;

    // ----------------------------------------------------
    // TEST 2: Increase Action (Flat & Percentage)
    // ----------------------------------------------------
    console.log("\n--- TEST 2: Increase Action (Flat & Percentage) ---");
    const res2 = mockRes();
    const req2 = mockReq({
      action: "INCREASE",
      ruleType: "RECHARGE",
      targetField: "COMMISSION",
      filters: { slabIds: [slabA.id] },
      params: { value: 0.5, valueType: "FLAT" },
      previewVersion: startVersion
    });

    await executeBulkJob(req2, res2);
    assert(res2.statusCode === 200 && res2.data.success === true, "Execution must succeed");
    increaseJobId = res2.data.data.jobId;
    
    const uRechargeRule1 = await prisma.rechargeCommissionRule.findUnique({ where: { id: rechargeRule1.id } });
    const uRechargeRule2 = await prisma.rechargeCommissionRule.findUnique({ where: { id: rechargeRule2.id } });
    assert(uRechargeRule1.commissionValue === 2.5, "rechargeRule1 should be 2.5");
    assert(uRechargeRule2.commissionValue === 3.5, "rechargeRule2 should be 3.5");
    console.log("PASS: Increase action applied successfully");
    passedTests++;

    // ----------------------------------------------------
    // TEST 3: Decrease Action
    // ----------------------------------------------------
    console.log("\n--- TEST 3: Decrease Action ---");
    const v2 = startVersion + 1;
    const res3 = mockRes();
    const req3 = mockReq({
      action: "DECREASE",
      ruleType: "RECHARGE",
      targetField: "COMMISSION",
      filters: { slabIds: [slabA.id] },
      params: { value: 20, valueType: "PERCENTAGE" },
      previewVersion: v2
    });

    await executeBulkJob(req3, res3);
    assert(res3.statusCode === 200 && res3.data.success === true, "Execution must succeed");
    decreaseJobId = res3.data.data.jobId;

    const uuRechargeRule1 = await prisma.rechargeCommissionRule.findUnique({ where: { id: rechargeRule1.id } });
    assert(uuRechargeRule1.commissionValue === 2.0, "rechargeRule1 should be 2.0");
    console.log("PASS: Decrease action applied successfully");
    passedTests++;

    // ----------------------------------------------------
    // TEST 4: Replace Action
    // ----------------------------------------------------
    console.log("\n--- TEST 4: Replace Action ---");
    const v3 = startVersion + 2;
    const res4 = mockRes();
    const req4 = mockReq({
      action: "REPLACE",
      ruleType: "RANGE",
      targetField: "COMMISSION",
      filters: { slabIds: [slabA.id], mode: "GENERAL" },
      params: { value: 8.8888 },
      previewVersion: v3
    });

    await executeBulkJob(req4, res4);
    assert(res4.statusCode === 200 && res4.data.success === true, "Execution must succeed");
    replaceJobId = res4.data.data.jobId;

    const uRangeRule1 = await prisma.rangeCommissionRule.findUnique({ where: { id: rangeRule1.id } });
    assert(uRangeRule1.commissionValue === 8.8888, "rangeRule1 should be replaced by 8.8888");
    console.log("PASS: Replace action applied successfully");
    passedTests++;

    // ----------------------------------------------------
    // TEST 5: Copy Action (PENDING status by default)
    // ----------------------------------------------------
    console.log("\n--- TEST 5: Copy Action (PENDING status by default) ---");
    const v4 = startVersion + 3;
    const res5 = mockRes();
    const req5 = mockReq({
      action: "COPY",
      ruleType: "RECHARGE",
      targetField: "COMMISSION",
      filters: { slabIds: [slabB.id] },
      params: { sourceSlabId: slabA.id, autoActivate: false },
      previewVersion: v4
    });

    await executeBulkJob(req5, res5);
    assert(res5.statusCode === 200 && res5.data.success === true, "Execution must succeed");
    copyJobBId = res5.data.data.jobId;

    const copiedRechargeRules = await prisma.rechargeCommissionRule.findMany({
      where: { slabId: slabB.id, isDeleted: false }
    });
    assert(copiedRechargeRules.length === 2, "Should copy 2 recharge rules to slabB");
    assert(copiedRechargeRules.every(r => r.status === "PENDING"), "Copied rules must be PENDING by default");
    
    copiedRechargeRules.forEach(r => createdRechargeRuleIds.push(r.id));
    console.log("PASS: Copy action sets rules to PENDING by default");
    passedTests++;

    // ----------------------------------------------------
    // TEST 5b: Copy Action Auto-Activate (SUPER_ADMIN only)
    // ----------------------------------------------------
    console.log("\n--- TEST 5b: Copy Action Auto-Activate (SUPER_ADMIN only) ---");
    const v5 = startVersion + 4;
    slabC = await prisma.slab.create({ data: { name: `SLAB_C_${suffix}` } });

    const res5b = mockRes();
    const req5b = mockReq({
      action: "COPY",
      ruleType: "RECHARGE",
      targetField: "COMMISSION",
      filters: { slabIds: [slabC.id] },
      params: { sourceSlabId: slabA.id, autoActivate: true },
      previewVersion: v5
    }, {}, {}, { id: 1, role: "SUPER_ADMIN" });

    await executeBulkJob(req5b, res5b);
    assert(res5b.statusCode === 200 && res5b.data.success === true, "Execution must succeed");
    copyJobCId = res5b.data.data.jobId;

    const activatedRules = await prisma.rechargeCommissionRule.findMany({
      where: { slabId: slabC.id, isDeleted: false }
    });
    assert(activatedRules.length === 2, "Should copy 2 rules to slabC");
    assert(activatedRules.every(r => r.status === "ACTIVE"), "Rules must be auto-activated to ACTIVE status");

    activatedRules.forEach(r => createdRechargeRuleIds.push(r.id));
    console.log("PASS: Auto-activate copies rules directly as ACTIVE");
    passedTests++;

    // ----------------------------------------------------
    // TEST 6: Reset Action
    // ----------------------------------------------------
    console.log("\n--- TEST 6: Reset Action ---");
    const v6 = startVersion + 5;
    const res6 = mockRes();
    const req6 = mockReq({
      action: "RESET",
      ruleType: "RECHARGE",
      targetField: "COMMISSION",
      filters: { slabIds: [slabA.id] },
      params: {},
      previewVersion: v6
    });

    await executeBulkJob(req6, res6);
    assert(res6.statusCode === 200 && res6.data.success === true, "Execution must succeed");
    resetJobId = res6.data.data.jobId;

    const resetRechargeRule1 = await prisma.rechargeCommissionRule.findUnique({ where: { id: rechargeRule1.id } });
    assert(resetRechargeRule1.commissionValue === 0.0, "Reset should clear value to 0.0");
    console.log("PASS: Reset action resets values to 0.0000");
    passedTests++;

    // ----------------------------------------------------
    // TEST 7: Rollback Job (Updated & Copied rules)
    // ----------------------------------------------------
    console.log("\n--- TEST 7: Rollback Job (Updated & Copied rules) ---");
    
    // Rollback Reset job
    const res7 = mockRes();
    const req7 = mockReq({}, { id: resetJobId });

    await rollbackBulkJob(req7, res7);
    assert(res7.statusCode === 200 && res7.data.success === true, "Rollback must succeed");

    const rolledRechargeRule1 = await prisma.rechargeCommissionRule.findUnique({ where: { id: rechargeRule1.id } });
    assert(rolledRechargeRule1.commissionValue === 2.0, "Value should revert to 2.0");
    
    // Rollback Copy job B
    const res7b = mockRes();
    const req7b = mockReq({}, { id: copyJobBId });

    await rollbackBulkJob(req7b, res7b);
    assert(res7b.statusCode === 200 && res7b.data.success === true, "Rollback for slabB copy must succeed");

    const targetSlabBRules = await prisma.rechargeCommissionRule.findMany({
      where: { slabId: slabB.id, isDeleted: false }
    });
    assert(targetSlabBRules.length === 0, "Copied rules must be deleted on rollback");

    // Rollback Copy job C
    const res7c = mockRes();
    const req7c = mockReq({}, { id: copyJobCId });

    await rollbackBulkJob(req7c, res7c);
    assert(res7c.statusCode === 200 && res7c.data.success === true, "Rollback for slabC copy must succeed");

    const targetSlabCRules = await prisma.rechargeCommissionRule.findMany({
      where: { slabId: slabC.id, isDeleted: false }
    });
    assert(targetSlabCRules.length === 0, "Auto-activated copied rules must be deleted on rollback");

    console.log("PASS: Rollback reverts updates and DELETES copied rules");
    passedTests++;

    // ----------------------------------------------------
    // TEST 8: Audit Logs Wrote Correctly
    // ----------------------------------------------------
    console.log("\n--- TEST 8: Audit Logs Wrote Correctly ---");
    const previewAudits = await prisma.auditLog.findMany({ where: { action: "BULK_PREVIEW" } });
    const executeAudits = await prisma.auditLog.findMany({ where: { action: "BULK_EXECUTE" } });
    const rollbackAudits = await prisma.auditLog.findMany({ where: { action: "BULK_ROLLBACK" } });
    const autoActivateAudits = await prisma.auditLog.findMany({ where: { action: "BULK_COPY_ACTIVATION" } });

    assert(previewAudits.length > 0, "Should have BULK_PREVIEW logs");
    assert(executeAudits.length > 0, "Should have BULK_EXECUTE logs");
    assert(rollbackAudits.length > 0, "Should have BULK_ROLLBACK logs");
    assert(autoActivateAudits.length > 0, "Should have BULK_COPY_ACTIVATION logs");
    console.log("PASS: Audit Logs verified");
    passedTests++;

    // ----------------------------------------------------
    // TEST 9: History Logs Wrote Correctly
    // ----------------------------------------------------
    console.log("\n--- TEST 9: History Logs Wrote Correctly ---");
    const histories = await prisma.commissionRuleHistory.findMany({
      where: { changedById: 1 }
    });
    assert(histories.length > 0, "History logs must be recorded for bulk adjustments");
    console.log("PASS: History logs recorded successfully");
    passedTests++;

    // ----------------------------------------------------
    // TEST 10: RBAC Validation
    // ----------------------------------------------------
    console.log("\n--- TEST 10: RBAC Validation ---");
    const res10a = mockRes();
    const req10a = mockReq({
      action: "INCREASE",
      ruleType: "RECHARGE",
      targetField: "COMMISSION",
      filters: { slabIds: [slabA.id] },
      params: { value: 10, valueType: "PERCENTAGE" }
    }, {}, {}, { id: 2, role: "SUB_ADMIN" });

    await getBulkPreview(req10a, res10a);
    assert(res10a.statusCode === 200, "Sub-admin must be allowed to preview");

    let isNextCalled = false;
    const nextMock = () => { isNextCalled = true; };
    const middleware = checkCommissionPermission("write");
    
    const mockResCheck = {
      statusCode: 200,
      status: function(code) { this.statusCode = code; return this; },
      json: function(obj) { this.data = obj; return this; }
    };
    
    await middleware(
      { user: { id: 2, role: "SUB_ADMIN" } },
      mockResCheck,
      nextMock
    );
    
    assert(isNextCalled === false, "Middleware must NOT call next() for sub-admin write action");
    assert(mockResCheck.statusCode === 403, "Middleware must return 403 Forbidden");
    console.log("PASS: RBAC blocks Sub-Admins from executing updates");
    passedTests++;

    // ----------------------------------------------------
    // TEST 11: Cache Version Increment
    // ----------------------------------------------------
    console.log("\n--- TEST 11: Cache Version Increment ---");
    const configBefore = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    const versionBefore = configBefore.currentVersion;

    const res11 = mockRes();
    const req11 = mockReq({
      action: "REPLACE",
      ruleType: "RANGE",
      targetField: "COMMISSION",
      filters: { slabIds: [slabA.id], mode: "GENERAL" },
      params: { value: 3.3333 },
      previewVersion: versionBefore
    });

    await executeBulkJob(req11, res11);
    
    const configAfter = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    assert(configAfter.currentVersion === versionBefore + 1, "Config version must be incremented exactly once per execute");
    console.log("PASS: Cache version incremented exactly once");
    passedTests++;

    // ----------------------------------------------------
    // TEST 12: Transaction Rollback (No Partial Updates)
    // ----------------------------------------------------
    console.log("\n--- TEST 12: Transaction Rollback (No Partial Updates) ---");
    const activeVersion = configAfter.currentVersion;
    
    const res12 = mockRes();
    const req12 = mockReq({
      action: "COPY",
      ruleType: "RANGE",
      targetField: "COMMISSION",
      filters: { slabIds: [slabB.id] },
      params: { sourceSlabId: slabA.id, autoActivate: true },
      previewVersion: activeVersion
    });

    const duplicateRange = await prisma.rangeCommissionRule.create({
      data: {
        slabId: slabB.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        amountFrom: 500,
        amountTo: 1500,
        mode: "GENERAL",
        commissionValue: 1.0,
        status: "ACTIVE",
        version: 1
      }
    });
    createdRangeRuleIds.push(duplicateRange.id);

    await executeBulkJob(req12, res12);
    
    assert(res12.statusCode === 500, "Should return 500 error status");
    assert(res12.data.message.includes("Overlapping rule detected"), "Should throw overlap exception");

    const configAfterFail = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    assert(configAfterFail.currentVersion === activeVersion, "Config version must NOT increment on transaction fail");
    console.log("PASS: Transaction rolls back fully on failure with zero partial commits");
    passedTests++;

    // ----------------------------------------------------
    // TEST 13: Stale Preview Rejection
    // ----------------------------------------------------
    console.log("\n--- TEST 13: Stale Preview Rejection ---");
    const activeVersionCurrent = configAfterFail.currentVersion;
    
    await prisma.commissionConfig.update({
      where: { id: 1 },
      data: { currentVersion: { increment: 1 } }
    });

    const res13 = mockRes();
    const req13 = mockReq({
      action: "REPLACE",
      ruleType: "RANGE",
      targetField: "COMMISSION",
      filters: { slabIds: [slabA.id], mode: "GENERAL" },
      params: { value: 6.6666 },
      previewVersion: activeVersionCurrent
    });

    await executeBulkJob(req13, res13);
    assert(res13.statusCode === 409, "Should return 409 Conflict");
    assert(res13.data.message === "Bulk preview is stale. Please regenerate preview.", "Should return stale preview message");
    console.log("PASS: Stale preview rejected successfully");
    passedTests++;

    // ----------------------------------------------------
    // TEST 14: Concurrent Bulk Execution
    // ----------------------------------------------------
    console.log("\n--- TEST 14: Concurrent Bulk Execution ---");
    
    // Enable Mock Redis Client to test distributed lock behavior
    const originalStatus = redisClient.status;
    const originalSet = redisClient.set;
    const originalEval = redisClient.eval;

    let mockRedisStore = new Map();
    redisClient.status = "ready";
    redisClient.set = async (key, value, nx, px, ttlMs) => {
      if (nx === "NX") {
        if (mockRedisStore.has(key)) {
          return null; // Lock already exists
        }
        mockRedisStore.set(key, value);
        return "OK";
      }
      mockRedisStore.set(key, value);
      return "OK";
    };
    redisClient.eval = async (script, numKeys, key, val) => {
      if (mockRedisStore.get(key) === val) {
        mockRedisStore.delete(key);
        return 1;
      }
      return 0;
    };

    const latestVersion = (await prisma.commissionConfig.findUnique({ where: { id: 1 } })).currentVersion;
    
    // Admin A: Bulk Increase
    const resA = mockRes();
    const reqA = mockReq({
      action: "INCREASE",
      ruleType: "RECHARGE",
      targetField: "COMMISSION",
      filters: { slabIds: [slabA.id] },
      params: { value: 5, valueType: "PERCENTAGE" },
      previewVersion: latestVersion
    }, {}, {}, { id: 1, role: "SUPER_ADMIN" });

    // Admin B: Bulk Reset
    const resB = mockRes();
    const reqB = mockReq({
      action: "RESET",
      ruleType: "RECHARGE",
      targetField: "COMMISSION",
      filters: { slabIds: [slabA.id] },
      params: {},
      previewVersion: latestVersion
    }, {}, {}, { id: 1, role: "SUPER_ADMIN" });

    // Execute Admin A and Admin B concurrently
    const [resultA, resultB] = await Promise.all([
      executeBulkJob(reqA, resA).catch(err => err),
      executeBulkJob(reqB, resB).catch(err => err)
    ]);

    // One succeeds (200), one is rejected (423)
    const successRes = resA.statusCode === 200 ? resA : (resB.statusCode === 200 ? resB : null);
    const failureRes = resA.statusCode === 423 ? resA : (resB.statusCode === 423 ? resB : null);

    assert(successRes !== null, "One bulk operation must succeed");
    assert(failureRes !== null, "One bulk operation must be rejected");
    assert(failureRes.statusCode === 423, "Rejected operation must return 423 (Locked)");
    assert(failureRes.data.message === "Another bulk commission operation is currently running.", "Failure message must match lock warning");

    // Clean up mock Redis
    redisClient.status = originalStatus;
    redisClient.set = originalSet;
    redisClient.eval = originalEval;

    console.log("PASS: Concurrent bulk execution protects race conditions (one succeeds, one rejected)");
    passedTests++;

    console.log("\n==================================================");
    console.log(`STATUS: ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log("==================================================");

  } finally {
    console.log("\nCleaning up test records...");
    if (createdRechargeRuleIds.length > 0) {
      await prisma.rechargeCommissionRule.deleteMany({ where: { id: { in: createdRechargeRuleIds } } }).catch(() => {});
    }
    if (createdRangeRuleIds.length > 0) {
      await prisma.rangeCommissionRule.deleteMany({ where: { id: { in: createdRangeRuleIds } } }).catch(() => {});
    }
    
    const jobs = await prisma.bulkCommissionJob.findMany({
      where: { createdById: 1 }
    });
    const jobIds = jobs.map(j => j.id);
    if (jobIds.length > 0) {
      await prisma.bulkCommissionJobSlab.deleteMany({ where: { jobId: { in: jobIds } } }).catch(() => {});
      await prisma.bulkCommissionAudit.deleteMany({ where: { jobId: { in: jobIds } } }).catch(() => {});
      await prisma.bulkCommissionJob.deleteMany({ where: { id: { in: jobIds } } }).catch(() => {});
    }

    if (testPackage) {
      await prisma.packageServiceSlab.deleteMany({ where: { packageId: testPackage.id } }).catch(() => {});
      await prisma.commissionPackage.delete({ where: { id: testPackage.id } }).catch(() => {});
    }
    if (slabA) await prisma.slab.delete({ where: { id: slabA.id } }).catch(() => {});
    if (slabB) await prisma.slab.delete({ where: { id: slabB.id } }).catch(() => {});
    if (slabC) await prisma.slab.delete({ where: { id: slabC.id } }).catch(() => {});
    if (operator) await prisma.operator.delete({ where: { id: operator.id } }).catch(() => {});
    if (serviceCategory) await prisma.serviceCategory.delete({ where: { id: serviceCategory.id } }).catch(() => {});
    console.log("Cleanup completed.");
  }
}

runTests()
  .catch(err => {
    console.error("Test Suite Run Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
