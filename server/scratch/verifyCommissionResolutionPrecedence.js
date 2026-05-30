import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';
import { getHighestPriorityRule } from '../src/utils/getHighestPriorityRule.js';

const prisma = new PrismaClient();

// ====================================================
// COMMISSION RESOLUTION ENGINE PROTOTYPE
// ====================================================
async function resolveCommission(userId, operatorName, serviceCategoryCode, amount) {
  // 1. Fetch user's slabId, packageId, tier, and role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      slabId: true,
      packageId: true,
      tier: true,
      commissionRole: true
    }
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // 2. Resolve slabId based on precedence: User Slab Override -> Package Assignment
  let targetSlabId = user.slabId;
  let slabSource = "USER_SLAB_OVERRIDE";
  
  if (!targetSlabId && user.packageId) {
    const serviceCategory = await prisma.serviceCategory.findUnique({
      where: { code: serviceCategoryCode }
    });
    if (serviceCategory) {
      const packageMapping = await prisma.packageServiceSlab.findUnique({
        where: {
          packageId_serviceCategoryId: {
            packageId: user.packageId,
            serviceCategoryId: serviceCategory.id
          }
        }
      });
      if (packageMapping) {
        targetSlabId = packageMapping.slabId;
        slabSource = "PACKAGE_SLAB_RESOLUTION";
      }
    }
  }

  // Find operator and service category in DB
  const operatorObj = await prisma.operator.findUnique({
    where: { name: operatorName }
  });

  const serviceCategoryObj = await prisma.serviceCategory.findUnique({
    where: { code: serviceCategoryCode }
  });

  let resolvedRule = null;
  let ruleSource = "DEFAULT_FALLBACK";

  if (targetSlabId && operatorObj && serviceCategoryObj) {
    const role = user.commissionRole;

    // A. Check Range Commission Rules (Highest Precedence inside slab)
    const rangeRules = await prisma.rangeCommissionRule.findMany({
      where: {
        slabId: targetSlabId,
        operatorId: operatorObj.id,
        serviceCategoryId: serviceCategoryObj.id,
        role: role,
        amountFrom: { lte: amount },
        amountTo: { gte: amount },
        status: { in: ["ACTIVE", "APPROVED"] },
        isDeleted: false
      }
    });

    const rangeRule = getHighestPriorityRule(rangeRules);

    if (rangeRule) {
      resolvedRule = rangeRule;
      ruleSource = `RANGE_RULE (${slabSource})`;
    } else {
      // B. Check Recharge Commission Rules (Fallback inside slab)
      const rechargeRules = await prisma.rechargeCommissionRule.findMany({
        where: {
          slabId: targetSlabId,
          operatorId: operatorObj.id,
          serviceCategoryId: serviceCategoryObj.id,
          role: role,
          status: { in: ["ACTIVE", "APPROVED"] },
          isDeleted: false
        }
      });

      const rechargeRule = getHighestPriorityRule(rechargeRules);

      if (rechargeRule) {
        resolvedRule = rechargeRule;
        ruleSource = `RECHARGE_RULE (${slabSource})`;
      }
    }
  }

  // C. Fallback to Legacy Commission Rules if no slab rule matched
  if (!resolvedRule && operatorObj) {
    const legacyRule = await prisma.commissionRule.findFirst({
      where: {
        operator: operatorName,
        userTier: user.tier || "Standard",
        isActive: true
      },
      orderBy: { priority: "desc" }
    });

    if (legacyRule) {
      resolvedRule = {
        commissionValue: legacyRule.commissionPercent,
        commissionType: "PERCENTAGE",
        mode: "GENERAL"
      };
      ruleSource = "LEGACY_RULE";
    }
  }

  // D. Default Fallback Logic if still nothing resolved
  if (!resolvedRule) {
    return {
      commissionValue: 5.0, // 5% default
      commissionType: "PERCENTAGE",
      mode: "GENERAL",
      source: "DEFAULT_FALLBACK"
    };
  }

  return {
    commissionValue: resolvedRule.commissionValue,
    commissionType: resolvedRule.commissionType,
    mode: resolvedRule.mode || "GENERAL",
    source: ruleSource
  };
}

// ====================================================
// VERIFICATION TEST RUNNER
// ====================================================
async function runPrecedenceTests() {
  console.log("==================================================");
  console.log("COMMISSION RESOLUTION PRECEDENCE VERIFICATION SUITE");
  console.log("==================================================");

  // Setup descriptive test items with timestamps to avoid uniqueness constraints
  const suffix = Date.now();
  const opName = `AIRTEL_${suffix}`;
  const catCode = `RECHARGE_${suffix}`;
  
  // Create operator and service category
  const operator = await prisma.operator.create({
    data: { name: opName, codes: opName, active: true }
  });
  
  const serviceCategory = await prisma.serviceCategory.create({
    data: { name: `Recharge Cat ${suffix}`, code: catCode, isActive: true }
  });

  const vipSlab = await prisma.slab.create({ data: { name: `VIP_SLAB_${suffix}` } });
  const standardSlab = await prisma.slab.create({ data: { name: `STANDARD_SLAB_${suffix}` } });
  const testSlab7 = await prisma.slab.create({ data: { name: `TEST_SLAB_7_${suffix}` } });

  const standardPackage = await prisma.commissionPackage.create({ data: { name: `STANDARD_PACKAGE_${suffix}` } });
  const testPackage5 = await prisma.commissionPackage.create({ data: { name: `TEST_PACKAGE_5_${suffix}` } });

  // Map package service slabs
  await prisma.packageServiceSlab.createMany({
    data: [
      { packageId: standardPackage.id, serviceCategoryId: serviceCategory.id, slabId: standardSlab.id },
      { packageId: testPackage5.id, serviceCategoryId: serviceCategory.id, slabId: testSlab7.id }
    ]
  });

  // Create a base test user mapped to standard package
  const user = await prisma.user.create({
    data: {
      name: `Test Precedence User ${suffix}`,
      email: `precedence_${suffix}@dizipay.com`,
      password: "password123",
      packageId: testPackage5.id,
      slabId: testSlab7.id,
      commissionRole: "RETAILER",
      tier: `Tier_${suffix}`
    }
  });

  const createdRules = [];
  const createdLegacyRules = [];

  try {
    // ----------------------------------------------------
    // TEST 1: RANGE VS RECHARGE
    // ----------------------------------------------------
    console.log("\n--- TEST 1: Range Rule vs Recharge Rule ---");
    
    // Create Recharge rule = 2%
    const rechargeRule1 = await prisma.rechargeCommissionRule.create({
      data: {
        slabId: testSlab7.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        commissionValue: 2.0,
        status: "ACTIVE"
      }
    });
    createdRules.push({ id: rechargeRule1.id, type: "RECHARGE" });

    // Create Range rule = 4% (0 to 1000 amount)
    const rangeRule1 = await prisma.rangeCommissionRule.create({
      data: {
        slabId: testSlab7.id,
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

    const res1 = await resolveCommission(user.id, opName, catCode, 500);
    console.log(`Resolution output: Commission: ${res1.commissionValue}%, Source: ${res1.source}`);
    if (res1.commissionValue === 4.0 && res1.source.includes("RANGE_RULE")) {
      console.log("✔ TEST 1 PASSED: Range Rule won over Recharge Rule.");
    } else {
      throw new Error(`TEST 1 FAILED: Expected 4% from RANGE_RULE, got: ${JSON.stringify(res1)}`);
    }

    // ----------------------------------------------------
    // TEST 2: RECHARGE RULE FALLBACK
    // ----------------------------------------------------
    console.log("\n--- TEST 2: Recharge Rule Fallback (No Range Rule match) ---");
    // Query for amount out of Range Rule bounds (e.g. 1500)
    const res2 = await resolveCommission(user.id, opName, catCode, 1500);
    console.log(`Resolution output: Commission: ${res2.commissionValue}%, Source: ${res2.source}`);
    if (res2.commissionValue === 2.0 && res2.source.includes("RECHARGE_RULE")) {
      console.log("✔ TEST 2 PASSED: Recharge rule fell back successfully.");
    } else {
      throw new Error(`TEST 2 FAILED: Expected 2% from RECHARGE_RULE, got: ${JSON.stringify(res2)}`);
    }

    // ----------------------------------------------------
    // TEST 3: LEGACY FALLBACK
    // ----------------------------------------------------
    console.log("\n--- TEST 3: Legacy Fallback (No slab rules) ---");
    // Temporarily clear the slab on the user so no Range/Recharge matches
    await prisma.user.update({
      where: { id: user.id },
      data: { slabId: null, packageId: null }
    });

    // Create legacy rule
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

    const res3 = await resolveCommission(user.id, opName, catCode, 500);
    console.log(`Resolution output: Commission: ${res3.commissionValue}%, Source: ${res3.source}`);
    if (res3.commissionValue === 1.5 && res3.source === "LEGACY_RULE") {
      console.log("✔ TEST 3 PASSED: Legacy rule fell back successfully.");
    } else {
      throw new Error(`TEST 3 FAILED: Expected 1.5% from LEGACY_RULE, got: ${JSON.stringify(res3)}`);
    }

    // ----------------------------------------------------
    // TEST 4: DEFAULT FALLBACK
    // ----------------------------------------------------
    console.log("\n--- TEST 4: Default Fallback ---");
    // Disable legacy rule
    await prisma.commissionRule.update({
      where: { id: legacyRule.id },
      data: { isActive: false }
    });

    const res4 = await resolveCommission(user.id, opName, catCode, 500);
    console.log(`Resolution output: Commission: ${res4.commissionValue}%, Source: ${res4.source}`);
    if (res4.commissionValue === 5.0 && res4.source === "DEFAULT_FALLBACK") {
      console.log("✔ TEST 4 PASSED: Default fallback applied successfully.");
    } else {
      throw new Error(`TEST 4 FAILED: Expected 5% from DEFAULT_FALLBACK, got: ${JSON.stringify(res4)}`);
    }

    // Restore legacy rule for any references
    await prisma.commissionRule.update({
      where: { id: legacyRule.id },
      data: { isActive: true }
    });

    // ----------------------------------------------------
    // TEST 5: USER SLAB OVERRIDE
    // ----------------------------------------------------
    console.log("\n--- TEST 5: User Slab Override ---");
    // Set user to VIP_SLAB override and STANDARD_PACKAGE
    await prisma.user.update({
      where: { id: user.id },
      data: {
        slabId: vipSlab.id,
        packageId: standardPackage.id
      }
    });

    // VIP_SLAB Recharge rule = 5%
    const vipRule = await prisma.rechargeCommissionRule.create({
      data: {
        slabId: vipSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        commissionValue: 5.0,
        status: "ACTIVE"
      }
    });
    createdRules.push({ id: vipRule.id, type: "RECHARGE" });

    // STANDARD_SLAB Recharge rule = 2%
    const standardRule = await prisma.rechargeCommissionRule.create({
      data: {
        slabId: standardSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "RETAILER",
        commissionValue: 2.0,
        status: "ACTIVE"
      }
    });
    createdRules.push({ id: standardRule.id, type: "RECHARGE" });

    const res5 = await resolveCommission(user.id, opName, catCode, 500);
    console.log(`Resolution output: Commission: ${res5.commissionValue}%, Source: ${res5.source}`);
    if (res5.commissionValue === 5.0 && res5.source.includes("USER_SLAB_OVERRIDE")) {
      console.log("✔ TEST 5 PASSED: User Slab Override won over Package Slab.");
    } else {
      throw new Error(`TEST 5 FAILED: Expected 5% from VIP_SLAB, got: ${JSON.stringify(res5)}`);
    }

    // ----------------------------------------------------
    // TEST 6: PACKAGE SLAB RESOLUTION
    // ----------------------------------------------------
    console.log("\n--- TEST 6: Package Slab Resolution ---");
    // Remove user's direct slabId override, leaving only packageId
    await prisma.user.update({
      where: { id: user.id },
      data: { slabId: null }
    });

    const res6 = await resolveCommission(user.id, opName, catCode, 500);
    console.log(`Resolution output: Commission: ${res6.commissionValue}%, Source: ${res6.source}`);
    if (res6.commissionValue === 2.0 && res6.source.includes("PACKAGE_SLAB_RESOLUTION")) {
      console.log("✔ TEST 6 PASSED: Resolved correctly via standard package mapping.");
    } else {
      throw new Error(`TEST 6 FAILED: Expected 2% from Package mapping standard slab, got: ${JSON.stringify(res6)}`);
    }

    // ----------------------------------------------------
    // TEST 7: RANGE + USER SLAB OVERRIDE
    // ----------------------------------------------------
    console.log("\n--- TEST 7: Range + User Slab Override ---");
    // Set user's override back to VIP_SLAB
    await prisma.user.update({
      where: { id: user.id },
      data: { slabId: vipSlab.id }
    });

    // Create Range rule on VIP_SLAB = 6% (for amount 1000)
    const rangeRuleVip = await prisma.rangeCommissionRule.create({
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
    createdRules.push({ id: rangeRuleVip.id, type: "RANGE" });

    const res7 = await resolveCommission(user.id, opName, catCode, 1000);
    console.log(`Resolution output: Commission: ${res7.commissionValue}%, Source: ${res7.source}`);
    if (res7.commissionValue === 6.0 && res7.source.includes("RANGE_RULE") && res7.source.includes("USER_SLAB_OVERRIDE")) {
      console.log("✔ TEST 7 PASSED: Range Rule on VIP slab override won.");
    } else {
      throw new Error(`TEST 7 FAILED: Expected 6% from VIP Range Rule, got: ${JSON.stringify(res7)}`);
    }

    // ----------------------------------------------------
    // TEST 8: MODE PRECEDENCE
    // ----------------------------------------------------
    console.log("\n--- TEST 8: Mode Precedence ---");
    // Create overlapping range rule on VIP_SLAB with mode = REAL and commissionValue = 7.5%
    const rangeRuleVipReal = await prisma.rangeCommissionRule.create({
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
    createdRules.push({ id: rangeRuleVipReal.id, type: "RANGE" });

    const res8 = await resolveCommission(user.id, opName, catCode, 1000);
    console.log(`Resolution output: Commission: ${res8.commissionValue}%, Mode: ${res8.mode}, Source: ${res8.source}`);
    // Check if REAL mode wins
    if (res8.commissionValue === 7.5 && res8.mode === "REAL") {
      console.log("✔ TEST 8 PASSED: REAL mode took precedence over GENERAL mode.");
    } else {
      throw new Error(`TEST 8 FAILED: Expected REAL rule 7.5%, got: ${JSON.stringify(res8)}`);
    }

    // ----------------------------------------------------
    // TEST 9: SOFT DELETED RULES
    // ----------------------------------------------------
    console.log("\n--- TEST 9: Soft-deleted Rules Ignored ---");
    // Soft-delete the winner rule (REAL rule)
    await prisma.rangeCommissionRule.update({
      where: { id: rangeRuleVipReal.id },
      data: { isDeleted: true, deletedAt: new Date() }
    });

    const res9 = await resolveCommission(user.id, opName, catCode, 1000);
    console.log(`Resolution output: Commission: ${res9.commissionValue}%, Mode: ${res9.mode}, Source: ${res9.source}`);
    // Should fall back to the GENERAL range rule (6%)
    if (res9.commissionValue === 6.0 && res9.mode === "GENERAL") {
      console.log("✔ TEST 9 PASSED: Soft-deleted rule ignored successfully.");
    } else {
      throw new Error(`TEST 9 FAILED: Expected fallback to GENERAL 6%, got: ${JSON.stringify(res9)}`);
    }

    // ----------------------------------------------------
    // TEST 10: INACTIVE RULES
    // ----------------------------------------------------
    console.log("\n--- TEST 10: Inactive Rules Ignored ---");
    // Set matching GENERAL range rule to PENDING
    await prisma.rangeCommissionRule.update({
      where: { id: rangeRuleVip.id },
      data: { status: "PENDING" }
    });

    // VIP Recharge rule is still active (5%)
    const res10 = await resolveCommission(user.id, opName, catCode, 1000);
    console.log(`Resolution output: Commission: ${res10.commissionValue}%, Source: ${res10.source}`);
    if (res10.commissionValue === 5.0 && res10.source.includes("RECHARGE_RULE")) {
      console.log("✔ TEST 10 PASSED: Inactive rules (PENDING) were ignored.");
    } else {
      throw new Error(`TEST 10 FAILED: Expected fallback to ACTIVE Recharge rule 5%, got: ${JSON.stringify(res10)}`);
    }

    // ----------------------------------------------------
    // TEST 11: AUDIT LOG VALIDATION (Read-Only Check)
    // ----------------------------------------------------
    console.log("\n--- TEST 11: Audit Validation (Read-only Resolution) ---");
    const baselineAudits = await prisma.auditLog.count();
    const baselineHistory = await prisma.commissionRuleHistory.count();
    const baselineConfig = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    const baselineVersion = baselineConfig ? baselineConfig.currentVersion : 1;

    await resolveCommission(user.id, opName, catCode, 1000);

    const finalAudits = await prisma.auditLog.count();
    const finalHistory = await prisma.commissionRuleHistory.count();
    const finalConfig = await prisma.commissionConfig.findUnique({ where: { id: 1 } });
    const finalVersion = finalConfig ? finalConfig.currentVersion : 1;

    if (baselineAudits === finalAudits && baselineHistory === finalHistory && baselineVersion === finalVersion) {
      console.log("✔ AUDIT VALIDATION PASSED: Commission lookup does not write logs, histories, or cache updates.");
    } else {
      throw new Error(`AUDIT FAILED: Lookup wrote audit/history/cache state! Audits: ${finalAudits - baselineAudits}, History: ${finalHistory - baselineHistory}, VersionDiff: ${finalVersion - baselineVersion}`);
    }

    // ----------------------------------------------------
    // TEST 12: PERFORMANCE LOOKUP SCALING (20,000+ Rules)
    // ----------------------------------------------------
    console.log("\n--- TEST 12: Scale Performance Validation ---");
    console.log("Generating 10,000 Recharge Rules and 10,000 Range Rules...");
    
    const performanceRecharge = [];
    const performanceRange = [];
    const scaleSlab = await prisma.slab.create({ data: { name: `SCALE_SLAB_${suffix}` } });
    
    // Map user to scaleSlab override to keep lookup isolated to scale rules
    await prisma.user.update({
      where: { id: user.id },
      data: { slabId: scaleSlab.id }
    });

    for (let i = 0; i < 10000; i++) {
      performanceRecharge.push({
        slabId: scaleSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "CUSTOMER", // different role to not conflict with RETAILER lookup
        commissionValue: 1.0,
        status: "ACTIVE"
      });

      performanceRange.push({
        slabId: scaleSlab.id,
        operatorId: operator.id,
        serviceCategoryId: serviceCategory.id,
        role: "CUSTOMER",
        amountFrom: i * 50,
        amountTo: (i + 1) * 50 - 1,
        mode: "GENERAL",
        commissionValue: 2.0,
        status: "ACTIVE"
      });
    }

    const tStartInsert1 = Date.now();
    await prisma.rechargeCommissionRule.createMany({ data: performanceRecharge });
    const tEndInsert1 = Date.now();
    console.log(`✔ Bulk inserted 10,000 Recharge Rules in ${tEndInsert1 - tStartInsert1}ms.`);

    const tStartInsert2 = Date.now();
    await prisma.rangeCommissionRule.createMany({ data: performanceRange });
    const tEndInsert2 = Date.now();
    console.log(`✔ Bulk inserted 10,000 Range Rules in ${tEndInsert2 - tStartInsert2}ms.`);

    console.log("Simulating 1,000 resolution lookups...");
    const latencies = [];
    
    // We execute lookups against the user who has RETAILER role (falls back to legacy/default since RETAILER has no active scale rules)
    // And user2 who has CUSTOMER role (resolves from range/recharge scale rules)
    const user2 = await prisma.user.create({
      data: {
        name: `Test Scale User ${suffix}`,
        email: `scale_${suffix}@dizipay.com`,
        password: "password123",
        slabId: scaleSlab.id,
        commissionRole: "CUSTOMER",
        tier: `Tier_${suffix}`
      }
    });

    for (let idx = 0; idx < 1000; idx++) {
      const searchAmt = (idx * 37) % 50000; // query varying amounts
      const tStartLookup = performance.now();
      await resolveCommission(user2.id, opName, catCode, searchAmt);
      const tEndLookup = performance.now();
      latencies.push(tEndLookup - tStartLookup);
    }

    // Compute stats
    const totalLatency = latencies.reduce((sum, l) => sum + l, 0);
    const avgLatency = totalLatency / latencies.length;
    
    latencies.sort((a, b) => a - b);
    const p95Idx = Math.floor(latencies.length * 0.95);
    const p95Latency = latencies[p95Idx];
    const worstLatency = latencies[latencies.length - 1];

    console.log(`\nResolution Performance Stats (over 1,000 calls):`);
    console.log(`- Average resolution time: ${avgLatency.toFixed(3)} ms`);
    console.log(`- 95th Percentile resolution: ${p95Latency.toFixed(3)} ms`);
    console.log(`- Worst-case lookup latency: ${worstLatency.toFixed(3)} ms`);

    const maxLimitMs = 15.0; // 15ms is extremely conservative for DB checks
    if (avgLatency <= maxLimitMs) {
      console.log(`✔ PERFORMANCE PASSED: Avg lookup time is well below ${maxLimitMs}ms.`);
    } else {
      throw new Error(`PERFORMANCE FAILED: Average resolution latency too high: ${avgLatency.toFixed(3)}ms`);
    }

    // Cleanup bulk scale rules and slab
    console.log("\nCleaning up scale rules and test records...");
    await prisma.user.delete({ where: { id: user2.id } });
    await prisma.rangeCommissionRule.deleteMany({ where: { slabId: scaleSlab.id } });
    await prisma.rechargeCommissionRule.deleteMany({ where: { slabId: scaleSlab.id } });
    await prisma.slab.delete({ where: { id: scaleSlab.id } });
    console.log("✔ Bulk cleanup completed.");

    console.log("\n==================================================");
    console.log("STATUS: ALL PRECEDENCE VERIFICATION TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================");

  } finally {
    // General cleanup
    console.log("\n[Cleanup] Cleaning up standard test records...");
    const ruleIds = createdRules.map(r => r.id);
    const rangeIds = createdRules.filter(r => r.type === "RANGE").map(r => r.id);
    const rechargeIds = createdRules.filter(r => r.type === "RECHARGE").map(r => r.id);

    if (user) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }

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
      where: { packageId: { in: [standardPackage.id, testPackage5.id] } }
    }).catch(() => {});

    await prisma.commissionPackage.deleteMany({
      where: { id: { in: [standardPackage.id, testPackage5.id] } }
    }).catch(() => {});

    await prisma.slab.deleteMany({
      where: { id: { in: [vipSlab.id, standardSlab.id, testSlab7.id] } }
    }).catch(() => {});

    await prisma.operator.delete({ where: { id: operator.id } }).catch(() => {});
    await prisma.serviceCategory.delete({ where: { id: serviceCategory.id } }).catch(() => {});
    console.log("[Cleanup] Completed.");
  }
}

runPrecedenceTests()
  .catch(err => {
    console.error("\nTEST SUITE RUN FAILED:", err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
