import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  RefreshCw,
  Clock,
  Zap,
  Activity,
  History
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function ProviderHealthDashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    providers: [],
    apibox: {
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
    },
    webhookMetrics: {
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
      avgPaymentVerificationLatencyMs: 0,
      redisFallbackCount: 0,
      failedLedgerWriteCount: 0,
      failedAuditWriteCount: 0,
      alerts: {
        hasStuckTransactions: false,
        hasRepeatedFailures: false,
        hasRefundSpikes: false
      }
    }
  });
  
  const [logs, setLogs] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsRes, logsRes] = await Promise.all([
        api.get('/admin/provider-health/metrics'),
        api.get('/admin/provider-health/logs')
      ]);

      if (metricsRes.data?.success) {
        setMetrics(metricsRes.data.data);
      }
      if (logsRes.data?.success) {
        setLogs(logsRes.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load provider health telemetry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getAlertColorClass = (color) => {
    if (color === "GREEN") return "bg-emerald-500/10 text-emerald-500 border-emerald-500/25";
    if (color === "YELLOW") return "bg-amber-500/10 text-amber-500 border-amber-500/25";
    return "bg-rose-500/10 text-rose-500 border-rose-500/25";
  };

  const getHealthDotColor = (color) => {
    if (color === "GREEN") return "bg-emerald-500";
    if (color === "YELLOW") return "bg-amber-500";
    return "bg-rose-500";
  };

  const getStatusTextClass = (status) => {
    if (status === "HEALTHY") return "text-emerald-500";
    if (status === "DEGRADED" || status === "WARNING") return "text-amber-500";
    return "text-rose-500";
  };

  const webhook = metrics.webhookMetrics;
  const apibox = metrics.apibox;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-[var(--text-primary)]"
    >
      {/* Header */}
      <div className="flex justify-between items-center border-b border-[var(--border-soft)] pb-4">
        <div className="space-y-0.5">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Provider <span className="text-[var(--color-primary)]">Health</span></h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Gateway heartbeat tracking and webhook callback diagnostics</p>
        </div>
        <button 
          onClick={fetchData}
          className="p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-xl transition-all cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 text-[var(--color-primary)] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Activity className="w-8 h-8 text-[var(--color-primary)] animate-pulse" />
          <span className="text-xs text-[var(--text-secondary)] font-bold">Connecting gateway telemetry feed...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Alarms row */}
          {(webhook.alerts.hasStuckTransactions || webhook.alerts.hasRepeatedFailures || webhook.alerts.hasRefundSpikes) && (
            <div className="space-y-2">
              {webhook.alerts.hasStuckTransactions && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 text-rose-500 rounded-xl text-xs font-semibold flex items-center gap-2 animate-pulse">
                  <AlertCircle className="w-4.5 h-4.5" />
                  <span>Stuck Transactions Detected: {webhook.stuckPendingCount} recharge operations are stuck in pending state for over 10 minutes.</span>
                </div>
              )}
              {webhook.alerts.hasRepeatedFailures && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 text-rose-500 rounded-xl text-xs font-semibold flex items-center gap-2 animate-pulse">
                  <AlertTriangle className="w-4.5 h-4.5" />
                  <span>Callback Outage Warning: High frequency of failed webhook callbacks detected in the last 10 minutes.</span>
                </div>
              )}
              {webhook.alerts.hasRefundSpikes && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 text-amber-500 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4.5 h-4.5" />
                  <span>Refund Activity Spike: Platform refunds have exceeded standard threshold limits in the last hour.</span>
                </div>
              )}
            </div>
          )}

          {/* Primary Gateways Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {metrics.providers.map((p, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -1 }}
                className="bg-[var(--card-bg)] border border-[var(--border-soft)] p-5 rounded-2xl shadow-soft flex flex-col justify-between"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">{p.name}</h3>
                    <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mt-0.5">{p.code} GATEWAY</span>
                  </div>
                  <div className={`px-2.5 py-0.5 border rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 ${getAlertColorClass(p.alertColor)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getHealthDotColor(p.alertColor)}`} />
                    {p.healthStatus}
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-[var(--border-soft)]">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[var(--text-secondary)]">Uptime Success Rate</span>
                    <span className="font-extrabold">{p.successRate}%</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[var(--text-secondary)]">Average Response Time</span>
                    <span className="font-extrabold">{p.latency}ms</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[var(--text-secondary)]">Overall Health Score</span>
                    <span className="font-extrabold">{p.healthScore}/100</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Webhook Callback & Reconciliation Telemetry */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] p-6 rounded-2xl shadow-soft">
            <div className="flex items-center gap-2 mb-6 border-b border-[var(--border-soft)] pb-3">
              <Clock className="w-5 h-5 text-[var(--color-primary)]" />
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Callback & Reconciliation Telemetry</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 bg-[var(--bg-secondary)]/30 border border-[var(--border-soft)] rounded-xl">
                <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Avg Reconciliation Delay</span>
                <span className="text-lg font-black">{webhook.avgReconciliationLatencyMs}ms</span>
              </div>
              <div className="p-3 bg-[var(--bg-secondary)]/30 border border-[var(--border-soft)] rounded-xl">
                <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">p95 Reconciliation Delay</span>
                <span className="text-lg font-black">{webhook.p95LatencyMs}ms</span>
              </div>
              <div className="p-3 bg-[var(--bg-secondary)]/30 border border-[var(--border-soft)] rounded-xl">
                <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">p99 Reconciliation Delay</span>
                <span className="text-lg font-black">{webhook.p99LatencyMs}ms</span>
              </div>
              <div className="p-3 bg-[var(--bg-secondary)]/30 border border-[var(--border-soft)] rounded-xl">
                <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Avg Verification Delay</span>
                <span className="text-lg font-black">{webhook.avgPaymentVerificationLatencyMs}ms</span>
              </div>
            </div>
          </div>

          {/* Uptime Status Logs */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl shadow-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-soft)] flex items-center gap-2 bg-[var(--bg-secondary)]/10">
              <History className="w-4.5 h-4.5 text-[var(--color-primary)]" />
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Health Transition Logs</h3>
            </div>
            <div className="divide-y divide-[var(--border-soft)] text-xs font-semibold max-h-[300px] overflow-y-auto custom-scrollbar">
              {logs.length === 0 ? (
                <div className="text-center py-10 text-[var(--text-secondary)]">No health alerts or transitions logged</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="px-6 py-3.5 flex justify-between items-center hover:bg-[var(--bg-secondary)]/5 transition-colors">
                    <div className="space-y-0.5">
                      <span className="font-bold uppercase">{log.providerCode}</span>
                      <p className="text-[10px] text-[var(--text-secondary)] font-medium leading-relaxed">{log.message || "State query succeeded"}</p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide ${
                        log.status === "HEALTHY" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                      }`}>{log.status}</span>
                      <span className="text-[9px] text-[var(--text-secondary)] block mt-1">{new Date(log.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
