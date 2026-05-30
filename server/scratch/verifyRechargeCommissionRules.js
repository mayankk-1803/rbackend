import { PrismaClient } from '@prisma/client';
import {
  getRechargeRules,
  createRechargeRule,
  updateRechargeRule,
  deleteRechargeRule,
  cloneRechargeRule,
  approveRechargeRule,
  rejectRechargeRule
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
    headers: { "user-agent": "verification-script" }
  };
};

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING RECHARGE COMMISSION RULES VERIFICATION TEST SUITE");
  console.log("==================================================");

  // Fetch a test slab
  const testSlab = await prisma.slab.findFirst({
    where: { isDeleted: false }
  });
  if (!testSlab) {
    throw new Error("No slab found in database! Run seeding first.");
  }
  console.log(`[Setup] Using Slab: ${testSlab.name} (ID: ${testSlab.id})`);

  // Fetch an active operator, seed if none exist
  let testOperator = await prisma.operator.findFirst({
    where: { active: true }
  });
  if (!testOperator) {
    console.log("[Setup] No active operators found in database. Seeding default operators...");
    await prisma.operator.createMany({
      data: [
        { name: "JIO", codes: "JIO", active: true },
        { name: "AIRTEL", codes: "AIRTEL", active: true },
        { name: "VI", codes: "VI", active: true },
        { name: "BSNL", codes: "BSNL", active: true }
      ]
    });
    testOperator = await prisma.operator.findFirst({
      where: { active: true }
    });
  }
  if (!testOperator) {
    throw new Error("No active operator found even after seeding.");
  }
  console.log(`[Setup] Using Operator: ${testOperator.name} (ID: ${testOperator.id})`);

  // Fetch first service category
  const testCat = await prisma.serviceCategory.findFirst({
    where: { isActive: true }
  });
  if (!testCat) {
    throw new Error("No active ServiceCategory found! Run seeding.");
  }
  console.log(`[Setup] Using Service Category: ${testCat.name} (ID: ${testCat.id})`);

  // We will run tests using a role like RETAILER
  const testRole = "RETAILER";
  console.log(`[Setup] Using Target Role: ${testRole}`);

  // Fetch initial cache version
  let initialConfig = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
  if (!initialConfig) {
    initialConfig = await prisma.commissionConfig.create({ data: { id: 1, currentVersion: 1 } });
  }
  let lastVersion = initialConfig.currentVersion;
  console.log(`[Setup] Initial Commission Config Version: ${lastVersion}`);

  // Tracking created rule IDs for cleanup
  const createdRuleIds = [];

  try {
    // ----------------------------------------------------
    // TEST 1: Rule Creation (PENDING)
    // ----------------------------------------------------
    console.log("\n--- TEST 1: Rule Creation (Default PENDING status) ---");
    const res1 = mockRes();
    const rulePayload = {
      slabId: testSlab.id,
      operatorId: testOperator.id,
      serviceCategoryId: testCat.id,
      role: testRole,
      commissionType: "PERCENTAGE",
      commissionValue: 2.5,
      realCommission: 2.3,
      surchargeType: "FLAT",
      surchargeValue: 0.5,
      profitType: "PERCENTAGE",
      profitValue: 0.2,
      feeType: "FLAT",
      feeValue: 0.1,
      maxCommission: 50.0,
      fixedCharge: 1.0,
      effectiveFrom: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      effectiveTo: new Date(Date.now() + 86400000 * 30).toISOString(), // 30 days later
      status: "PENDING"
    };

    await createRechargeRule(mockReq(rulePayload), res1);
    if (res1.statusCode !== 200 || !res1.data.success) {
      throw new Error(`Failed Test 1: Rule creation failed: ${JSON.stringify(res1.data)}`);
    }

    const createdRule = res1.data.data;
    createdRuleIds.push(createdRule.id);
    console.log(`✔ Rule created successfully! ID: ${createdRule.id}, Status: ${createdRule.status}`);

    // Verify history creation
    const historyEntry = await prisma.commissionRuleHistory.findFirst({
      where: { ruleId: createdRule.id, ruleType: "RECHARGE" }
    });
    if (historyEntry && historyEntry.newValue === 2.5 && historyEntry.oldValue === 0.0) {
      console.log(`✔ History entry recorded successfully! Old: ${historyEntry.oldValue}, New: ${historyEntry.newValue}`);
    } else {
      throw new Error(`Failed Test 1: History entry not found or invalid: ${JSON.stringify(historyEntry)}`);
    }

    // Verify cache version increment
    const currentConfig1 = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    if (currentConfig1.currentVersion > lastVersion) {
      console.log(`✔ Cache version incremented successfully! New Version: ${currentConfig1.currentVersion}`);
      lastVersion = currentConfig1.currentVersion;
    } else {
      throw new Error(`Failed Test 1: Cache version did not increment!`);
    }

    // ----------------------------------------------------
    // TEST 2: Rule Update
    // ----------------------------------------------------
    console.log("\n--- TEST 2: Rule Update ---");
    const res2 = mockRes();
    const updatePayload = {
      commissionValue: 3.2,
      realCommission: 3.0
    };

    await updateRechargeRule(mockReq(updatePayload, { id: createdRule.id.toString() }), res2);
    if (res2.statusCode !== 200 || !res2.data.success) {
      throw new Error(`Failed Test 2: Rule update failed: ${JSON.stringify(res2.data)}`);
    }

    const updatedRule = res2.data.data;
    console.log(`✔ Rule updated successfully! ID: ${updatedRule.id}, New Value: ${updatedRule.commissionValue}`);

    // Verify history update
    const historyEntries = await prisma.commissionRuleHistory.findMany({
      where: { ruleId: createdRule.id, ruleType: "RECHARGE" },
      orderBy: { createdAt: "desc" }
    });
    if (historyEntries.length >= 2 && historyEntries[0].oldValue === 2.5 && historyEntries[0].newValue === 3.2) {
      console.log(`✔ History update entry recorded successfully! Old: ${historyEntries[0].oldValue}, New: ${historyEntries[0].newValue}`);
    } else {
      throw new Error(`Failed Test 2: History entries invalid or missing! Total found: ${historyEntries.length}`);
    }

    // Verify cache version increment
    const currentConfig2 = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    if (currentConfig2.currentVersion > lastVersion) {
      console.log(`✔ Cache version incremented successfully! New Version: ${currentConfig2.currentVersion}`);
      lastVersion = currentConfig2.currentVersion;
    } else {
      throw new Error(`Failed Test 2: Cache version did not increment!`);
    }

    // ----------------------------------------------------
    // TEST 3: Rule Clone
    // ----------------------------------------------------
    console.log("\n--- TEST 3: Rule Clone ---");
    const res3 = mockRes();
    await cloneRechargeRule(mockReq({ role: "DISTRIBUTOR" }, { id: createdRule.id.toString() }), res3);
    if (res3.statusCode !== 200 || !res3.data.success) {
      throw new Error(`Failed Test 3: Rule clone failed: ${JSON.stringify(res3.data)}`);
    }

    const clonedRule = res3.data.data;
    createdRuleIds.push(clonedRule.id);
    console.log(`✔ Rule cloned successfully! Cloned ID: ${clonedRule.id}`);

    // Assert that cloned properties are reset/omitted correctly
    if (clonedRule.status === "PENDING" && clonedRule.approvedById === null && clonedRule.approvedAt === null && clonedRule.approvalComment === null && clonedRule.version === 1) {
      console.log("✔ Verified: Clone reset status to PENDING, cleared approvals, and set version to 1.");
    } else {
      throw new Error(`Failed Test 3: Cloned rule metadata is incorrect: ${JSON.stringify(clonedRule)}`);
    }

    // Verify cache version increment
    const currentConfig3 = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    if (currentConfig3.currentVersion > lastVersion) {
      console.log(`✔ Cache version incremented successfully! New Version: ${currentConfig3.currentVersion}`);
      lastVersion = currentConfig3.currentVersion;
    } else {
      throw new Error(`Failed Test 3: Cache version did not increment!`);
    }

    // ----------------------------------------------------
    // TEST 4: Rule Approval (PENDING -> ACTIVE)
    // ----------------------------------------------------
    console.log("\n--- TEST 4: Rule Approval ---");
    const res4 = mockRes();
    const approvalPayload = {
      comment: "Approved rule for retail slab"
    };

    await approveRechargeRule(mockReq(approvalPayload, { id: createdRule.id.toString() }), res4);
    if (res4.statusCode !== 200 || !res4.data.success) {
      throw new Error(`Failed Test 4: Rule approval failed: ${JSON.stringify(res4.data)}`);
    }

    const approvedRule = res4.data.data;
    console.log(`✔ Rule approved successfully! Status: ${approvedRule.status}`);
    if (approvedRule.status === "ACTIVE" && approvedRule.approvedById === 1 && approvedRule.approvalComment === approvalPayload.comment) {
      console.log("✔ Verified: approvedById, approvedAt, and approvalComment are mapped correctly.");
    } else {
      throw new Error(`Failed Test 4: Approved metadata mismatch: ${JSON.stringify(approvedRule)}`);
    }

    // Verify cache version increment
    const currentConfig4 = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    if (currentConfig4.currentVersion > lastVersion) {
      console.log(`✔ Cache version incremented successfully! New Version: ${currentConfig4.currentVersion}`);
      lastVersion = currentConfig4.currentVersion;
    } else {
      throw new Error(`Failed Test 4: Cache version did not increment!`);
    }

    // ----------------------------------------------------
    // TEST 5: Rule Rejection
    // ----------------------------------------------------
    console.log("\n--- TEST 5: Rule Rejection ---");
    const res5 = mockRes();
    const rejectionPayload = {
      comment: "Rejected this clone"
    };

    await rejectRechargeRule(mockReq(rejectionPayload, { id: clonedRule.id.toString() }), res5);
    if (res5.statusCode !== 200 || !res5.data.success) {
      throw new Error(`Failed Test 5: Rule rejection failed: ${JSON.stringify(res5.data)}`);
    }

    const rejectedRule = res5.data.data;
    console.log(`✔ Rule rejected successfully! Status: ${rejectedRule.status}`);
    if (rejectedRule.status === "REJECTED" && rejectedRule.approvalComment === rejectionPayload.comment) {
      console.log("✔ Verified: status set to REJECTED and rejection comments updated.");
    } else {
      throw new Error(`Failed Test 5: Rejected metadata mismatch: ${JSON.stringify(rejectedRule)}`);
    }

    // Verify cache version increment
    const currentConfig5 = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    if (currentConfig5.currentVersion > lastVersion) {
      console.log(`✔ Cache version incremented successfully! New Version: ${currentConfig5.currentVersion}`);
      lastVersion = currentConfig5.currentVersion;
    } else {
      throw new Error(`Failed Test 5: Cache version did not increment!`);
    }

    // ----------------------------------------------------
    // TEST 6: Overlap & Duplicate Prevention
    // ----------------------------------------------------
    console.log("\n--- TEST 6: Overlap / Duplicate Prevention ---");
    
    // Create another rule targeting the same slab, operator, serviceCategory, role
    const res6a = mockRes();
    const overlappingRulePayload = {
      slabId: testSlab.id,
      operatorId: testOperator.id,
      serviceCategoryId: testCat.id,
      role: testRole,
      commissionType: "PERCENTAGE",
      commissionValue: 1.0,
      effectiveFrom: new Date(Date.now() + 3600000 * 2).toISOString(), // 2 hours from now (overlaps original rule which ends in 30 days)
      effectiveTo: new Date(Date.now() + 3600000 * 10).toISOString(),
      status: "PENDING"
    };

    console.log("Creating overlapping rule (should succeed as PENDING)...");
    await createRechargeRule(mockReq(overlappingRulePayload), res6a);
    if (res6a.statusCode !== 200 || !res6a.data.success) {
      throw new Error(`Failed to create overlapping pending rule: ${JSON.stringify(res6a.data)}`);
    }

    const overlapPendingRule = res6a.data.data;
    createdRuleIds.push(overlapPendingRule.id);

    console.log("Attempting to approve overlapping rule (should fail)...");
    const res6b = mockRes();
    await approveRechargeRule(mockReq({ comment: "Should fail" }, { id: overlapPendingRule.id.toString() }), res6b);
    if (res6b.statusCode === 400 && !res6b.data.success) {
      console.log(`✔ Correctly blocked approving overlapping rule: "${res6b.data.message}"`);
    } else {
      throw new Error(`Failed Test 6: Overlap approval wasn't blocked! status: ${res6b.statusCode}, data: ${JSON.stringify(res6b.data)}`);
    }

    // ----------------------------------------------------
    // TEST 7: Audit Logging
    // ----------------------------------------------------
    console.log("\n--- TEST 7: Audit Log Verification ---");
    const actions = ["RULE_CREATE", "RULE_UPDATE", "RULE_CLONE", "RULE_APPROVE", "RULE_REJECT"];
    const logs = await prisma.auditLog.findMany({
      where: { action: { in: actions } },
      orderBy: { createdAt: "desc" }
    });

    console.log(`Found ${logs.length} Rule audit logs in database.`);
    const foundActions = logs.map(l => l.action);
    const missing = actions.filter(a => !foundActions.includes(a));

    if (missing.length === 0) {
      console.log("✔ Verified: Audit logs exist for all rule actions: CREATE, UPDATE, CLONE, APPROVE, REJECT.");
    } else {
      throw new Error(`Missing expected audit actions: ${missing.join(", ")}`);
    }

    // ----------------------------------------------------
    // TEST 8: RBAC Enforcement
    // ----------------------------------------------------
    console.log("\n--- TEST 8: RBAC Protection (SUB_ADMIN Read-Only) ---");
    
    // Set User ID 1 commissionRole to SUB_ADMIN
    const originalRole = (await prisma.user.findUnique({ where: { id: 1 }, select: { commissionRole: true } })).commissionRole;
    await prisma.user.update({ where: { id: 1 }, data: { commissionRole: "SUB_ADMIN" } });

    try {
      const mockMiddlewareReq = {
        user: { id: 1, role: "ADMIN" } // JWT Admin status
      };
      
      // Verify WRITE is blocked
      const middlewareWrite = checkCommissionPermission("write");
      const mockMiddlewareResWrite = mockRes();
      let nextWriteCalled = false;
      const mockNextWrite = () => { nextWriteCalled = true; };

      await middlewareWrite(mockMiddlewareReq, mockMiddlewareResWrite, mockNextWrite);

      if (mockMiddlewareResWrite.statusCode === 403 && !nextWriteCalled) {
        console.log("✔ Correctly blocked write action for SUB_ADMIN role: returned 403 Forbidden");
      } else {
        throw new Error(`RBAC failure: SUB_ADMIN was not blocked from writing! status: ${mockMiddlewareResWrite.statusCode}`);
      }

      // Verify READ is allowed
      const middlewareRead = checkCommissionPermission("read");
      const mockMiddlewareResRead = mockRes();
      let nextReadCalled = false;
      const mockNextRead = () => { nextReadCalled = true; };

      await middlewareRead(mockMiddlewareReq, mockMiddlewareResRead, mockNextRead);

      if (nextReadCalled && mockMiddlewareResRead.statusCode === 200) {
        console.log("✔ Correctly permitted read action for SUB_ADMIN role.");
      } else {
        throw new Error(`RBAC failure: SUB_ADMIN was blocked from reading! status: ${mockMiddlewareResRead.statusCode}`);
      }
    } finally {
      // Restore role
      await prisma.user.update({ where: { id: 1 }, data: { commissionRole: originalRole } });
    }

    // ----------------------------------------------------
    // TEST 9: Soft Delete Rule
    // ----------------------------------------------------
    console.log("\n--- TEST 9: Rule Soft Delete ---");
    const res9 = mockRes();
    await deleteRechargeRule(mockReq({}, { id: createdRule.id.toString() }), res9);
    if (res9.statusCode !== 200 || !res9.data.success) {
      throw new Error(`Failed Test 9: Rule deletion failed: ${JSON.stringify(res9.data)}`);
    }

    const deletedRuleCheck = await prisma.rechargeCommissionRule.findUnique({
      where: { id: createdRule.id }
    });
    if (deletedRuleCheck.isDeleted && deletedRuleCheck.deletedAt !== null) {
      console.log("✔ Soft delete succeeded! Database flag isDeleted=true, deletedAt is set.");
    } else {
      throw new Error(`Failed Test 9: Database state invalid: ${JSON.stringify(deletedRuleCheck)}`);
    }

    // Verify cache version increment
    const currentConfig9 = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    if (currentConfig9.currentVersion > lastVersion) {
      console.log(`✔ Cache version incremented successfully! New Version: ${currentConfig9.currentVersion}`);
      lastVersion = currentConfig9.currentVersion;
    } else {
      throw new Error(`Failed Test 9: Cache version did not increment!`);
    }

    console.log("\n==================================================");
    console.log("STATUS: ALL RECHARGE COMMISSION RULE TESTS PASSED!");
    console.log("==================================================");

  } finally {
    console.log("\n[Cleanup] Cleaning up created test rules and history records...");
    if (createdRuleIds.length > 0) {
      // Delete histories first since they reference the rule IDs (although loose relation, good to clean up)
      await prisma.commissionRuleHistory.deleteMany({
        where: { ruleId: { in: createdRuleIds } }
      }).catch(err => console.warn("Failed to cleanup rule histories:", err.message));

      // Hard delete rule entries so we do not pollute the database
      await prisma.rechargeCommissionRule.deleteMany({
        where: { id: { in: createdRuleIds } }
      }).catch(err => console.warn("Failed to cleanup recharge commission rules:", err.message));
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
