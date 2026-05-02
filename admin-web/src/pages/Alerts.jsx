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
      className="space-y-10"
    >
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/70 backdrop-blur-2xl p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-200 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-rose-500/5 to-transparent"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <ShieldAlert className="w-4 h-4 md:w-5 md:h-5 text-rose-500" />
            <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Security <span className="text-rose-600 text-shadow-glow">Telemetry</span></h1>
          </div>
          <p className="text-[8px] md:text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Monitoring spectral anomalies and provider integrity logs</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-100 rounded-xl md:rounded-2xl">
          <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></div>
          <span className="text-[8px] md:text-[9px] font-black text-rose-600 uppercase tracking-widest">Real-time Watcher Active</span>
        </div>
      </header>

      <div className="grid gap-4 md:gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-32 bg-white/5 animate-pulse rounded-2xl md:rounded-[2.5rem] border border-white/5"></div>
          ))
        ) : alerts.length === 0 ? (
          <div className="py-16 md:py-24 text-center bg-white/70 backdrop-blur-2xl border border-slate-200 border-dashed rounded-2xl md:rounded-[2.5rem] space-y-4 shadow-sm">
             <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                <ShieldAlert className="w-6 h-6 md:w-8 md:h-8 text-emerald-600" />
             </div>
             <div>
                <p className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-widest">System Perimeter Secure</p>
                <p className="text-[8px] md:text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">No active threat signatures detected</p>
             </div>
          </div>
        ) : (
          alerts.map((alert, idx) => (
            <motion.div
              key={alert.id || idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`group flex flex-col sm:flex-row items-start p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border backdrop-blur-2xl transition-all duration-500 relative overflow-hidden ${
                alert.severity === 'high'
                  ? 'bg-rose-50 border-rose-200 hover:bg-rose-100/50 shadow-sm'
                  : 'bg-white/70 border-slate-200 hover:bg-white hover:shadow-md'
              }`}
            >
              <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-white/5 to-transparent"></div>
              
              {/* Icon Container */}
              <div
                className={`p-4 md:p-5 rounded-xl md:rounded-[1.5rem] mb-4 sm:mb-0 sm:mr-8 shadow-inner border ${
                  alert.severity === 'high'
                    ? 'bg-rose-100 text-rose-600 border-rose-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                {alert.type === 'FRAUD' ? (
                  <ShieldAlert className="w-6 h-6 md:w-8 md:h-8" />
                ) : (
                  <AlertCircle className="w-6 h-6 md:w-8 md:h-8" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 relative z-10 w-full">
                <div className="flex justify-between items-start mb-2 gap-2">
                   <h3 className={`text-lg md:text-xl font-black uppercase tracking-tighter italic ${
                      alert.severity === 'high' ? 'text-rose-700' : 'text-slate-900'
                   }`}>
                     {(alert.type || 'Anomaly').replace('_', ' ')}
                   </h3>
                   <span className={`text-[7px] md:text-[8px] font-black px-3 py-1 rounded-lg uppercase tracking-[0.2em] whitespace-nowrap ${
                      alert.severity === 'high' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500'
                   }`}>
                      {alert.severity || 'low'}
                   </span>
                </div>

                <p className="text-slate-400 text-xs md:text-sm font-medium leading-relaxed max-w-3xl">
                  {alert.message || 'Undefined spectral anomaly detected in system logs.'}
                </p>

                {/* Meta Info Footer */}
                <div className="mt-6 md:mt-8 flex flex-wrap gap-3 md:gap-4 items-center">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl">
                     <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase">Resource</span>
                     <span className="text-[9px] md:text-[10px] font-black text-slate-900 uppercase tracking-tight">{alert.val || 'N/A'}</span>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl">
                     <Clock className="w-3 h-3 text-slate-400" />
                     <span className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                        {alert.time ? new Date(alert.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Boot'}
                     </span>
                  </div>

                  <motion.button 
                    whileHover={{ x: 5 }}
                    className="sm:ml-auto text-[8px] md:text-[9px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2 transition-colors"
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