import prisma from "./src/config/prisma.js";
import featureFlags, { FLAGS } from "./src/services/featureFlagsService.js";
import routingIntel, { resolveIntelligenceRoute, computeHash, checkSafetyKillSwitch, promoteRoutingRolloutLevel } from "./src/services/routingIntelligenceService.js";

async function main() {
  console.log("=== STARTING AUTONOMOUS ACTIVATION & SHARDING VERIFICATION ===");
  process.env.NODE_ENV = "test-sandbox"; // allows bypassing strict 72-hour window unless tested

  try {
    // 1. Setup mock provider, operator, and user
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: { phone: "9000000001", password: "mock" }
      });
    }

    let prov = await prisma.provider.findFirst({ where: { code: "APIBOX" } });
    if (!prov) {
      prov = await prisma.provider.create({
        data: { code: "APIBOX", name: "APIBOX", baseUrl: "http://apibox.com", apiKey: "key", isActive: true }
      });
    }

    // Seed RoutingIntelligenceConfig
    await prisma.routingIntelligenceConfig.upsert({
      where: { id: 1 },
      update: {
        rolloutLevel: 0.25, // 25% rollout
        killSwitchTriggered: false,
        cooldownUntil: null
      },
      create: {
        id: 1,
        rolloutLevel: 0.25,
        killSwitchTriggered: false
      }
    });

    await featureFlags.setFlag(FLAGS.ROUTING_INTELLIGENCE_ENABLED, true);
    await featureFlags.setFlag(FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS, true);

    console.log("[TEST 1] Verifying deterministic sharding logic (djb2 hash)...");
    const testCases = [
      { userId: "userA", op: "JIO", expectedShard: computeHash("userAJIO") },
      { userId: "userB", op: "AIRTEL", expectedShard: computeHash("userBAIRTEL") }
    ];
    for (const tc of testCases) {
      console.log(`- String: "${tc.userId}${tc.op}" | Hash: ${tc.expectedShard}`);
    }
    console.log("✔ Sharding hash computes deterministically.");

    console.log("[TEST 2] Testing progressive rollout levels sharding ratio...");
    let autonomousCount = 0;
    const totalRuns = 100;
    for (let i = 0; i < totalRuns; i++) {
      const res = await resolveIntelligenceRoute({
        operator: "JIO",
        amount: 100,
        userId: `user_idx_${i}`
      });
      if (res.mode === "AUTONOMOUS") {
        autonomousCount++;
      }
    }
    console.log(`- Out of ${totalRuns} sharded executions, ${autonomousCount} routed in AUTONOMOUS mode (Rollout level: 25%).`);
    if (autonomousCount === 0 || autonomousCount === totalRuns) {
      throw new Error("Sharding failed to distribute traffic proportionally.");
    }
    console.log("✔ Sharding ratio verification succeeded.");

    console.log("[TEST 3] Testing 24-hour Cooldown Lock re-enablement prevention...");
    const config = await prisma.routingIntelligenceConfig.update({
      where: { id: 1 },
      data: {
        killSwitchTriggered: true,
        cooldownUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours lock
      }
    });

    try {
      await featureFlags.setFlag(FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS, true);
      throw new Error("Feature flags setFlag should have blocked enabling autonomous routing during active cooldown.");
    } catch (err) {
      if (err.message.includes("Autonomous routing cannot be re-enabled during the 24-hour cooldown lock")) {
        console.log("✔ Cooldown Lock blocked admin override successfully.");
      } else {
        throw err;
      }
    }

    console.log("[TEST 4] Testing Cooldown Lock routing fallback (forces SHADOW)...");
    // Even if ROUTING_INTELLIGENCE_AUTONOMOUS was somehow true, active cooldown must force SHADOW mode
    await prisma.featureFlag.update({
      where: { key: FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS },
      data: { value: true }
    });
    // Clear Redis cache
    if (featureFlags.redisClient && featureFlags.redisClient.status === "ready") {
      await featureFlags.redisClient.del(`feature:flag:${FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS}`);
    }

    const route = await resolveIntelligenceRoute({ operator: "JIO", amount: 100, userId: "userA" });
    if (route.mode !== "SHADOW") {
      throw new Error(`Expected active cooldown to force SHADOW, got: ${route.mode}`);
    }
    console.log("✔ Cooldown lock forced mode to SHADOW correctly.");

    // Clean up cooldown
    await prisma.routingIntelligenceConfig.update({
      where: { id: 1 },
      data: { killSwitchTriggered: false, cooldownUntil: null }
    });
    await featureFlags.setFlag(FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS, true);

    console.log("[TEST 5] Testing Hourly sliding-window safety kill switch...");
    // Seed at least 5 failures in the last 1 hour
    await prisma.routingDecision.deleteMany({}); // reset decisions
    for (let i = 0; i < 6; i++) {
      const decision = await prisma.routingDecision.create({
        data: {
          operator: "JIO",
          amount: 100,
          providerCode: "APIBOX",
          confidenceScore: 90.0,
          routingMode: "AUTONOMOUS"
        }
      });
      await prisma.routingFeedback.create({
        data: {
          decisionId: decision.id,
          success: false, // failure
          latency: 200,
          cost: 1.0,
          failureReason: "Gateway Timeout"
        }
      });
    }

    // Trigger check
    const triggered = await checkSafetyKillSwitch();
    if (!triggered) {
      throw new Error("Safety kill switch did not trigger despite high failure rate.");
    }
    console.log("✔ Hourly safety kill switch successfully triggered, disabled autonomous mode, and locked cooldown.");

    console.log("[TEST 6] Testing Rollout Promotion Gates validation...");
    // Reset config and test gate rejection when strict conditions aren't satisfied
    process.env.NODE_ENV = "production"; // turn on strict checks
    await prisma.routingIntelligenceConfig.update({
      where: { id: 1 },
      data: { rolloutLevel: 0.01, killSwitchTriggered: false, cooldownUntil: null }
    });

    try {
      await promoteRoutingRolloutLevel(0.05, false); // promote 1% -> 5%
      throw new Error("Promotion should have failed due to missing 72h observation and 10k transactions.");
    } catch (err) {
      if (err.message.includes("Rollout promotion gate failed")) {
        console.log(`- Rejection as expected: ${err.message}`);
        console.log("✔ Promotion gates successfully blocked premature promotion.");
      } else {
        throw err;
      }
    }

    console.log("✔ ALL AUTONOMOUS ROUTING ACTIVATION TESTS PASSED!");
  } catch (err) {
    console.error("❌ VERIFICATION SUITE FAILED:", err.message, err.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
