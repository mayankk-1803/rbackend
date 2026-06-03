import prisma from "./src/config/prisma.js";
import featureFlags, { FLAGS } from "./src/services/featureFlagsService.js";

async function main() {
  console.log("=== STARTING FEATURE FLAGS VERIFICATION SUITE ===");

  try {
    // 1. Seed flags
    console.log("[TEST 1] Seeding feature flags...");
    await featureFlags.seedInitialFlags();
    console.log("✔ Seeding succeeded.");

    // 2. Validate hot-toggle update
    console.log("[TEST 2] Verifying flag state updates...");
    
    // Set to true
    await featureFlags.setFlag(FLAGS.ROUTING_INTELLIGENCE_ENABLED, true, "Unit Test flag enablement");
    let isEnabledValue = await featureFlags.isEnabled(FLAGS.ROUTING_INTELLIGENCE_ENABLED);
    if (!isEnabledValue) {
      throw new Error("Flag ROUTING_INTELLIGENCE_ENABLED should be true.");
    }
    console.log("✔ Active toggle verified as enabled.");

    // Set to false
    await featureFlags.setFlag(FLAGS.ROUTING_INTELLIGENCE_ENABLED, false, "Unit Test flag disablement");
    isEnabledValue = await featureFlags.isEnabled(FLAGS.ROUTING_INTELLIGENCE_ENABLED);
    if (isEnabledValue) {
      throw new Error("Flag ROUTING_INTELLIGENCE_ENABLED should be false.");
    }
    console.log("✔ Inactive toggle verified as disabled.");

    // 3. Test PRODUCTION_AUTOMATION_FREEZE emergency brake
    console.log("[TEST 3] Testing PRODUCTION_AUTOMATION_FREEZE emergency brake interceptor...");
    
    // Enable the automation flags first
    await featureFlags.setFlag(FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS, true);
    await featureFlags.setFlag(FLAGS.COMMISSION_INTELLIGENCE_AUTOMATION, true);
    await featureFlags.setFlag(FLAGS.PUBLIC_API_BILLING, true);
    await featureFlags.setFlag(FLAGS.API_MARKETPLACE_ENABLED, true);

    // Verify they are enabled
    let autoRouting = await featureFlags.isEnabled(FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS);
    let autoComm = await featureFlags.isEnabled(FLAGS.COMMISSION_INTELLIGENCE_AUTOMATION);
    let pubBilling = await featureFlags.isEnabled(FLAGS.PUBLIC_API_BILLING);
    let apiMarket = await featureFlags.isEnabled(FLAGS.API_MARKETPLACE_ENABLED);

    if (!autoRouting || !autoComm || !pubBilling || !apiMarket) {
      throw new Error("Automation flags should be enabled prior to freeze test.");
    }

    // Toggle emergency freeze ON
    await featureFlags.setFlag(FLAGS.PRODUCTION_AUTOMATION_FREEZE, true);

    // Check them now - they must all return false!
    autoRouting = await featureFlags.isEnabled(FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS);
    autoComm = await featureFlags.isEnabled(FLAGS.COMMISSION_INTELLIGENCE_AUTOMATION);
    pubBilling = await featureFlags.isEnabled(FLAGS.PUBLIC_API_BILLING);
    apiMarket = await featureFlags.isEnabled(FLAGS.API_MARKETPLACE_ENABLED);

    if (autoRouting || autoComm || pubBilling || apiMarket) {
      throw new Error("Emergency freeze failed to block autonomous modules!");
    }
    console.log("✔ Emergency Freeze instantly blocked autonomous routing, commission optimizer, public billing, and api marketplace.");

    // Toggle emergency freeze OFF
    await featureFlags.setFlag(FLAGS.PRODUCTION_AUTOMATION_FREEZE, false);

    // Check again - they must return true now
    autoRouting = await featureFlags.isEnabled(FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS);
    autoComm = await featureFlags.isEnabled(FLAGS.COMMISSION_INTELLIGENCE_AUTOMATION);
    pubBilling = await featureFlags.isEnabled(FLAGS.PUBLIC_API_BILLING);
    apiMarket = await featureFlags.isEnabled(FLAGS.API_MARKETPLACE_ENABLED);

    if (!autoRouting || !autoComm || !pubBilling || !apiMarket) {
      throw new Error("Automation flags did not restore after disabling freeze.");
    }
    console.log("✔ Emergency Freeze disabled and restored all configurations smoothly.");

    console.log("✔ ALL FEATURE FLAGS TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ FEATURE FLAGS VERIFICATION FAILED:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
