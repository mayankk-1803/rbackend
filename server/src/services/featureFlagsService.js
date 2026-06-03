import prisma from "../config/prisma.js";
import { redisClient } from "../config/redis.js";
import logger from "./logging/logger.js";

const CACHE_PREFIX = "feature:flag:";

export const FLAGS = {
  ROUTING_INTELLIGENCE_ENABLED: "ROUTING_INTELLIGENCE_ENABLED",
  ROUTING_INTELLIGENCE_AUTONOMOUS: "ROUTING_INTELLIGENCE_AUTONOMOUS",
  COMMISSION_INTELLIGENCE_ENABLED: "COMMISSION_INTELLIGENCE_ENABLED",
  COMMISSION_INTELLIGENCE_AUTOMATION: "COMMISSION_INTELLIGENCE_AUTOMATION",
  API_MARKETPLACE_ENABLED: "API_MARKETPLACE_ENABLED",
  PRODUCTION_AUTOMATION_FREEZE: "PRODUCTION_AUTOMATION_FREEZE",
  PUBLIC_API_BILLING: "PUBLIC_API_BILLING"
};

/**
 * Checks if a feature flag is enabled.
 * First queries Redis. Falls back to Prisma DB. Toggles instantly.
 */
export const isEnabled = async (key) => {
  // Global Emergency Freeze Interceptor:
  // If the emergency freeze is enabled, we immediately block autonomous/automation modules.
  if (key !== FLAGS.PRODUCTION_AUTOMATION_FREEZE) {
    const isFrozen = await isEnabled(FLAGS.PRODUCTION_AUTOMATION_FREEZE);
    if (isFrozen) {
      if (
        key === FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS ||
        key === FLAGS.COMMISSION_INTELLIGENCE_AUTOMATION ||
        key === FLAGS.PUBLIC_API_BILLING ||
        key === FLAGS.API_MARKETPLACE_ENABLED
      ) {
        logger.warn(`[EMERGENCY AUTOMATION FREEZE] Blocked invocation of key: ${key}`);
        return false;
      }
    }
  }

  const cacheKey = `${CACHE_PREFIX}${key}`;
  
  if (redisClient && redisClient.status === "ready") {
    try {
      // 1. Query Redis Cache
      const cachedValue = await redisClient.get(cacheKey);
      if (cachedValue !== null) {
        return cachedValue === "true";
      }
    } catch (err) {
      logger.error("Redis error reading feature flag, fallback to DB", { key, error: err.message });
    }
  }

  try {
    // 2. Query Prisma DB
    const flag = await prisma.featureFlag.findUnique({
      where: { key }
    });

    const value = flag ? flag.value : false;

    // 3. Cache value in Redis if connection is open
    if (redisClient && redisClient.status === "ready") {
      await redisClient.setex(cacheKey, 10, value ? "true" : "false").catch(() => {});
    }
    return value;
  } catch (err) {
    logger.error("Database error reading feature flag, default to false", { key, error: err.message });
    return false;
  }
};

/**
 * Sets/Toggles a feature flag in DB and invalidates/updates Redis cache immediately.
 */
export const setFlag = async (key, value, description = null) => {
  try {
    // Prevent enabling autonomous routing while cooldown is active
    if (key === FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS && value === true) {
      const config = await prisma.routingIntelligenceConfig.findUnique({
        where: { id: 1 }
      });
      if (config && config.killSwitchTriggered && config.cooldownUntil && new Date() < config.cooldownUntil) {
        throw new Error("Autonomous routing cannot be re-enabled during the 24-hour cooldown lock.");
      }
    }

    const flag = await prisma.featureFlag.upsert({
      where: { key },
      update: { value, description: description || undefined },
      create: { key, value, description }
    });

    if (redisClient && redisClient.status === "ready") {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      await redisClient.set(cacheKey, value ? "true" : "false").catch(() => {});
    }
    logger.info("Feature flag updated successfully", { key, value });
    return flag;
  } catch (err) {
    logger.error("Failed to update feature flag", { key, value, error: err.message });
    throw err;
  }
};

/**
 * Seeds initial flags if missing in database
 */
export const seedInitialFlags = async () => {
  const initialFlags = [
    { key: FLAGS.ROUTING_INTELLIGENCE_ENABLED, value: false, description: "Enables assisted and shadow routing intelligence modes" },
    { key: FLAGS.ROUTING_INTELLIGENCE_AUTONOMOUS, value: false, description: "Enables autonomous routing provider overrides" },
    { key: FLAGS.COMMISSION_INTELLIGENCE_ENABLED, value: false, description: "Enables commission optimization algorithms and replay" },
    { key: FLAGS.COMMISSION_INTELLIGENCE_AUTOMATION, value: false, description: "Enables automatic commission recommendation checker rules" },
    { key: FLAGS.API_MARKETPLACE_ENABLED, value: false, description: "Enables the fintech API Marketplace plans and subscriptions" },
    { key: FLAGS.PUBLIC_API_BILLING, value: false, description: "Enables billing charging for API Marketplace calls" },
    { key: FLAGS.PRODUCTION_AUTOMATION_FREEZE, value: false, description: "Global emergency brake that instantly freezes all automations" }
  ];

  for (const f of initialFlags) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      update: { description: f.description },
      create: f
    }).catch(() => {});
    
    if (redisClient && redisClient.status === "ready") {
      await redisClient.set(`${CACHE_PREFIX}${f.key}`, "false").catch(() => {});
    }
  }
};

export default {
  isEnabled,
  setFlag,
  seedInitialFlags,
  FLAGS
};
