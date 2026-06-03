import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { 
  Activity, 
  RefreshCw, 
  Users, 
  Key, 
  FileText,
  AlertTriangle,
  Lock,
  Coins
} from 'lucide-react';

export const ApiMarketplaceDashboard = () => {
  const [partnersData, setPartnersData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await api.get('/admin/api-access/partners');
      if (response.data?.success) {
        setPartnersData(response.data);
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 bg-[var(--bg-secondary)] rounded-md shimmer-element"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 h-28 shimmer-element"></div>
          ))}
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 h-48 shimmer-element"></div>
        <p className="text-xs text-[var(--text-secondary)] text-center animate-pulse">Loading data...</p>
      </div>
    );
  }

  if (error || !partnersData) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Unable to load data.</h1>
        <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
          Marketplace analytics source unavailable.
        </p>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Connection
        </button>
      </div>
    );
  }

  const { analytics } = partnersData;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">API Marketplace</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Explore live developer subscriptions, API keys, and sandbox usage aggregates.
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer h-fit w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh State
        </button>
      </div>

      {/* Analytics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Active Subscriptions */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-primary-glow)] flex items-center justify-center text-[var(--color-primary)]">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Active Customers</p>
            <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{analytics?.totalApiUsers || 0}</p>
          </div>
        </div>

        {/* Active Keys */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Active API Keys</p>
            <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{analytics?.activeKeys || 0}</p>
          </div>
        </div>

        {/* Sandbox Calls */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Sandbox calls</p>
            <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{analytics?.sandboxUsage || 0}</p>
          </div>
        </div>

        {/* Pending Requests */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Pending Upgrades</p>
            <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{analytics?.pendingRequests || 0}</p>
          </div>
        </div>
      </div>

      {/* Marketplace Real-Time Analytics Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Marketplace Revenue */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs relative">
          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <Coins className="w-4 h-4 text-[var(--color-primary)]" /> Marketplace Credit Revenue
          </h3>
          <div className="h-24 flex flex-col items-center justify-center border border-[var(--border-soft)] rounded-xl bg-[var(--bg-tertiary)]/30 space-y-1">
            <span className="text-2xl font-black text-[var(--text-primary)]">
              ₹{(analytics?.totalRevenue || 0).toLocaleString()}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-bold rounded">DB_SYNC_ONLINE</span>
          </div>
          <p className="text-[9px] text-[var(--text-secondary)] text-center mt-3 uppercase tracking-wider">Active Wallet Ledgers</p>
        </div>

        {/* Request volume */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs relative">
          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" /> Live Request Volume
          </h3>
          <div className="h-24 flex flex-col items-center justify-center border border-[var(--border-soft)] rounded-xl bg-[var(--bg-tertiary)]/30 space-y-1">
            <span className="text-2xl font-black text-[var(--text-primary)]">
              {(analytics?.totalRequests || 0).toLocaleString()} calls
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-bold rounded">DB_SYNC_ONLINE</span>
          </div>
          <p className="text-[9px] text-[var(--text-secondary)] text-center mt-3 uppercase tracking-wider">Live API Traffic Gateway</p>
        </div>

        {/* Error rates */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs relative">
          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> API Gateway Error rates
          </h3>
          <div className="h-24 flex flex-col items-center justify-center border border-[var(--border-soft)] rounded-xl bg-[var(--bg-tertiary)]/30 space-y-1">
            <span className="text-2xl font-black text-[var(--text-primary)]">
              {(analytics?.errorRate || 0).toFixed(2)}%
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-bold rounded">DB_SYNC_ONLINE</span>
          </div>
          <p className="text-[9px] text-[var(--text-secondary)] text-center mt-3 uppercase tracking-wider">Active Telemetry Broker</p>
        </div>
      </div>
    </div>
  );
};
