import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Download, 
  RefreshCw,
  Wallet,
  Percent,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend } from 'recharts';
import api from '../../services/api';
import { formatAmount, safeArray } from '../../utils/helpers';
import { downloadFile } from '../../utils/downloadFile';
import toast from 'react-hot-toast';

const COLORS = ['#6366F1', '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6', '#F43F5E'];

export default function CommissionDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    kpis: {
      todayCommission: 0, todayCashback: 0, todayProfit: 0,
      weekCommission: 0, weekCashback: 0, weekProfit: 0,
      monthCommission: 0, monthCashback: 0, monthProfit: 0,
      lifetimeCommission: 0, lifetimeCashback: 0, lifetimeProfit: 0
    },
    breakdown: [],
    trends: []
  });
  
  const [activeTrendTab, setActiveTrendTab] = useState('daily'); // daily, weekly, monthly, yearly
  const [isExporting, setIsExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/analytics/commissions');
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load commission analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading("Downloading commission report summary...");
    try {
      await downloadFile(api, '/admin/analytics/reports/generate', `commission_daily_summary_${Date.now()}.csv`, { type: 'daily' });
      toast.success("Summary exported successfully", { id: toastId });
    } catch (err) {
      toast.error("Failed to export summary", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const kpis = data.kpis;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-[var(--text-primary)]"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="space-y-0.5">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Commission <span className="text-[var(--color-primary)]">Analytics</span></h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Recharge yields, platform margins, and cashback payouts</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-[var(--color-primary)]" />
            {isExporting ? 'Exporting...' : 'Export Summary'}
          </button>
          <button 
            onClick={fetchData}
            className="p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-[var(--color-primary)] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Today's Stats Card */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] p-5 rounded-2xl shadow-soft">
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Today's Performance</span>
            <Calendar className="w-4 h-4 text-[var(--color-primary)]" />
          </div>
          <div className="space-y-2.5">
            <div>
              <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Today's Profit</p>
              <h3 className="text-xl font-black text-emerald-500">₹{formatAmount(kpis.todayProfit)}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-soft)]">
              <div>
                <p className="text-[8px] text-[var(--text-secondary)] uppercase tracking-wider">Total Comm</p>
                <p className="text-xs font-bold">₹{formatAmount(kpis.todayCommission)}</p>
              </div>
              <div>
                <p className="text-[8px] text-[var(--text-secondary)] uppercase tracking-wider">Total Cashback</p>
                <p className="text-xs font-bold text-blue-500">₹{formatAmount(kpis.todayCashback)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* This Week's Stats Card */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] p-5 rounded-2xl shadow-soft">
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">This Week's Performance</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="space-y-2.5">
            <div>
              <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Weekly Profit</p>
              <h3 className="text-xl font-black text-emerald-500">₹{formatAmount(kpis.weekProfit)}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-soft)]">
              <div>
                <p className="text-[8px] text-[var(--text-secondary)] uppercase tracking-wider">Total Comm</p>
                <p className="text-xs font-bold">₹{formatAmount(kpis.weekCommission)}</p>
              </div>
              <div>
                <p className="text-[8px] text-[var(--text-secondary)] uppercase tracking-wider">Total Cashback</p>
                <p className="text-xs font-bold text-blue-500">₹{formatAmount(kpis.weekCashback)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* This Month's Stats Card */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] p-5 rounded-2xl shadow-soft">
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">This Month's Performance</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="space-y-2.5">
            <div>
              <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Monthly Profit</p>
              <h3 className="text-xl font-black text-emerald-500">₹{formatAmount(kpis.monthProfit)}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-soft)]">
              <div>
                <p className="text-[8px] text-[var(--text-secondary)] uppercase tracking-wider">Total Comm</p>
                <p className="text-xs font-bold">₹{formatAmount(kpis.monthCommission)}</p>
              </div>
              <div>
                <p className="text-[8px] text-[var(--text-secondary)] uppercase tracking-wider">Total Cashback</p>
                <p className="text-xs font-bold text-blue-500">₹{formatAmount(kpis.monthCashback)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lifetime Earnings Stats Card */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] p-5 rounded-2xl shadow-soft sm:col-span-2 lg:col-span-3">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-[var(--border-soft)] pb-3.5 mb-3.5">
            <div>
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Lifetime Margins</span>
              <span className="text-xs font-medium text-[var(--text-secondary)]">Aggregated historical commission margins</span>
            </div>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-[var(--bg-secondary)]/30 border border-[var(--border-soft)] rounded-xl">
              <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider mb-1">Lifetime Gross Comm</p>
              <h4 className="text-xl font-extrabold text-[var(--text-primary)]">₹{formatAmount(kpis.lifetimeCommission)}</h4>
            </div>
            <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
              <p className="text-[9px] text-blue-500 uppercase tracking-wider mb-1">Lifetime Cashback Paid</p>
              <h4 className="text-xl font-extrabold text-blue-600 dark:text-blue-400">₹{formatAmount(kpis.lifetimeCashback)}</h4>
            </div>
            <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
              <p className="text-[9px] text-emerald-500 uppercase tracking-wider mb-1">Net Platform Profit</p>
              <h4 className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">₹{formatAmount(kpis.lifetimeProfit)}</h4>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Table & Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Trend Chart Panel */}
        <div className="xl:col-span-8 bg-[var(--card-bg)] border border-[var(--border-soft)] p-6 rounded-2xl shadow-soft">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
            <div>
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Commission Profit Trends</h3>
              <p className="text-[9px] text-[var(--text-secondary)] font-medium mt-0.5">Yield distribution graphs</p>
            </div>
            <div className="flex gap-1 p-1 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-soft)] self-start">
              {['daily', 'weekly', 'monthly', 'yearly'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTrendTab(tab)}
                  className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                    activeTrendTab === tab
                      ? 'bg-[var(--card-bg)] text-[var(--color-primary)] border border-[var(--border-soft)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trends}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-soft)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} dy={8} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-soft)', borderRadius: '12px', fontSize: '11px', color: 'var(--text-primary)' }} formatter={(value) => [`₹${value}`, 'Profit']} />
                <Area type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operators Breakdown list */}
        <div className="xl:col-span-4 bg-[var(--card-bg)] border border-[var(--border-soft)] p-6 rounded-2xl shadow-soft flex flex-col">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Top Yielding Operators</h3>
            <p className="text-[9px] text-[var(--text-secondary)] font-medium mt-0.5">Success rates and net platform margins</p>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[320px] pr-1 space-y-4 custom-scrollbar">
            {data.breakdown.length === 0 ? (
              <div className="text-center py-10 text-xs text-[var(--text-secondary)]">No operators transactions logged</div>
            ) : (
              data.breakdown.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-0.5 border-b border-[var(--border-soft)] last:border-0">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-[var(--text-primary)] uppercase">{item.operator}</p>
                    <p className="text-[9px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">{item.count} Recharge Volume</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-xs font-extrabold text-[var(--text-primary)]">₹{formatAmount(item.profit)}</p>
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="text-[8px] text-emerald-500 font-bold">SR {item.successRate}%</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Complete Table Breakdown */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl shadow-soft overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-soft)]">
          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Operator-wise Volume Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-secondary)]/25 border-b border-[var(--border-soft)] text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                <th className="px-6 py-3.5">Operator</th>
                <th className="px-6 py-3.5 text-right">Recharges</th>
                <th className="px-6 py-3.5 text-right">Volume (Amount)</th>
                <th className="px-6 py-3.5 text-right">Total Comm</th>
                <th className="px-6 py-3.5 text-right">Cashback Paid</th>
                <th className="px-6 py-3.5 text-right">Net Profit</th>
                <th className="px-6 py-3.5 text-right">Success Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)] text-xs font-semibold">
              {data.breakdown.map((item, idx) => (
                <tr key={idx} className="hover:bg-[var(--bg-secondary)]/10 transition-colors">
                  <td className="px-6 py-3.5 font-bold uppercase">{item.operator}</td>
                  <td className="px-6 py-3.5 text-right">{item.count}</td>
                  <td className="px-6 py-3.5 text-right">₹{formatAmount(item.amount)}</td>
                  <td className="px-6 py-3.5 text-right">₹{formatAmount(item.commission)}</td>
                  <td className="px-6 py-3.5 text-right text-blue-500">₹{formatAmount(item.cashback)}</td>
                  <td className="px-6 py-3.5 text-right text-emerald-500">₹{formatAmount(item.profit)}</td>
                  <td className="px-6 py-3.5 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      item.successRate >= 95 ? 'bg-emerald-500/10 text-emerald-500' :
                      item.successRate >= 85 ? 'bg-amber-500/10 text-amber-500' :
                      'bg-rose-500/10 text-rose-500'
                    }`}>
                      {item.successRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
