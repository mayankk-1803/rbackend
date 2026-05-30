import prisma from "../../config/prisma.js";
import logger from "../logging/logger.js";
import { redisClient } from "../../config/redis.js";

/**
 * Enterprise Provider Health Telemetry Service
 */
export const recordProviderHealth = async (providerCode, status, latencyMs, message = "") => {
  try {
    // 1. Write telemetry log to ProviderHealthLog
    await prisma.providerHealthLog.create({
      data: {
        providerCode,
        status,
        latency: Math.round(latencyMs),
        message: message || "Automatic health log"
      }
    });

    // 2. Refresh average success/latency status in primary provider table
    const provider = await prisma.provider.findUnique({ where: { code: providerCode } });
    if (provider) {
      const avgResponseTime = Math.round((provider.avgResponseTime * 9 + latencyMs) / 10);
      const isHealthy = status === "HEALTHY";
      const successRate = Number(((provider.successRate * 9 + (isHealthy ? 100 : 0)) / 10).toFixed(2));

      await prisma.provider.update({
        where: { id: provider.id },
        data: {
          avgResponseTime,
          successRate,
          healthStatus: isHealthy ? "HEALTHY" : "DOWN",
          lastCheckAt: new Date()
        }
      });
    }

    logger.debug(`[TELEMETRY] Recorded health for ${providerCode}`, { status, latencyMs });
  } catch (error) {
    logger.error("Failed to write provider health logs", { error: error.message, providerCode });
  }
};

/**
 * Returns real-time health telemetry summary of active nodes
 */
export const getActiveTelemetrySummary = async () => {
  try {
    const providers = await prisma.provider.findMany();
    const logs = await prisma.providerHealthLog.findMany({
      take: 20,
      orderBy: { createdAt: "desc" }
    });

    return {
      providers: providers.map(p => ({
        code: p.code,
        name: p.name,
        isActive: p.isActive,
        successRate: p.successRate,
        avgResponseTime: p.avgResponseTime,
        healthStatus: p.healthStatus,
        lastCheckAt: p.lastCheckAt
      })),
      recentLogs: logs
    };
  } catch (error) {
    logger.error("Failed to fetch active telemetry summary", { error: error.message });
    return { providers: [], recentLogs: [] };
  }
};

export default {
  recordProviderHealth,
  getActiveTelemetrySummary
};
