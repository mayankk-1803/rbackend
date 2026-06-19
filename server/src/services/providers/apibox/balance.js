import { redisClient } from "../../../config/redis.js";
import { apiboxRequest } from "./client.js";

/**
 * Fetches current wallet balance from Apibox with caching and resiliency
 */
export const getBalance = async (isP2A = false) => {
  const CACHE_KEY = isP2A ? "provider:apibox:balance:p2a" : "provider:apibox:balance";
  const BREAKER_KEY = "provider:apibox:breaker";

  try {
    // 1. Check Circuit Breaker
    let isBroken = null;
    try {
      isBroken = await redisClient.get(BREAKER_KEY);
    } catch (redisErr) {
      console.error("[APIBOX][REDIS_ERROR] Failed to read breaker state:", redisErr.message);
    }

    if (isBroken) {
      let cachedBalance = null;
      try {
        cachedBalance = await redisClient.get(CACHE_KEY);
      } catch (redisErr) {
        console.error("[APIBOX][REDIS_ERROR] Failed to read cached balance:", redisErr.message);
      }
      return { 
        success: true, 
        cached: true, 
        providerAvailable: false,
        balance: Number(cachedBalance || 0),
        message: "Provider in cooldown"
      };
    }

    const params = {
      P2A: "true"
    };
    const responseData = await apiboxRequest("/Balance", params, false);

    if (responseData && responseData.STATUS === 1) {
      const balance = Number(responseData.BALANCE || 0);
      // Update Cache
      try {
        await redisClient.setex(CACHE_KEY, 3600, balance.toString());
        // Reset Breaker failures on success
        await redisClient.del(`${BREAKER_KEY}:failures`);
      } catch (redisErr) {
        console.error("[APIBOX][REDIS_ERROR] Failed to write cache:", redisErr.message);
      }
      
      return {
        success: true,
        cached: false,
        providerAvailable: true,
        balance,
        raw: responseData
      };
    }

    throw new Error(responseData?.MESSAGE || "Provider reported error");

  } catch (error) {
    console.error(`[APIBOX][BALANCE_ERROR]:`, error.message);
    
    // Increment Failure Count for Breaker
    try {
      const failureCount = await redisClient.incr(`${BREAKER_KEY}:failures`);
      if (failureCount === 1) await redisClient.expire(`${BREAKER_KEY}:failures`, 300);
      
      if (failureCount >= 3) {
        console.warn(`[APIBOX][CIRCUIT_BREAKER] Tripping breaker for 2 minutes`);
        await redisClient.setex(BREAKER_KEY, 120, "broken");
      }
    } catch (redisErr) {
      console.error("[APIBOX][REDIS_ERROR] Failed to update breaker failures:", redisErr.message);
    }

    // Return Cached Balance as fallback
    let cachedBalance = null;
    try {
      cachedBalance = await redisClient.get(CACHE_KEY);
    } catch (redisErr) {
      console.error("[APIBOX][REDIS_ERROR] Failed to read fallback cached balance:", redisErr.message);
    }
    return { 
      success: true, 
      cached: true, 
      providerAvailable: false,
      balance: Number(cachedBalance || 0),
      message: error.message
    };
  }
};
