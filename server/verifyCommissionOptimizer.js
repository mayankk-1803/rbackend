import prisma from "./src/config/prisma.js";
import featureFlags, { FLAGS } from "./src/services/featureFlagsService.js";
import {
  createRecommendation,
  submitRecommendation,
  approveRecommendation,
  applyRecommendation,
  rollbackRecommendation
} from "./src/services/commissionIntelligenceService.js";

async function main() {
  console.log("=== STARTING COMMISSION OPTIMIZER VERIFICATION SUITE ===");

  try {
    // Enable features
    await featureFlags.setFlag(FLAGS.COMMISSION_INTELLIGENCE_ENABLED, true);

    // Ensure MANUAL automation mode for optimizer workflow testing
    await prisma.commissionIntelligenceConfig.upsert({
      where: { id: 1 },
      update: { automationMode: "MANUAL" },
      create: { id: 1, automationMode: "MANUAL", targetProfitMargin: 0.02, profitDropThreshold: 0.05 }
    });

    let op = await prisma.operator.findFirst();
    if (!op) op = await prisma.operator.create({ data: { name: "AIRTEL" } });

    let sc = await prisma.serviceCategory.findFirst();
    if (!sc) sc = await prisma.serviceCategory.create({ data: { code: "RECHARGE", name: "Recharge" } });

    // Seed mock admin
    let admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!admin) {
      admin = await prisma.user.create({
        data: { phone: "9876543219", password: "hash", role: "ADMIN" }
      });
    }

    console.log("[TEST 1] Generating recommendation...");
    const rec = await createRecommendation(op.id, sc.id, "RETAILER", 3.0, 3.5, "Optimize RETAILER commissions for Airtels");
    if (!rec || rec.status !== "DRAFT") {
      throw new Error("Created recommendation should start in DRAFT status.");
    }
    console.log("✔ Recommendation successfully generated in DRAFT state.");

    // Check forecast & experiments database records
    const forecastCount = await prisma.commissionImpactForecast.count({ where: { recommendationId: rec.id } });
    const expCount = await prisma.commissionExperiment.count({ where: { recommendationId: rec.id } });
    if (forecastCount === 0 || expCount === 0) {
      throw new Error("Forecasts or A/B experiments were not generated.");
    }
    console.log(`✔ Persistence validated (Forecasts: ${forecastCount}, A/B Experiments: ${expCount}).`);

    console.log("[TEST 2] Submitting and approving recommendation...");
    await submitRecommendation(rec.id);
    await approveRecommendation(rec.id, admin.id);
    
    let approvedRec = await prisma.commissionRecommendation.findUnique({ where: { id: rec.id } });
    if (approvedRec.status !== "APPROVED") {
      throw new Error("Status should transition to APPROVED.");
    }
    console.log("✔ Submission & Approval workflow transitions succeeded.");

    console.log("[TEST 3] Applying approved recommendation to live rule table...");
    const rule = await applyRecommendation(rec.id, admin.id);
    if (!rule || rule.status !== "ACTIVE" || rule.commissionValue !== 3.5) {
      throw new Error("Live RechargeCommissionRule application failed.");
    }
    console.log(`✔ Applied to active tables (Rule ID: ${rule.id}, Injected Value: ${rule.commissionValue}%).`);

    console.log("[TEST 4] Simulating safety rollback of applied rule...");
    await rollbackRecommendation(rec.id, admin.id);
    
    let rolledRec = await prisma.commissionRecommendation.findUnique({ where: { id: rec.id } });
    if (rolledRec.status !== "ROLLED_BACK") {
      throw new Error("Status should transition to ROLLED_BACK.");
    }

    const liveRuleCount = await prisma.rechargeCommissionRule.count({ where: { id: rule.id } });
    if (liveRuleCount !== 0) {
      throw new Error("Applied RechargeCommissionRule should have been deleted on rollback.");
    }
    console.log("✔ Safety rollback and live rule purging verified successfully.");

    console.log("✔ ALL COMMISSION OPTIMIZER TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ COMMISSION OPTIMIZER VERIFICATION FAILED:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
