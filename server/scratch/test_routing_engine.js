import IORedis from "ioredis";

// Mock Redis connection before loading app configs to prevent connection blockages
IORedis.prototype.get = async (key) => null;
IORedis.prototype.set = async (key, value, ...args) => "OK";
IORedis.prototype.del = async (key) => 1;
IORedis.prototype.multi = function() {
  const chain = {
    incr: () => chain,
    ttl: () => chain,
    exec: async () => [[null, 1], [null, 10]]
  };
  return chain;
};
IORedis.prototype.connect = async () => {};
IORedis.prototype.sendCommand = async () => {};

import prisma from "../src/config/prisma.js";
import eventBus from "../src/config/eventBus.js";
import { selectProvider, enterpriseFeatures } from "../src/services/routingEngine/routingEngine.js";
import { recordProviderHealth } from "../src/services/telemetry/healthMonitor.js";
import { dispatchNotification } from "../src/services/whatsapp/whatsappService.js";

async function runTests() {
  console.log("====================================================");
  console.log("STARTING ENTERPRISE CONTROL & ROUTING ENGINE TESTS");
  console.log("====================================================\n");

  let testUser = await prisma.user.findFirst({ where: { role: "USER" } });
  if (!testUser) {
    console.log("[SETUP] Creating sandbox test user...");
    testUser = await prisma.user.create({
      data: {
        name: "Enterprise Test User",
        email: `ent_test_${Date.now()}@dizipay.com`,
        phone: "9876543210",
        password: "secure_password",
        role: "USER"
      }
    });
  }

  // Setup test provider APIBOX if missing
  let provider = await prisma.provider.findUnique({ where: { code: "APIBOX" } });
  if (!provider) {
    console.log("[SETUP] Inserting APIBOX provider entry...");
    provider = await prisma.provider.create({
      data: {
        code: "APIBOX",
        name: "APIBOX Recharge Gway",
        baseUrl: "https://api.apibox.in",
        apiKey: "test_key",
        isActive: true,
        priority: 100
      }
    });
  }

  // Clean old test decision logs and other mappings
  await prisma.routingDecisionLog.deleteMany({ where: { operator: "TEST_OP" } });
  await prisma.operatorMapping.deleteMany({ where: { operatorName: "TEST_OP" } });
  await prisma.routingRule.deleteMany({ where: { name: { startsWith: "Test Rule" } } });

  try {
    // ------------------------------------------------------------------------
    // TEST 1: TELEMETRY HEALTH RECORDING
    // ------------------------------------------------------------------------
    console.log("[TEST 1] Testing Telemetry Health Monitoring...");
    const latency = 150;
    await recordProviderHealth("APIBOX", "HEALTHY", latency, "Self check success");
    
    const healthLogs = await prisma.providerHealthLog.findMany({
      where: { providerCode: "APIBOX" },
      orderBy: { createdAt: "desc" },
      take: 1
    });

    if (healthLogs.length > 0 && healthLogs[0].latency === latency) {
      console.log(`✔ Health logs registered successfully! Latency match: ${healthLogs[0].latency}ms`);
    } else {
      throw new Error("Telemetry health logging mismatch");
    }

    // ------------------------------------------------------------------------
    // TEST 2: ROUTING ENGINE SHADOW SELECTION & AUDIT LOGGING
    // ------------------------------------------------------------------------
    console.log("\n[TEST 2] Testing Routing Engine Shadow Mode Decisions...");
    
    // Create an operator mapping to test dynamic shadow recommendation
    await prisma.operatorMapping.create({
      data: {
        operatorName: "TEST_OP",
        providerCode: "APIBOX",
        providerOperatorCode: "123",
        isActive: true
      }
    });

    // Invoke selectProvider
    const resolvedProviders = await selectProvider({
      userId: testUser.id,
      operator: "TEST_OP",
      amount: 100,
      circle: "ALL",
      txnId: 999999
    });

    if (resolvedProviders.length > 0 && resolvedProviders[0].code === "APIBOX") {
      console.log("✔ Routing engine returned active provider APIBOX successfully.");
    } else {
      throw new Error("Routing engine returned incorrect providers");
    }

    // Verify Shadow Logging write to DB
    const decisionLogs = await prisma.routingDecisionLog.findMany({
      where: { txnId: 999999 },
      take: 1
    });

    if (decisionLogs.length > 0 && decisionLogs[0].recommendedProvider === "APIBOX") {
      console.log(`✔ Shadow Routing Decision Log written successfully! Reason: ${decisionLogs[0].routingReason}`);
    } else {
      throw new Error("Routing decision log was not written or values mismatch");
    }

    // ------------------------------------------------------------------------
    // TEST 3: ASYNCHRONOUS WHATSAPP NOTIFIER DISPATCH
    // ------------------------------------------------------------------------
    console.log("\n[TEST 3] Testing Asynchronous WhatsApp Dispatch Flow...");
    
    // Purge old notification logs to verify fresh dispatch
    await prisma.notificationLog.deleteMany({ where: { recipient: "9876543210" } });

    await dispatchNotification({
      recipient: "9876543210",
      templateName: "recharge_success",
      variables: {
        amount: "250.00",
        mobile: "9876543210",
        operator: "JIO",
        refId: "TXN_MOCK_123"
      }
    });

    // Delay briefly to allow async notification dispatcher thread to complete db transaction
    await new Promise(resolve => setTimeout(resolve, 800));

    const notificationLogs = await prisma.notificationLog.findMany({
      where: { recipient: "9876543210" },
      take: 1
    });

    if (notificationLogs.length > 0) {
      console.log(`✔ Asynchronous WhatsApp notifier log generated! Delivery Status: ${notificationLogs[0].status}`);
      console.log(`Resolved Message Body preview: "${notificationLogs[0].response?.resolvedBody}"`);
    } else {
      throw new Error("WhatsApp notification log not generated");
    }

    console.log("\n====================================================");
    console.log("ALL ENTERPRISE ENGINE ORCHESTRATION TESTS PASSED SUCCESS!");
    console.log("====================================================");

  } finally {
    // Teardown test artifacts
    await prisma.routingDecisionLog.deleteMany({ where: { operator: "TEST_OP" } });
    await prisma.operatorMapping.deleteMany({ where: { operatorName: "TEST_OP" } });
    await prisma.notificationLog.deleteMany({ where: { recipient: "9876543210" } });
  }
}

runTests()
  .then(() => {
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ [TEST FAILURE]:", err.message);
    prisma.$disconnect();
    process.exit(1);
  });
