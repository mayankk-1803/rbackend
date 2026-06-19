import { redisClient } from "../config/redis.js";

const memoryCache = new Map();
const lookupMap = new Map();
const CACHE_TTL_SECONDS = 15 * 60; // 15 minutes

/**
 * Resolves cache key from mobile number.
 * @param {string} mobile
 * @returns {Promise<string|null>}
 */
const resolveCacheKey = async (mobile) => {
  const lookupKey = `recharge_cache:lookup:${mobile}`;
  if (redisClient && redisClient.status === "ready") {
    try {
      return await redisClient.get(lookupKey);
    } catch (err) {
      console.warn("[Server Cache] Redis lookup get error:", err.message);
    }
  }
  return lookupMap.get(lookupKey) || null;
};

/**
 * Gets cached recharge plans from Redis or local memory map.
 * @param {string} cacheKeyOrMobile
 * @returns {Promise<object|null>}
 */
export const getRechargePlanCache = async (cacheKeyOrMobile) => {
  if (!cacheKeyOrMobile) return null;

  let cacheKey = cacheKeyOrMobile;
  // If it's a 10-digit mobile number, resolve it via lookup
  if (/^[6-9]\d{9}$/.test(cacheKeyOrMobile)) {
    const resolved = await resolveCacheKey(cacheKeyOrMobile);
    if (!resolved) {
      // Fallback: scan memory cache keys as backup
      const prefix = `recharge_cache_${cacheKeyOrMobile}_`;
      for (const key of memoryCache.keys()) {
        if (key.startsWith(prefix)) {
          cacheKey = key;
          break;
        }
      }
      if (cacheKey === cacheKeyOrMobile) return null;
    } else {
      cacheKey = resolved;
    }
  }

  // 1. Try Redis cache
  if (redisClient && redisClient.status === "ready") {
    try {
      const data = await redisClient.get(cacheKey);
      if (data) {
        return JSON.parse(data);
      }
    } catch (err) {
      console.warn("[Server Cache] Redis get error:", err.message);
    }
  }

  // 2. Fallback to Local Memory Map
  const entry = memoryCache.get(cacheKey);
  if (entry) {
    if (Date.now() - entry.fetchedAt < CACHE_TTL_SECONDS * 1000) {
      return entry.data;
    } else {
      memoryCache.delete(cacheKey);
    }
  }

  return null;
};

/**
 * Sets cached recharge plans in Redis or local memory map.
 * @param {string} cacheKey
 * @param {object} data
 * @returns {Promise<void>}
 */
export const setRechargePlanCache = async (cacheKey, data) => {
  if (!cacheKey || !data) return;

  // Extract mobile number from cacheKey (recharge_cache_${mobile}_${operatorCode}_${circleCode})
  let mobile = null;
  const match = cacheKey.match(/recharge_cache_([6-9]\d{9})_/);
  if (match) {
    mobile = match[1];
  }

  // 1. Try Redis cache
  if (redisClient && redisClient.status === "ready") {
    try {
      await redisClient.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(data));
      if (mobile) {
        const lookupKey = `recharge_cache:lookup:${mobile}`;
        await redisClient.setex(lookupKey, CACHE_TTL_SECONDS, cacheKey);
      }
      return;
    } catch (err) {
      console.warn("[Server Cache] Redis set error:", err.message);
    }
  }

  // 2. Fallback to Local Memory Map
  memoryCache.set(cacheKey, {
    data,
    fetchedAt: Date.now()
  });

  if (mobile) {
    const lookupKey = `recharge_cache:lookup:${mobile}`;
    lookupMap.set(lookupKey, cacheKey);
  }
};

/**
 * Clears expired local memory cache entries.
 */
export const removeExpiredCache = () => {
  try {
    const now = Date.now();
    for (const [key, value] of memoryCache.entries()) {
      if (now - value.fetchedAt >= CACHE_TTL_SECONDS * 1000) {
        memoryCache.delete(key);
        // Also remove lookup
        const match = key.match(/recharge_cache_([6-9]\d{9})_/);
        if (match) {
          lookupMap.delete(`recharge_cache:lookup:${match[1]}`);
        }
      }
    }
  } catch (e) {
    console.error("[Server Cache] Error in removeExpiredCache:", e);
  }
};
