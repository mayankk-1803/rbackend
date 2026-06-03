import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { 
  Sliders, 
  RefreshCw, 
  ShieldAlert, 
  Coins, 
  Zap, 
  Lock 
} from 'lucide-react';

export const ApiPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPlans = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await api.get('/admin/api-marketplace/plans');
      if (response.data?.success) {
        setPlans(response.data.data || []);
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
    fetchPlans();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Credit Bundle Plans</h1>
          <p className="text-sm text-[var(--text-secondary)] font-medium">Configure developer billing plans, credit multipliers, and daily sharding limits.</p>
        </div>
        <button
          onClick={fetchPlans}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all disabled:opacity-50 cursor-pointer h-fit w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh State
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 h-56 shimmer-element"></div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3">
          <ShieldAlert className="w-8 h-8 text-rose-500" />
          <h3 className="font-bold text-sm text-[var(--text-primary)]">Unable to load data.</h3>
          <p className="text-xs text-[var(--text-secondary)]">Please check your connection and try refreshing.</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <Sliders className="w-8 h-8 text-[var(--text-secondary)] opacity-50" />
          <h4 className="font-bold text-sm text-[var(--text-primary)]">No records found.</h4>
          <p className="text-xs text-[var(--text-secondary)] max-w-xs">No active API marketplace pricing plans have been configured in the database.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 flex flex-col justify-between space-y-6 hover:border-[var(--color-primary-glow)] transition-all shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--color-primary)] opacity-5 rounded-bl-full pointer-events-none" />
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold text-[var(--color-primary)] tracking-widest uppercase font-mono">{plan.product?.name || "FINTECH CHANNEL"}</span>
                  <h3 className="font-extrabold text-lg text-[var(--text-primary)] tracking-wide">{plan.name}</h3>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-[var(--text-primary)] font-mono">₹{Number(plan.price).toLocaleString()}</span>
                  <span className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">/ Setup Bundle</span>
                </div>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed min-h-12">{plan.description}</p>

                <div className="space-y-2.5 border-t border-[var(--border-soft)] pt-4 text-xs font-semibold text-[var(--text-primary)]">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase">RPM Limit</span>
                    <span className="font-mono">{plan.requestsPerMinute} req/min</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase">RPH Limit</span>
                    <span className="font-mono">{plan.requestsPerHour} req/hour</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase">RPD Limit</span>
                    <span className="font-mono">{plan.requestsPerDay} req/day</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase">Cost per request</span>
                    <span className="font-mono text-[var(--color-primary)]">₹{Number(plan.costPerRequest).toFixed(4)}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--border-soft)] pt-3 flex items-center justify-between text-[10px] text-[var(--text-secondary)] font-medium">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-emerald-500" /> DB_SYNC_ONLINE
                </span>
                <span>Active Plan</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
