import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  RefreshCw,
  Wallet,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Filter,
  DollarSign
} from 'lucide-react';
import api from '../../services/api';
import { formatAmount } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function FinancialDashboard() {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('lifetime'); // today, 7days, 30days, 90days, lifetime
  const [financials, setFinancials] = useState({
    rechargeVolume: 0,
    commissionPaid: 0,
    cashbackPaid: 0,
    platformProfit: 0,
    refundVolume: 0,
    liabilities: {
      userBalance: 0,
      cashbackBalance: 0,
      totalLiabilities: 0
    }
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/analytics/financials', { params: { filter } });
      if (res.data?.success) {
        setFinancials(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load financial reporting details");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filterOptions = [
    { key: 'today', label: 'Today' },
    { key: '7days', label: 'Last 7 Days' },
    { key: '30days', label: 'Last 30 Days' },
    { key: '90days', label: 'Last 90 Days' },
    { key: 'lifetime', label: 'Lifetime' }
  ];

  const kpis = [
    { title: "Total Recharge Volume", value: financials.rechargeVolume, icon: DollarSign, color: "text-[var(--color-primary)]", bg: "bg-[var(--color-primary-glow)]" },
    { title: "Total Commission Paid", value: financials.commissionPaid, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Total Cashback Paid", value: financials.cashbackPaid, icon: Wallet, color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Platform Retained Profit", value: financials.platformProfit, icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Refund/Reversal Volume", value: financials.refundVolume, icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-500/10" }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-[var(--text-primary)]"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="space-y-0.5">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Financial <span className="text-[var(--color-primary)]">Analytics</span></h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Platform revenue metrics and system liabilities</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <div className="flex gap-1 p-1 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-soft)]">
            {filterOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  filter === opt.key
                    ? 'bg-[var(--card-bg)] text-[var(--color-primary)] border border-[var(--border-soft)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button 
            onClick={fetchData}
            className="p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-[var(--color-primary)] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <motion.div 
              key={idx}
              whileHover={{ y: -1 }}
              className="bg-[var(--card-bg)] border border-[var(--border-soft)] p-5 rounded-2xl shadow-soft flex items-center gap-4"
            >
              <div className={`p-3 rounded-xl ${kpi.color} ${kpi.bg}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">{kpi.title}</p>
                <h3 className="text-xl font-black text-[var(--text-primary)]">₹{formatAmount(kpi.value)}</h3>
              </div>
            </motion.div>
          );
        })}

        {/* System Liabilities Widget */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] p-5 rounded-2xl shadow-soft flex flex-col justify-between">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider">User Wallet Liabilities</span>
            <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-[var(--text-secondary)]">Retailer Main Wallets</span>
              <span>₹{formatAmount(financials.liabilities.userBalance)}</span>
            </div>
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-[var(--text-secondary)]">Cashback Ledger Vaults</span>
              <span>₹{formatAmount(financials.liabilities.cashbackBalance)}</span>
            </div>
            <div className="flex justify-between text-xs font-extrabold pt-2 border-t border-[var(--border-soft)]">
              <span>Gross Liabilities</span>
              <span className="text-rose-500">₹{formatAmount(financials.liabilities.totalLiabilities)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Info Alert */}
      <div className="p-4 bg-[var(--bg-secondary)]/30 border border-[var(--border-soft)] rounded-2xl text-xs font-semibold flex items-center gap-2">
        <ShieldCheck className="w-4.5 h-4.5 text-[var(--color-primary)]" />
        <span>Financial metrics calculations are pulled asynchronously and cached to guarantee zero overhead to live gateway recharge handlers.</span>
      </div>
    </motion.div>
  );
}
