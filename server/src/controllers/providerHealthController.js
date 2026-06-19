import prisma from "../config/prisma.js";
import { getMetricsReport } from "../services/webhookMonitoringService.js";

/**
 * GET /api/admin/provider-health/metrics
 * Fetch dynamic telemetry for active gateways (APIBOX, etc.) and webhook delays.
 */
export const getProviderHealthMetrics = async (req, res) => {
  try {
    // 1. Fetch provider details from database
    const providers = await prisma.provider.findMany({
      include: {
        healthMetrics: true
      }
    });

    // 2. Fetch webhook outcome metrics
    const webhookMetrics = await getMetricsReport();

    // 3. Format and attach health alert status (Green/Yellow/Red)
    const formattedProviders = providers.map(p => {
      const stats = p.healthMetrics || {
        latency: p.avgResponseTime || 0,
        successRate: p.successRate || 100,
        failureRate: 0,
        healthScore: 100
      };

      const successRate = Number(stats.successRate);
      let alertColor = "GREEN";
      
      if (!p.isActive || p.isBlacklisted || p.healthStatus === "DOWN" || successRate < 80) {
        alertColor = "RED";
      } else if (p.healthStatus === "DEGRADED" || successRate < 93) {
        alertColor = "YELLOW";
      }

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        isActive: p.isActive,
        isBlacklisted: p.isBlacklisted,
        healthStatus: p.healthStatus,
        latency: Number(stats.latency.toFixed(2)),
        successRate: Number(successRate.toFixed(2)),
        failureRate: Number(stats.failureRate.toFixed(2)),
        healthScore: Number(stats.healthScore.toFixed(2)),
        lastCheckedAt: p.lastCheckAt || stats.lastCheckedAt || new Date(),
        alertColor
      };
    });

    // 4. Extract APIBOX details specifically for UI widgets
    const apibox = formattedProviders.find(p => p.code === "APIBOX") || {
      name: "APIBOX Gateway",
      code: "APIBOX",
      isActive: false,
      isBlacklisted: false,
      healthStatus: "UNKNOWN",
      latency: 0,
      successRate: 0,
      failureRate: 0,
      healthScore: 0,
      alertColor: "RED"
    };

    return res.json({
      success: true,
      data: {
        providers: formattedProviders,
        apibox,
        webhookMetrics: {
          successRate: webhookMetrics.successRate,
          successCount: webhookMetrics.successCount,
          failedCount: webhookMetrics.failedCount,
          duplicateCount: webhookMetrics.duplicateCount,
          serverErrorCount: webhookMetrics.serverErrorCount,
          stuckPendingCount: webhookMetrics.stuckPendingCount,
          refundCount: webhookMetrics.refundCount,
          avgReconciliationLatencyMs: webhookMetrics.avgReconciliationLatencyMs,
          p95LatencyMs: webhookMetrics.p95LatencyMs,
          p99LatencyMs: webhookMetrics.p99LatencyMs,
          avgPaymentVerificationLatencyMs: webhookMetrics.avgPaymentVerificationLatencyMs,
          redisFallbackCount: webhookMetrics.redisFallbackCount,
          failedLedgerWriteCount: webhookMetrics.failedLedgerWriteCount,
          failedAuditWriteCount: webhookMetrics.failedAuditWriteCount,
          alerts: webhookMetrics.alerts
        }
      }
    });
  } catch (error) {
    console.error("[Provider Health Controller Error]:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/admin/provider-health/logs
 * Retrieve recent system health transition logs.
 */
export const getProviderHealthLogs = async (req, res) => {
  try {
    const logs = await prisma.providerHealthLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error("[Provider Health Logs Error]:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
