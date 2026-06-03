import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Activity, 
  RefreshCw, 
  Award, 
  Cpu, 
  CheckCircle, 
  XCircle, 
  AlertTriangle 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';

export const RoutingIntelligence = () => {
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchTelemetry = async () => {
    setLoading(true);
    setError(false);
    try {
      const [telRes, anaRes] = await Promise.all([
        api.get('/admin/enterprise/telemetry'),
        api.get('/admin/enterprise/routing/analytics').catch(() => ({ data: { success: false } }))
      ]);

      if (telRes.data?.success) {
        setData(telRes.data.data);
      } else {
        setError(true);
      }

      if (anaRes.data?.success) {
        setAnalytics(anaRes.data.data);
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 bg-[var(--bg-secondary)] rounded-md shimmer-element"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 h-32 shimmer-element"></div>
          ))}
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 h-96 shimmer-element"></div>
        <p className="text-xs text-[var(--text-secondary)] text-center animate-pulse">Loading data...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Unable to load data.</h1>
        <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
          Routing intelligence telemetry unavailable.
        </p>
        <button
          onClick={fetchTelemetry}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Connection
        </button>
      </div>
    );
  }

  // Real data calculations
  const providersList = data.providers || [];
  const decisionLogs = data.decisionLogs || [];
  const healthLogs = data.healthLogs || [];

  // Shadow agreement calculation (Real data analysis)
  const shadowCount = decisionLogs.length;
  const matchCount = decisionLogs.filter(l => l.recommendedProvider === l.executedProvider).length;
  const shadowAgreementRate = shadowCount > 0 ? (matchCount / shadowCount) * 100 : null;

  // Enriched provider ranking logic
  const rankedProviders = providersList.map((p) => {
    // Composite routing score formula using real success rate and latency metrics
    const successFactor = p.successRate || 0;
    const latencyFactor = Math.max(0, 1000 - (p.avgResponseTime || 0)) / 10;
    const compositeScore = Math.max(0, Math.min(100, Math.round(successFactor * 0.6 + latencyFactor * 0.4)));
    return {
      ...p,
      compositeScore
    };
  }).sort((a, b) => b.compositeScore - a.compositeScore);

  const topProvider = rankedProviders[0];
  const worstProvider = rankedProviders.length > 1 ? rankedProviders[rankedProviders.length - 1] : null;

  // Chart data preparing
  const chartData = rankedProviders.map(p => ({
    name: p.code,
    "Success Rate (%)": p.successRate || 0,
    "Avg Latency (ms)": p.avgResponseTime || 0,
    "Composite Score": p.compositeScore || 0
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Routing Intelligence</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Explore live composite scoring rankings, real-time success rates, and shadow validation agreements.
          </p>
        </div>
        <button
          onClick={fetchTelemetry}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer h-fit w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh State
        </button>
      </div>

      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Shadow Agreement Card */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-primary-glow)] flex items-center justify-center text-[var(--color-primary)]">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Shadow Agreement Rate</p>
            <p className="text-2xl font-black text-[var(--text-primary)] mt-1">
              {shadowAgreementRate !== null ? `${shadowAgreementRate.toFixed(1)}%` : 'No logs found'}
            </p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Based on last {shadowCount} decisions</p>
          </div>
        </div>

        {/* Top Performing Provider */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Top-Performing Node</p>
            <p className="text-lg font-bold text-[var(--text-primary)] mt-1 truncate max-w-[200px]">
              {topProvider ? `${topProvider.name} (${topProvider.compositeScore} PTS)` : 'No records found'}
            </p>
            <p className="text-[10px] text-emerald-500 mt-0.5">Active routing preference</p>
          </div>
        </div>

        {/* Worst Performing Provider */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Lowest-Scoring Node</p>
            <p className="text-lg font-bold text-[var(--text-primary)] mt-1 truncate max-w-[200px]">
              {worstProvider ? `${worstProvider.name} (${worstProvider.compositeScore} PTS)` : 'No records found'}
            </p>
            <p className="text-[10px] text-rose-500 mt-0.5">Assigned fallback priority</p>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs">
        <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-6 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--color-primary)]" /> Real-time Performance & Scores comparison
        </h3>
        
        {chartData.length === 0 ? (
          <div className="text-center py-10 text-xs text-[var(--text-secondary)]">No records found.</div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" opacity={0.3} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    borderColor: 'var(--border-soft)',
                    borderRadius: '0.75rem',
                    color: 'var(--text-primary)'
                  }} 
                />
                <Legend verticalAlign="top" height={36} iconType="circle" fontSize={11} />
                <Bar dataKey="Success Rate (%)" fill="var(--color-primary)" radius={[4, 4, 0, 0]} opacity={0.8} maxBarSize={40} />
                <Line type="monotone" dataKey="Avg Latency (ms)" stroke="#ef4444" strokeWidth={2} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Composite Score" stroke="#10b981" strokeWidth={2} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Provider Ranking & Telemetry Table */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-[var(--border-soft)]">
          <h3 className="font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider">Live Provider Ranking Matrix</h3>
        </div>
        
        {rankedProviders.length === 0 ? (
          <div className="text-center py-10 text-xs text-[var(--text-secondary)]">No records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] font-extrabold uppercase">
                  <th className="px-6 py-4">Rank</th>
                  <th className="px-6 py-4">Gateway</th>
                  <th className="px-6 py-4">Availability</th>
                  <th className="px-6 py-4">Latency (ms)</th>
                  <th className="px-6 py-4">Dynamic status</th>
                  <th className="px-6 py-4 text-right">Composite Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)] text-[var(--text-primary)] font-medium">
                {rankedProviders.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-[var(--accent-hover)] transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-[14px]">#{idx + 1}</td>
                    <td className="px-6 py-4">
                      <span className="font-bold block">{p.name}</span>
                      <span className="text-[10px] text-[var(--text-secondary)] font-mono">{p.code}</span>
                    </td>
                    <td className="px-6 py-4 text-emerald-500 font-bold">{(p.successRate || 0).toFixed(1)}%</td>
                    <td className="px-6 py-4 font-mono">{p.avgResponseTime || 0}ms</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                        p.healthStatus === 'active' || p.healthStatus === 'healthy' || p.healthStatus === 'GOOD'
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                      }`}>
                        {p.healthStatus || 'OFFLINE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-emerald-500 text-sm">{p.compositeScore} PTS</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Decision logs stream */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-[var(--border-soft)]">
          <h3 className="font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider">Live AI Recommendation & Decision Logs</h3>
        </div>
        
        {decisionLogs.length === 0 ? (
          <div className="text-center py-10 text-xs text-[var(--text-secondary)]">No records found.</div>
        ) : (
          <div className="divide-y divide-[var(--border-soft)]">
            {decisionLogs.map((log) => {
              const matched = log.recommendedProvider === log.executedProvider;
              return (
                <div key={log.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs hover:bg-[var(--accent-hover)] transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text-primary)] font-mono">Decision #{log.id}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)]">
                      <span>Shadow Mode Target: <strong className="text-[var(--text-primary)]">{log.recommendedProvider}</strong></span>
                      <span>•</span>
                      <span>Executed Route: <strong className="text-[var(--text-primary)]">{log.executedProvider}</strong></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${
                      matched 
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    }`}>
                      {matched ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {matched ? 'SHADOW MATCHED' : 'DEVIATION DETECTED'}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-secondary)]">Reason: {log.routingReason || 'COMPOSITE_SCORE'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
