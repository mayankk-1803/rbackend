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

async function verifyReadOnly() {
  console.log("==========================================================================");
  console.log("STARTING SIMULATOR READ-ONLY VERIFICATION SCRIPT");
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
    // 1. Capture counts/states before simulation
    const txnBefore = await prisma.transaction.count();
    const ledgerBefore = await prisma.ledgerEntry.count();
    const walletBefore = await prisma.wallet.count();
    const auditBefore = await prisma.routingAuditLog.count();
    const rulesBefore = await prisma.routingRule.count();
    const providersBefore = await prisma.provider.count();
    const configBefore = await prisma.routingConfig.findUnique({ where: { id: 1 } });
    const configVersionBefore = configBefore ? configBefore.currentVersion : 1;

    // 2. Execute a simulated request using simulateRoute controller
    console.log("\nExecuting Route Simulation...");
    const section = await prisma.serviceSection.findFirst({ where: { code: "RECHARGE" } });
    const operator = await prisma.operator.findFirst({ where: { name: "Airtel" } });

    const reqMock = {
      body: {
        sectionId: section?.id || 1,
        operatorId: operator?.id || 1,
        circleId: 1,
        amount: 250.0,
        serviceType: "RECHARGE"
      },
      user: { id: 999, role: "SUPER_ADMIN" }
    };

    let responseData = null;
    const resMock = {
      status: (code) => {
        console.error(`Mock response status: ${code}`);
        return resMock;
      },
      json: (data) => {
        responseData = data;
        return resMock;
      }
    };

    await ops.simulateRoute(reqMock, resMock);

    assert(responseData && responseData.success === true, "Simulation API response success was true");
    if (responseData && responseData.data) {
      console.log("Simulation Result Output:", JSON.stringify(responseData.data));
    }

    // 3. Capture counts/states after simulation
    const txnAfter = await prisma.transaction.count();
    const ledgerAfter = await prisma.ledgerEntry.count();
    const walletAfter = await prisma.wallet.count();
    const auditAfter = await prisma.routingAuditLog.count();
    const rulesAfter = await prisma.routingRule.count();
    const providersAfter = await prisma.provider.count();
    const configAfter = await prisma.routingConfig.findUnique({ where: { id: 1 } });
    const configVersionAfter = configAfter ? configAfter.currentVersion : 1;

    // 4. Assertions
    assert(txnBefore === txnAfter, `Transaction count unchanged (${txnBefore} === ${txnAfter})`);
    assert(ledgerBefore === ledgerAfter, `Ledger entry count unchanged (${ledgerBefore} === ${ledgerAfter})`);
    assert(walletBefore === walletAfter, `Wallet count unchanged (${walletBefore} === ${walletAfter})`);
    assert(auditBefore === auditAfter, `Routing audit log count unchanged (${auditBefore} === ${auditAfter})`);
    assert(rulesBefore === rulesAfter, `Routing rules count unchanged (${rulesBefore} === ${rulesAfter})`);
    assert(providersBefore === providersAfter, `Providers count unchanged (${providersBefore} === ${providersAfter})`);
    assert(configVersionBefore === configVersionAfter, `RoutingConfig version unchanged (${configVersionBefore} === ${configVersionAfter})`);

  } catch (err) {
    console.error("Simulation test threw an error:", err);
    failed++;
  } finally {
    await prisma.$disconnect();
    console.log("\n==========================================================================");
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log("==========================================================================");
    process.exit(failed > 0 ? 1 : 0);
  }
}

verifyReadOnly();
