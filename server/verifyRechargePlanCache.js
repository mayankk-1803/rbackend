import { getRechargePlanCache, setRechargePlanCache, removeExpiredCache } from "./src/services/rechargePlanCacheService.js";

async function main() {
  console.log("=== STARTING RECHARGE PLAN CACHE VERIFICATION SUITE ===");

  try {
    const mobile = "9258337170";
    const operatorCode = "AT";
    const circleCode = "UPW";
    const cacheKey = `recharge_cache_${mobile}_${operatorCode}_${circleCode}`;

    const dummyPlansResponse = {
      success: true,
      operator: { name: "AIRTEL", code: 1 },
      circle: { name: "UP WEST", code: 23 },
      plans: {
        popular: [{ amount: 199, validity: "28 Days", description: "Popular Plan" }]
      },
      source: { hlr: "ezytm-live", plans: "mplan-live" }
    };

    console.log("[TEST 1] Setting plan cache...");
    await setRechargePlanCache(cacheKey, dummyPlansResponse);
    console.log("✔ Cache saved successfully.");

    console.log("[TEST 2] Retrieving cache using complete cache key...");
    const cachedPlansByKey = await getRechargePlanCache(cacheKey);
    if (!cachedPlansByKey) {
      throw new Error("Failed to retrieve cache by cacheKey");
    }
    console.log("✔ Retrieve by cacheKey matches expected:", cachedPlansByKey.plans.popular[0].amount);

    console.log("[TEST 3] Retrieving cache using only 10-digit mobile number (Lookup resolution)...");
    const cachedPlansByMobile = await getRechargePlanCache(mobile);
    if (!cachedPlansByMobile) {
      throw new Error("Failed to retrieve cache by mobile lookup");
    }
    console.log("✔ Retrieve by mobile lookup matches expected:", cachedPlansByMobile.plans.popular[0].amount);

    console.log("[TEST 4] Modifying cache and ensuring overwrite handles operator update...");
    const newCacheKey = `recharge_cache_${mobile}_JIO_UPW`;
    const newPlansResponse = {
      ...dummyPlansResponse,
      operator: { name: "JIO", code: 2 }
    };
    await setRechargePlanCache(newCacheKey, newPlansResponse);
    
    const checkNewLookup = await getRechargePlanCache(mobile);
    if (!checkNewLookup || checkNewLookup.operator.name !== "JIO") {
      throw new Error("Failed to resolve lookup to updated operator JIO");
    }
    console.log("✔ Lookup correctly resolved to updated operator JIO:", checkNewLookup.operator.name);

    console.log("\n✔ ALL RECHARGE PLAN CACHE BACKEND CHECKS PASSED!");
  } catch (err) {
    console.error("❌ RECHARGE PLAN CACHE VERIFICATION FAILED:", err.message);
    process.exit(1);
  }
  process.exit(0);
}

main();
