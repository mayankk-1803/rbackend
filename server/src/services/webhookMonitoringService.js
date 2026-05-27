import prisma from "../config/prisma.js";

// In-memory metrics store for high-performance logging and aggregation
const metrics = {
  successCount: 0,
  failedCount: 0,
  duplicateCount: 0,
  refundCount: 0,
  serverErrorCount: 0, // 500 responses
  latencySum: 0,
  latencyCount: 0,
  recentLatencies: [], // sliding window (capped at 1000) for percentiles
  lastFailures: [], // Queue of timestamps of recent failures to check repeated failures
  lastRefunds: [], // Queue of timestamps of recent refunds to check spikes
  redisFallbackCount: 0,
  paymentVerificationLatencySum: 0,
  paymentVerificationLatencyCount: 0,
  socketEmitSuccessCount: 0,
  socketEmitFailureCount: 0,
  failedLedgerWriteCount: 0,
  failedAuditWriteCount: 0,
};

export const recordRedisFallback = () => {
  try {
    metrics.redisFallbackCount++;
  } catch (err) {
    console.warn("[MONITORING] Error recording Redis fallback:", err.message);
  }
};

export const recordPaymentVerificationLatency = (latencyMs) => {
  try {
    if (latencyMs !== undefined && latencyMs !== null) {
      metrics.paymentVerificationLatencySum += latencyMs;
      metrics.paymentVerificationLatencyCount++;
    }
  } catch (err) {
    console.warn("[MONITORING] Error recording payment verification latency:", err.message);
  }
};

export const recordSocketEmit = (success) => {
  try {
    if (success) {
      metrics.socketEmitSuccessCount++;
    } else {
      metrics.socketEmitFailureCount++;
    }
  } catch (err) {
    console.warn("[MONITORING] Error recording Socket.IO emit:", err.message);
  }
};

export const recordFailedLedgerWrite = () => {
  try {
    metrics.failedLedgerWriteCount++;
  } catch (err) {
    console.warn("[MONITORING] Error recording failed ledger write:", err.message);
  }
};

export const recordFailedAuditWrite = () => {
  try {
    metrics.failedAuditWriteCount++;
  } catch (err) {
    console.warn("[MONITORING] Error recording failed audit write:", err.message);
  }
};

// Alerts configuration thresholds
const ALERTS_CFG = {
  STUCK_THRESHOLD_MS: 10 * 60 * 1000, // 10 minutes
  REPEATED_FAILURES_LIMIT: 5,
  REPEATED_FAILURES_WINDOW_MS: 10 * 60 * 1000, // 10 minutes
  REFUND_SPIKE_LIMIT: 10,
  REFUND_SPIKE_WINDOW_MS: 60 * 60 * 1000, // 1 hour
};

// Helper for percentile calculation
const calculatePercentile = (arr, percentile) => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
};

export const recordWebhookSuccess = (latencyMs) => {
  try {
    metrics.successCount++;
    if (latencyMs !== undefined && latencyMs !== null) {
      metrics.latencySum += latencyMs;
      metrics.latencyCount++;
      metrics.recentLatencies.push(latencyMs);
      if (metrics.recentLatencies.length > 1000) {
        metrics.recentLatencies.shift(); // keep it bounded to prevent memory leaks
      }
    }
  } catch (err) {
    console.warn("[MONITORING] Error recording webhook success:", err.message);
  }
};

export const recordWebhookFailure = () => {
  try {
    metrics.failedCount++;
    const now = Date.now();
    metrics.lastFailures.push(now);
    // Clean old failures outside window
    metrics.lastFailures = metrics.lastFailures.filter(t => now - t < ALERTS_CFG.REPEATED_FAILURES_WINDOW_MS);
    
    if (metrics.lastFailures.length >= ALERTS_CFG.REPEATED_FAILURES_LIMIT) {
      console.error(`[MONITORING_ALERT] Repeated FAILED callbacks detected! Count: ${metrics.lastFailures.length} within 10 mins.`);
    }
  } catch (err) {
    console.warn("[MONITORING] Error recording webhook failure:", err.message);
  }
};

export const recordWebhookDuplicate = () => {
  try {
    metrics.duplicateCount++;
  } catch (err) {
    console.warn("[MONITORING] Error recording webhook duplicate:", err.message);
  }
};

export const recordRefund = () => {
  try {
    metrics.refundCount++;
    const now = Date.now();
    metrics.lastRefunds.push(now);
    // Clean old refunds outside window
    metrics.lastRefunds = metrics.lastRefunds.filter(t => now - t < ALERTS_CFG.REFUND_SPIKE_WINDOW_MS);

    if (metrics.lastRefunds.length >= ALERTS_CFG.REFUND_SPIKE_LIMIT) {
      console.error(`[MONITORING_ALERT] Refund spike detected! Count: ${metrics.lastRefunds.length} within 1 hour.`);
    }
  } catch (err) {
    console.warn("[MONITORING] Error recording refund:", err.message);
  }
};

export const recordServerError = () => {
  try {
    metrics.serverErrorCount++;
    console.error(`[MONITORING_ALERT] Webhook 500 response returned.`);
  } catch (err) {
    console.warn("[MONITORING] Error recording server error:", err.message);
  }
};

export const recordReconciliationLatency = (latencyMs) => {
  try {
    if (latencyMs !== undefined && latencyMs !== null) {
      metrics.latencySum += latencyMs;
      metrics.latencyCount++;
      metrics.recentLatencies.push(latencyMs);
      if (metrics.recentLatencies.length > 1000) {
        metrics.recentLatencies.shift(); // keep it bounded to prevent memory leaks
      }
    }
  } catch (err) {
    console.warn("[MONITORING] Error recording reconciliation latency:", err.message);
  }
};

export const getStuckTransactionsCount = async () => {
  try {
    const threshold = new Date(Date.now() - ALERTS_CFG.STUCK_THRESHOLD_MS);
    const count = await prisma.transaction.count({
      where: {
        status: { in: ["PENDING", "PENDING_REVIEW", "PROCESSING"] },
        type: "RECHARGE",
        createdAt: { lt: threshold }
      }
    });
    
    if (count > 0) {
      console.warn(`[MONITORING_ALERT] Stuck transactions warning: ${count} transactions are stuck in PENDING/PENDING_REVIEW/PROCESSING status for more than 10 minutes.`);
    }
    return count;
  } catch (err) {
    console.error("[MONITORING] Failed to query stuck transactions:", err.message);
    return 0;
  }
};

export const getMetricsReport = async () => {
  try {
    const stuckCount = await getStuckTransactionsCount();
    const avgLatency = metrics.latencyCount > 0 ? (metrics.latencySum / metrics.latencyCount) : 0;
    const totalProcessed = metrics.successCount + metrics.failedCount + metrics.duplicateCount;
    const successRate = totalProcessed > 0 ? (metrics.successCount / totalProcessed) * 100 : 100;

    const p95 = calculatePercentile(metrics.recentLatencies, 95);
    const p99 = calculatePercentile(metrics.recentLatencies, 99);
    
    const avgVerificationLatency = metrics.paymentVerificationLatencyCount > 0 
      ? (metrics.paymentVerificationLatencySum / metrics.paymentVerificationLatencyCount) 
      : 0;

    return {
      successRate: parseFloat(successRate.toFixed(2)),
      successCount: metrics.successCount,
      failedCount: metrics.failedCount,
      duplicateCount: metrics.duplicateCount,
      serverErrorCount: metrics.serverErrorCount,
      stuckPendingCount: stuckCount,
      refundCount: metrics.refundCount,
      avgReconciliationLatencyMs: parseFloat(avgLatency.toFixed(2)),
      p95LatencyMs: parseFloat(p95.toFixed(2)),
      p99LatencyMs: parseFloat(p99.toFixed(2)),
      // Operational metric additions
      redisFallbackCount: metrics.redisFallbackCount,
      avgPaymentVerificationLatencyMs: parseFloat(avgVerificationLatency.toFixed(2)),
      socketEmitSuccessCount: metrics.socketEmitSuccessCount,
      socketEmitFailureCount: metrics.socketEmitFailureCount,
      failedLedgerWriteCount: metrics.failedLedgerWriteCount,
      failedAuditWriteCount: metrics.failedAuditWriteCount,
      alerts: {
        hasStuckTransactions: stuckCount > 0,
        hasRepeatedFailures: metrics.lastFailures.length >= ALERTS_CFG.REPEATED_FAILURES_LIMIT,
        hasRefundSpikes: metrics.lastRefunds.length >= ALERTS_CFG.REFUND_SPIKE_LIMIT
      }
    };
  } catch (err) {
    console.warn("[MONITORING] Error generating metrics report:", err.message);
    return {
      successRate: 100,
      successCount: 0,
      failedCount: 0,
      duplicateCount: 0,
      serverErrorCount: 0,
      stuckPendingCount: 0,
      refundCount: 0,
      avgReconciliationLatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      redisFallbackCount: 0,
      avgPaymentVerificationLatencyMs: 0,
      socketEmitSuccessCount: 0,
      socketEmitFailureCount: 0,
      failedLedgerWriteCount: 0,
      failedAuditWriteCount: 0,
      alerts: {
        hasStuckTransactions: false,
        hasRepeatedFailures: false,
        hasRefundSpikes: false
      }
    };
  }
};
