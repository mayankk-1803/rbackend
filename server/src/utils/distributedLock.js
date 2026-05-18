import { redisClient } from "../config/redis.js";

/**
 * Simple distributed lock using Redis.
 * @param {string} resource - The resource identifier to lock.
 * @param {number} ttl - Time to live in milliseconds.
 * @returns {Promise<boolean>} - True if lock acquired, false otherwise.
 */
export const acquireLock = async (resource, ttl = 5000) => {
  const lockKey = `lock:${resource}`;
  const result = await redisClient.set(lockKey, 'locked', 'PX', ttl, 'NX');
  return result === 'OK';
};

/**
 * Releases the lock.
 * @param {string} resource 
 */
export const releaseLock = async (resource) => {
  const lockKey = `lock:${resource}`;
  await redisClient.del(lockKey);
};

/**
 * Executes a function within a lock.
 */
export const withLock = async (resource, ttl, fn) => {
  const acquired = await acquireLock(resource, ttl);
  if (!acquired) {
    throw new Error(`Could not acquire lock for ${resource}`);
  }
  try {
    return await fn();
  } finally {
    await releaseLock(resource);
  }
};
