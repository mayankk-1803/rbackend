import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { 
  ShieldAlert, 
  Activity, 
  RefreshCw, 
  Cpu, 
  AlertTriangle, 
  Sliders, 
  Play, 
  Pause, 
  RotateCcw,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  XCircle
} from 'lucide-react';

export const AutonomousRoutingMonitor = () => {
  const [telemetry, setTelemetry] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [adminUser, setAdminUser] = useState({});
  const [promoteTarget, setPromoteTarget] = useState(0.05); // Default next promo target
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    try {
      const data = JSON.parse(sessionStorage.getItem("dizipay_admin_data")) || {};
      setAdminUser(data);
      if (data.role === 'SUPER_ADMIN') {
        setIsAdminUser(true);
      }
    } catch (e) {
      setIsAdminUser(false);
    }
  }, []);

  const fetchState = async () => {
    setLoading(true);
    setError(false);
    try {
      const [telRes, anaRes] = await Promise.all([
        api.get('/admin/enterprise/telemetry'),
        api.get('/admin/enterprise/routing/analytics').catch(() => ({ data: { success: false } }))
      ]);

      if (telRes.data?.success) {
        setTelemetry(telRes.data.data);
      } else {
        setError(true);
      }

      if (anaRes.data?.success) {
        setAnalytics(anaRes.data.data);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        // RBAC Access denied handled in check or render
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminUser) {
      fetchState();
    } else {
      setLoading(false);
    }
  }, [isAdminUser]);

  const handleToggleMemoryFlag = async (flagName, currentValue) => {
    try {
      const response = await api.post('/admin/enterprise/features/flags', {
        flagName,
        value: !currentValue
      });
      if (response.data?.success) {
        toast.success(`Platform Mode '${flagName}' hot-swapped!`);
        fetchState();
      } else {
        toast.error("Failed to update feature state");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to toggle flag");
    }
  };

  const handlePromoteRollout = async () => {
    setActionLoading(true);
    try {
      const response = await api.post('/admin/enterprise/routing/promote', { targetLevel: promoteTarget });
      if (response.data?.success) {
        toast.success(response.data.message || "Rollout level promoted successfully!");
        fetchState();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to promote rollout level");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseRollout = async () => {
    setActionLoading(true);
    try {
      const response = await api.post('/admin/enterprise/routing/pause');
      if (response.data?.success) {
        toast.success(response.data.message || "Rollout sharding paused!");
        fetchState();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to pause rollout");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRollbackRollout = async () => {
    if (!window.confirm("WARNING: Emergency rollback will de-activate Autonomous Routing immediately and return the platform safely to Shadow Validation. Proceed?")) return;
    setActionLoading(true);
    try {
      const response = await api.post('/admin/enterprise/routing/rollback');
      if (response.data?.success) {
        toast.success(response.data.message || "Emergency rollback triggered!");
        fetchState();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to trigger emergency rollback");
    } finally {
      setActionLoading(false);
    }
  };

  if (!isAdminUser) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Access Denied</h1>
        <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
          Permission state: Access denied. Super Admin privileges are required to view or manage autonomous sharding shunts.
        </p>
      </div>
    );
  }

  // Real data parameters
  const flags = telemetry?.featureFlags || {};
  const dbFlags = telemetry?.dbFeatureFlags || {};
  const config = telemetry?.routingIntelligenceConfig || {};
  const decisionLogs = telemetry?.decisionLogs || [];

  const isAutonomousEnabled = dbFlags.ROUTING_INTELLIGENCE_AUTONOMOUS?.value || false;
  const isRoutingEnabled = dbFlags.ROUTING_INTELLIGENCE_ENABLED?.value || false;

  // Shadow agreement calculation (Real data analysis)
  const shadowCount = decisionLogs.length;
  const matchCount = decisionLogs.filter(l => l.recommendedProvider === l.executedProvider).length;
  const shadowAgreementRate = shadowCount > 0 ? (matchCount / shadowCount) * 100 : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Autonomous Routing Monitor</h1>
          <p className="text-sm text-[var(--text-secondary)] font-medium">
            Verify sharding ratios, rollout observing windows, safety kill switches, and instant rollback gates.
          </p>
        </div>
        <button
          onClick={fetchState}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer h-fit w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh State
        </button>
      </div>

      {loading ? (
        <div className="space-y-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 h-28 shimmer-element"></div>
            ))}
          </div>
          <div className="h-64 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl shimmer-element"></div>
          <p className="text-xs text-[var(--text-secondary)] text-center animate-pulse">Loading data...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500" />
          <h3 className="font-bold text-sm text-[var(--text-primary)]">Unable to load data.</h3>
          <p className="text-xs text-[var(--text-secondary)]">Connection error loading telemetry metrics.</p>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Sharding Status Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Current Mode */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-primary-glow)] flex items-center justify-center text-[var(--color-primary)]">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Current Routing Mode</p>
                <p className="text-lg font-black text-[var(--text-primary)] mt-1 uppercase">
                  {isAutonomousEnabled ? "AUTONOMOUS" : isRoutingEnabled ? "SHADOW_VALIDATION" : "BYPASSED"}
                </p>
              </div>
            </div>

            {/* Shadow Mode */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isRoutingEnabled ? 'bg-amber-500/10 text-amber-500' : 'bg-[var(--border-soft)] text-[var(--text-secondary)]'}`}>
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Shadow Validation</p>
                <p className="text-lg font-black text-[var(--text-primary)] mt-1 uppercase">
                  {isRoutingEnabled ? "ENABLED" : "DISABLED"}
                </p>
              </div>
            </div>

            {/* Autonomous status */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isAutonomousEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                <Sliders className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Autonomous Core</p>
                <p className="text-lg font-black text-[var(--text-primary)] mt-1 uppercase">
                  {isAutonomousEnabled ? "ONLINE" : "OFFLINE"}
                </p>
              </div>
            </div>

            {/* Shadow Agreement Rate */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Shadow Agreement</p>
                <p className="text-lg font-black text-[var(--text-primary)] mt-1 font-mono">
                  {shadowAgreementRate !== null ? `${shadowAgreementRate.toFixed(1)}%` : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Database Shunting Controllers (Connected Live!) */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-4">
              <h3 className="font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[var(--color-primary)]" /> Database Sharding & Shunts Configuration
              </h3>
              <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-bold rounded">DB_SYNC_ONLINE</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
              <div className="bg-[var(--bg-tertiary)]/50 rounded-xl p-4 space-y-1.5 border border-[var(--border-soft)]">
                <p className="font-bold text-[10px] uppercase text-[var(--text-secondary)]">Rollout Shard Percent</p>
                <p className="text-lg font-black text-[var(--text-primary)] font-mono">{(config.rolloutLevel * 100).toFixed(0)}% Rollout</p>
              </div>
              
              <div className="bg-[var(--bg-tertiary)]/50 rounded-xl p-4 space-y-1.5 border border-[var(--border-soft)]">
                <p className="font-bold text-[10px] uppercase text-[var(--text-secondary)]">Safety Kill Switch</p>
                <p className={`text-lg font-black font-mono ${config.killSwitchTriggered ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {config.killSwitchTriggered ? 'TRIGGERED' : 'NOMINAL'}
                </p>
              </div>

              <div className="bg-[var(--bg-tertiary)]/50 rounded-xl p-4 space-y-1.5 border border-[var(--border-soft)]">
                <p className="font-bold text-[10px] uppercase text-[var(--text-secondary)]">24h Cooldown Timer</p>
                <p className="text-[11px] font-bold text-[var(--text-primary)] leading-normal mt-1">
                  {config.cooldownUntil && new Date(config.cooldownUntil) > new Date() 
                    ? new Date(config.cooldownUntil).toLocaleString() 
                    : 'NOMINAL (NO COOLDOWN)'
                  }
                </p>
              </div>

              <div className="bg-[var(--bg-tertiary)]/50 rounded-xl p-4 space-y-1.5 border border-[var(--border-soft)]">
                <p className="font-bold text-[10px] uppercase text-[var(--text-secondary)]">Routing Agreement Delta</p>
                <p className="text-lg font-black text-[var(--text-primary)] font-mono">{(config.autonomousThreshold * 100).toFixed(0)}% Min</p>
              </div>
            </div>

            {/* Shard Rollout Controllers */}
            <div className="bg-[var(--bg-tertiary)]/30 rounded-xl p-6 border border-[var(--border-soft)] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-[var(--text-primary)]">Shard Rollout Promotion Controls</h4>
                <p className="text-xs text-[var(--text-secondary)] font-medium">Promote autonomous sharding target levels safely or pause active transactions immediately.</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Target:</label>
                  <select
                    value={promoteTarget}
                    onChange={(e) => setPromoteTarget(Number(e.target.value))}
                    className="text-xs bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg p-2 text-[var(--text-primary)] outline-none cursor-pointer"
                  >
                    <option value={0.01}>1% (Shadow Shard)</option>
                    <option value={0.05}>5% (Pilot Shard)</option>
                    <option value={0.10}>10% (Limited Shard)</option>
                    <option value={0.25}>25% (Aggregated Shard)</option>
                    <option value={0.50}>50% (High Shard)</option>
                    <option value={1.00}>100% (Full Autonomous)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={handlePromoteRollout}
                    disabled={actionLoading}
                    className="px-4 py-2.5 bg-[var(--color-primary-glow)] hover:bg-[var(--color-primary)] text-[var(--color-primary)] hover:text-[var(--bg-primary)] border border-[var(--border-soft)] text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" /> Promote
                  </button>
                  <button 
                    onClick={handlePauseRollout}
                    disabled={actionLoading}
                    className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-black border border-amber-500/20 text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </button>
                  <button 
                    onClick={handleRollbackRollout}
                    disabled={actionLoading}
                    className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 text-[11px] font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Rollback
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Super Admin Mode Overrides */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs space-y-6">
            <h3 className="font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider">Super Admin In-Memory Shunts</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Toggle Shadow Mode */}
              <div className="border border-[var(--border-soft)] rounded-xl p-6 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[var(--text-primary)]">Toggle Shadow Validation Mode</h4>
                  <p className="text-xs text-[var(--text-secondary)] font-medium">Evaluate recommeded routes without active traffic routing overrides.</p>
                </div>
                <button 
                  onClick={() => handleToggleMemoryFlag("shadowMode", flags.shadowMode || false)}
                  className="cursor-pointer transition-transform duration-100 hover:scale-105"
                >
                  {flags.shadowMode ? (
                    <ToggleRight className="w-10 h-10 text-[var(--color-primary)]" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-[var(--text-secondary)] opacity-50" />
                  )}
                </button>
              </div>

              {/* Toggle Routing Engine */}
              <div className="border border-[var(--border-soft)] rounded-xl p-6 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[var(--text-primary)]">Toggle Platform Router Core</h4>
                  <p className="text-xs text-[var(--text-secondary)] font-medium">Orchestrator resolves switching rules and provider weights when active.</p>
                </div>
                <button 
                  onClick={() => handleToggleMemoryFlag("routingEngine", flags.routingEngine || false)}
                  className="cursor-pointer transition-transform duration-100 hover:scale-105"
                >
                  {flags.routingEngine ? (
                    <ToggleRight className="w-10 h-10 text-[var(--color-primary)]" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-[var(--text-secondary)] opacity-50" />
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
