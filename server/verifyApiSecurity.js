import prisma from "./src/config/prisma.js";
import { redisClient } from "./src/config/redis.js";
import { checkPlanRateLimit } from "./src/services/apiMarketplaceService.js";

// Mock Redis client status and pipeline commands to test rate-limiting sliding windows
redisClient.status = "ready";
const mockStore = {};
redisClient.incr = async (key) => {
  mockStore[key] = (mockStore[key] || 0) + 1;
  return mockStore[key];
};
redisClient.expire = async () => 1;

async function main() {
  console.log("=== STARTING API SECURITY VERIFICATION SUITE ===");

  try {
    const clientId = 88771;
    const plan = {
      requestsPerMinute: 2, // low limit for quick testing
      requestsPerHour: 10,
      requestsPerDay: 50
    };

    console.log("[TEST 1] Verifying rate limit passes within limits...");
    let limitCheck = await checkPlanRateLimit(clientId, plan);
    if (!limitCheck.ok) {
      throw new Error("Rate limit check failed unexpectedly.");
    }
    
    limitCheck = await checkPlanRateLimit(clientId, plan);
    if (!limitCheck.ok) {
      throw new Error("Rate limit check failed unexpectedly on second request.");
    }
    console.log("✔ Sliding-window check allowed requests within rate limits.");

    console.log("[TEST 2] Verifying rate limit lock breaches and threat logs...");
    // Third call should trigger limit breach
    limitCheck = await checkPlanRateLimit(clientId, plan);
    if (limitCheck.ok) {
      throw new Error("Rate limit check should have blocked the third request!");
    }
    console.log(`✔ Breach blocked successfully (Key locked at limit: ${limitCheck.limit}, Current requests: ${limitCheck.current}).`);

    // Verify threat log creation
    const threatRecord = await prisma.apiThreatLog.findFirst({
      where: { clientId, threatType: "RATE_LIMIT" }
    });
    if (!threatRecord) {
      throw new Error("Rate limit breach failed to generate a Threat Log entry!");
    }
    console.log(`✔ Persisted threat logged (Threat: ${threatRecord.threatType}, Details: ${threatRecord.details}).`);

    console.log("✔ ALL API SECURITY TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ API SECURITY VERIFICATION FAILED:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
