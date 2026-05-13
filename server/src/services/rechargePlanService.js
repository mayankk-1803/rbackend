import { redisClient } from "../config/redis.js";

const CACHE_TTL = 86400; // 24 hours

const fallbackPlans = {
  JIO: [
    { amount: 299, validity: "28 Days", data: "2GB/Day", description: "Unlimited Calls + 100 SMS/Day", category: "POPULAR" },
    { amount: 666, validity: "84 Days", data: "1.5GB/Day", description: "Unlimited Calls + Jio Apps", category: "BEST VALUE" },
    { amount: 749, validity: "90 Days", data: "2GB/Day", description: "Unlimited Calls + 100 SMS/Day", category: "BEST VALUE" },
    { amount: 2999, validity: "365 Days", data: "2.5GB/Day", description: "Unlimited Calls + 100 SMS/Day + JioTV", category: "YEARLY" },
    { amount: 155, validity: "28 Days", data: "2GB Total", description: "Unlimited Calls + 300 SMS", category: "BUDGET" }
  ],
  AIRTEL: [
    { amount: 299, validity: "28 Days", data: "1.5GB/Day", description: "Truly Unlimited Calls + 100 SMS/Day", category: "POPULAR" },
    { amount: 479, validity: "56 Days", data: "1.5GB/Day", description: "Unlimited Calls + Apollo 24|7 Circle", category: "BEST VALUE" },
    { amount: 719, validity: "84 Days", data: "1.5GB/Day", description: "Truly Unlimited Calls + Xstream Mobile", category: "BEST VALUE" },
    { amount: 3359, validity: "365 Days", data: "2.5GB/Day", description: "Disney+ Hotstar + Amazon Prime", category: "YEARLY" },
    { amount: 179, validity: "28 Days", data: "2GB Total", description: "Unlimited Calls + 300 SMS", category: "BUDGET" }
  ],
  VI: [
    { amount: 299, validity: "28 Days", data: "1.5GB/Day", description: "Binge All Night + Weekend Rollover", category: "POPULAR" },
    { amount: 479, validity: "56 Days", data: "1.5GB/Day", description: "Truly Unlimited + Vi Movies & TV", category: "BEST VALUE" },
    { amount: 719, validity: "84 Days", data: "1.5GB/Day", description: "Binge All Night + Data Delight", category: "BEST VALUE" },
    { amount: 3099, validity: "365 Days", data: "2GB/Day", description: "Disney+ Hotstar Mobile included", category: "YEARLY" },
    { amount: 155, validity: "24 Days", data: "1GB Total", description: "Truly Unlimited + 300 SMS", category: "BUDGET" }
  ],
  BSNL: [
    { amount: 197, validity: "70 Days", data: "2GB/Day", description: "Unlimited Calls for first 18 days", category: "POPULAR" },
    { amount: 397, validity: "150 Days", data: "2GB/Day", description: "Free calls for 30 days", category: "BEST VALUE" },
    { amount: 797, validity: "300 Days", data: "2GB/Day", description: "Free calls for 60 days", category: "YEARLY" },
    { amount: 107, validity: "35 Days", data: "3GB Total", description: "Unlimited Incoming + 200 min local", category: "BUDGET" }
  ]
};

export const fetchPlans = async (mobile, operator) => {
  const normalizedOp = operator.toUpperCase();
  const cacheKey = `plans:${normalizedOp}`;

  // 1. Check Redis Cache
  try {
    const cachedPlans = await redisClient.get(cacheKey);
    if (cachedPlans) {
      return { success: true, data: JSON.parse(cachedPlans) };
    }
  } catch (err) {
    console.error("[Plans] Redis error:", err);
  }

  // 2. Mock Real Fetch (In future, call provider specific plan API)
  // For now, use high-quality structured plans
  const plans = fallbackPlans[normalizedOp] || [];

  // 3. Cache results
  if (plans.length > 0) {
    try {
      await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(plans));
    } catch (err) {
      console.error("[Plans] Failed to cache:", err);
    }
  }

  return { success: true, data: plans };
};
