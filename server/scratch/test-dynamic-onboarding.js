import dotenv from "dotenv";
import http from "http";
import prisma from "../src/config/prisma.js";
import { getProvider, isSupported } from "../src/services/providers/providerFactory.js";
import providerService from "../src/services/providerService.js";
import { resolveRoute } from "../src/services/routingEngine/routingEngine.js";
import { handleProviderWebhook } from "../src/controllers/webhookController.js";

dotenv.config();

// Create a local mock server to handle provider requests in offline sandbox
const PORT = 9099;
const mockServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });

  if (req.url.startsWith("/balance")) {
    res.end(JSON.stringify({ success: true, balance: 12500.50 }));
  } else if (req.url.startsWith("/status")) {
    res.end(JSON.stringify({ success: true, status: "SUCCESS" }));
  } else {
    res.end(JSON.stringify({ success: true, message: "Mock server active" }));
  }
});

async function runTests() {
  console.log("=== STARTING DYNAMIC PROVIDER ADAPTER INTEGRATION TESTS ===");
  const providerCode = "MOCK_PROVIDER";

  // Start mock server
  await new Promise((resolve) => mockServer.listen(PORT, "127.0.0.1", resolve));
  console.log(`[MOCK_SERVER] Listening at http://127.0.0.1:${PORT}`);

  try {
    // 1. Clean up any stale mock provider
    await prisma.provider.deleteMany({ where: { code: providerCode } });

    // 2. Register mock provider via service
    console.log("\n[TEST 1] Registering MOCK_PROVIDER...");
    const prov = await providerService.createProvider({
      name: "Mock Dynamic Provider Node",
      code: providerCode,
      providerType: "RECHARGE",
      baseUrl: `http://127.0.0.1:${PORT}/ping`,
      apiUrl: `http://127.0.0.1:${PORT}/ping`,
      statusCheckUrl: `http://127.0.0.1:${PORT}/status?tx={txnId}`,
      balanceUrl: `http://127.0.0.1:${PORT}/balance`,
      disputeUrl: `http://127.0.0.1:${PORT}/dispute`,
      apiKey: "test-api-key",
      priority: 99,
      routeType: "Both"
    });

    console.log(` MOCK_PROVIDER created successfully! ID: ${prov.id}`);

    // Verify Telemetry Auto-Registration
    console.log("\n[TEST 2] Verifying Telemetry Auto-Registration records...");
    const healthMetrics = await prisma.providerHealthMetrics.findUnique({
      where: { providerId: prov.id }
    });
    console.log(` Health metrics seeded:`, healthMetrics);
    if (!healthMetrics || healthMetrics.healthScore !== 100) {
      throw new Error("Failed to auto-register ProviderHealthMetrics with default score");
    }

    const providerCost = await prisma.providerCost.findUnique({
      where: { providerId: prov.id }
    });
    console.log(` Provider cost seeded:`, providerCost);
    if (!providerCost) {
      throw new Error("Failed to auto-register ProviderCost record");
    }

    const healthLog = await prisma.providerHealthLog.findFirst({
      where: { providerCode }
    });
    console.log(` Provider health log seeded:`, healthLog);
    if (!healthLog) {
      throw new Error("Failed to auto-register ProviderHealthLog entry");
    }

    // 3. Verify Factory Integration
    console.log("\n[TEST 3] Verifying Factory Integration...");
    const supported = isSupported(providerCode);
    console.log(` isSupported('${providerCode}'):`, supported);
    if (!supported) {
      throw new Error("Factory does not report dynamic provider as supported");
    }

    const adapter = getProvider(providerCode);
    console.log(` resolved adapter:`, adapter.constructor.name);
    if (adapter.constructor.name !== "DynamicProviderAdapter") {
      throw new Error("Factory did not return DynamicProviderAdapter instance");
    }

    const caps = adapter.getCapabilities();
    console.log(` adapter capabilities:`, caps);

    // 4. Verify Diagnostics checks
    console.log("\n[TEST 4] Testing adapter diagnostics methods...");
    
    console.log(" Running ping()...");
    const pingRes = await adapter.ping();
    console.log(" ping response:", pingRes);
    if (!pingRes.success) throw new Error("Adapter ping check failed: " + pingRes.error);

    console.log(" Running getBalance()...");
    const balanceRes = await adapter.getBalance();
    console.log(" balance response:", balanceRes);
    if (!balanceRes.success) throw new Error("Adapter balance check failed: " + balanceRes.error);
    if (balanceRes.balance !== 12500.50) throw new Error("Unexpected balance value resolved: " + balanceRes.balance);

    console.log(" Running checkStatus()...");
    const statusRes = await adapter.checkStatus("MOCK_TX_789", "MOCK_PROV_789");
    console.log(" status response:", statusRes);
    if (!statusRes.success) throw new Error("Adapter status check failed: " + statusRes.error);

    // 5. Verify Recharge Protection (Safe Mode block)
    console.log("\n[TEST 5] Testing recharge safe-mode protection...");
    try {
      await adapter.recharge({ mobile: "9999999999", amount: 100 });
      throw new Error("Recharge execution succeeded instead of throwing error");
    } catch (rechargeErr) {
      console.log(` Recharge correctly failed with: "${rechargeErr.message}"`);
      if (rechargeErr.message !== "Dynamic recharge providers are disabled in safe mode") {
        throw new Error("Recharge failed with unexpected message: " + rechargeErr.message);
      }
    }

    // 6. Verify Webhook Safe Mode Bypass
    console.log("\n[TEST 6] Testing webhook safe-mode logging and response...");
    
    // We mock express request and response objects
    const req = {
      params: { providerCode },
      method: "POST",
      body: { txnId: "123", status: "success", operator_id: "OP123" }
    };
    
    let webhookStatus = null;
    let webhookJson = null;
    const res = {
      status: (code) => {
        webhookStatus = code;
        return {
          json: (data) => {
            webhookJson = data;
          }
        };
      }
    };

    await handleProviderWebhook(req, res);
    console.log(` Webhook status:`, webhookStatus);
    console.log(` Webhook response:`, webhookJson);
    if (webhookStatus !== 200 || !webhookJson.success || webhookJson.message !== "Webhook acknowledged") {
      throw new Error("Webhook did not respond with 200 acknowledged under safe mode rules");
    }

    // Verify no mutations happened in database (should have no transaction created)
    const tx = await prisma.transaction.findFirst({
      where: { provider: providerCode }
    });
    if (tx) {
      throw new Error("A transaction was erroneously created/updated in dynamic safe mode");
    }
    console.log(" Checked: No transaction mutations occurred.");

    // 7. Verify Routing engine safe mode bypass
    console.log("\n[TEST 7] Testing routing engine safety isolation...");
    
    // Activate provider in switch temporarily to see if routing engine resolves it but bypasses it
    await prisma.provider.update({
      where: { id: prov.id },
      data: { isActive: true, inSwitch: true }
    });
    
    // Also sync providers cache
    const { refreshProviderFactoryCache } = await import("../src/services/providers/providerFactory.js");
    await refreshProviderFactoryCache();
    
    // Resolve route matching MOCK_PROVIDER (or forcing it)
    console.log(" Resolving route...");
    const route = await resolveRoute({
      sectionId: 1,
      operatorId: 1,
      circleId: 1,
      amount: 50,
      serviceType: "RECHARGE"
    });
    console.log(` Selected Provider:`, route.selectedProvider);
    console.log(` Route reason:`, route.reason);
    console.log(` Fallback chain:`, route.fallbackChain);
    
    // Selected provider must NOT be MOCK_PROVIDER (even if we temporarily made it active and high priority)
    if (route.selectedProvider === providerCode || route.fallbackChain.includes(providerCode)) {
      throw new Error("Routing engine selected dynamic provider or put it in fallback chain under safe mode");
    }
    console.log(" Checked: Routing engine successfully bypassed dynamic provider.");

    console.log("\n=== ALL TESTS PASSED SUCCESSFULLY ===");

  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
    process.exit(1);
  } finally {
    // Close mock server
    mockServer.close();
    // 8. Clean up mock provider
    console.log("\n[TEST CLEANUP] Deleting MOCK_PROVIDER...");
    await prisma.provider.deleteMany({ where: { code: providerCode } }).catch(() => {});
    await prisma.$disconnect();
    console.log(" Cleanup completed.");
  }
}

runTests();
