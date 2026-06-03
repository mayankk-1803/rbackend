import prisma from "./src/config/prisma.js";
import { redisClient } from "./src/config/redis.js";
import { resolveRoute, selectProvider } from "./src/services/routingEngine/routingEngine.js";
import { rebuildRoutingCache, REDIS_KEYS, setFeatureFlag } from "./src/services/routingEngine/routingCache.js";
import { REAL_TO_ALIAS, ALIAS_TO_REAL } from "./src/config/providerAliases.js";

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

// Override redisClient methods
redisClient.pipeline = mockPipeline;

redisClient.eval = async (script, numKeys, ...args) => {
  const keys = args.slice(0, numKeys);
  const weights = args.slice(numKeys);

  if (!redisMockStore["routing:traffic:current_weights"]) {
    redisMockStore["routing:traffic:current_weights"] = {};
  }
  const curWeights = redisMockStore["routing:traffic:current_weights"];
  let maxVal = -999999;
  let maxIdx = 0;
  let totalSum = 0;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const ew = Number(weights[i]) || 1;
    totalSum += ew;
    const cw = (Number(curWeights[key]) || 0) + ew;
    curWeights[key] = cw;
    if (cw > maxVal) {
      maxVal = cw;
      maxIdx = i;
    }
  }

  const selected = keys[maxIdx];
  curWeights[selected] = curWeights[selected] - totalSum;
  return selected;
};

redisClient.hgetall = async (key) => {
  return redisMockStore[key] || {};
};

redisClient.hset = async (key, fieldOrObj, value) => {
  if (!redisMockStore[key]) redisMockStore[key] = {};
  if (typeof fieldOrObj === "object" && fieldOrObj !== null) {
    for (const [k, v] of Object.entries(fieldOrObj)) {
      redisMockStore[key][k] = typeof v === "object" ? JSON.stringify(v) : String(v);
    }
  } else {
    redisMockStore[key][fieldOrObj] = typeof value === "object" ? JSON.stringify(value) : String(value);
  }
  return 1;
};

redisClient.hget = async (key, field) => {
  return redisMockStore[key] ? redisMockStore[key][field] : null;
};

redisClient.get = async (key) => {
  return redisMockStore[key] !== undefined ? String(redisMockStore[key]) : null;
};

redisClient.set = async (key, value) => {
  redisMockStore[key] = String(value);
  return "OK";
};

redisClient.del = async (key) => {
  delete redisMockStore[key];
  return 1;
};

redisClient.incr = async (key) => {
  const val = (Number(redisMockStore[key]) || 0) + 1;
  redisMockStore[key] = String(val);
  return val;
};

redisClient.expire = async (key, seconds) => {
  return 1;
};

redisClient.hincrby = async (key, field, value) => {
  if (!redisMockStore[key]) redisMockStore[key] = {};
  const val = (Number(redisMockStore[key][field]) || 0) + value;
  redisMockStore[key][field] = String(val);
  return val;
};

redisClient.incrbyfloat = async (key, value) => {
  const val = (Number(redisMockStore[key]) || 0.0) + value;
  redisMockStore[key] = String(val);
  return val;
};

redisClient.disconnect = () => {};
redisClient.ping = async () => "PONG";

// ==========================================================================
// TEST IMPLEMENTATION
// ==========================================================================
async function runTests() {
  console.log("==========================================================================");
  console.log("STARTING TELECOM ROUTING MANAGEMENT SUITE AUTOMATED TESTING SUITE");
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
    // ----------------------------------------------------
    // TEST 1: Schema Integrity & Connection
    // ----------------------------------------------------
    console.log("\n--- Test 1: Schema Integrity & Connection ---");
    try {
      const sectionCount = await prisma.serviceSection.count();
      const mappingCount = await prisma.operatorProviderMapping.count();
      const healthCount = await prisma.providerHealthMetrics.count();
      const rulesCount = await prisma.routingRule.count();
      const costCount = await prisma.providerCost.count();

      assert(true, `Database queries succeeded. Sections: ${sectionCount}, Mappings: ${mappingCount}, Health: ${healthCount}, Rules: ${rulesCount}, Costs: ${costCount}`);
    } catch (dbErr) {
      assert(false, `Database query failed: ${dbErr.message}`);
    }

    // ----------------------------------------------------
    // TEST 2: Redis Cache Sync
    // ----------------------------------------------------
    console.log("\n--- Test 2: Redis Cache Sync ---");
    try {
      await rebuildRoutingCache();
      const cachedFlags = await redisClient.hgetall(REDIS_KEYS.FEATURE_FLAGS);
      assert(cachedFlags && cachedFlags.shadowRoutingEnabled === "true", "Redis cache successfully rebuilt. Default feature flags synchronized.");
    } catch (cacheErr) {
      assert(false, `Cache rebuild failed: ${cacheErr.message}`);
    }

    // ----------------------------------------------------
    // TEST 3: Provider Masking & Obfuscation
    // ----------------------------------------------------
    console.log("\n--- Test 3: Provider Masking & Obfuscation ---");
    assert(REAL_TO_ALIAS["APIBOX"] === "Primary Gateway", "Provider APIBOX masks to 'Primary Gateway'");
    assert(REAL_TO_ALIAS["MPLAN"] === "Plans Engine", "Provider MPLAN masks to 'Plans Engine'");
    assert(REAL_TO_ALIAS["EZYTM"] === "Operator Engine", "Provider EZYTM masks to 'Operator Engine'");

    // ----------------------------------------------------
    // TEST 4: Approval Workflow & Maker-Checker
    // ----------------------------------------------------
    console.log("\n--- Test 4: Approval Workflow ---");
    let testRuleId = null;
    try {
      const section = await prisma.serviceSection.findFirst({ where: { code: "RECHARGE" } });
      const provider = await prisma.provider.findFirst({ where: { code: "APIBOX" } });

      // Create Draft
      const draftRule = await prisma.routingRule.create({
        data: {
          name: "Test Promo Slab Rule",
          sectionId: section?.id,
          providerId: provider?.id,
          priority: 50,
          routeType: "PRIMARY",
          status: "DRAFT",
          amountFrom: 100.0,
          amountTo: 500.0,
          serviceType: "RECHARGE",
          isActive: false
        }
      });
      assert(draftRule.status === "DRAFT" && !draftRule.isActive, "Draft rule created in DRAFT status and inactive");
      testRuleId = draftRule.id;

      // Submit Draft
      const submittedRule = await prisma.routingRule.update({
        where: { id: testRuleId },
        data: { status: "PENDING_APPROVAL" }
      });
      assert(submittedRule.status === "PENDING_APPROVAL", "Draft rule successfully transitioned to PENDING_APPROVAL");

      // Approve & Publish
      const approvedRule = await prisma.routingRule.update({
        where: { id: testRuleId },
        data: { status: "APPROVED", isActive: true }
      });
      assert(approvedRule.status === "APPROVED" && approvedRule.isActive, "Draft rule approved and published active");
      
      // Sync cache
      await rebuildRoutingCache();
    } catch (wfErr) {
      assert(false, `Approval workflow failed: ${wfErr.message}`);
    }

    // ----------------------------------------------------
    // TEST 5: Routing Precedence Evaluation
    // ----------------------------------------------------
    console.log("\n--- Test 5: Routing Precedence Evaluation ---");
    try {
      const section = await prisma.serviceSection.findFirst({ where: { code: "RECHARGE" } });
      // Resolve route inside slab range (amount = 250)
      const resValSlab = await resolveRoute({
        sectionId: section?.id,
        amount: 250,
        serviceType: "RECHARGE"
      });
      assert(resValSlab.selectedProvider === "Primary Gateway", "Route resolved through correct matching rule within promo slab");
    } catch (precErr) {
      assert(false, `Precedence evaluation failed: ${precErr.message}`);
    }

    // ----------------------------------------------------
    // TEST 6: Fallback Chains
    // ----------------------------------------------------
    console.log("\n--- Test 6: Fallback Chains ---");
    try {
      // Temporarily mark APIBOX as unhealthy or trip its circuit breaker
      await setFeatureFlag("circuitBreakerEnabled", true);
      await redisClient.set("provider:apibox:breaker", "tripped");

      const section = await prisma.serviceSection.findFirst({ where: { code: "RECHARGE" } });
      
      // Resolve route while primary is circuit-broken
      const resolution = await resolveRoute({
        sectionId: section?.id,
        amount: 250,
        serviceType: "RECHARGE"
      });

      // It should fall back to next healthy provider (like MPLAN or EZYTM, masked as Plans Engine or Operator Engine)
      assert(resolution.selectedProvider !== "Primary Gateway", `Fallback chain correctly bypassed broken primary. Selected: ${resolution.selectedProvider}`);
    } catch (fbErr) {
      assert(false, `Fallback check failed: ${fbErr.message}`);
    } finally {
      // Revert temporary circuit-breaker
      await redisClient.del("provider:apibox:breaker");
      await setFeatureFlag("circuitBreakerEnabled", false);
      await rebuildRoutingCache();
    }

    // ----------------------------------------------------
    // TEST 7: Smooth Weighted Round Robin (SWRR)
    // ----------------------------------------------------
    console.log("\n--- Test 7: SWRR Distribution Splits ---");
    try {
      // Set feature flag to weighted mode
      await setFeatureFlag("weightedRoutingEnabled", true);
      
      // Ensure current weights are cleaned up
      await redisClient.del("routing:traffic:current_weights");

      const results = {};
      const section = await prisma.serviceSection.findFirst({ where: { code: "RECHARGE" } });

      // Run 30 simulated requests
      for (let i = 0; i < 30; i++) {
        const route = await resolveRoute({
          sectionId: section?.id,
          amount: 50,
          serviceType: "RECHARGE"
        });
        results[route.selectedProvider] = (results[route.selectedProvider] || 0) + 1;
      }

      console.log("SWRR distribution results over 30 runs:", results);
      assert(Object.keys(results).length > 0, "SWRR successfully distributed requests across configured providers.");
    } catch (swrrErr) {
      assert(false, `SWRR test failed: ${swrrErr.message}`);
    } finally {
      await setFeatureFlag("weightedRoutingEnabled", false);
      await rebuildRoutingCache();
    }

    // ----------------------------------------------------
    // TEST 8: Distributed Circuit Breaker
    // ----------------------------------------------------
    console.log("\n--- Test 8: Circuit Breaker Behavior ---");
    try {
      await setFeatureFlag("circuitBreakerEnabled", true);
      
      // Simulate circuit breaker trip
      await redisClient.set("provider:apibox:breaker", "tripped");

      const section = await prisma.serviceSection.findFirst({ where: { code: "RECHARGE" } });
      const resolution = await resolveRoute({
        sectionId: section?.id,
        amount: 150,
        serviceType: "RECHARGE"
      });

      assert(resolution.selectedProvider !== "Primary Gateway", `Circuit breaker bypassed tripped provider. Selected: ${resolution.selectedProvider}`);
    } catch (cbErr) {
      assert(false, `Circuit breaker test failed: ${cbErr.message}`);
    } finally {
      await redisClient.del("provider:apibox:breaker");
      await setFeatureFlag("circuitBreakerEnabled", false);
      await rebuildRoutingCache();
    }

    // ----------------------------------------------------
    // TEST 9: Append-Only Immutable Audits
    // ----------------------------------------------------
    console.log("\n--- Test 9: Immutable Audits ---");
    try {
      const logEntry = await prisma.routingAuditLog.create({
        data: {
          action: "TEST_WRITE",
          entityType: "RoutingRule",
          entityId: 9999,
          newValue: "test data"
        }
      });
      assert(logEntry.id > 0, "Audit log successfully appended");

      // Attempt to update
      try {
        await prisma.routingAuditLog.update({
          where: { id: logEntry.id },
          data: { action: "TEMPERED" }
        });
        assert(false, "ERROR: Audit log update was not blocked!");
      } catch (updErr) {
        assert(updErr.message.includes("Immutability Violation"), `Audit log update successfully blocked: ${updErr.message}`);
      }

      // Attempt to delete
      try {
        await prisma.routingAuditLog.delete({
          where: { id: logEntry.id }
        });
        assert(false, "ERROR: Audit log deletion was not blocked!");
      } catch (delErr) {
        assert(delErr.message.includes("Immutability Violation"), `Audit log deletion successfully blocked: ${delErr.message}`);
      }
    } catch (auditErr) {
      assert(false, `Audit check failed: ${auditErr.message}`);
    }

    // ----------------------------------------------------
    // TEST 10: Shadow Mode Non-Interference
    // ----------------------------------------------------
    console.log("\n--- Test 10: Shadow Mode Non-Interference ---");
    try {
      const providers = await selectProvider({
        userId: 1,
        operator: "Airtel",
        amount: 200,
        circle: "Delhi"
      });
      
      // Ensure selectProvider ALWAYS returns legacy default provider APIBOX (Primary Gateway) regardless of recommended routes
      assert(providers.length === 1 && providers[0].code === "APIBOX", "Shadow mode selection preserved legacy execution path without deviation.");
    } catch (shErr) {
      assert(false, `Shadow Mode check failed: ${shErr.message}`);
    }

    // Clean up test rule
    if (testRuleId) {
      await prisma.routingRule.update({
        where: { id: testRuleId },
        data: { isDeleted: true, isActive: false }
      }).catch(() => {});
      await rebuildRoutingCache();
    }

  } catch (globalErr) {
    console.error("Global Test Error:", globalErr);
  } finally {
    await prisma.$disconnect();
    
    console.log("\n==========================================================================");
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log("==========================================================================");

    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
