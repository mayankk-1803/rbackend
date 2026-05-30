import prisma from "../src/config/prisma.js";
import { redisClient } from "../src/config/redis.js";
import { getCommissionDetails, getDeterministicBucket } from "../src/services/commissionEngine.js";

// Stub Redis client to work without a running Redis server
const redisMockStore = {};
redisClient.get = async (key) => {
  return redisMockStore[key] || null;
};
redisClient.set = async (key, value) => {
  redisMockStore[key] = String(value);
  return "OK";
};
redisClient.del = async (key) => {
  delete redisMockStore[key];
  return 1;
};
redisClient.quit = async () => {
  return "OK";
};
// Silence IORedis connection errors
redisClient.removeAllListeners("error");
redisClient.on("error", () => {});

const ANSI_GREEN = "\x1b[32m";
const ANSI_RED = "\x1b[31m";
const ANSI_RESET = "\x1b[0m";
const ANSI_BOLD = "\x1b[1m";

async function runTests() {
  console.log(ANSI_BOLD + "\n=== STARTING COMMISSION MIGRATION TEST SUITE (12 SCENARIOS) ===\n" + ANSI_RESET);

  let passedTests = 0;
  let failedTests = 0;

  const testResults = [];

  function recordResult(scenario, name, passed, details = "") {
    if (passed) {
      passedTests++;
      testResults.push({ scenario, name, status: "PASS", details });
      console.log(`${ANSI_GREEN}✔ PASS:${ANSI_RESET} [Scenario ${scenario}] ${name} ${details ? `(${details})` : ""}`);
    } else {
      failedTests++;
      testResults.push({ scenario, name, status: "FAIL", details });
      console.log(`${ANSI_RED}✘ FAIL:${ANSI_RESET} [Scenario ${scenario}] ${name} ${details ? `(${details})` : ""}`);
    }
  }

  // --- SETUP TEST RECORDS IN DATABASE ---
  console.log("Setting up test database entities...");
  
  // 1. Service Category
  const serviceCategory = await prisma.serviceCategory.upsert({
    where: { code: "RECHARGE" },
    update: { isActive: true },
    create: { code: "RECHARGE", name: "Mobile Recharge", isActive: true }
  });

  // 2. Operator
  const testOperatorName = "TEST_TEL_OP";
  const operatorObj = await prisma.operator.upsert({
    where: { name: testOperatorName },
    update: { active: true },
    create: { name: testOperatorName, codes: "TTO", active: true }
  });

  // 3. Slabs
  const legacySlab = await prisma.slab.upsert({
    where: { name: "TEST_LEGACY_SLAB" },
    update: { isActive: true, isDeleted: false, isDefault: false },
    create: { name: "TEST_LEGACY_SLAB", description: "Legacy test slab", isActive: true, isDefault: false }
  });

  const overrideSlab = await prisma.slab.upsert({
    where: { name: "TEST_OVERRIDE_SLAB" },
    update: { isActive: true, isDeleted: false, isDefault: false },
    create: { name: "TEST_OVERRIDE_SLAB", description: "Override test slab", isActive: true, isDefault: false }
  });

  const packageSlab = await prisma.slab.upsert({
    where: { name: "TEST_PACKAGE_SLAB" },
    update: { isActive: true, isDeleted: false, isDefault: false },
    create: { name: "TEST_PACKAGE_SLAB", description: "Package test slab", isActive: true, isDefault: false }
  });

  const defaultSlab = await prisma.slab.findFirst({
    where: { isDefault: true, isDeleted: false }
  }) || await prisma.slab.create({
    data: { name: "TEST_DEFAULT_SLAB", description: "Default fallback slab", isActive: true, isDefault: true }
  });

  // 4. Recharge Commission Rules (New Precedence Engine)
  // For User Slab Override
  await prisma.rechargeCommissionRule.deleteMany({
    where: { slabId: { in: [legacySlab.id, overrideSlab.id, packageSlab.id, defaultSlab.id] } }
  });
  await prisma.rangeCommissionRule.deleteMany({
    where: { slabId: { in: [legacySlab.id, overrideSlab.id, packageSlab.id, defaultSlab.id] } }
  });

  // Create general rules for slab override
  const ruleOverride = await prisma.rechargeCommissionRule.create({
    data: {
      slabId: overrideSlab.id,
      operatorId: operatorObj.id,
      serviceCategoryId: serviceCategory.id,
      role: "RETAILER",
      commissionType: "PERCENTAGE",
      commissionValue: 6.0, // 6% base commission
      profitType: "PERCENTAGE",
      profitValue: 1.5, // 1.5% profit
      status: "APPROVED"
    }
  });

  // Create rules for package slab
  const rulePackage = await prisma.rechargeCommissionRule.create({
    data: {
      slabId: packageSlab.id,
      operatorId: operatorObj.id,
      serviceCategoryId: serviceCategory.id,
      role: "RETAILER",
      commissionType: "PERCENTAGE",
      commissionValue: 4.5,
      profitType: "PERCENTAGE",
      profitValue: 1.0,
      status: "APPROVED"
    }
  });

  // Create rules for default slab
  const ruleDefault = await prisma.rechargeCommissionRule.create({
    data: {
      slabId: defaultSlab.id,
      operatorId: operatorObj.id,
      serviceCategoryId: serviceCategory.id,
      role: "RETAILER",
      commissionType: "PERCENTAGE",
      commissionValue: 3.0,
      profitType: "PERCENTAGE",
      profitValue: 0.5,
      status: "APPROVED"
    }
  });

  // Create Range Rules for default slab (amount 100 to 500)
  const rangeRuleDefault = await prisma.rangeCommissionRule.create({
    data: {
      slabId: defaultSlab.id,
      operatorId: operatorObj.id,
      serviceCategoryId: serviceCategory.id,
      amountFrom: 100.0,
      amountTo: 500.0,
      role: "RETAILER",
      commissionType: "PERCENTAGE",
      commissionValue: 5.5555,
      profitType: "PERCENTAGE",
      profitValue: 1.1111,
      status: "APPROVED"
    }
  });

  // 5. Legacy rules in commissionRule table
  await prisma.commissionRule.deleteMany({
    where: { operator: testOperatorName }
  });
  
  const legacyRule = await prisma.commissionRule.create({
    data: {
      operator: testOperatorName,
      userTier: "Standard",
      commissionPercent: 2.5,
      cashbackPercent: 2.0,
      isActive: true,
      priority: 10
    }
  });

  // 6. Packages
  const testPackage = await prisma.commissionPackage.upsert({
    where: { name: "TEST_MIGRATION_PACKAGE" },
    update: { isActive: true, isDeleted: false },
    create: { name: "TEST_MIGRATION_PACKAGE", description: "Migration test package", isActive: true }
  });

  // Package Service Slab mapping
  await prisma.packageServiceSlab.deleteMany({
    where: { packageId: testPackage.id }
  });
  await prisma.packageServiceSlab.create({
    data: {
      packageId: testPackage.id,
      serviceCategoryId: serviceCategory.id,
      slabId: packageSlab.id
    }
  });

  // 7. Users
  const testUserOverride = await prisma.user.upsert({
    where: { email: "test_override@dizipay.com" },
    update: { slabId: overrideSlab.id, packageId: null, commissionRole: "RETAILER", tier: "Standard" },
    create: {
      name: "Test Override User",
      email: "test_override@dizipay.com",
      password: "hashedPassword123",
      phone: "9999999901",
      commissionRole: "RETAILER",
      slabId: overrideSlab.id,
      tier: "Standard"
    }
  });

  const testUserPackage = await prisma.user.upsert({
    where: { email: "test_package@dizipay.com" },
    update: { slabId: null, packageId: testPackage.id, commissionRole: "RETAILER", tier: "Standard" },
    create: {
      name: "Test Package User",
      email: "test_package@dizipay.com",
      password: "hashedPassword123",
      phone: "9999999902",
      commissionRole: "RETAILER",
      packageId: testPackage.id,
      tier: "Standard"
    }
  });

  const testUserDefault = await prisma.user.upsert({
    where: { email: "test_default@dizipay.com" },
    update: { slabId: null, packageId: null, commissionRole: "RETAILER", tier: "Standard" },
    create: {
      name: "Test Default User",
      email: "test_default@dizipay.com",
      password: "hashedPassword123",
      phone: "9999999903",
      commissionRole: "RETAILER",
      tier: "Standard"
    }
  });

  console.log("Database entities set up successfully.\n");

  // ==================== SCENARIO 1 ====================
  try {
    await prisma.commissionConfig.upsert({
      where: { id: 1 },
      update: { commissionEngineVersion: "LEGACY", rolloutPercent: 0 },
      create: { id: 1, commissionEngineVersion: "LEGACY", rolloutPercent: 0 }
    });

    const res = await getCommissionDetails(100, testOperatorName, "Standard", { userId: testUserOverride.id });
    const passed = res.snapshot && res.snapshot.engine === "LEGACY" && res.commission === 2.5 && res.cashback === 2.0;
    recordResult(1, "Legacy Routing (Engine = LEGACY)", passed, `Engine: ${res.snapshot?.engine}, Comm: ${res.commission}`);
  } catch (err) {
    recordResult(1, "Legacy Routing (Engine = LEGACY)", false, err.message);
  }

  // ==================== SCENARIO 2 ====================
  try {
    await prisma.commissionConfig.update({
      where: { id: 1 },
      data: { commissionEngineVersion: "NEW", rolloutPercent: 0 }
    });

    const res = await getCommissionDetails(100, testOperatorName, "Standard", { userId: testUserOverride.id });
    const passed = res.snapshot && res.snapshot.engine === "NEW" && res.snapshot.slabSource === "USER_SLAB_OVERRIDE";
    recordResult(2, "New Routing (Engine = NEW)", passed, `Engine: ${res.snapshot?.engine}, SlabSource: ${res.snapshot?.slabSource}`);
  } catch (err) {
    recordResult(2, "New Routing (Engine = NEW)", false, err.message);
  }

  // ==================== SCENARIO 3 ====================
  try {
    await prisma.commissionConfig.update({
      where: { id: 1 },
      data: { commissionEngineVersion: "HYBRID", rolloutPercent: 10 }
    });

    // Find routing keys designed to hash to < 10 (NEW) and >= 10 (LEGACY)
    let keyForNew = null;
    let keyForLegacy = null;

    for (let i = 0; i < 1000; i++) {
      const key = `key_${i}`;
      const bucket = getDeterministicBucket(key);
      if (bucket < 10 && !keyForNew) keyForNew = key;
      if (bucket >= 10 && !keyForLegacy) keyForLegacy = key;
      if (keyForNew && keyForLegacy) break;
    }

    const resNew = await getCommissionDetails(100, testOperatorName, "Standard", { userId: testUserOverride.id, idempotencyKey: keyForNew });
    const resLegacy = await getCommissionDetails(100, testOperatorName, "Standard", { userId: testUserOverride.id, idempotencyKey: keyForLegacy });

    const passed = resNew.snapshot.engine === "NEW" && resLegacy.snapshot.engine === "LEGACY";
    recordResult(3, "Hybrid 10% Routing Determinism", passed, `Key < 10 -> ${resNew.snapshot.engine}, Key >= 10 -> ${resLegacy.snapshot.engine}`);
  } catch (err) {
    recordResult(3, "Hybrid 10% Routing Determinism", false, err.message);
  }

  // ==================== SCENARIO 4 ====================
  try {
    await prisma.commissionConfig.update({
      where: { id: 1 },
      data: { commissionEngineVersion: "HYBRID", rolloutPercent: 50 }
    });

    let keyForNew = null;
    let keyForLegacy = null;

    for (let i = 0; i < 1000; i++) {
      const key = `key_${i}`;
      const bucket = getDeterministicBucket(key);
      if (bucket < 50 && !keyForNew) keyForNew = key;
      if (bucket >= 50 && !keyForLegacy) keyForLegacy = key;
      if (keyForNew && keyForLegacy) break;
    }

    const resNew = await getCommissionDetails(100, testOperatorName, "Standard", { userId: testUserOverride.id, idempotencyKey: keyForNew });
    const resLegacy = await getCommissionDetails(100, testOperatorName, "Standard", { userId: testUserOverride.id, idempotencyKey: keyForLegacy });

    const passed = resNew.snapshot.engine === "NEW" && resLegacy.snapshot.engine === "LEGACY";
    recordResult(4, "Hybrid 50% Routing Determinism", passed, `Key < 50 -> ${resNew.snapshot.engine}, Key >= 50 -> ${resLegacy.snapshot.engine}`);
  } catch (err) {
    recordResult(4, "Hybrid 50% Routing Determinism", false, err.message);
  }

  // ==================== SCENARIO 5 ====================
  try {
    await prisma.commissionConfig.update({
      where: { id: 1 },
      data: { commissionEngineVersion: "HYBRID", rolloutPercent: 100 }
    });

    const keys = ["key_a", "key_b", "key_c", "key_d", "key_e"];
    let allNew = true;
    for (const key of keys) {
      const res = await getCommissionDetails(100, testOperatorName, "Standard", { userId: testUserOverride.id, idempotencyKey: key });
      if (res.snapshot.engine !== "NEW") {
        allNew = false;
        break;
      }
    }

    recordResult(5, "Hybrid 100% Routing", allNew, `All 5 keys routed to: ${allNew ? "NEW" : "MIXED"}`);
  } catch (err) {
    recordResult(5, "Hybrid 100% Routing", false, err.message);
  }

  // ==================== SCENARIO 6 ====================
  try {
    // Start with NEW
    await prisma.commissionConfig.update({
      where: { id: 1 },
      data: { commissionEngineVersion: "NEW" }
    });
    const res1 = await getCommissionDetails(100, testOperatorName, "Standard", { userId: testUserOverride.id });
    
    // Switch to LEGACY
    await prisma.commissionConfig.update({
      where: { id: 1 },
      data: { commissionEngineVersion: "LEGACY" }
    });
    const res2 = await getCommissionDetails(100, testOperatorName, "Standard", { userId: testUserOverride.id });

    const passed = res1.snapshot.engine === "NEW" && res2.snapshot.engine === "LEGACY";
    recordResult(6, "Instant Rollback Trigger", passed, `Initial: ${res1.snapshot.engine} -> Switched: ${res2.snapshot.engine}`);
  } catch (err) {
    recordResult(6, "Instant Rollback Trigger", false, err.message);
  }

  // ==================== SCENARIO 7 ====================
  try {
    await prisma.commissionConfig.update({
      where: { id: 1 },
      data: { commissionEngineVersion: "NEW" }
    });

    const res = await getCommissionDetails(100, testOperatorName, "Standard", { userId: testUserOverride.id });
    // User Override Slab has commissionValue = 6%
    const passed = res.snapshot.slabSource === "USER_SLAB_OVERRIDE" && res.commission === 6.0;
    recordResult(7, "Slab Override Precedence", passed, `Source: ${res.snapshot.slabSource}, Comm: ${res.commission} (Expected: 6)`);
  } catch (err) {
    recordResult(7, "Slab Override Precedence", false, err.message);
  }

  // ==================== SCENARIO 8 ====================
  try {
    const res = await getCommissionDetails(100, testOperatorName, "Standard", { userId: testUserPackage.id });
    // Package Slab has commissionValue = 4.5%
    const passed = res.snapshot.slabSource === "PACKAGE_SLAB_RESOLUTION" && res.commission === 4.5;
    recordResult(8, "Package Slab Resolution", passed, `Source: ${res.snapshot.slabSource}, Comm: ${res.commission} (Expected: 4.5)`);
  } catch (err) {
    recordResult(8, "Package Slab Resolution", false, err.message);
  }

  // ==================== SCENARIO 9 ====================
  try {
    // Default slab has Recharge rule of 3% commission, and Range rule (100 - 500) of 5.5555% commission.
    // Call with amount 200 -> should resolve to Range Rule (5.5555%)
    const resInside = await getCommissionDetails(200, testOperatorName, "Standard", { userId: testUserDefault.id });
    
    // Call with amount 50 -> should resolve to Recharge Rule (3%)
    const resOutside = await getCommissionDetails(50, testOperatorName, "Standard", { userId: testUserDefault.id });

    const passed = resInside.snapshot.ruleSource === "RANGE_RULE" && resInside.commission === 11.1110 && // 5.5555% of 200 = 11.1110
                   resOutside.snapshot.ruleSource === "RECHARGE_RULE" && resOutside.commission === 1.5; // 3% of 50 = 1.5

    recordResult(9, "Operator Range Rules Precedence", passed, `Inside range: ${resInside.snapshot.ruleSource} (Comm: ${resInside.commission}), Outside range: ${resOutside.snapshot.ruleSource} (Comm: ${resOutside.commission})`);
  } catch (err) {
    recordResult(9, "Operator Range Rules Precedence", false, err.message);
  }

  // ==================== SCENARIO 10 ===================
  try {
    // Using default user and amount 200. Range rule has 5.5555% commission and 1.1111% profit.
    const res = await getCommissionDetails(200, testOperatorName, "Standard", { userId: testUserDefault.id });
    
    // commission = 200 * 5.5555 / 100 = 11.111
    // profit = 200 * 1.1111 / 100 = 2.2222
    // cashback = commission - profit = 8.8888
    const expectedComm = Number((200 * 0.055555).toFixed(4));
    const expectedProfit = Number((200 * 0.011111).toFixed(4));
    const expectedCashback = Number((expectedComm - expectedProfit).toFixed(4));

    const checkPrecision = (val) => {
      const str = String(val);
      const dec = str.split(".")[1] || "";
      return dec.length <= 4;
    };

    const isMatch = res.commission === expectedComm && 
                    res.profit === expectedProfit && 
                    res.cashback === expectedCashback;
    
    const precisionOk = checkPrecision(res.commission) && 
                        checkPrecision(res.profit) && 
                        checkPrecision(res.cashback);

    const passed = isMatch && precisionOk;
    recordResult(10, "4-Decimal Precision & Net Retailer Earnings Mapping", passed, `Comm: ${res.commission}, Profit: ${res.profit}, Cashback: ${res.cashback}`);
  } catch (err) {
    recordResult(10, "4-Decimal Precision & Net Retailer Earnings Mapping", false, err.message);
  }

  // ==================== SCENARIO 11 ===================
  try {
    const res = await getCommissionDetails(200, testOperatorName, "Standard", { userId: testUserDefault.id });
    const snap = res.snapshot;
    const hasKeys = "engine" in snap && "winningRuleId" in snap && "slabSource" in snap &&
                    "ruleSource" in snap && "commission" in snap && "surcharge" in snap &&
                    "fee" in snap && "profit" in snap && "cashback" in snap && "mode" in snap;
    
    const passed = snap.engine === "NEW" && hasKeys;
    recordResult(11, "Telemetry Snapshots Logging", passed, `Keys present: ${hasKeys}`);
  } catch (err) {
    recordResult(11, "Telemetry Snapshots Logging", false, err.message);
  }

  // ==================== SCENARIO 12 ===================
  try {
    const iterations = 1000;
    const startTime = Date.now();

    const promises = [];
    for (let i = 0; i < iterations; i++) {
      promises.push(getCommissionDetails(150, testOperatorName, "Standard", { userId: testUserDefault.id }));
    }

    await Promise.all(promises);
    const duration = Date.now() - startTime;
    const avgLatency = duration / iterations;

    // Sub-15ms budget target per resolution
    const passed = avgLatency < 15.0;
    recordResult(12, "High-Concurrency Performance Load Test", passed, `Total Time: ${duration}ms, Avg Latency: ${avgLatency.toFixed(2)}ms`);
  } catch (err) {
    recordResult(12, "High-Concurrency Performance Load Test", false, err.message);
  }

  // --- TEARDOWN TEST RECORDS ---
  console.log("\nCleaning up test entities...");
  try {
    await prisma.rechargeCommissionRule.deleteMany({
      where: { slabId: { in: [legacySlab.id, overrideSlab.id, packageSlab.id, defaultSlab.id] } }
    });
    await prisma.rangeCommissionRule.deleteMany({
      where: { slabId: { in: [legacySlab.id, overrideSlab.id, packageSlab.id, defaultSlab.id] } }
    });
    await prisma.commissionRule.deleteMany({
      where: { operator: testOperatorName }
    });
    await prisma.packageServiceSlab.deleteMany({
      where: { packageId: testPackage.id }
    });
    await prisma.user.deleteMany({
      where: { email: { in: ["test_override@dizipay.com", "test_package@dizipay.com", "test_default@dizipay.com"] } }
    });
    await prisma.commissionPackage.delete({
      where: { id: testPackage.id }
    });
    await prisma.slab.deleteMany({
      where: { id: { in: [legacySlab.id, overrideSlab.id, packageSlab.id] } }
    });
    await prisma.operator.delete({
      where: { id: operatorObj.id }
    });
  } catch (err) {
    console.warn("Cleanup warning:", err.message);
  }

  // --- SUMMARY REPORT ---
  console.log(ANSI_BOLD + "\n==================================================" + ANSI_RESET);
  console.log(ANSI_BOLD + "                TEST RUN SUMMARY                  " + ANSI_RESET);
  console.log(ANSI_BOLD + "==================================================" + ANSI_RESET);
  console.log(`Total Scenarios: ${passedTests + failedTests}`);
  console.log(`Passed:          ${ANSI_GREEN}${passedTests}${ANSI_RESET}`);
  console.log(`Failed:          ${failedTests > 0 ? ANSI_RED : ""}${failedTests}${ANSI_RESET}`);
  console.log(ANSI_BOLD + "==================================================\n" + ANSI_RESET);

  // Close connections
  await redisClient.quit();
  await prisma.$disconnect();

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(async (err) => {
  console.error("Unhandle test runner error:", err);
  await redisClient.quit();
  await prisma.$disconnect();
  process.exit(1);
});
