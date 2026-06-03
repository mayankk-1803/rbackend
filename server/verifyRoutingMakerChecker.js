import prisma from "./src/config/prisma.js";
import { redisClient } from "./src/config/redis.js";
import ops from "./src/controllers/operationsController.js";

// ==========================================================================
// IN-MEMORY REDIS CLIENT MOCK
// ==========================================================================
const redisMockStore = {};

const mockPipeline = () => {
  const commands = [];
  const p = {
    del: (key) => {
      commands.push(() => {
        delete redisMockStore[key];
      });
      return p;
    },
    hset: (key, fieldOrObj, value) => {
      commands.push(() => {
        if (!redisMockStore[key]) redisMockStore[key] = {};
        if (typeof fieldOrObj === "object" && fieldOrObj !== null) {
          for (const [k, v] of Object.entries(fieldOrObj)) {
            redisMockStore[key][k] = typeof v === "object" ? JSON.stringify(v) : String(v);
          }
        } else {
          redisMockStore[key][fieldOrObj] = typeof value === "object" ? JSON.stringify(value) : String(value);
        }
      });
      return p;
    },
    exec: async () => {
      for (const cmd of commands) cmd();
      return [];
    }
  };
  return p;
};

redisClient.pipeline = mockPipeline;
redisClient.hgetall = async (key) => redisMockStore[key] || {};
redisClient.hset = async (key, f, v) => {
  if (!redisMockStore[key]) redisMockStore[key] = {};
  redisMockStore[key][f] = String(v);
  return 1;
};
redisClient.get = async (key) => redisMockStore[key] || null;
redisClient.set = async (key, val) => {
  redisMockStore[key] = String(val);
  return "OK";
};
redisClient.del = async (key) => {
  delete redisMockStore[key];
  return 1;
};
redisClient.incr = async (key) => 1;

async function runMakerCheckerTests() {
  console.log("==========================================================================");
  console.log("STARTING ROUTING MAKER-CHECKER VERIFICATION SCRIPT");
  console.log("==========================================================================");

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  };

  try {
    const section = await prisma.serviceSection.findFirst({ where: { code: "RECHARGE" } });
    const provider = await prisma.provider.findFirst({ where: { code: "APIBOX" } });
    const configBefore = await prisma.routingConfig.findUnique({ where: { id: 1 } });
    const initialVersion = configBefore ? configBefore.currentVersion : 1;

    // 1. Create a draft routing rule
    console.log("\n1. Testing rule draft creation...");
    const reqCreate = {
      body: {
        name: "E2E Maker-Checker Test Rule",
        sectionId: section?.id || 1,
        providerId: provider?.id || 1,
        priority: 60,
        routeType: "PRIMARY",
        amountFrom: 10.0,
        amountTo: 100.0,
        serviceType: "RECHARGE"
      },
      user: { id: 80, email: "admin1@dizipay.in", role: "ADMIN" }
    };

    let createdRule = null;
    const resCreate = {
      status: (code) => resCreate,
      json: (data) => {
        createdRule = data.data;
        return resCreate;
      }
    };

    await ops.createRuleDraft(reqCreate, resCreate);
    assert(createdRule && createdRule.status === "DRAFT", "Draft rule created with DRAFT status successfully.");

    // 2. Submit the rule for approval
    console.log("\n2. Testing rule submission...");
    const reqSubmit = {
      params: { id: createdRule.id },
      user: { id: 80, email: "admin1@dizipay.in", role: "ADMIN" }
    };

    let submittedRule = null;
    const resSubmit = {
      status: (code) => resSubmit,
      json: (data) => {
        submittedRule = data.data;
        return resSubmit;
      }
    };

    await ops.submitRuleForApproval(reqSubmit, resSubmit);
    assert(submittedRule && submittedRule.status === "PENDING_APPROVAL", "Draft rule submitted and transitioned to PENDING_APPROVAL.");

    // 3. Test self-approval rejection (maker-checker rule)
    console.log("\n3. Testing maker-checker constraint (Reject self-approval)...");
    const reqSelfApprove = {
      params: { id: createdRule.id },
      user: { id: 80, email: "admin1@dizipay.in", role: "SUPER_ADMIN" } // Same user ID = 80
    };

    let selfApproveResponse = null;
    let selfApproveStatusCode = 200;
    const resSelfApprove = {
      status: (code) => {
        selfApproveStatusCode = code;
        return resSelfApprove;
      },
      json: (data) => {
        selfApproveResponse = data;
        return resSelfApprove;
      }
    };

    await ops.approveRule(reqSelfApprove, resSelfApprove);
    assert(selfApproveStatusCode === 403 && selfApproveResponse.success === false, "Self-approval correctly blocked with 403 Forbidden.");
    assert(selfApproveResponse.message.includes("Self-approval is blocked"), `Correct warning message returned: "${selfApproveResponse.message}"`);

    // 4. Approve via a different user
    console.log("\n4. Testing approval via different user...");
    const reqOtherApprove = {
      params: { id: createdRule.id },
      user: { id: 90, email: "admin2@dizipay.in", role: "SUPER_ADMIN" } // Different user ID = 90
    };

    let approvedRule = null;
    const resOtherApprove = {
      status: (code) => resOtherApprove,
      json: (data) => {
        approvedRule = data.data;
        return resOtherApprove;
      }
    };

    await ops.approveRule(reqOtherApprove, resOtherApprove);
    assert(approvedRule && approvedRule.status === "APPROVED" && approvedRule.isActive === true, "Rule successfully approved by a different user.");

    // 5. Verify version increment and audit logging
    console.log("\n5. Verifying version increment & audits...");
    const configAfter = await prisma.routingConfig.findUnique({ where: { id: 1 } });
    const finalVersion = configAfter ? configAfter.currentVersion : 1;
    assert(finalVersion > initialVersion, `RoutingConfig version successfully incremented from ${initialVersion} to ${finalVersion}`);

    const auditEntry = await prisma.routingAuditLog.findFirst({
      where: { action: "ROUTING_APPROVE", entityId: createdRule.id }
    });
    assert(auditEntry !== null, `Standard audit log successfully recorded for ROUTING_APPROVE (ID: ${auditEntry?.id})`);

    // Cleanup
    await prisma.routingRuleVersion.deleteMany({ where: { routingRuleId: createdRule.id } });
    await prisma.routingRule.delete({ where: { id: createdRule.id } });

  } catch (err) {
    console.error("Maker-Checker test threw an error:", err);
    failed++;
  } finally {
    await prisma.$disconnect();
    console.log("\n==========================================================================");
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log("==========================================================================");
    process.exit(failed > 0 ? 1 : 0);
  }
}

runMakerCheckerTests();
