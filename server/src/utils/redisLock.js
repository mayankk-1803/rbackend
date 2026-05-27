import { redisClient } from "../config/redis.js";

/**
 * Acquires a distributed Redis lock.
 * @param {string} lockName - Name of the lock
 * @param {number} ttlMs - Time to live in milliseconds
 * @returns {Promise<string|null>} - Returns the lock value (token) if acquired, otherwise null
 */
export const acquireLock = async (lockName, ttlMs = 10000) => {
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  
  // Fallback: If Redis is offline, return a dummy lock token to allow DB transaction fallback
  if (redisClient.status !== "ready") {
    console.warn(`[RedisLock] Redis is offline (status: ${redisClient.status}). Bypassing lock for ${lockName} using DB isolation fallback.`);
    return `dummy_fallback_lock_${token}`;
  }

  try {
    const result = await redisClient.set(`lock:${lockName}`, token, "NX", "PX", ttlMs);
    return result === "OK" ? token : null;
  } catch (err) {
    console.error(`[RedisLock] Failed to acquire lock for ${lockName}:`, err);
    return `dummy_fallback_lock_${token}`;
  }
};

/**
 * Releases a distributed Redis lock safely using Lua scripting.
 * @param {string} lockName - Name of the lock
 * @param {string} token - The lock value (token) returned when acquired
 * @returns {Promise<boolean>}
 */
export const releaseLock = async (lockName, token) => {
  if (!token) return false;
  if (token.startsWith("dummy_fallback_lock_")) return true;
  if (redisClient.status !== "ready") return false;
  
  // Lua script ensures we only release our own lock
  const luaScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  try {
    const result = await redisClient.eval(luaScript, 1, `lock:${lockName}`, token);
    return result === 1;
  } catch (err) {
    console.error(`[RedisLock] Failed to release lock for ${lockName}:`, err);
    return false;
  }
};
