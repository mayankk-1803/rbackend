import { PrismaClient } from '@prisma/client';
import {
  getRangeRules,
  createRangeRule,
  updateRangeRule,
  deleteRangeRule,
  cloneRangeRule,
  approveRangeRule,
  rejectRangeRule
} from '../src/controllers/commissionAdminController.js';
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
    headers: { "user-agent": "range-verification-script" }
  };
};

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING RANGE COMMISSION RULES VERIFICATION TEST SUITE");
  console.log("==================================================");

  // Setup test catalogs
  const testSlab = await prisma.slab.findFirst({ where: { isDeleted: false } });
  const testOperator = await prisma.operator.findFirst({ where: { active: true } });
  const testCat = await prisma.serviceCategory.findFirst({ where: { isActive: true } });

  if (!testSlab || !testOperator || !testCat) {
    throw new Error("Missing database seeds (slab, operator, or category)");
  }

  console.log(`[Setup] Slab: ${testSlab.name} (ID: ${testSlab.id})`);
  console.log(`[Setup] Operator: ${testOperator.name} (ID: ${testOperator.id})`);
  console.log(`[Setup] Service Category: ${testCat.name} (ID: ${testCat.id})`);

  // Track created rule IDs for cleanup
  const createdRuleIds = [];

  // Fetch initial config version
  let initialConfig = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
  if (!initialConfig) {
    initialConfig = await prisma.commissionConfig.create({ data: { id: 1, currentVersion: 1 } });
  }
  let lastVersion = initialConfig.currentVersion;
  console.log(`[Setup] Baseline Cache Version: ${lastVersion}`);

  try {
    // ----------------------------------------------------
    // TEST 1: Rule Creation (PENDING)
    // ----------------------------------------------------
    console.log("\n--- TEST 1: Range Rule Creation (Forced PENDING) ---");
    const res1 = mockRes();
    const rulePayload = {
      slabId: testSlab.id,
      operatorId: testOperator.id,
      serviceCategoryId: testCat.id,
      role: "RETAILER",
      amountFrom: 0,
      amountTo: 500,
      mode: "GENERAL",
      commissionType: "PERCENTAGE",
      commissionValue: 1.8,
      realCommission: 1.6,
      surchargeType: "PERCENTAGE",
      surchargeValue: 0.1,
      profitType: "PERCENTAGE",
      profitValue: 0.1,
      feeType: "FLAT",
      feeValue: 0.05,
      maxCommission: 10,
      fixedCharge: 0.5,
      effectiveFrom: new Date(Date.now() - 3600000).toISOString(), // 1 hr ago
      effectiveTo: new Date(Date.now() + 86400000 * 30).toISOString(), // 30 days later
      status: "ACTIVE" // Try to bypass status
    };

    await createRangeRule(mockReq(rulePayload), res1);
    if (res1.statusCode !== 200 || !res1.data.success) {
      throw new Error(`Failed Test 1: Creation failed: ${JSON.stringify(res1.data)}`);
    }

    const createdRule = res1.data.data;
    createdRuleIds.push(createdRule.id);
    console.log(`✔ Rule created successfully! ID: ${createdRule.id}, Stored status: ${createdRule.status}`);

    if (createdRule.status === "PENDING") {
      console.log("✔ Verified: Status forced to PENDING (Bypass protection).");
    } else {
      throw new Error(`Failed Test 1: Bypass protection failed, status was: ${createdRule.status}`);
    }

    // Verify history creation
    const historyEntry = await prisma.commissionRuleHistory.findFirst({
      where: { ruleId: createdRule.id, ruleType: "RANGE" }
    });
    if (historyEntry && historyEntry.newAmountFrom === 0 && historyEntry.newAmountTo === 500 && historyEntry.newMode === "GENERAL") {
      console.log(`✔ History entry recorded successfully! OldVal: ${historyEntry.oldValue}, NewVal: ${historyEntry.newValue}, Range: ${historyEntry.newAmountFrom}-${historyEntry.newAmountTo}`);
    } else {
      throw new Error(`Failed Test 1: History entry not found or invalid: ${JSON.stringify(historyEntry)}`);
    }

    // Verify cache version increment
    const config1 = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    if (config1.currentVersion > lastVersion) {
      console.log(`✔ Cache version incremented successfully! Version: ${config1.currentVersion}`);
      lastVersion = config1.currentVersion;
    } else {
      throw new Error(`Failed Test 1: Cache version did not increment!`);
    }

    // ----------------------------------------------------
    // TEST 2: Rule Update (Forces PENDING)
    // ----------------------------------------------------
    console.log("\n--- TEST 2: Range Rule Update (Forces status back to PENDING) ---");
    
    // First, approve the rule so it becomes ACTIVE
    await prisma.rangeCommissionRule.update({
      where: { id: createdRule.id },
      data: { status: "ACTIVE" }
    });

    const res2 = mockRes();
    const updatePayload = {
      commissionValue: 2.2,
      amountTo: 600 // Change range bound
    };

    await updateRangeRule(mockReq(updatePayload, { id: createdRule.id.toString() }), res2);
    if (res2.statusCode !== 200 || !res2.data.success) {
      throw new Error(`Failed Test 2: Update failed: ${JSON.stringify(res2.data)}`);
    }

    const updatedRule = res2.data.data;
    console.log(`✔ Rule updated successfully! ID: ${updatedRule.id}, New Status: ${updatedRule.status}, New range to: ${updatedRule.amountTo}`);

    if (updatedRule.status === "PENDING") {
      console.log("✔ Verified: Status reset to PENDING on content modification.");
    } else {
      throw new Error(`Failed Test 2: Reset to PENDING failed! Status remained: ${updatedRule.status}`);
    }

    // Verify history logs
    const historyEntries = await prisma.commissionRuleHistory.findMany({
      where: { ruleId: createdRule.id, ruleType: "RANGE" },
      orderBy: { createdAt: "desc" }
    });
    if (historyEntries.length >= 2 && historyEntries[0].oldAmountTo === 500 && historyEntries[0].newAmountTo === 600) {
      console.log("✔ Verified: History logs recorded old/new range bounds correctly.");
    } else {
      throw new Error(`Failed Test 2: History logs missing range differences: ${JSON.stringify(historyEntries)}`);
    }

    // Verify cache version increment
    const config2 = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    if (config2.currentVersion > lastVersion) {
      console.log(`✔ Cache version incremented: ${config2.currentVersion}`);
      lastVersion = config2.currentVersion;
    } else {
      throw new Error(`Failed Test 2: Cache version did not increment!`);
    }

    // Restore rule status back to ACTIVE for subsequent overlap tests
    await prisma.rangeCommissionRule.update({
      where: { id: createdRule.id },
      data: { status: "ACTIVE", amountTo: 500 } // restore amountTo to 500
    });

    // ----------------------------------------------------
    // TEST 3: Rule Clone (PENDING)
    // ----------------------------------------------------
    console.log("\n--- TEST 3: Range Rule Clone ---");
    const res3 = mockRes();
    await cloneRangeRule(mockReq({ role: "DISTRIBUTOR" }, { id: createdRule.id.toString() }), res3);
    if (res3.statusCode !== 200 || !res3.data.success) {
      throw new Error(`Failed Test 3: Clone failed: ${JSON.stringify(res3.data)}`);
    }

    const clonedRule = res3.data.data;
    createdRuleIds.push(clonedRule.id);
    console.log(`✔ Rule cloned successfully! Cloned ID: ${clonedRule.id}, Cloned status: ${clonedRule.status}`);
    
    if (clonedRule.status === "PENDING" && clonedRule.approvedById === null && clonedRule.version === 1) {
      console.log("✔ Verified: Clone reset metadata, cleared approvals, and set version to 1.");
    } else {
      throw new Error(`Failed Test 3: Cloned metadata mismatch: ${JSON.stringify(clonedRule)}`);
    }

    // Verify cache version increment
    const config3 = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    if (config3.currentVersion > lastVersion) {
      console.log(`✔ Cache version incremented: ${config3.currentVersion}`);
      lastVersion = config3.currentVersion;
    }

    // ----------------------------------------------------
    // TEST 4: Rule Approval (PENDING -> ACTIVE)
    // ----------------------------------------------------
    console.log("\n--- TEST 4: Range Rule Approval ---");
    const res4 = mockRes();
    await approveRangeRule(mockReq({ comment: "Approve cloned rule for DISTRIBUTOR" }, { id: clonedRule.id.toString() }), res4);
    if (res4.statusCode !== 200 || !res4.data.success) {
      throw new Error(`Failed Test 4: Approval failed: ${JSON.stringify(res4.data)}`);
    }

    const approvedRule = res4.data.data;
    console.log(`✔ Rule approved successfully! Status: ${approvedRule.status}`);
    if (approvedRule.status === "ACTIVE" && approvedRule.approvalComment === "Approve cloned rule for DISTRIBUTOR") {
      console.log("✔ Verified: approvedById, approvedAt, and approvalComment are mapped correctly.");
    } else {
      throw new Error(`Failed Test 4: Approved metadata mismatch: ${JSON.stringify(approvedRule)}`);
    }

    // Restore cloned rule back to PENDING and then soft delete it so it does not interfere
    await prisma.rangeCommissionRule.update({
      where: { id: clonedRule.id },
      data: { isDeleted: true, deletedAt: new Date() }
    });

    // ----------------------------------------------------
    // TEST 5: Rule Rejection
    // ----------------------------------------------------
    console.log("\n--- TEST 5: Range Rule Rejection ---");
    // Create new pending rule for rejection
    const res5a = mockRes();
    await createRangeRule(mockReq({
      slabId: testSlab.id,
      operatorId: testOperator.id,
      serviceCategoryId: testCat.id,
      role: "CUSTOMER",
      amountFrom: 1000,
      amountTo: 2000,
      mode: "GENERAL",
      commissionValue: 1.0,
      status: "PENDING"
    }), res5a);
    const rejectTargetRule = res5a.data.data;
    createdRuleIds.push(rejectTargetRule.id);

    const res5b = mockRes();
    await rejectRangeRule(mockReq({ comment: "Rejected range rule for customer" }, { id: rejectTargetRule.id.toString() }), res5b);
    if (res5b.statusCode !== 200 || !res5b.data.success) {
      throw new Error(`Failed Test 5: Rejection failed: ${JSON.stringify(res5b.data)}`);
    }

    const rejectedRule = res5b.data.data;
    console.log(`✔ Rule rejected successfully! Status: ${rejectedRule.status}`);
    if (rejectedRule.status === "REJECTED" && rejectedRule.approvalComment === "Rejected range rule for customer") {
      console.log("✔ Verified: Status set to REJECTED with rejection comment.");
    } else {
      throw new Error(`Failed Test 5: Rejection state mismatch: ${JSON.stringify(rejectedRule)}`);
    }

    // ----------------------------------------------------
    // TEST 6: Range Overlap Prevention
    // ----------------------------------------------------
    console.log("\n--- TEST 6: Range Overlap Prevention ---");
    // Active rule exists for: slabId, operatorId, serviceCategoryId, role: RETAILER, mode: GENERAL, date: overlaps, amount: 0 to 500
    // Attempting to create an overlapping rule (amount: 400 to 800) -> Should fail
    const res6 = mockRes();
    const overlapPayload = {
      slabId: testSlab.id,
      operatorId: testOperator.id,
      serviceCategoryId: testCat.id,
      role: "RETAILER",
      amountFrom: 400,
      amountTo: 800,
      mode: "GENERAL",
      commissionValue: 1.5,
      effectiveFrom: new Date(Date.now() - 3600000).toISOString(),
      effectiveTo: new Date(Date.now() + 86400000).toISOString()
    };

    console.log("Attempting to create overlapping rule [400 - 800] (expecting 400 error)...");
    await createRangeRule(mockReq(overlapPayload), res6);
    if (res6.statusCode === 400 && !res6.data.success) {
      console.log(`✔ Correctly blocked overlapping amount range! Message: "${res6.data.message}"`);
    } else {
      throw new Error(`Failed Test 6: Overlap creation wasn't blocked! status: ${res6.statusCode}, data: ${JSON.stringify(res6.data)}`);
    }

    // Non-overlapping amount (501 to 1000) -> Should succeed
    const res6b = mockRes();
    const nonOverlapPayload = {
      slabId: testSlab.id,
      operatorId: testOperator.id,
      serviceCategoryId: testCat.id,
      role: "RETAILER",
      amountFrom: 501,
      amountTo: 1000,
      mode: "GENERAL",
      commissionValue: 1.5,
      effectiveFrom: new Date(Date.now() - 3600000).toISOString(),
      effectiveTo: new Date(Date.now() + 86400000).toISOString()
    };

    console.log("Attempting to create non-overlapping rule [501 - 1000] (expecting 200 success)...");
    await createRangeRule(mockReq(nonOverlapPayload), res6b);
    if (res6b.statusCode === 200 && res6b.data.success) {
      createdRuleIds.push(res6b.data.data.id);
      console.log(`✔ Correctly allowed non-overlapping amount range! Cloned ID: ${res6b.data.data.id}`);
    } else {
      throw new Error(`Failed Test 6: Non-overlapping rule creation blocked! status: ${res6b.statusCode}, data: ${JSON.stringify(res6b.data)}`);
    }

    // ----------------------------------------------------
    // TEST 7: Date Overlap Prevention
    // ----------------------------------------------------
    console.log("\n--- TEST 7: Date Overlap Prevention ---");
    // Active rule exists for RETAILER, GENERAL, amount 0 to 500, with dates: overlaps (1 hr ago to 30 days later)
    // We create a rule with amount 0 to 500, but in a completely different date window (e.g. 40 days to 50 days later) -> Should succeed.
    const res7a = mockRes();
    const futureDatePayload = {
      slabId: testSlab.id,
      operatorId: testOperator.id,
      serviceCategoryId: testCat.id,
      role: "RETAILER",
      amountFrom: 0,
      amountTo: 500,
      mode: "GENERAL",
      commissionValue: 2.0,
      effectiveFrom: new Date(Date.now() + 86400000 * 40).toISOString(), // 40 days later
      effectiveTo: new Date(Date.now() + 86400000 * 50).toISOString() // 50 days later
    };

    console.log("Creating rule with non-overlapping future date window (expecting 200 success)...");
    await createRangeRule(mockReq(futureDatePayload), res7a);
    if (res7a.statusCode === 200 && res7a.data.success) {
      createdRuleIds.push(res7a.data.data.id);
      console.log(`✔ Correctly allowed rule with non-overlapping dates! ID: ${res7a.data.data.id}`);
    } else {
      throw new Error(`Failed Test 7: Non-overlapping date rule blocked! status: ${res7a.statusCode}, data: ${JSON.stringify(res7a.data)}`);
    }

    // Try creating a rule with overlapping dates and amount -> Should fail.
    const res7b = mockRes();
    const overlappingDatePayload = {
      slabId: testSlab.id,
      operatorId: testOperator.id,
      serviceCategoryId: testCat.id,
      role: "RETAILER",
      amountFrom: 0,
      amountTo: 500,
      mode: "GENERAL",
      commissionValue: 2.0,
      effectiveFrom: new Date(Date.now() + 86400000 * 10).toISOString(), // 10 days later (overlaps 1hr ago - 30 days later)
      effectiveTo: new Date(Date.now() + 86400000 * 20).toISOString()
    };

    console.log("Creating rule with overlapping date window (expecting 400 fail)...");
    await createRangeRule(mockReq(overlappingDatePayload), res7b);
    if (res7b.statusCode === 400 && !res7b.data.success) {
      console.log(`✔ Correctly blocked overlapping date range! Message: "${res7b.data.message}"`);
    } else {
      throw new Error(`Failed Test 7: Overlapping date rule was not blocked! status: ${res7b.statusCode}, data: ${JSON.stringify(res7b.data)}`);
    }

    // ----------------------------------------------------
    // TEST 8: Audit Logging
    // ----------------------------------------------------
    console.log("\n--- TEST 8: Audit Log Verification ---");
    const actions = ["RANGE_RULE_CREATE", "RANGE_RULE_UPDATE", "RANGE_RULE_CLONE", "RANGE_RULE_APPROVE", "RANGE_RULE_REJECT"];
    const logs = await prisma.auditLog.findMany({
      where: { action: { in: actions } }
    });
    console.log(`Found ${logs.length} Range rule audit logs in database.`);
    const foundActions = logs.map(l => l.action);
    const missing = actions.filter(a => !foundActions.includes(a));
    if (missing.length === 0) {
      console.log("✔ Verified: Audit logs exist for all Range rule actions.");
    } else {
      throw new Error(`Missing expected range audit actions: ${missing.join(", ")}`);
    }

    // ----------------------------------------------------
    // TEST 11: RBAC Enforcement
    // ----------------------------------------------------
    console.log("\n--- TEST 11: RBAC Protection (SUB_ADMIN Read-Only) ---");
    const originalRole = (await prisma.user.findUnique({ where: { id: 1 }, select: { commissionRole: true } })).commissionRole;
    await prisma.user.update({ where: { id: 1 }, data: { commissionRole: "SUB_ADMIN" } });

    try {
      const mockMiddlewareReq = {
        user: { id: 1, role: "ADMIN" } // JWT role admin
      };
      
      const middlewareWrite = checkCommissionPermission("write");
      const mockMiddlewareResWrite = mockRes();
      let nextWriteCalled = false;
      await middlewareWrite(mockMiddlewareReq, mockMiddlewareResWrite, () => { nextWriteCalled = true; });

      if (mockMiddlewareResWrite.statusCode === 403 && !nextWriteCalled) {
        console.log("✔ Correctly blocked write action for SUB_ADMIN role: returned 403 Forbidden");
      } else {
        throw new Error(`RBAC failure: SUB_ADMIN was not blocked from writing! status: ${mockMiddlewareResWrite.statusCode}`);
      }

      const middlewareRead = checkCommissionPermission("read");
      const mockMiddlewareResRead = mockRes();
      let nextReadCalled = false;
      await middlewareRead(mockMiddlewareReq, mockMiddlewareResRead, () => { nextReadCalled = true; });

      if (nextReadCalled && mockMiddlewareResRead.statusCode === 200) {
        console.log("✔ Correctly permitted read action for SUB_ADMIN role.");
      } else {
        throw new Error(`RBAC failure: SUB_ADMIN was blocked from reading! status: ${mockMiddlewareResRead.statusCode}`);
      }
    } finally {
      await prisma.user.update({ where: { id: 1 }, data: { commissionRole: originalRole } });
    }

    // ----------------------------------------------------
    // TEST 12: Concurrent Approval Protection
    // ----------------------------------------------------
    console.log("\n--- TEST 12: Concurrent Approval Protection ---");
    // Create new PENDING rule
    const res12a = mockRes();
    await createRangeRule(mockReq({
      slabId: testSlab.id,
      operatorId: testOperator.id,
      serviceCategoryId: testCat.id,
      role: "RETAILER",
      amountFrom: 3000,
      amountTo: 4000,
      mode: "GENERAL",
      commissionValue: 3.5,
      status: "PENDING"
    }), res12a);
    const concurrentTargetRule = res12a.data.data;
    createdRuleIds.push(concurrentTargetRule.id);

    console.log(`Spawning 10 concurrent approval requests for Rule ID: ${concurrentTargetRule.id}...`);
    const approvePromises = [];
    const approveResponses = [];

    for (let i = 0; i < 10; i++) {
      const res = mockRes();
      approveResponses.push(res);
      approvePromises.push(
        approveRangeRule(
          mockReq({ comment: `Concurrent Approver ${i + 1}` }, { id: concurrentTargetRule.id.toString() }, {}, { id: 1 + i, role: "SUPER_ADMIN" }),
          res
        )
      );
    }

    await Promise.all(approvePromises);

    let successCount = 0;
    let failCount = 0;

    approveResponses.forEach((res, idx) => {
      if (res.statusCode === 200 && res.data?.success) {
        successCount++;
      } else {
        failCount++;
      }
    });

    console.log(`Approval results summary: Successes: ${successCount}, Failures: ${failCount}`);
    if (successCount === 1 && failCount === 9) {
      console.log("✔ TEST 12 PASSED: Exactly 1 approval succeeded and 9 failed (Race Protection active).");
    } else {
      throw new Error(`Failed Test 12: Concurrency counts invalid. Success: ${successCount}, Failures: ${failCount}`);
    }

    // ----------------------------------------------------
    // TEST 13: Scale Performance Test (10,000+ Range Rules)
    // ----------------------------------------------------
    console.log("\n--- TEST 13: Scale Performance Test (10,000+ Range Rules) ---");
    console.log("Generating 10,000 range rules dynamically in bulk...");
    
    const performanceRules = [];
    const batchSize = 10000;
    
    for (let i = 0; i < batchSize; i++) {
      performanceRules.push({
        slabId: testSlab.id,
        operatorId: testOperator.id,
        serviceCategoryId: testCat.id,
        amountFrom: i * 10,
        amountTo: (i + 1) * 10 - 1,
        role: "RETAILER",
        mode: "GENERAL",
        commissionType: "PERCENTAGE",
        commissionValue: 1.0 + (i % 100) / 100,
        realCommission: 0.9 + (i % 100) / 100,
        surchargeType: "FLAT",
        surchargeValue: 0,
        profitType: "PERCENTAGE",
        profitValue: 0.1,
        feeType: "PERCENTAGE",
        feeValue: 0,
        status: "ACTIVE",
        version: 1,
        isDeleted: false
      });
    }

    const tStartInsert = Date.now();
    const insertResult = await prisma.rangeCommissionRule.createMany({
      data: performanceRules
    });
    const tEndInsert = Date.now();
    console.log(`✔ Bulk inserted ${insertResult.count} range rules in ${(tEndInsert - tStartInsert)}ms.`);

    // Perform a paginated lookup request and measure response time
    console.log("Measuring paginated listing request latency...");
    const resPage1 = mockRes();
    const tStartQuery1 = Date.now();
    await getRangeRules(mockReq({}, {}, { page: "1", limit: "15" }), resPage1);
    const tEndQuery1 = Date.now();
    const latencyQuery1 = tEndQuery1 - tStartQuery1;

    console.log(`Response status: ${resPage1.statusCode}`);
    console.log(`Page 1 query completed in ${latencyQuery1}ms.`);
    if (resPage1.statusCode === 200 && resPage1.data?.success) {
      console.log(`✔ Query fetched successfully! Total entries in DB: ${resPage1.data.data.pagination.total}`);
    } else {
      throw new Error(`Failed to query page 1: ${JSON.stringify(resPage1.data)}`);
    }

    // Perform deep pagination query (e.g. Page 100)
    console.log("Measuring deep page query (Page 100)...");
    const resPage100 = mockRes();
    const tStartQuery100 = Date.now();
    await getRangeRules(mockReq({}, {}, { page: "100", limit: "15" }), resPage100);
    const tEndQuery100 = Date.now();
    const latencyQuery100 = tEndQuery100 - tStartQuery100;
    console.log(`Page 100 query completed in ${latencyQuery100}ms.`);

    // Perform operator filtered query
    console.log("Measuring operator filtered query...");
    const resFiltered = mockRes();
    const tStartQueryFiltered = Date.now();
    await getRangeRules(mockReq({}, {}, { operatorId: testOperator.id.toString(), limit: "15" }), resFiltered);
    const tEndQueryFiltered = Date.now();
    const latencyQueryFiltered = tEndQueryFiltered - tStartQueryFiltered;
    console.log(`Filtered query completed in ${latencyQueryFiltered}ms.`);

    // Assert performant response times
    const maxThresholdMs = 150;
    if (latencyQuery1 <= maxThresholdMs && latencyQuery100 <= maxThresholdMs && latencyQueryFiltered <= maxThresholdMs) {
      console.log(`✔ SUCCESS: All queries completed well under performance threshold of ${maxThresholdMs}ms.`);
    } else {
      throw new Error(`PERFORMANCE FAILED: Latency exceeded target thresholds! Q1: ${latencyQuery1}ms, Q100: ${latencyQuery100}ms, Filtered: ${latencyQueryFiltered}ms`);
    }

    // Cleanup performance rules
    console.log("Cleaning up bulk range rules...");
    const tStartDelete = Date.now();
    const deleteResult = await prisma.rangeCommissionRule.deleteMany({
      where: {
        slabId: testSlab.id,
        operatorId: testOperator.id,
        serviceCategoryId: testCat.id,
        // Delete all active rules with RETAILER role and commissionValue != 1.8 (to spare created rule 1)
        role: "RETAILER",
        status: "ACTIVE",
        commissionValue: { not: 1.8 }
      }
    });
    const tEndDelete = Date.now();
    console.log(`✔ Bulk deleted ${deleteResult.count} performance rules in ${(tEndDelete - tStartDelete)}ms.`);

    console.log("\n==================================================");
    console.log("STATUS: ALL RANGE COMMISSION RULE TESTS PASSED!");
    console.log("==================================================");

  } finally {
    console.log("\n[Cleanup] Cleaning up created test rules and history records...");
    if (createdRuleIds.length > 0) {
      await prisma.commissionRuleHistory.deleteMany({
        where: { ruleId: { in: createdRuleIds } }
      }).catch(err => console.warn("Failed to cleanup rule histories:", err.message));

      await prisma.rangeCommissionRule.deleteMany({
        where: { id: { in: createdRuleIds } }
      }).catch(err => console.warn("Failed to cleanup range commission rules:", err.message));
    }
    console.log("[Cleanup] Completed.");
  }
}

runTests()
  .catch((e) => {
    console.error("\nTEST RUN FAILED:", e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
