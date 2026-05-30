import prisma from "../config/prisma.js";
import { redisClient } from "../config/redis.js";
import { rechargeQueue } from "../config/rechargeQueue.js";
import logger from "./logging/logger.js";
import { REAL_TO_ALIAS, mapProviderToAlias } from "../config/providerAliases.js";

const CACHE_KEY = "dizipay:telemetry_snapshot";
const CACHE_TTL = 10; // 10 seconds refresh interval

/**
 * Enterprise Telemetry Health Classification
 * @param {number} successRate 
 * @param {number} latency 
 * @returns {string}
 */
export const classifyHealthStatus = (successRate, latency) => {
  if (successRate === null || latency === null) {
    return "Unknown";
  }
  const rate = Number(successRate);
  const lat = Number(latency);

  if (rate >= 98 && lat < 1500) {
    return "HEALTHY";
  } else if (rate >= 90 && lat < 5000) {
    return "DEGRADED";
  } else if (rate >= 70) {
    return "UNSTABLE";
  } else {
    return "DOWN";
  }
};

/**
 * Calculate dynamic successRate, avgResponseTime and healthStatus for a provider Code from ProviderHealthLog.
 */
export const getDynamicTelemetry = async (providerCode) => {
  try {
    const logs = await prisma.providerHealthLog.findMany({
      where: { providerCode },
      take: 50,
      orderBy: { createdAt: "desc" }
    });

    if (logs.length === 0) {
      return {
        successRate: null,
        avgResponseTime: null,
        healthStatus: "Unknown"
      };
    }

    const healthyLogs = logs.filter(log => log.status === "HEALTHY").length;
    const successRate = Number(((healthyLogs / logs.length) * 100).toFixed(2));
    const avgResponseTime = Math.round(logs.reduce((sum, log) => sum + log.latency, 0) / logs.length);
    const healthStatus = classifyHealthStatus(successRate, avgResponseTime);

    return {
      successRate,
      avgResponseTime,
      healthStatus
    };
  } catch (err) {
    logger.error("Failed to compute dynamic telemetry for " + providerCode, { error: err.message });
    return {
      successRate: null,
      avgResponseTime: null,
      healthStatus: "Unknown"
    };
  }
};

/**
 * Retrieves the live status of the BullMQ recharge queue
 */
export const getLiveQueueStatus = async () => {
  try {
    let activeJobs = 0;
    let waitingJobs = 0;
    let delayedJobs = 0;
    let failedJobs = 0;
    let completedJobs = 0;

    if (rechargeQueue) {
      activeJobs = await rechargeQueue.getActiveCount().catch(() => 0);
      waitingJobs = await rechargeQueue.getWaitingCount().catch(() => 0);
      delayedJobs = await rechargeQueue.getDelayedCount().catch(() => 0);
      failedJobs = await rechargeQueue.getFailedCount().catch(() => 0);
      completedJobs = await rechargeQueue.getCompletedCount().catch(() => 0);
    }

    return {
      activeJobs,
      waitingJobs,
      delayedJobs,
      failedJobs,
      completedJobs,
      total: activeJobs + waitingJobs + delayedJobs + failedJobs
    };
  } catch (error) {
    logger.error("Failed to fetch live queue counts", { error: error.message });
    return {
      activeJobs: 0,
      waitingJobs: 0,
      delayedJobs: 0,
      failedJobs: 0,
      completedJobs: 0,
      total: 0
    };
  }
};

/**
 * Returns a cached telemetry summary of providers and recent health logs
 */
export const getTelemetryDataCached = async () => {
  try {
    // 1. Attempt to fetch telemetry snapshot from Redis
    const cachedData = await redisClient.get(CACHE_KEY).catch((err) => {
      logger.error("Redis read error in telemetryService", { error: err.message });
      return null;
    });

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    // 2. Fetch fresh data from DB on cache miss
    const [healthLogs, decisionLogs, providers] = await Promise.all([
      prisma.providerHealthLog.findMany({
        take: 30,
        orderBy: { createdAt: "desc" }
      }),
      prisma.routingDecisionLog.findMany({
        take: 30,
        orderBy: { createdAt: "desc" }
      }),
      prisma.provider.findMany({
        orderBy: { priority: "desc" }
      })
    ]);

    // 3. Fetch fresh queue stats from BullMQ
    const queueStatus = await getLiveQueueStatus();

    // 4. Group rolling stats & enrich providers with live status
    const enrichedProviders = await Promise.all(providers.map(async (p) => {
      const dynamic = await getDynamicTelemetry(p.code);
      const aliased = mapProviderToAlias(p);
      return {
        ...aliased,
        successRate: dynamic.successRate,
        avgResponseTime: dynamic.avgResponseTime,
        healthStatus: dynamic.healthStatus,
        currentQueue: queueStatus.activeJobs + queueStatus.waitingJobs // Dynamic queue count
      };
    }));

    // 5. Map logs to aliases
    const mappedHealthLogs = healthLogs.map(log => ({
      ...log,
      providerCode: REAL_TO_ALIAS[log.providerCode?.toUpperCase()] || log.providerCode
    }));

    const mappedDecisionLogs = decisionLogs.map(log => ({
      ...log,
      recommendedProvider: REAL_TO_ALIAS[log.recommendedProvider?.toUpperCase()] || log.recommendedProvider,
      executedProvider: REAL_TO_ALIAS[log.executedProvider?.toUpperCase()] || log.executedProvider
    }));

    const telemetryPayload = {
      healthLogs: mappedHealthLogs,
      decisionLogs: mappedDecisionLogs,
      queueStatus,
      providers: enrichedProviders,
      timestamp: Date.now()
    };

    // 6. Store in Redis cache with TTL
    await redisClient.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(telemetryPayload)).catch((err) => {
      logger.error("Redis write error in telemetryService", { error: err.message });
    });

    return telemetryPayload;
  } catch (error) {
    logger.error("Telemetry service summary failure", { error: error.message });
    // Safe fallback
    return {
      healthLogs: [],
      decisionLogs: [],
      queueStatus: { activeJobs: 0, waitingJobs: 0, delayedJobs: 0, failedJobs: 0, completedJobs: 0, total: 0 },
      providers: [],
      timestamp: Date.now()
    };
  }
};

export default {
  classifyHealthStatus,
  getLiveQueueStatus,
  getTelemetryDataCached,
  getDynamicTelemetry
};

