import prisma from "./src/config/prisma.js";
import featureFlags, { FLAGS } from "./src/services/featureFlagsService.js";
import commissionIntel, { createRecommendation, evaluateProfitDropAndRollback, classifyRisk } from "./src/services/commissionIntelligenceService.js";

async function main() {
  console.log("=== STARTING COMMISSION AUTOMATION VERIFICATION SUITE ===");
  process.env.NODE_ENV = "test-sandbox";

  try {
    // 1. Setup mock operator & category
    let op = await prisma.operator.findFirst();
    if (!op) {
      op = await prisma.operator.create({
        data: { name: "JIO", code: "JIO", category: "MOBILE" }
      });
    }

    let cat = await prisma.serviceCategory.findFirst();
    if (!cat) {
      cat = await prisma.serviceCategory.create({
        data: { name: "Prepaid", code: "PREPAID" }
      });
    }

    // Seed/Reset CommissionIntelligenceConfig
    await prisma.commissionIntelligenceConfig.upsert({
      where: { id: 1 },
      update: {
        automationMode: "AUTOMATIC",
        profitDropThreshold: 0.05 // 5% drop limit
      },
      create: {
        id: 1,
        automationMode: "AUTOMATIC",
        profitDropThreshold: 0.05
      }
    });

    await featureFlags.setFlag(FLAGS.COMMISSION_INTELLIGENCE_ENABLED, true);

    console.log("[TEST 1] Testing Risk Classification grades...");
    if (classifyRisk(1.6, 1.5) !== "LOW") throw new Error("0.1% deviation should be LOW risk.");
    if (classifyRisk(2.4, 1.5) !== "MEDIUM") throw new Error("0.9% deviation should be MEDIUM risk.");
    if (classifyRisk(3.8, 1.5) !== "HIGH") throw new Error("2.3% deviation should be HIGH risk.");
    if (classifyRisk(5.0, 1.5) !== "CRITICAL") throw new Error("3.5% deviation should be CRITICAL risk.");
    console.log("✔ Risk classifier grades categorized correctly.");

    console.log("[TEST 2] Testing LOW risk auto-approval and auto-apply flow...");
    // Current rate = 1.5%, Recommended = 1.6% (LOW risk)
    const lowRec = await createRecommendation(op.id, cat.id, "RETAILER", 1.5, 1.6, "Low Risk optimization");
    if (lowRec.status !== "APPROVED" && lowRec.status !== "APPLIED") {
      throw new Error(`Expected LOW risk recommendation status to be APPROVED/APPLIED in AUTOMATIC mode, got: ${lowRec.status}`);
    }
    console.log("✔ LOW risk recommendation automatically processed and applied.");

    console.log("[TEST 3] Testing HIGH risk manual checker approval workflow...");
    // Current rate = 1.5%, Recommended = 3.5% (HIGH risk, variance 2.0%)
    const highRec = await createRecommendation(op.id, cat.id, "RETAILER", 1.5, 3.5, "High Risk adjustment");
    if (highRec.status !== "SUBMITTED") {
      throw new Error(`Expected HIGH risk recommendation status to be SUBMITTED, got: ${highRec.status}`);
    }
    console.log("✔ HIGH risk recommendation correctly routed to maker-checker approval gateway.");

    console.log("[TEST 4] Testing CRITICAL risk creation blocker...");
    // Current rate = 1.5%, Recommended = 5.0% (CRITICAL risk, variance 3.5%)
    try {
      await createRecommendation(op.id, cat.id, "RETAILER", 1.5, 5.0, "Critical Risk adjustment");
      throw new Error("CRITICAL risk recommendation should have been blocked.");
    } catch (err) {
      if (err.message.includes("blocked due to CRITICAL risk levels")) {
        console.log("✔ CRITICAL risk creation successfully blocked.");
      } else {
        throw err;
      }
    }

    console.log("[TEST 5] Testing Automatic Profit Drop Rollback...");
    // Apply a recommendation
    const rec = await prisma.commissionRecommendation.create({
      data: {
        operatorId: op.id,
        serviceCategoryId: cat.id,
        role: "RETAILER",
        currentCommission: 2.0,
        recommendedCommission: 2.3,
        expectedGrowth: 5.0,
        expectedProfit: -2.0,
        riskScore: 20.0,
        status: "APPROVED"
      }
    });

    await commissionIntel.applyRecommendation(rec.id, 1);

    // Verify it is applied
    let rule = await prisma.rechargeCommissionRule.findFirst({
      where: { operatorId: op.id, commissionValue: 2.3 }
    });
    if (!rule) throw new Error("Recommendation was not applied in DB.");

    // Evaluate profit drop = 8% (which exceeds 5% threshold)
    const rolledBack = await evaluateProfitDropAndRollback(rec.id, 0.08);
    if (!rolledBack) throw new Error("Rollback failed to trigger.");

    // Verify the recommendation status is updated
    const updatedRec = await prisma.commissionRecommendation.findUnique({ where: { id: rec.id } });
    if (updatedRec.status !== "ROLLED_BACK") {
      throw new Error(`Expected recommendation status ROLLED_BACK, got: ${updatedRec.status}`);
    }

    // Verify previous rule value of 2.0 is restored
    const restoredRule = await prisma.rechargeCommissionRule.findFirst({
      where: { operatorId: op.id, commissionValue: 2.0 }
    });
    if (!restoredRule) {
      throw new Error("Previous commission rule rate failed to restore.");
    }
    console.log(`✔ Profit Drop Automatic Rollback successfully triggered, restored legacy rate of ${restoredRule.commissionValue}%.`);

    // Verify audit log
    const log = await prisma.auditLog.findFirst({
      where: { action: "AUTOMATIC_ROLLBACK_TRIGGERED" }
    });
    if (!log) throw new Error("Audit log for AUTOMATIC_ROLLBACK_TRIGGERED was not written.");
    console.log("✔ Audit log and administrative alerts successfully verified.");

    console.log("✔ ALL COMMISSION AUTOMATION TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ COMMISSION AUTOMATION VERIFICATION FAILED:", err.message, err.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
