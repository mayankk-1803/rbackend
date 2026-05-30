import { PrismaClient } from '@prisma/client';
import {
  createRechargeRule,
  approveRechargeRule,
  rejectRechargeRule
} from '../src/controllers/commissionAdminController.js';

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
    headers: { "user-agent": "hardening-verification-script" }
  };
};

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING PHASE 4.1 HARDENING VERIFICATION TEST SUITE");
  console.log("==================================================");

  // Setup test catalogs
  const testSlab = await prisma.slab.findFirst({ where: { isDeleted: false } });
  const testOperator = await prisma.operator.findFirst({ where: { active: true } });
  const testCat = await prisma.serviceCategory.findFirst({ where: { isActive: true } });

  if (!testSlab || !testOperator || !testCat) {
    throw new Error("Missing database seeds (slab, operator, or category)");
  }

  const createdRuleIds = [];

  try {
    // ----------------------------------------------------
    // TEST 3: Approval Bypass Test
    // ----------------------------------------------------
    console.log("\n--- TEST 3: Approval Bypass Test ---");
    const resBypass = mockRes();
    const bypassPayload = {
      slabId: testSlab.id,
      operatorId: testOperator.id,
      serviceCategoryId: testCat.id,
      role: "CUSTOMER",
      commissionValue: 1.5,
      status: "ACTIVE" // Attempting to bypass
    };

    console.log("Creating rule with status=ACTIVE...");
    await createRechargeRule(mockReq(bypassPayload), resBypass);
    
    if (resBypass.statusCode !== 200) {
      throw new Error(`Failed to create rule: ${JSON.stringify(resBypass.data)}`);
    }

    const bypassedRule = resBypass.data.data;
    createdRuleIds.push(bypassedRule.id);
    console.log(`Created rule ID: ${bypassedRule.id}, Stored status: ${bypassedRule.status}`);

    if (bypassedRule.status === "PENDING") {
      console.log("✔ SUCCESS: Stored status was forced to PENDING.");
    } else {
      throw new Error(`Bypass protection failed! Status was stored as: ${bypassedRule.status}`);
    }

    // ----------------------------------------------------
    // TEST 1, 4, 5, 6: Concurrent Approval & Consistency Tests
    // ----------------------------------------------------
    console.log("\n--- TEST 1, 4, 5, 6: Concurrent Approval Test ---");
    
    // Create a new PENDING rule
    const resApproveInit = mockRes();
    await createRechargeRule(mockReq({
      slabId: testSlab.id,
      operatorId: testOperator.id,
      serviceCategoryId: testCat.id,
      role: "RETAILER",
      commissionValue: 2.0,
      status: "PENDING"
    }), resApproveInit);

    const approveRule = resApproveInit.data.data;
    createdRuleIds.push(approveRule.id);
    console.log(`Created PENDING rule ID: ${approveRule.id} for concurrent approvals`);

    // Fetch baseline values
    const initialConfig = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    const baselineVersion = initialConfig ? initialConfig.currentVersion : 1;
    
    const baselineAudits = await prisma.auditLog.count({
      where: { action: "RULE_APPROVE", entityId: approveRule.id }
    });

    const baselineHistory = await prisma.commissionRuleHistory.count({
      where: { ruleId: approveRule.id }
    });

    console.log(`Baseline cache version: ${baselineVersion}`);
    console.log(`Baseline audits for this rule: ${baselineAudits}`);
    console.log(`Baseline history entries for this rule: ${baselineHistory}`);

    // Spawn 10 concurrent approval requests
    console.log("\nSpawning 10 parallel approval requests...");
    const approvePromises = [];
    const approveResponses = [];

    for (let i = 0; i < 10; i++) {
      const res = mockRes();
      approveResponses.push(res);
      approvePromises.push(
        approveRechargeRule(
          mockReq({ comment: `Concurrent Approver ${i + 1}` }, { id: approveRule.id.toString() }, {}, { id: 1 + i, role: "SUPER_ADMIN" }),
          res
        )
      );
    }

    await Promise.all(approvePromises);

    let successCount = 0;
    let failCount = 0;

    approveResponses.forEach((res, index) => {
      if (res.statusCode === 200 && res.data?.success) {
        successCount++;
        console.log(`Request ${index + 1} -> SUCCESS (200)`);
      } else {
        failCount++;
        console.log(`Request ${index + 1} -> FAILED (${res.statusCode}): ${res.data?.message}`);
      }
    });

    console.log(`\nApproval results summary: Successes: ${successCount}, Failures: ${failCount}`);

    // Verification 1: Exactly 1 success, 9 failures
    if (successCount === 1 && failCount === 9) {
      console.log("✔ TEST 1 PASSED: Exactly 1 approval succeeded and 9 failed.");
    } else {
      throw new Error(`Failed Test 1: Success/Fail counts invalid. Successes: ${successCount}, Failures: ${failCount}`);
    }

    // Verification 4: Cache version increment once
    const updatedConfig = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    const newVersion = updatedConfig.currentVersion;
    console.log(`New cache version: ${newVersion}`);
    if (newVersion === baselineVersion + 1) {
      console.log("✔ TEST 4 PASSED: Cache version incremented exactly once.");
    } else {
      throw new Error(`Failed Test 4: Cache version increment mismatch. Expected: ${baselineVersion + 1}, Got: ${newVersion}`);
    }

    // Verification 5: Single audit log
    const finalAudits = await prisma.auditLog.count({
      where: { action: "RULE_APPROVE", entityId: approveRule.id }
    });
    console.log(`Final audits for this rule: ${finalAudits}`);
    if (finalAudits === baselineAudits + 1) {
      console.log("✔ TEST 5 PASSED: Exactly one RULE_APPROVE audit log was written.");
    } else {
      throw new Error(`Failed Test 5: Audit logs mismatch. Expected: ${baselineAudits + 1}, Got: ${finalAudits}`);
    }

    // Verification 6: Single rule history entry (no duplicates from failed approvals)
    const finalHistory = await prisma.commissionRuleHistory.count({
      where: { ruleId: approveRule.id }
    });
    console.log(`Final history entries for this rule: ${finalHistory}`);
    if (finalHistory === baselineHistory) {
      console.log("✔ TEST 6 PASSED: Rule history entry count is consistent (no entries written during approval).");
    } else {
      throw new Error(`Failed Test 6: Rule history entries modified. Expected: ${baselineHistory}, Got: ${finalHistory}`);
    }

    // ----------------------------------------------------
    // TEST 2: Concurrent Reject Test
    // ----------------------------------------------------
    console.log("\n--- TEST 2: Concurrent Reject Test ---");

    // Create a new PENDING rule
    const resRejectInit = mockRes();
    await createRechargeRule(mockReq({
      slabId: testSlab.id,
      operatorId: testOperator.id,
      serviceCategoryId: testCat.id,
      role: "DISTRIBUTOR",
      commissionValue: 3.0,
      status: "PENDING"
    }), resRejectInit);

    const rejectRule = resRejectInit.data.data;
    createdRuleIds.push(rejectRule.id);
    console.log(`Created PENDING rule ID: ${rejectRule.id} for concurrent rejections`);

    // Spawn 10 concurrent reject requests
    console.log("\nSpawning 10 parallel reject requests...");
    const rejectPromises = [];
    const rejectResponses = [];

    for (let i = 0; i < 10; i++) {
      const res = mockRes();
      rejectResponses.push(res);
      rejectPromises.push(
        rejectRechargeRule(
          mockReq({ comment: `Concurrent Rejecter ${i + 1}` }, { id: rejectRule.id.toString() }, {}, { id: 1 + i, role: "SUPER_ADMIN" }),
          res
        )
      );
    }

    await Promise.all(rejectPromises);

    let rejectSuccessCount = 0;
    let rejectFailCount = 0;

    rejectResponses.forEach((res, index) => {
      if (res.statusCode === 200 && res.data?.success) {
        rejectSuccessCount++;
        console.log(`Request ${index + 1} -> SUCCESS (200)`);
      } else {
        rejectFailCount++;
        console.log(`Request ${index + 1} -> FAILED (${res.statusCode}): ${res.data?.message}`);
      }
    });

    console.log(`\nRejection results summary: Successes: ${rejectSuccessCount}, Failures: ${rejectFailCount}`);

    // Verification 2: Exactly 1 success, 9 failures
    if (rejectSuccessCount === 1 && rejectFailCount === 9) {
      console.log("✔ TEST 2 PASSED: Exactly 1 rejection succeeded and 9 failed.");
    } else {
      throw new Error(`Failed Test 2: Success/Fail counts invalid. Successes: ${rejectSuccessCount}, Failures: ${rejectFailCount}`);
    }

    console.log("\n==================================================");
    console.log("STATUS: ALL PHASE 4.1 HARDENING TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================");

  } finally {
    console.log("\n[Cleanup] Cleaning up created test rules and history records...");
    if (createdRuleIds.length > 0) {
      await prisma.commissionRuleHistory.deleteMany({
        where: { ruleId: { in: createdRuleIds } }
      }).catch(err => console.warn("Failed to cleanup rule histories:", err.message));

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
