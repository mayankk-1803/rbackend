import { redisClient } from "../../config/redis.js";
import prisma from "../../config/prisma.js";

// Keys Namespaces
export const REDIS_KEYS = {
  RULES: "routing:rules",
  PROVIDERS: "routing:providers",
  HEALTH: "routing:health",
  OVERRIDES: "routing:overrides",
  CIRCUIT_BREAKER: "routing:circuitbreaker",
  FEATURE_FLAGS: "routing:featureflags",
  TRAFFIC: "routing:traffic",
  COSTS: "routing:costs"
};

// Default Feature Flags
export const DEFAULT_FEATURE_FLAGS = {
  shadowRoutingEnabled: "true",
  smartRoutingEnabled: "false",
  weightedRoutingEnabled: "false",
  healthRoutingEnabled: "false",
  emergencyOverrideEnabled: "false",
  circuitBreakerEnabled: "false",
  routeSimulationEnabled: "true",
  trafficPercentage: "0"
};

/**
 * Rebuilds the entire routing configurations namespace in Redis from DB records.
 */
export const rebuildRoutingCache = async () => {
  try {
    console.log("[REDIS_CACHE] Rebuilding routing cache...");
    const pipeline = redisClient.pipeline();

    // 1. Clear old routing namespace keys
    const allKeys = Object.values(REDIS_KEYS);
    for (const key of allKeys) {
      pipeline.del(key);
    }

    // 2. Load and cache Feature Flags (initialize with defaults if not populated)
    const existingFlags = await redisClient.hgetall(REDIS_KEYS.FEATURE_FLAGS);
    if (!existingFlags || Object.keys(existingFlags).length === 0) {
      pipeline.hset(REDIS_KEYS.FEATURE_FLAGS, DEFAULT_FEATURE_FLAGS);
    }

    // 3. Load & Cache Providers list
    const providers = await prisma.provider.findMany();
    for (const prov of providers) {
      pipeline.hset(REDIS_KEYS.PROVIDERS, prov.code.toUpperCase(), JSON.stringify(prov));
    }

    // 4. Load & Cache Operator Mappings
    const mappings = await prisma.operatorProviderMapping.findMany({
      where: { isActive: true },
      include: { operator: true, provider: true }
    });
    // Store mappings grouped by operatorId
    const mappingsGrouped = {};
    for (const m of mappings) {
      if (!mappingsGrouped[m.operatorId]) {
        mappingsGrouped[m.operatorId] = [];
      }
      mappingsGrouped[m.operatorId].push({
        providerId: m.providerId,
        providerCode: m.provider.code.toUpperCase(),
        providerOperatorCode: m.providerOperatorCode,
        providerCircleCode: m.providerCircleCode,
        priority: m.priority
      });
    }
    for (const opId in mappingsGrouped) {
      pipeline.hset("routing:mappings", opId, JSON.stringify(mappingsGrouped[opId]));
    }

    // 5. Load & Cache Routing Rules
    const rules = await prisma.routingRule.findMany({
      where: { isActive: true, isDeleted: false },
      include: { operator: true, provider: true }
    });
    for (const rule of rules) {
      pipeline.hset(REDIS_KEYS.RULES, rule.id.toString(), JSON.stringify(rule));
    }

    // 6. Load & Cache Provider Costs
    const costs = await prisma.providerCost.findMany({
      where: { isActive: true }
    });
    for (const cost of costs) {
      pipeline.hset(REDIS_KEYS.COSTS, cost.providerId.toString(), JSON.stringify(cost));
    }

    // 7. Initialize Health Metrics
    const healthMetrics = await prisma.providerHealthMetrics.findMany();
    for (const hm of healthMetrics) {
      const provider = providers.find(p => p.id === hm.providerId);
      if (provider) {
        pipeline.hset(REDIS_KEYS.HEALTH, provider.code.toUpperCase(), JSON.stringify(hm));
      }
    }

    // 8. Execute pipeline atomically
    await pipeline.exec();
    console.log("[REDIS_CACHE] Routing cache rebuild completed successfully.");
    return { success: true, message: "Cache rebuilt successfully" };
  } catch (error) {
    console.error("[REDIS_CACHE] Failed to rebuild routing cache:", error.message);
    throw error;
  }
};

/**
 * Gets a feature flag value from Redis.
 */
export const getFeatureFlag = async (flagName) => {
  try {
    const val = await redisClient.hget(REDIS_KEYS.FEATURE_FLAGS, flagName);
    if (val === null) {
      return DEFAULT_FEATURE_FLAGS[flagName] === "true" || DEFAULT_FEATURE_FLAGS[flagName] === "1";
    }
    return val === "true" || val === "1";
  } catch (err) {
    console.error(`[REDIS_CACHE] Failed to read flag ${flagName}, returning default:`, err.message);
    return DEFAULT_FEATURE_FLAGS[flagName] === "true";
  }
};

/**
 * Sets a feature flag value in Redis.
 */
export const setFeatureFlag = async (flagName, value) => {
  await redisClient.hset(REDIS_KEYS.FEATURE_FLAGS, flagName, value.toString());
};

/**
 * Increments the global RoutingConfig version.
 */
export const incrementRoutingConfigVersion = async (userIdOrEmail) => {
  try {
    const updated = await prisma.routingConfig.update({
      where: { id: 1 },
      data: {
        currentVersion: { increment: 1 },
        lastModifiedBy: String(userIdOrEmail || "SYSTEM"),
        lastModifiedAt: new Date()
      }
    });
    console.log(`[ROUTING_CONFIG] Version incremented to ${updated.currentVersion} by ${userIdOrEmail}`);
    return updated;
  } catch (err) {
    console.error("[ROUTING_CONFIG] Failed to increment RoutingConfig version:", err.message);
  }
};

export default {
  REDIS_KEYS,
  DEFAULT_FEATURE_FLAGS,
  rebuildRoutingCache,
  getFeatureFlag,
  setFeatureFlag,
  incrementRoutingConfigVersion
};
