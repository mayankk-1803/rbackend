import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { 
  ToggleLeft, 
  ToggleRight, 
  RefreshCw, 
  ShieldAlert, 
  Lock, 
  Sliders, 
  CheckCircle, 
  AlertTriangle 
} from 'lucide-react';

export const FeatureFlags = () => {
  const [flags, setFlags] = useState({});
  const [dbFlags, setDbFlags] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [adminUser, setAdminUser] = useState({});
  const [togglingKey, setTogglingKey] = useState(null);

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

  const fetchFlags = async (showSkeleton = true) => {
    if (showSkeleton) {
      setLoading(true);
    }
    setError(false);
    try {
      const response = await api.get('/admin/enterprise/telemetry');
      if (response.data?.success) {
        setFlags(response.data.data.featureFlags || {});
        setDbFlags(response.data.data.dbFeatureFlags || {});
      } else {
        if (showSkeleton) setError(true);
      }
    } catch (err) {
      if (err.response?.status !== 403) {
        if (showSkeleton) setError(true);
      }
    } finally {
      if (showSkeleton) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isAdminUser) {
      fetchFlags(true);
    } else {
      setLoading(false);
    }
  }, [isAdminUser]);

  const handleToggle = async (flagName, currentValue) => {
    setTogglingKey(flagName);
    try {
      const response = await api.patch(`/admin/enterprise/features/flags/${flagName}`, {
        value: !currentValue
      });
      if (response.data?.success) {
        toast.success(`Flag ${flagName} hot-swapped successfully!`);
        await fetchFlags(false);
      } else {
        toast.error("Failed to update flag state");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to toggle feature flag");
    } finally {
      setTogglingKey(null);
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
          Permission state: Access denied. Super Admin privileges are required to view or modify platform feature flags.
        </p>
      </div>
    );
  }

  const databaseFlagsList = [
    { key: "ROUTING_INTELLIGENCE_ENABLED", desc: "Enables assisted and shadow routing intelligence modes" },
    { key: "ROUTING_INTELLIGENCE_AUTONOMOUS", desc: "Enables autonomous routing provider overrides" },
    { key: "COMMISSION_INTELLIGENCE_ENABLED", desc: "Enables commission optimization algorithms and replay" },
    { key: "COMMISSION_INTELLIGENCE_AUTOMATION", desc: "Enables automatic commission recommendation checker rules" },
    { key: "API_MARKETPLACE_ENABLED", desc: "Enables the fintech API Marketplace plans and subscriptions" },
    { key: "PUBLIC_API_BILLING", desc: "Enables billing charging for API Marketplace calls" },
    { key: "PRODUCTION_AUTOMATION_FREEZE", desc: "Global emergency brake that instantly freezes all automations" }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Feature Flags Center</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Manage live platform configurations, routing intelligence shunts, and marketplace billing levels.
          </p>
        </div>
        <button
          onClick={fetchFlags}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all disabled:opacity-50 cursor-pointer h-fit w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh State
        </button>
      </div>

      {loading ? (
        <div className="space-y-6 py-6">
          <div className="h-6 w-48 bg-[var(--bg-secondary)] rounded-md shimmer-element"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 h-40 shimmer-element"></div>
            ))}
          </div>
          <p className="text-xs text-[var(--text-secondary)] text-center animate-pulse mt-4">Loading data...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500" />
          <h3 className="font-bold text-sm text-[var(--text-primary)]">Unable to load data.</h3>
          <p className="text-xs text-[var(--text-secondary)]">Please check your connection and try refreshing.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Memory System Flags */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border-soft)] pb-2">
              <Sliders className="w-4 h-4 text-[var(--color-primary)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">In-Memory Engine Controls</h2>
            </div>
            
            {Object.keys(flags).length === 0 ? (
              <div className="text-center py-6 text-xs text-[var(--text-secondary)]">No records found.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(flags).map(([key, val]) => (
                  <div key={key} className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 flex items-start justify-between gap-4 shadow-xs">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--text-primary)] truncate block">{key}</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-bold rounded">MEM_LIVE</span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                        Controls platform resolving triggers for the in-memory {key.replace(/([A-Z])/g, ' $1').toLowerCase()} pipeline.
                      </p>
                      <div className="flex items-center gap-4 text-[10px] text-[var(--text-secondary)] mt-2 font-medium">
                        <span>Last Updated: Live</span>
                        <span>Updated By: System Admin</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleToggle(key, val)}
                      disabled={togglingKey !== null}
                      className="cursor-pointer transition-transform duration-100 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {togglingKey === key ? (
                        <RefreshCw className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
                      ) : val ? (
                        <ToggleRight className="w-10 h-10 text-[var(--color-primary)]" />
                      ) : (
                        <ToggleLeft className="w-10 h-10 text-[var(--text-secondary)] opacity-50" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Database System Flags (Connected) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border-soft)] pb-2">
              <Sliders className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Database Platform Intelligence Flags</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {databaseFlagsList.map((flag) => {
                const dbEntry = dbFlags[flag.key];
                const hasDb = dbEntry !== undefined;
                const val = hasDb ? (dbEntry.value !== undefined ? dbEntry.value : dbEntry.enabled) : false;
                const lastUpdated = hasDb && dbEntry.updatedAt ? new Date(dbEntry.updatedAt).toLocaleString() : 'N/A';
                
                return (
                  <div key={flag.key} className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 flex items-start justify-between gap-4 shadow-xs">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-col gap-2">
                        <span className="font-bold text-sm text-[var(--text-primary)] truncate block">{flag.key}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded ${
                            val 
                              ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' 
                              : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                          }`}>
                            {val ? 'ENABLED' : 'DISABLED'}
                          </span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded ${
                            hasDb 
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          }`}>
                            {hasDb ? 'DB_SYNC_ONLINE' : 'DB_SYNC_OFFLINE'}
                          </span>
                          {hasDb && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded ${
                              dbEntry.redisSynced 
                                ? 'bg-teal-500/10 text-teal-500 border border-teal-500/20' 
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            }`}>
                              {dbEntry.redisSynced ? 'CACHE_SYNCED' : 'CACHE_MISMATCH'}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-1">{flag.desc}</p>
                      <div className="flex items-center gap-4 text-[10px] text-[var(--text-secondary)] mt-2 font-medium">
                        <span>Last Updated: {lastUpdated}</span>
                        <span>Updated By: SUPER_ADMIN</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleToggle(flag.key, val)}
                      disabled={togglingKey !== null}
                      className="cursor-pointer transition-transform duration-100 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {togglingKey === flag.key ? (
                        <RefreshCw className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
                      ) : val ? (
                        <ToggleRight className="w-10 h-10 text-[var(--color-primary)]" />
                      ) : (
                        <ToggleLeft className="w-10 h-10 text-[var(--text-secondary)] opacity-50" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
