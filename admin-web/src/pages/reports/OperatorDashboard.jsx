import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  RefreshCw,
  Smartphone,
  Tv,
  Activity
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function OperatorDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    mobile: [],
    dth: []
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/analytics/operators');
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load operator performance stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusBadgeClass = (health) => {
    if (health === "HEALTHY") return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    if (health === "WARNING") return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    return "bg-rose-500/10 text-rose-500 border-rose-500/20";
  };

  const getHealthDotColor = (health) => {
    if (health === "HEALTHY") return "bg-emerald-500";
    if (health === "WARNING") return "bg-amber-500";
    return "bg-rose-500";
  };

  const renderOperatorGrid = (operators, title, icon) => {
    const Icon = icon;
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-[var(--border-soft)] pb-3">
          <Icon className="w-5 h-5 text-[var(--color-primary)]" />
          <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">{title}</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {operators.map((op, idx) => (
            <motion.div 
              key={idx}
              whileHover={{ y: -1 }}
              className="bg-[var(--card-bg)] border border-[var(--border-soft)] p-5 rounded-2xl shadow-soft flex flex-col justify-between"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-tight">{op.operator}</h3>
                  <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mt-0.5">TELEMETRY</span>
                </div>
                <div className={`px-2.5 py-0.5 border rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 ${getStatusBadgeClass(op.health)}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${getHealthDotColor(op.health)} ${op.health !== "HEALTHY" ? 'animate-pulse' : ''}`} />
                  {op.health}
                </div>
              </div>

              {/* Status dial */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-semibold">
                    <span className="text-[var(--text-secondary)]">SUCCESS RATE</span>
                    <span className={op.health === "HEALTHY" ? "text-emerald-500 font-extrabold" : op.health === "WARNING" ? "text-amber-500 font-extrabold" : "text-rose-500 font-extrabold"}>
                      {op.successRate}%
                    </span>
                  </div>
                  <div className="w-full bg-[var(--bg-secondary)] rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${op.health === "HEALTHY" ? "bg-emerald-500" : op.health === "WARNING" ? "bg-amber-500" : "bg-rose-500"}`}
                      style={{ width: `${op.successRate}%` }}
                    />
                  </div>
                </div>

                {/* Status Counters */}
                <div className="grid grid-cols-4 gap-1 text-center pt-2.5 border-t border-[var(--border-soft)]">
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-[var(--text-muted)] font-bold block">SUCCESS</span>
                    <span className="text-xs font-black text-emerald-500">{op.success}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-[var(--text-muted)] font-bold block">FAILED</span>
                    <span className="text-xs font-black text-rose-500">{op.failed}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-[var(--text-muted)] font-bold block">REFUNDED</span>
                    <span className="text-xs font-black text-blue-500">{op.refunded}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-[var(--text-muted)] font-bold block">PENDING</span>
                    <span className="text-xs font-black text-amber-500">{op.pending}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 text-[var(--text-primary)]"
    >
      {/* Header */}
      <div className="flex justify-between items-center border-b border-[var(--border-soft)] pb-4">
        <div className="space-y-0.5">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Operator <span className="text-[var(--color-primary)]">Performance</span></h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Real-time status tracking and gateway health checks</p>
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
          <span className="text-xs text-[var(--text-secondary)] font-bold">Synchronizing telemetry counters...</span>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Mobile Operators */}
          {renderOperatorGrid(data.mobile, "Mobile Recharge Operators", Smartphone)}

          {/* DTH Operators */}
          {renderOperatorGrid(data.dth, "DTH Subscription Operators", Tv)}
        </div>
      )}
    </motion.div>
  );
}
