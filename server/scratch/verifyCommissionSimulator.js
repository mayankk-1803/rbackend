import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';
import { simulateCommission, clearSimulatorCache } from '../src/controllers/commissionAdminController.js';

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

async function runSimulatorTests() {
  console.log("==================================================");
  console.log("COMMISSION SIMULATOR VERIFICATION SUITE");
  console.log("==================================================");

  let passedTests = 0;
  const totalTests = 14;

  function assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  const suffix = Date.now();
  const opName = `OP_SIM_${suffix}`;
  const catCode = `CAT_SIM_${suffix}`;

  // Setup Catalogs
  const operator = await prisma.operator.create({
    data: { name: opName, codes: opName, active: true }
  });
  
  const serviceCategory = await prisma.serviceCategory.create({
    data: { name: `Sim Cat ${suffix}`, code: catCode, isActive: true }
  });

  const vipSlab = await prisma.slab.create({ data: { name: `VIP_SLAB_${suffix}` } });
  const standardSlab = await prisma.slab.create({ data: { name: `STANDARD_SLAB_${suffix}` } });
  const testSlab = await prisma.slab.create({ data: { name: `TEST_SLAB_${suffix}` } });

  const standardPackage = await prisma.commissionPackage.create({ data: { name: `STANDARD_PACKAGE_${suffix}` } });
  const testPackage = await prisma.commissionPackage.create({ data: { name: `TEST_PACKAGE_${suffix}` } });

  // Map package service slabs
  await prisma.packageServiceSlab.createMany({
    data: [
      { packageId: standardPackage.id, serviceCategoryId: serviceCategory.id, slabId: standardSlab.id },
      { packageId: testPackage.id, serviceCategoryId: serviceCategory.id, slabId: testSlab.id }
    ]
  });

  // Create a base test user
  const user = await prisma.user.create({
    data: {
      name: `Test Simulator User ${suffix}`,
      email: `simulator_${suffix}@dizipay.com`,
      password: "password123",
      packageId: testPackage.id,
      slabId: null,
      commissionRole: "RETAILER",
      tier: `Tier_${suffix}`
    }
  });

  // Ensure user has a wallet
  const wallet = await prisma.wallet.upsert({
    where: { userId: user.id },
    update: { balance: 1000.00 },
    create: { userId: user.id, balance: 1000.00 }
  });

  const createdRules = [];
  const createdLegacyRules = [];

  try {
    // 1. Preload Rules
    // Recharge Rule standardSlab = 2%
    const rechargeRule1 = await prisma.rechargeCommissionRule.create({
      data: {
        slabId: standardSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        commissionValue: 2.0,
        status: "ACTIVE"
      }
    });
    createdRules.push({ id: rechargeRule1.id, type: "RECHARGE" });

    // Range Rule standardSlab = 4% (0 - 1000)
    const rangeRule1 = await prisma.rangeCommissionRule.create({
      data: {
        slabId: standardSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        amountFrom: 0,
        amountTo: 1000,
        mode: "GENERAL",
        commissionValue: 4.0,
        status: "ACTIVE"
      }
    });
    createdRules.push({ id: rangeRule1.id, type: "RANGE" });

    // Recharge Rule vipSlab = 5%
    const vipRecharge = await prisma.rechargeCommissionRule.create({
      data: {
        slabId: vipSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        commissionValue: 5.0,
        status: "ACTIVE"
      }
    });
    createdRules.push({ id: vipRecharge.id, type: "RECHARGE" });

    // Range Rule vipSlab = 7.5% REAL mode (0 - 2000)
    const vipRangeReal = await prisma.rangeCommissionRule.create({
      data: {
        slabId: vipSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        amountFrom: 0,
        amountTo: 2000,
        mode: "REAL",
        commissionValue: 7.5,
        status: "ACTIVE"
      }
    });
    createdRules.push({ id: vipRangeReal.id, type: "RANGE" });

    // Range Rule vipSlab = 6.0% GENERAL mode (0 - 2000)
    const vipRangeGeneral = await prisma.rangeCommissionRule.create({
      data: {
        slabId: vipSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        amountFrom: 0,
        amountTo: 2000,
        mode: "GENERAL",
        commissionValue: 6.0,
        status: "ACTIVE"
      }
    });
    createdRules.push({ id: vipRangeGeneral.id, type: "RANGE" });

    // Legacy rule
    const legacyRule = await prisma.commissionRule.create({
      data: {
        operator: opName,
        userTier: user.tier,
        commissionPercent: 1.5,
        cashbackPercent: 0.5,
        isActive: true
      }
    });
    createdLegacyRules.push(legacyRule.id);


    // ----------------------------------------------------
    // TEST 1: Range Rule Resolution
    // ----------------------------------------------------
    console.log("\n--- TEST 1: Range Rule Resolution ---");
    const res1 = mockRes();
    const req1 = mockReq({
      slabId: standardSlab.id,
      operatorId: operator.id,
      serviceCategoryId: serviceCategory.id,
      amount: 500
    });
    await simulateCommission(req1, res1);
    
    assert(res1.statusCode === 200, "Should return 200");
    assert(res1.data.success === true, "Should succeed");
    assert(res1.data.data.winningRule.id === rangeRule1.id, "Winner must be rangeRule1");
    assert(res1.data.data.financials.commission === "20.0000", "500 * 4% = 20.0000 commission");
    assert(res1.data.data.resolutionPath.ruleSource.includes("RANGE_RULE"), "Source must be RANGE_RULE");
    console.log("PASS: Range Rule resolved accurately");
    passedTests++;

    // ----------------------------------------------------
    // TEST 2: Recharge Rule Resolution
    // ----------------------------------------------------
    console.log("\n--- TEST 2: Recharge Rule Resolution ---");
    const res2 = mockRes();
    const req2 = mockReq({
      slabId: standardSlab.id,
      operatorId: operator.id,
      serviceCategoryId: serviceCategory.id,
      amount: 1500 // exceeds rangeRule1 limit
    });
    await simulateCommission(req2, res2);

    assert(res2.statusCode === 200, "Should return 200");
    assert(res2.data.data.winningRule.id === rechargeRule1.id, "Winner must fall back to rechargeRule1");
    assert(res2.data.data.financials.commission === "30.0000", "1500 * 2% = 30.0000 commission");
    assert(res2.data.data.resolutionPath.ruleSource.includes("RECHARGE_RULE"), "Source must fallback to RECHARGE_RULE");
    console.log("PASS: Recharge Rule fell back successfully on out-of-bounds amount");
    passedTests++;

    // ----------------------------------------------------
    // TEST 3: Package Resolution
    // ----------------------------------------------------
    console.log("\n--- TEST 3: Package Resolution ---");
    // User is standardPackage (maps to standardSlab)
    const res3 = mockRes();
    const req3 = mockReq({
      userId: user.id,
      packageId: standardPackage.id, // override package
      slabId: undefined, // let package resolve
      operatorId: operator.id,
      serviceCategoryId: serviceCategory.id,
      amount: 500
    });
    await simulateCommission(req3, res3);

    assert(res3.statusCode === 200, "Should return 200");
    assert(res3.data.data.resolutionPath.slabSource === "PACKAGE_SLAB_RESOLUTION", "Slab resolved via Package Slab");
    assert(res3.data.data.winningRule.id === rangeRule1.id, "Winner must be rangeRule1");
    console.log("PASS: Package mapping slab resolution verified");
    passedTests++;

    // ----------------------------------------------------
    // TEST 4: User Slab Override
    // ----------------------------------------------------
    console.log("\n--- TEST 4: User Slab Override ---");
    // User slabId override is vipSlab, packageId standardPackage
    // Direct slabId override must win over package resolution
    await prisma.user.update({
      where: { id: user.id },
      data: { slabId: vipSlab.id, packageId: standardPackage.id }
    });
    clearSimulatorCache();

    const res4 = mockRes();
    const req4 = mockReq({
      userId: user.id,
      operatorId: operator.id,
      serviceCategoryId: serviceCategory.id,
      amount: 1000
    });
    await simulateCommission(req4, res4);

    assert(res4.statusCode === 200, "Should return 200");
    assert(res4.data.data.resolutionPath.slabSource === "USER_SLAB_OVERRIDE", "Slab resolved via User Slab Override");
    assert(res4.data.data.winningRule.id === vipRangeReal.id, "VIP range rule must win");
    console.log("PASS: User slab override precedence verified");
    passedTests++;

    // ----------------------------------------------------
    // TEST 5: REAL Mode Priority
    // ----------------------------------------------------
    console.log("\n--- TEST 5: REAL Mode Priority ---");
    // vipRangeReal (mode REAL, 7.5%) and vipRangeGeneral (mode GENERAL, 6.0%) both match.
    // REAL must outrank GENERAL in the priority sorter.
    const res5 = mockRes();
    const req5 = mockReq({
      slabId: vipSlab.id,
      operatorId: operator.id,
      serviceCategoryId: serviceCategory.id,
      amount: 1000
    });
    await simulateCommission(req5, res5);

    assert(res5.statusCode === 200, "Should return 200");
    assert(res5.data.data.winningRule.id === vipRangeReal.id, "REAL mode rule must win");
    assert(res5.data.data.financials.commission === "75.0000", "REAL 7.5% wins");
    console.log("PASS: REAL mode priority outranks GENERAL mode successfully");
    passedTests++;

    // ----------------------------------------------------
    // TEST 6: Legacy Fallback
    // ----------------------------------------------------
    console.log("\n--- TEST 6: Legacy Fallback ---");
    // Provide no target slabId to trigger fallback rules
    const res6 = mockRes();
    const req6 = mockReq({
      userId: user.id,
      slabId: null, // explicit bypass
      packageId: null, // explicit bypass
      operatorId: operator.id,
      serviceCategoryId: serviceCategory.id,
      amount: 1000
    });
    // Temp disable slab/package on user to prevent resolution
    await prisma.user.update({
      where: { id: user.id },
      data: { slabId: null, packageId: null }
    });
    clearSimulatorCache();

    await simulateCommission(req6, res6);
    assert(res6.statusCode === 200, "Should return 200");
    assert(res6.data.data.resolutionPath.ruleSource === "LEGACY_RULE", "Rule source must be LEGACY_RULE");
    assert(res6.data.data.winningRule.id === legacyRule.id, "Winner must be legacyRule");
    assert(res6.data.data.financials.commission === "15.0000", "Legacy 1.5% commission (15.0000)");
    console.log("PASS: Legacy fallback resolution verified");
    passedTests++;

    // ----------------------------------------------------
    // TEST 7: Default Fallback
    // ----------------------------------------------------
    console.log("\n--- TEST 7: Default Fallback ---");
    // Make legacy rule inactive
    await prisma.commissionRule.update({
      where: { id: legacyRule.id },
      data: { isActive: false }
    });
    clearSimulatorCache();

    const res7 = mockRes();
    const req7 = mockReq({
      userId: user.id,
      operatorId: operator.id,
      serviceCategoryId: serviceCategory.id,
      amount: 1000
    });
    await simulateCommission(req7, res7);

    assert(res7.statusCode === 200, "Should return 200");
    assert(res7.data.data.resolutionPath.ruleSource === "DEFAULT_FALLBACK", "Rule source must fall back to DEFAULT_FALLBACK");
    assert(res7.data.data.winningRule.id === 0, "Default winning rule ID is 0");
    assert(res7.data.data.financials.commission === "50.0000", "Default fallback 5.0% commission (50.0000)");
    console.log("PASS: Default fallback resolution verified");
    passedTests++;

    // Restore legacy rule for references
    await prisma.commissionRule.update({
      where: { id: legacyRule.id },
      data: { isActive: true }
    });
    clearSimulatorCache();

    // Restore user parameters
    await prisma.user.update({
      where: { id: user.id },
      data: { slabId: testSlab.id, packageId: testPackage.id }
    });
    clearSimulatorCache();

    // ----------------------------------------------------
    // TEST 8: Trace Accuracy
    // ----------------------------------------------------
    console.log("\n--- TEST 8: Trace Accuracy ---");
    const res8 = mockRes();
    const req8 = mockReq({
      slabId: vipSlab.id,
      operatorId: operator.id,
      serviceCategoryId: serviceCategory.id,
      amount: 3000 // exceeds amount range limit of Range Rules on vipSlab (0 - 2000)
    });
    await simulateCommission(req8, res8);

    const trace = res8.data.data.trace;
    assert(trace.length > 0, "Trace log must not be empty");
    
    const rangeTrace = trace.find(t => t.ruleId === vipRangeReal.id);
    assert(rangeTrace !== undefined, "Trace must log vipRangeReal evaluation");
    assert(rangeTrace.decision === "REJECTED_AMOUNT", "vipRangeReal must be rejected due to amount");
    assert(rangeTrace.amountMatch === false, "amountMatch must be false");
    assert(rangeTrace.statusMatch === true, "statusMatch must be true");

    const winningTrace = trace.find(t => t.ruleId === vipRecharge.id);
    assert(winningTrace.decision === "SELECTED", "vipRecharge must be selected as winner");
    console.log("PASS: Precedence trace log accuracy verified");
    passedTests++;

    // ----------------------------------------------------
    // TEST 9: Read-Only Validation (Audit logs)
    // ----------------------------------------------------
    console.log("\n--- TEST 9: Read-Only Validation (No Audit Logs Written) ---");
    const auditCountBefore = await prisma.auditLog.count();
    
    const res9 = mockRes();
    const req9 = mockReq({
      slabId: standardSlab.id,
      operatorId: operator.id,
      serviceCategoryId: serviceCategory.id,
      amount: 500
    });
    await simulateCommission(req9, res9);

    const auditCountAfter = await prisma.auditLog.count();
    assert(auditCountBefore === auditCountAfter, "Simulation must not create audit logs");
    console.log("PASS: Read-only simulation creates zero audit logs");
    passedTests++;

    // ----------------------------------------------------
    // TEST 10: No Wallet Changes
    // ----------------------------------------------------
    console.log("\n--- TEST 10: No Wallet Changes ---");
    const walletBefore = await prisma.wallet.findUnique({ where: { userId: user.id } });
    const balanceBefore = walletBefore.balance;

    const res10 = mockRes();
    const req10 = mockReq({
      userId: user.id,
      operatorId: operator.id,
      serviceCategoryId: serviceCategory.id,
      amount: 500
    });
    await simulateCommission(req10, res10);

    const walletAfter = await prisma.wallet.findUnique({ where: { userId: user.id } });
    assert(walletAfter.balance.toString() === balanceBefore.toString(), "User wallet balance must remain unchanged");
    console.log("PASS: Simulator does not deduct or modify user wallets");
    passedTests++;

    // ----------------------------------------------------
    // TEST 11: No Ledger Changes
    // ----------------------------------------------------
    console.log("\n--- TEST 11: No Ledger Changes ---");
    const ledgerCountBefore = await prisma.ledgerEntry.count().catch(() => 0); // fallback if model missing

    const res11 = mockRes();
    const req11 = mockReq({
      userId: user.id,
      operatorId: operator.id,
      serviceCategoryId: serviceCategory.id,
      amount: 500
    });
    await simulateCommission(req11, res11);

    const ledgerCountAfter = await prisma.ledgerEntry.count().catch(() => 0);
    assert(ledgerCountBefore === ledgerCountAfter, "Simulation must not write ledger entries");
    console.log("PASS: Simulator writes zero ledger entries");
    passedTests++;

    // ----------------------------------------------------
    // TEST 12: No Database Writes (Rules or History)
    // ----------------------------------------------------
    console.log("\n--- TEST 12: No Database Writes (Rules or History) ---");
    const rulesCountBefore = await prisma.rechargeCommissionRule.count();
    const historyCountBefore = await prisma.commissionRuleHistory.count();
    const configBefore = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    const versionBefore = configBefore ? configBefore.currentVersion : 1;

    const res12 = mockRes();
    const req12 = mockReq({
      userId: user.id,
      operatorId: operator.id,
      serviceCategoryId: serviceCategory.id,
      amount: 500
    });
    await simulateCommission(req12, res12);

    const rulesCountAfter = await prisma.rechargeCommissionRule.count();
    const historyCountAfter = await prisma.commissionRuleHistory.count();
    const configAfter = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    const versionAfter = configAfter ? configAfter.currentVersion : 1;

    assert(rulesCountBefore === rulesCountAfter, "No recharge rules must be created");
    assert(historyCountBefore === historyCountAfter, "No rule history must be logged");
    assert(versionBefore === versionAfter, "CommissionConfig version must not increment");
    console.log("PASS: Read-only check verified. Zero database updates or version changes");
    passedTests++;

    // ----------------------------------------------------
    // TEST 13: Simulation Export Validation
    // ----------------------------------------------------
    console.log("\n--- TEST 13: Simulation Export Validation ---");
    const res13 = mockRes();
    const req13 = mockReq({
      slabId: standardSlab.id,
      operatorId: operator.id,
      serviceCategoryId: serviceCategory.id,
      amount: 100.5
    });
    await simulateCommission(req13, res13);

    const resData = res13.data.data;
    assert(resData.financials.walletImpactEstimate !== undefined, "Must contain walletImpactEstimate");
    assert(typeof resData.financials.walletImpactEstimate === "string", "walletImpactEstimate must be a string representation");
    assert(resData.financials.calculationSource === "SIMULATOR_ONLY", "calculationSource must be SIMULATOR_ONLY");
    
    // Check 4 decimal formatting
    assert(resData.financials.amount === "100.5000", "Amount must have 4 decimals");
    assert(resData.financials.commission === "4.0200", "Commission must have 4 decimals");
    assert(resData.financials.surcharge === "0.0000", "Surcharge must have 4 decimals");
    assert(resData.financials.fee === "0.0000", "Fee must have 4 decimals");
    assert(resData.financials.walletImpactEstimate === "-96.4800", "Wallet impact must have 4 decimals (-96.4800)");

    // Simulated Export snapshot structure
    const exportSnapshot = {
      timestamp: new Date().toISOString(),
      userId: null,
      packageId: null,
      slabId: standardSlab.id,
      operatorId: operator.id,
      serviceCategoryId: serviceCategory.id,
      amount: 100.5,
      resolutionPath: resData.resolutionPath,
      winningRule: resData.winningRule,
      financials: resData.financials,
      trace: resData.trace
    };

    assert(exportSnapshot.winningRule.commissionValue === 4.0000, "Winning rule value must match 4.0");
    assert(exportSnapshot.winningRule.maxCommission === null, "Winning rule maxCommission matches");
    assert(exportSnapshot.trace.length > 0, "Export snapshot contains evaluation trace log");
    console.log("PASS: Financial math decimals and client-side JSON export schema validated");
    passedTests++;

    // ----------------------------------------------------
    // TEST 14: Deterministic Replay
    // ----------------------------------------------------
    console.log("\n--- TEST 14: Deterministic Replay ---");
    const baselineResults = [];
    
    for (let loopIdx = 0; loopIdx < 100; loopIdx++) {
      const resLoop = mockRes();
      const reqLoop = mockReq({
        userId: user.id,
        slabId: vipSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        amount: 850
      });
      await simulateCommission(reqLoop, resLoop);
      baselineResults.push(JSON.stringify(resLoop.data.data));
    }

    const firstRunOutput = baselineResults[0];
    const isDeterministic = baselineResults.every(output => output === firstRunOutput);
    assert(isDeterministic === true, "All 100 simulation replays must return identical outputs");
    console.log("PASS: 100/100 deterministic replays match exactly with zero variance");
    passedTests++;

    // ----------------------------------------------------
    // PERFORMANCE BENCHMARK Lookups (20,000+ rules dataset)
    // ----------------------------------------------------
    console.log("\n--- PERFORMANCE BENCHMARK Lookups ---");
    console.log("Bulk loading 10,000 Recharge Rules and 10,000 Range Rules on temporary slab...");
    const scaleSlab = await prisma.slab.create({ data: { name: `SIM_SCALE_SLAB_${suffix}` } });

    const scaleRechargeRules = [];
    const scaleRangeRules = [];

    for (let idx = 0; idx < 10000; idx++) {
      scaleRechargeRules.push({
        slabId: scaleSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "CUSTOMER", // CUSTOMER role to prevent overlap with standard test RETAILER
        commissionValue: 1.25,
        status: "ACTIVE"
      });

      scaleRangeRules.push({
        slabId: scaleSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "CUSTOMER",
        amountFrom: idx * 2,
        amountTo: (idx + 1) * 2 - 0.01,
        mode: "GENERAL",
        commissionValue: 2.5,
        status: "ACTIVE"
      });
    }

    const tStartInsert1 = Date.now();
    await prisma.rechargeCommissionRule.createMany({ data: scaleRechargeRules });
    const tEndInsert1 = Date.now();
    console.log(`Bulk inserted 10,000 Recharge rules in ${tEndInsert1 - tStartInsert1}ms`);

    const tStartInsert2 = Date.now();
    await prisma.rangeCommissionRule.createMany({ data: scaleRangeRules });
    const tEndInsert2 = Date.now();
    console.log(`Bulk inserted 10,000 Range rules in ${tEndInsert2 - tStartInsert2}ms`);

    console.log("Running 1,000 simulations against scale slab rules...");
    const perfLatencies = [];
    
    // Create customer role user context
    const customerUser = await prisma.user.create({
      data: {
        name: `Test Scale Customer ${suffix}`,
        email: `sim_scale_${suffix}@dizipay.com`,
        password: "password123",
        slabId: scaleSlab.id,
        commissionRole: "CUSTOMER",
        tier: `Tier_${suffix}`
      }
    });

    for (let simIdx = 0; simIdx < 1000; simIdx++) {
      const searchAmt = (simIdx * 7) % 20000; // vary search amount
      const tStartSim = performance.now();
      
      const resPerf = mockRes();
      const reqPerf = mockReq({
        userId: customerUser.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        amount: searchAmt
      });
      await simulateCommission(reqPerf, resPerf);
      
      const tEndSim = performance.now();
      perfLatencies.push(tEndSim - tStartSim);
      
      // Safety assert on winner
      assert(resPerf.data.data.winningRule.id !== 0, "Resolution must find a matched rule");
    }

    // Performance statistics
    const totalLatency = perfLatencies.reduce((sum, l) => sum + l, 0);
    const avgLatency = totalLatency / perfLatencies.length;
    
    perfLatencies.sort((a, b) => a - b);
    const p95Idx = Math.floor(perfLatencies.length * 0.95);
    const p95Latency = perfLatencies[p95Idx];
    const worstLatency = perfLatencies[perfLatencies.length - 1];

    console.log(`\nSimulation Scale Performance results (over 1,000 simulations):`);
    console.log(`- Average simulation latency: ${avgLatency.toFixed(3)} ms`);
    console.log(`- 95th Percentile latency (P95): ${p95Latency.toFixed(3)} ms`);
    console.log(`- Worst-case simulation latency: ${worstLatency.toFixed(3)} ms`);

    const limitMs = 15.0;
    if (avgLatency <= limitMs) {
      console.log(`PASS: Performance metrics are outstanding (Average resolved under ${limitMs}ms)`);
    } else {
      throw new Error(`Performance warning: average simulation took ${avgLatency.toFixed(3)}ms (limit is ${limitMs}ms)`);
    }

    // Clean up scale rules
    console.log("\nCleaning up scale rules and temporary slab...");
    await prisma.user.delete({ where: { id: customerUser.id } }).catch(() => {});
    await prisma.rangeCommissionRule.deleteMany({ where: { slabId: scaleSlab.id } });
    await prisma.rechargeCommissionRule.deleteMany({ where: { slabId: scaleSlab.id } });
    await prisma.slab.delete({ where: { id: scaleSlab.id } });

    console.log("\n==================================================");
    console.log(`STATUS: ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log("==================================================");

  } finally {
    console.log("\nStandard test records cleanup...");
    // Standard test cleanup
    if (user) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }

    const rangeIds = createdRules.filter(r => r.type === "RANGE").map(r => r.id);
    const rechargeIds = createdRules.filter(r => r.type === "RECHARGE").map(r => r.id);

    if (rangeIds.length > 0) {
      await prisma.rangeCommissionRule.deleteMany({ where: { id: { in: rangeIds } } }).catch(() => {});
    }
    if (rechargeIds.length > 0) {
      await prisma.rechargeCommissionRule.deleteMany({ where: { id: { in: rechargeIds } } }).catch(() => {});
    }
    if (createdLegacyRules.length > 0) {
      await prisma.commissionRule.deleteMany({ where: { id: { in: createdLegacyRules } } }).catch(() => {});
    }

    await prisma.packageServiceSlab.deleteMany({
      where: { packageId: { in: [standardPackage.id, testPackage.id] } }
    }).catch(() => {});

    await prisma.commissionPackage.deleteMany({
      where: { id: { in: [standardPackage.id, testPackage.id] } }
    }).catch(() => {});

    await prisma.slab.deleteMany({
      where: { id: { in: [vipSlab.id, standardSlab.id, testSlab.id] } }
    }).catch(() => {});

    await prisma.operator.delete({ where: { id: operator.id } }).catch(() => {});
    await prisma.serviceCategory.delete({ where: { id: serviceCategory.id } }).catch(() => {});
    console.log("Cleanup completed.");
  }
}

runSimulatorTests()
  .catch(err => {
    console.error("Test Suite Run Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
