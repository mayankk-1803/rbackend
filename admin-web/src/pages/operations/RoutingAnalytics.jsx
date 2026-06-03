import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { BarChart3, Activity, Compass, AlertTriangle, CloudRain } from 'lucide-react';

export const RoutingAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const response = await fetch('/api/admin/enterprise/routing/analytics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const res = await response.json();
      if (res.success) {
        setData(res.data);
      } else {
        toast.error(res.message || 'Failed to load analytics');
      }
    } catch (err) {
      toast.error('Connection error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Routing Analytics</h1>
        <p className="text-sm text-[var(--text-secondary)]">Monitor routing performance indicators, failover statistics, and transaction distributions.</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-[var(--text-secondary)]">Aggregating telemetry performance logs...</div>
      ) : (
        <div className="space-y-6">
          {/* Key metrics cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-primary-glow)] flex items-center justify-center text-[var(--color-primary)]">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Requests Routed</p>
                <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{data?.totalTransactions || 0}</p>
              </div>
            </div>

            <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Success Rate</p>
                <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{data?.successRate ? `${data.successRate.toFixed(1)}%` : '100.0%'}</p>
              </div>
            </div>

            <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                <CloudRain className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Failure Rate</p>
                <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{(100.0 - (data?.successRate || 100.0)).toFixed(1)}%</p>
              </div>
            </div>

            <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Active Overrides</p>
                <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">0</p>
              </div>
            </div>
          </div>

          {/* Detailed table of provider metrics */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-[var(--border-soft)]">
              <h3 className="font-bold text-base text-[var(--text-primary)]">Gateway Performance Metrics</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] font-semibold">
                    <th className="px-6 py-4">Gateway Alias</th>
                    <th className="px-6 py-4">Uptime/Availability</th>
                    <th className="px-6 py-4">Average Latency (ms)</th>
                    <th className="px-6 py-4">Health Telemetry Score</th>
                    <th className="px-6 py-4">Routing Pool Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-soft)] text-[var(--text-primary)] font-medium">
                  {data?.providers.map((p, idx) => (
                    <tr key={idx} className="hover:bg-[var(--accent-hover)] transition-colors">
                      <td className="px-6 py-4 font-bold">{p.providerAlias}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center text-emerald-500 font-semibold">{p.successRate.toFixed(1)}%</span>
                      </td>
                      <td className="px-6 py-4 font-mono">{p.latency.toFixed(0)}ms</td>
                      <td className="px-6 py-4 font-bold text-emerald-500">{p.healthScore.toFixed(1)}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)]">ACTIVE (Priority Route)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
