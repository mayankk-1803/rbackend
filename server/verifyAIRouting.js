import prisma from "./src/config/prisma.js";
import featureFlags, { FLAGS } from "./src/services/featureFlagsService.js";
import { calculateProviderScores, resolveIntelligenceRoute } from "./src/services/routingIntelligenceService.js";

async function main() {
  console.log("=== STARTING ROUTING INTELLIGENCE ENGINE VERIFICATION ===");

  try {
    // Enable features
    await featureFlags.seedInitialFlags();
    await featureFlags.setFlag(FLAGS.ROUTING_INTELLIGENCE_ENABLED, true);

    // Make sure we have a provider seeded to score
    let testProvider = await prisma.provider.findFirst();
    if (!testProvider) {
      testProvider = await prisma.provider.create({
        data: {
          code: "APIBOX",
          name: "APIBOX Main Gateway",
          baseUrl: "http://apibox.com",
          apiKey: "key",
          isActive: true
        }
      });
    }

    console.log("[TEST 1] Calculating composite provider scores...");
    const rankings = await calculateProviderScores("JIO", 100.0);
    if (rankings.length === 0) {
      throw new Error("Provider scoring engine returned empty rankings list.");
    }
    
    const best = rankings[0];
    console.log(`✔ Rankings computed (Top Provider: ${best.providerCode}, Composite Score: ${best.finalScore}).`);
    console.log(`  - Explainability details: Success: ${best.successScore}, Latency: ${best.latencyScore}, Cost: ${best.costScore}, Health: ${best.healthScore}, Trend: ${best.trendScore}.`);

    console.log("[TEST 2] Resolving route using routing intelligence overlay...");
    const route = await resolveIntelligenceRoute({ operator: "JIO", amount: 100.0, txnId: 88812 });
    console.log(`✔ Route resolved successfully (Mode: ${route.mode}, Provider: ${route.selectedProvider}).`);

    // Verify explainable decison logging
    const decision = await prisma.routingDecision.findFirst({
      where: { txnId: 88812 },
      include: { reasons: true }
    });

    if (!decision || decision.reasons.length === 0) {
      throw new Error("Routing Decision explainability record not persisted.");
    }
    console.log(`✔ Persistence validated (Decision ID: ${decision.id}, Reasons Count: ${decision.reasons.length}, Algorithm Model: ${decision.modelVersion}).`);

    console.log("✔ ALL ROUTING INTELLIGENCE TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ ROUTING INTELLIGENCE VERIFICATION FAILED:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
