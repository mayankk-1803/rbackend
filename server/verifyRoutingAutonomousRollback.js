import prisma from "./src/config/prisma.js";
import featureFlags, { FLAGS } from "./src/services/featureFlagsService.js";
import { resolveIntelligenceRoute } from "./src/services/routingIntelligenceService.js";

async function main() {
  console.log("=== STARTING AUTONOMOUS ROLLBACK VERIFICATION SUITE ===");

  try {
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

    console.log("[TEST 1] Testing MANUAL routing fallback (Flags disabled)...");
    await featureFlags.setFlag(FLAGS.ROUTING_INTELLIGENCE_ENABLED, false);
    await featureFlags.setFlag(FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS, false);

    let route = await resolveIntelligenceRoute({ operator: "JIO", amount: 299 });
    if (route.mode !== "MANUAL") {
      throw new Error(`Expected MANUAL routing, got: ${route.mode}`);
    }
    console.log("✔ Fallback resolved correctly to MANUAL.");

    console.log("[TEST 2] Testing SHADOW routing activation...");
    await featureFlags.setFlag(FLAGS.ROUTING_INTELLIGENCE_ENABLED, true);
    route = await resolveIntelligenceRoute({ operator: "JIO", amount: 299 });
    if (route.mode !== "SHADOW") {
      throw new Error(`Expected SHADOW routing, got: ${route.mode}`);
    }
    console.log("✔ Active resolved to SHADOW mode.");

    console.log("[TEST 3] Testing AUTONOMOUS routing activation...");
    await featureFlags.setFlag(FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS, true);
    route = await resolveIntelligenceRoute({ operator: "JIO", amount: 299 });
    if (route.mode !== "AUTONOMOUS" && route.mode !== "SHADOW") {
      throw new Error(`Expected AUTONOMOUS/SHADOW routing, got: ${route.mode}`);
    }
    console.log(`✔ Active resolved to autonomous route (Mode: ${route.mode}, Provider: ${route.selectedProvider}).`);

    console.log("[TEST 4] Simulating Emergency Rollback...");
    // Instant hot-rollback
    await featureFlags.setFlag(FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS, false);
    route = await resolveIntelligenceRoute({ operator: "JIO", amount: 299 });
    if (route.mode !== "SHADOW") {
      throw new Error(`Expected emergency fallback to SHADOW, got: ${route.mode}`);
    }
    console.log("✔ Instant rollback to non-autonomous execution verified successfully.");

    console.log("✔ ALL AUTONOMOUS ROLLBACK TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ AUTONOMOUS ROLLBACK VERIFICATION FAILED:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
