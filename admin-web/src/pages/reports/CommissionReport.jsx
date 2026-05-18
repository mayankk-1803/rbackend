import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart, 
  Download, 
  RefreshCw,
  Wallet,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../services/api';
import { formatAmount, safeArray } from '../../utils/helpers';
import { downloadFile } from '../../utils/downloadFile';
import toast from 'react-hot-toast';

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length || !payload[0] || !payload[0].payload) {
    return null;
  }
  
  return (
    <div className="bg-white p-4 rounded-2xl shadow-[0_10px_15px_-3px_rgb(0,0,0,0.1)] text-xs border border-slate-100">
      <p className="font-black text-slate-700 uppercase mb-2">Operator: {label}</p>
      <p className="text-emerald-600 font-bold">Profit: ₹{formatAmount(payload[0].value)}</p>
    </div>
  );
};

export default function CommissionReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/reports/commissions');
      setData(safeArray(res.data.data));
    } catch (err) {
      toast.error("Failed to load commissions");
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
    const toastId = toast.loading("Exporting commission data...");
    try {
      await downloadFile(api, '/admin/reports/export', `commissions_${Date.now()}.csv`, { type: 'COMMISSION' });
      toast.success("Data exported", { id: toastId });
    } catch (err) {
      toast.error("Export failed", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const totalEarnings = data.reduce((acc, curr) => acc + (curr._sum.profit || 0), 0);
  const totalVolume = data.reduce((acc, curr) => acc + (curr._sum.amount || 0), 0);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 p-6 lg:p-8"
    >
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Yield <span className="text-emerald-600">Analytics</span></h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Network profit & commission distribution metrics</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-emerald-600 hover:text-emerald-600 transition-all shadow-sm disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} /> {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button 
            onClick={fetchData}
            className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-emerald-600 transition-all"
          >
            <RefreshCw className={`w-5 h-5 text-emerald-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm flex items-center gap-6"
        >
          <div className="p-4 bg-emerald-50 rounded-2xl">
            <TrendingUp className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Net Profit</p>
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter">₹{formatAmount(totalEarnings)}</h3>
          </div>
        </motion.div>
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm flex items-center gap-6"
        >
          <div className="p-4 bg-indigo-50 rounded-2xl">
            <BarChart3 className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Flow Volume</p>
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter">₹{formatAmount(totalVolume)}</h3>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Chart */}
        <div className="lg:col-span-8 bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Operator-wise Earnings</h3>
            <PieChart className="w-4 h-4 text-slate-400" />
          </div>
          <div className="w-full h-full min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="operator" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="_sum.profit" name="Profit" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="lg:col-span-4 bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm overflow-hidden">
          <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-8">Breakdown</h3>
          <div className="space-y-6 overflow-y-auto max-h-[400px] no-scrollbar">
            {data.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center group">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase">{item.operator}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{item._count.id} TXNs</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900 tracking-tighter">₹{formatAmount(item._sum.profit)}</p>
                  <p className="text-[9px] text-emerald-600 font-bold uppercase">+{((item._sum.profit / totalEarnings) * 100).toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
