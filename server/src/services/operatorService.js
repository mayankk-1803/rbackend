import { redisClient } from "../config/redis.js";
import { operatorMap, fallback3DigitMap } from "../utils/operatorMap.js";

const CACHE_TTL = 3600; // 1 hour

export const detectOperator = async (mobile) => {
  // 1. Validate mobile (10 digits)
  if (!mobile || mobile.length < 4 || !/^\d+$/.test(mobile)) {
    return { success: false, message: "Invalid mobile number format", fallback: true };
  }

  // Use only 4 digits for caching
  const prefix4 = mobile.substring(0, 4);
  const cacheKey = `operator_detect:${prefix4}`;

  // 2. Check Redis cache
  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return { success: true, data: JSON.parse(cachedData) };
    }
  } catch (redisErr) {
    console.error("[Operator] Redis cache failed, falling back to local map");
  }

  // 3. Prefix matching
  let matchedOperator = "UNKNOWN";
  let confidence = "LOW";

  // Try 4-digit exact match
  if (operatorMap[prefix4]) {
    matchedOperator = operatorMap[prefix4];
    confidence = "HIGH";
  } else {
    // Try 3-digit fallback
    const prefix3 = mobile.substring(0, 3);
    if (fallback3DigitMap[prefix3]) {
      matchedOperator = fallback3DigitMap[prefix3];
      confidence = "MEDIUM";
    }
  }

  // 4. Fallback if unknown
  if (matchedOperator === "UNKNOWN") {
    console.log(`[Operator] Unknown prefix detected: ${prefix4}`);
    return { success: false, message: "Operator detection failed", fallback: true };
  }

  const displayNames = {
    "JIO": "Jio",
    "AIRTEL": "Airtel",
    "VI": "Vi",
    "BSNL": "BSNL"
  };

  const resultData = { 
    operator: matchedOperator, 
    displayName: displayNames[matchedOperator] || matchedOperator,
    circle: "Unknown", 
    confidence: confidence,
    source: "local_prefix" 
  };

  // 5. Cache result by prefix
  try {
    await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(resultData));
  } catch (redisErr) {
    console.error("[Operator] Failed to set cache for prefix:", prefix4);
  }

  return { success: true, data: resultData };
};
