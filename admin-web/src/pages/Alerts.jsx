import React, { useState, useEffect } from 'react';
import { AlertCircle, ShieldAlert, Clock, ChevronRight } from 'lucide-react';
import api from '../services/api';
import { motion } from 'framer-motion';

export const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/admin/alerts');
        setAlerts(Array.isArray(data?.data) ? data.data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] shadow-soft relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 bg-rose-500/10 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Security alerts
            </h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Monitoring provider integrity logs and system threshold warnings</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-xl self-start sm:self-auto">
          <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Real-time watch active</span>
        </div>
      </header>

      <div className="grid gap-4">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-32 bg-[var(--card-bg)] animate-pulse rounded-xl border border-[var(--border-soft)] shimmer-element"></div>
          ))
        ) : alerts.length === 0 ? (
          <div className="py-16 text-center bg-[var(--card-bg)] border border-[var(--border-soft)] border-dashed rounded-xl shadow-soft space-y-4">
             <div className="w-12 h-12 bg-[var(--color-primary-glow)] rounded-full flex items-center justify-center mx-auto border border-[var(--color-primary)]/10">
                <ShieldAlert className="w-5 h-5 text-[var(--color-primary)]" />
             </div>
             <div>
                <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">System Perimeter Secure</p>
                <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-1">No active security threat signatures detected</p>
             </div>
          </div>
        ) : (
          alerts.map((alert, idx) => (
            <motion.div
              key={alert.id || idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`group flex flex-col sm:flex-row items-start p-6 rounded-xl border transition-all duration-200 relative overflow-hidden shadow-soft ${
                alert.severity === 'high'
                  ? 'bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10'
                  : 'bg-[var(--card-bg)] border-[var(--border-soft)] hover:border-[var(--color-primary)]/30'
              }`}
            >
              {/* Icon Container */}
              <div
                className={`p-3 rounded-xl mb-4 sm:mb-0 sm:mr-5 border ${
                  alert.severity === 'high'
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-soft)]'
                }`}
              >
                {alert.type === 'FRAUD' ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 relative z-10 w-full">
                <div className="flex justify-between items-start mb-2 gap-2">
                   <h3 className={`text-sm font-bold uppercase tracking-tight ${
                      alert.severity === 'high' ? 'text-rose-600' : 'text-[var(--text-primary)]'
                   }`}>
                     {(alert.type || 'Anomaly').replace('_', ' ')}
                   </h3>
                   <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      alert.severity === 'high' ? 'bg-rose-600 text-white shadow-sm' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-soft)]'
                   }`}>
                      {alert.severity || 'low'}
                   </span>
                </div>

                <p className="text-[var(--text-secondary)] text-xs font-medium leading-relaxed max-w-3xl">
                  {alert.message || 'Undefined spectral anomaly detected in system logs.'}
                </p>

                {/* Meta Info Footer */}
                <div className="mt-4 pt-4 border-t border-[var(--border-soft)] flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2 px-2.5 py-1 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg">
                     <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">Resource</span>
                     <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-tight">{alert.val || 'N/A'}</span>
                  </div>

                  <div className="flex items-center gap-2 px-2.5 py-1 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg">
                     <Clock className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                     <span className="text-[10px] font-semibold text-[var(--text-secondary)] font-mono">
                        {alert.time ? new Date(alert.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Boot'}
                     </span>
                  </div>

                  <motion.button 
                    whileHover={{ x: 3 }}
                    className="sm:ml-auto text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--color-primary)] uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                     Investigate <ChevronRight className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
};