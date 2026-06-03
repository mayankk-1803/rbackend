import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { 
  ShieldAlert, 
  RefreshCw, 
  AlertTriangle, 
  Cpu, 
  Terminal, 
  Info,
  Clock
} from 'lucide-react';

export const ThreatAnalytics = () => {
  const [threats, setThreats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchThreats = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await api.get('/admin/api-marketplace/threats');
      if (response.data?.success) {
        setThreats(response.data.data || []);
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
    fetchThreats();
  }, []);

  // Compute stats
  const criticalCount = threats.filter(t => t.severity >= 3).length;
  const warningCount = threats.filter(t => t.severity === 2).length;
  const infoCount = threats.filter(t => t.severity <= 1).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Perimeter Threat Analytics</h1>
          <p className="text-sm text-[var(--text-secondary)] font-medium">Monitor real-time abuse attempts, suspicious client IPs, rate-limit threshold breaches, and key rotation anomalies.</p>
        </div>
        <button
          onClick={fetchThreats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all disabled:opacity-50 cursor-pointer h-fit w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh State
        </button>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 h-28 shimmer-element"></div>
            ))}
          </div>
          <div className="h-96 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl shimmer-element"></div>
          <p className="text-xs text-[var(--text-secondary)] text-center animate-pulse">Loading data...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500" />
          <h3 className="font-bold text-sm text-[var(--text-primary)]">Unable to load data.</h3>
          <p className="text-xs text-[var(--text-secondary)]">Please check your connection and try refreshing.</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Info Metrics */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Info className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Severity: Low / Info</p>
                <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{infoCount} Incidents</p>
              </div>
            </div>

            {/* Warning Metrics */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Severity: Warning</p>
                <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{warningCount} Incidents</p>
              </div>
            </div>

            {/* Critical Metrics */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Severity: Critical / High</p>
                <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{criticalCount} Incidents</p>
              </div>
            </div>
          </div>

          {/* Real Threats Log Table */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-[var(--border-soft)] flex justify-between items-center">
              <h3 className="font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4 text-rose-500" /> Active Security Threat Detection Stream
              </h3>
              <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-bold rounded">DB_SYNC_ONLINE</span>
            </div>

            {threats.length === 0 ? (
              <div className="text-center py-12 text-xs text-[var(--text-secondary)]">No records found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] font-extrabold uppercase">
                      <th className="px-6 py-4">Threat Type</th>
                      <th className="px-6 py-4">Endpoint</th>
                      <th className="px-6 py-4">Source IP</th>
                      <th className="px-6 py-4">Client ID</th>
                      <th className="px-6 py-4">Details</th>
                      <th className="px-6 py-4 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-soft)] text-[var(--text-primary)] font-medium">
                    {threats.map((t) => {
                      const isCritical = t.severity >= 3;
                      const isWarning = t.severity === 2;
                      
                      return (
                        <tr key={t.id} className="hover:bg-[var(--accent-hover)] transition-colors">
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-extrabold border ${
                              isCritical 
                                ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' 
                                : isWarning 
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                            }`}>
                              <ShieldAlert className="w-3 h-3" />
                              {t.threatType}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono">{t.endpoint}</td>
                          <td className="px-6 py-4 font-mono text-[var(--text-secondary)]">{t.ipAddress || "N/A"}</td>
                          <td className="px-6 py-4 font-mono">{t.clientId ? `User #${t.clientId}` : "UNAUTHORIZED"}</td>
                          <td className="px-6 py-4 max-w-sm truncate text-[var(--text-secondary)]" title={t.details}>{t.details || "N/A"}</td>
                          <td className="px-6 py-4 text-right text-[var(--text-secondary)] font-mono flex items-center justify-end gap-1.5 h-full py-5">
                            <Clock className="w-3 h-3" /> {new Date(t.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
