import { PrismaClient } from '@prisma/client';
import { getHighestPriorityRule } from '../src/utils/getHighestPriorityRule.js';
import { MODE_PRIORITY } from '../src/constants/modePriority.js';
import { performance } from 'perf_hooks';

const prisma = new PrismaClient();

async function runHardeningTests() {
  console.log("==================================================");
  console.log("MODE PRIORITY HARDENING & VALIDATION TEST SUITE");
  console.log("==================================================");

  let passedTests = 0;
  const totalTests = 10;

  function assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Setup database variables for DB-backed tests
  const suffix = Date.now();
  const opName = `OP_MODE_${suffix}`;
  const catCode = `CAT_MODE_${suffix}`;
  
  let operator, serviceCategory, testSlab;
  const createdRangeRuleIds = [];
  const createdRechargeRuleIds = [];

  try {
    // Setup DB records first
    operator = await prisma.operator.create({
      data: { name: opName, codes: opName, active: true }
    });
    serviceCategory = await prisma.serviceCategory.create({
      data: { name: `Mode Category ${suffix}`, code: catCode, isActive: true }
    });
    testSlab = await prisma.slab.create({ data: { name: `MODE_SLAB_${suffix}` } });

    // ----------------------------------------------------
    // TEST 1: REAL + GENERAL
    // ----------------------------------------------------
    console.log("\n--- TEST 1: REAL + GENERAL ---");
    const rules1 = [
      { id: 1, mode: "GENERAL", commissionValue: 2.0 },
      { id: 2, mode: "REAL", commissionValue: 4.0 }
    ];
    const winner1 = getHighestPriorityRule(rules1);
    assert(winner1.mode === "REAL" && winner1.commissionValue === 4.0, "REAL must win over GENERAL");
    console.log("PASS: REAL wins over GENERAL");
    passedTests++;

    // ----------------------------------------------------
    // TEST 2: GENERAL only
    // ----------------------------------------------------
    console.log("\n--- TEST 2: GENERAL only ---");
    const rules2 = [
      { id: 1, mode: "GENERAL", commissionValue: 2.0 }
    ];
    const winner2 = getHighestPriorityRule(rules2);
    assert(winner2.mode === "GENERAL" && winner2.commissionValue === 2.0, "GENERAL must win when alone");
    console.log("PASS: GENERAL wins");
    passedTests++;

    // ----------------------------------------------------
    // TEST 3: REAL + PROMO
    // ----------------------------------------------------
    console.log("\n--- TEST 3: REAL + PROMO ---");
    const rules3 = [
      { id: 1, mode: "PROMO", commissionValue: 5.0 },
      { id: 2, mode: "REAL", commissionValue: 3.0 }
    ];
    const winner3 = getHighestPriorityRule(rules3);
    assert(winner3.mode === "REAL" && winner3.commissionValue === 3.0, "REAL must win over PROMO (unknown)");
    console.log("PASS: REAL wins");
    passedTests++;

    // ----------------------------------------------------
    // TEST 4: REAL + GENERAL + PROMO
    // ----------------------------------------------------
    console.log("\n--- TEST 4: REAL + GENERAL + PROMO ---");
    const rules4 = [
      { id: 1, mode: "PROMO", commissionValue: 5.0 },
      { id: 2, mode: "GENERAL", commissionValue: 2.0 },
      { id: 3, mode: "REAL", commissionValue: 3.5 }
    ];
    const winner4 = getHighestPriorityRule(rules4);
    assert(winner4.mode === "REAL" && winner4.commissionValue === 3.5, "REAL must win in mixed REAL + GENERAL + PROMO");
    console.log("PASS: REAL wins");
    passedTests++;

    // ----------------------------------------------------
    // TEST 5: GENERAL + PROMO
    // ----------------------------------------------------
    console.log("\n--- TEST 5: GENERAL + PROMO ---");
    const rules5 = [
      { id: 1, mode: "PROMO", commissionValue: 5.0 },
      { id: 2, mode: "GENERAL", commissionValue: 2.5 }
    ];
    const winner5 = getHighestPriorityRule(rules5);
    assert(winner5.mode === "GENERAL" && winner5.commissionValue === 2.5, "GENERAL must win over PROMO (unknown)");
    console.log("PASS: GENERAL wins");
    passedTests++;

    // ----------------------------------------------------
    // TEST 6: REAL + GENERAL + PROMO + VIP + CUSTOM
    // ----------------------------------------------------
    console.log("\n--- TEST 6: REAL + GENERAL + PROMO + VIP + CUSTOM ---");
    const rules6 = [
      { id: 1, mode: "VIP", commissionValue: 8.0 },
      { id: 2, mode: "GENERAL", commissionValue: 2.5 },
      { id: 3, mode: "CUSTOM", commissionValue: 9.0 },
      { id: 4, mode: "REAL", commissionValue: 4.5 },
      { id: 5, mode: "PROMO", commissionValue: 7.0 }
    ];
    const sorted6 = [...rules6].sort((a, b) => {
      const priorityA = MODE_PRIORITY[a.mode] ?? 0;
      const priorityB = MODE_PRIORITY[b.mode] ?? 0;
      if (priorityB !== priorityA) return priorityB - priorityA;
      return b.id - a.id;
    });
    
    assert(sorted6[0].mode === "REAL", "First must be REAL");
    assert(sorted6[1].mode === "GENERAL", "Second must be GENERAL");
    const prioritiesOfRest = sorted6.slice(2).map(r => MODE_PRIORITY[r.mode] ?? 0);
    assert(prioritiesOfRest.every(p => p === 0), "All remaining must be unknown (priority 0)");
    console.log("PASS: REAL wins, GENERAL second, Unknown modes below GENERAL");
    passedTests++;

    // ----------------------------------------------------
    // TEST 7: Unknown modes only (PROMO, VIP, CUSTOM)
    // ----------------------------------------------------
    console.log("\n--- TEST 7: Unknown modes only (PROMO, VIP, CUSTOM) ---");
    const rules7a = [
      { id: 1, mode: "PROMO", commissionValue: 1.0 },
      { id: 2, mode: "VIP", commissionValue: 2.0 },
      { id: 3, mode: "CUSTOM", commissionValue: 3.0 }
    ];
    const rules7b = [
      { id: 3, mode: "CUSTOM", commissionValue: 3.0 },
      { id: 1, mode: "PROMO", commissionValue: 1.0 },
      { id: 2, mode: "VIP", commissionValue: 2.0 }
    ];
    const winner7a = getHighestPriorityRule(rules7a);
    const winner7b = getHighestPriorityRule(rules7b);
    
    assert(winner7a !== null && winner7b !== null, "Winners must not be null");
    assert(winner7a.mode === winner7b.mode && winner7a.id === winner7b.id, "Winner must be deterministic regardless of input array order");
    console.log(`PASS: Deterministic winner selected: Mode: ${winner7a.mode}, ID: ${winner7a.id}. No crash.`);
    passedTests++;

    // ----------------------------------------------------
    // TEST 8: 10,000 mixed rules
    // ----------------------------------------------------
    console.log("\n--- TEST 8: 10,000 mixed rules ---");
    const largeRulesList = [];
    const modesPool = ["REAL", "GENERAL", "PROMO", "VIP", "CUSTOM"];
    for (let i = 1; i <= 10000; i++) {
      largeRulesList.push({
        id: i,
        mode: modesPool[i % modesPool.length],
        commissionValue: Math.random() * 10
      });
    }
    
    const sortedLarge = [...largeRulesList].sort((a, b) => {
      const priorityA = MODE_PRIORITY[a.mode] ?? 0;
      const priorityB = MODE_PRIORITY[b.mode] ?? 0;
      if (priorityB !== priorityA) return priorityB - priorityA;
      return b.id - a.id;
    });
    
    const realCount = largeRulesList.filter(r => r.mode === "REAL").length;
    const generalCount = largeRulesList.filter(r => r.mode === "GENERAL").length;
    
    for (let i = 0; i < realCount; i++) {
      assert(sortedLarge[i].mode === "REAL", `Index ${i} must be REAL`);
    }
    for (let i = realCount; i < realCount + generalCount; i++) {
      assert(sortedLarge[i].mode === "GENERAL", `Index ${i} must be GENERAL`);
    }
    for (let i = realCount + generalCount; i < 10000; i++) {
      const p = MODE_PRIORITY[sortedLarge[i].mode] ?? 0;
      assert(p === 0, `Index ${i} must be unknown mode (priority 0), got: ${sortedLarge[i].mode}`);
    }
    console.log("PASS: 10,000 rules sorted deterministically and correctly.");
    passedTests++;

    // ----------------------------------------------------
    // TEST 9: Recharge Rule precedence
    // ----------------------------------------------------
    console.log("\n--- TEST 9: Recharge Rule precedence ---");
    // DB verification: Create Recharge rules in DB
    const dbRecharge1 = await prisma.rechargeCommissionRule.create({
      data: {
        slabId: testSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        commissionValue: 2.0,
        status: "ACTIVE"
      }
    });
    createdRechargeRuleIds.push(dbRecharge1.id);

    const dbRecharge2 = await prisma.rechargeCommissionRule.create({
      data: {
        slabId: testSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        commissionValue: 3.5,
        status: "ACTIVE"
      }
    });
    createdRechargeRuleIds.push(dbRecharge2.id);

    // Fetch them and resolve
    const dbRechargeRules = await prisma.rechargeCommissionRule.findMany({
      where: {
        slabId: testSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        isDeleted: false
      }
    });

    // In DB, Recharge Rules default to mode GENERAL logically, and tie-break by ID descending
    const rechargeWinner = getHighestPriorityRule(dbRechargeRules);
    assert(rechargeWinner !== null, "Winner must not be null");
    assert(rechargeWinner.id === dbRecharge2.id && rechargeWinner.commissionValue === 3.5, "Newer Recharge Rule (higher ID) must win");
    console.log(`PASS: Recharge Rule resolved deterministically (Newer wins, ID: ${rechargeWinner.id}, Value: ${rechargeWinner.commissionValue}%)`);
    passedTests++;

    // ----------------------------------------------------
    // TEST 10: Range Rule precedence
    // ----------------------------------------------------
    console.log("\n--- TEST 10: Range Rule precedence ---");
    // DB verification: Create a GENERAL and a REAL range rule in DB
    const dbRangeGeneral = await prisma.rangeCommissionRule.create({
      data: {
        slabId: testSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        amountFrom: 0,
        amountTo: 1000,
        mode: "GENERAL",
        commissionValue: 2.5,
        status: "ACTIVE"
      }
    });
    createdRangeRuleIds.push(dbRangeGeneral.id);

    const dbRangeReal = await prisma.rangeCommissionRule.create({
      data: {
        slabId: testSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        amountFrom: 0,
        amountTo: 1000,
        mode: "REAL",
        commissionValue: 5.0,
        status: "ACTIVE"
      }
    });
    createdRangeRuleIds.push(dbRangeReal.id);

    // Fetch Range Rules from DB (no database orderBy mode DESC)
    const dbRangeRules = await prisma.rangeCommissionRule.findMany({
      where: {
        slabId: testSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        isDeleted: false
      }
    });

    const rangeWinner = getHighestPriorityRule(dbRangeRules);
    assert(rangeWinner !== null, "Winner must not be null");
    assert(rangeWinner.mode === "REAL" && rangeWinner.commissionValue === 5.0, "REAL Range Rule must win over GENERAL Range Rule");
    console.log(`PASS: REAL Range Rule wins over GENERAL Range Rule (Mode: ${rangeWinner.mode}, Value: ${rangeWinner.commissionValue}%)`);
    passedTests++;

    // ----------------------------------------------------
    // PERFORMANCE BENCHMARK
    // ----------------------------------------------------
    console.log("\n--- PERFORMANCE BENCHMARK ---");
    const iterations = 50000;
    const testArray = [
      { id: 1, mode: "PROMO" },
      { id: 2, mode: "GENERAL" },
      { id: 3, mode: "REAL" },
      { id: 4, mode: "VIP" }
    ];
    
    // Warm up
    for (let i = 0; i < 1000; i++) {
      getHighestPriorityRule(testArray);
    }
    
    const latencies = [];
    const tStartBenchmark = performance.now();
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      getHighestPriorityRule(testArray);
      const t1 = performance.now();
      latencies.push(t1 - t0);
    }
    const tEndBenchmark = performance.now();
    const totalBenchmarkTime = tEndBenchmark - tStartBenchmark;
    
    latencies.sort((a, b) => a - b);
    const avgBenchmark = totalBenchmarkTime / iterations;
    const p95Benchmark = latencies[Math.floor(iterations * 0.95)];
    const worstBenchmark = latencies[iterations - 1];
    
    console.log(`In-memory sorting benchmark over ${iterations} iterations:`);
    console.log(`- Total time: ${totalBenchmarkTime.toFixed(3)} ms`);
    console.log(`- Average latency: ${(avgBenchmark * 1000).toFixed(3)} microseconds`);
    console.log(`- P95 latency: ${(p95Benchmark * 1000).toFixed(3)} microseconds`);
    console.log(`- Worst case latency: ${(worstBenchmark * 1000).toFixed(3)} microseconds`);
    
    console.log("\n==================================================");
    console.log(`STATUS: ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log("==================================================");

  } catch (error) {
    console.error("\nTEST SUITE FAILED:", error);
    process.exit(1);
  } finally {
    console.log("\nCleaning up test rules and records...");
    if (createdRangeRuleIds.length > 0) {
      await prisma.rangeCommissionRule.deleteMany({ where: { id: { in: createdRangeRuleIds } } }).catch(() => {});
    }
    if (createdRechargeRuleIds.length > 0) {
      await prisma.rechargeCommissionRule.deleteMany({ where: { id: { in: createdRechargeRuleIds } } }).catch(() => {});
    }
    if (testSlab) {
      await prisma.slab.delete({ where: { id: testSlab.id } }).catch(() => {});
    }
    if (operator) {
      await prisma.operator.delete({ where: { id: operator.id } }).catch(() => {});
    }
    if (serviceCategory) {
      await prisma.serviceCategory.delete({ where: { id: serviceCategory.id } }).catch(() => {});
    }
    console.log("Cleanup completed.");
  }
}

runHardeningTests()
  .catch(err => {
    console.error("Test Suite Run Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
