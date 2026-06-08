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
import MasterKeyModal from '../../components/MasterKeyModal';

const COLORS = ['#1F7A4D', '#10B981', '#34D399', '#059669', '#6EE7B7', '#A7F3D0'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length || !payload[0] || !payload[0].payload) {
    return null;
  }
  
  return (
    <div className="bg-[var(--card-bg)] p-3 rounded-xl shadow-soft text-xs border border-[var(--border-soft)]">
      <p className="font-semibold text-[var(--text-primary)] uppercase mb-1">Operator: {label}</p>
      <p className="text-emerald-500 font-bold">Profit: ₹{formatAmount(payload[0].value)}</p>
    </div>
  );
};

export default function CommissionReport() {
  const [isMasterKeyModalOpen, setIsMasterKeyModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const handleCriticalAction = (actionCallback) => {
    if (window.masterKeySession && window.masterKeySessionExpiry && window.masterKeySessionExpiry > Date.now()) {
      actionCallback(window.masterKeySession);
    } else {
      setPendingAction(() => actionCallback);
      setIsMasterKeyModalOpen(true);
    }
  };

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

  const handleExport = () => {
    if (isExporting) return;
    handleCriticalAction(async () => {
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
    });
  };

  const totalEarnings = data.reduce((acc, curr) => acc + (curr._sum.profit || 0), 0);
  const totalVolume = data.reduce((acc, curr) => acc + (curr._sum.amount || 0), 0);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <div className="space-y-0.5">
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">Yield <span className="text-[var(--color-primary)]">Analytics</span></h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Network profit & commission distribution metrics</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} /> {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button 
            onClick={fetchData}
            className="p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4.5 h-4.5 text-[var(--color-primary)] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <motion.div 
          whileHover={{ y: -1 }}
          className="bg-[var(--card-bg)] border border-[var(--border-soft)] p-6 rounded-xl shadow-soft flex items-center gap-5"
        >
          <div className="p-3 bg-[var(--color-primary-glow)] rounded-xl text-[var(--color-primary)]">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">Total Net Profit</p>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">₹{formatAmount(totalEarnings)}</h3>
          </div>
        </motion.div>
        
        <motion.div 
          whileHover={{ y: -1 }}
          className="bg-[var(--card-bg)] border border-[var(--border-soft)] p-6 rounded-xl shadow-soft flex items-center gap-5"
        >
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">Total Flow Volume</p>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">₹{formatAmount(totalVolume)}</h3>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart */}
        <div className="lg:col-span-8 bg-[var(--card-bg)] border border-[var(--border-soft)] p-6 rounded-xl shadow-soft">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">Operator-wise Earnings</h3>
            <PieChart className="w-4 h-4 text-[var(--text-secondary)]" />
          </div>
          <div className="w-full h-full min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-soft)" />
                <XAxis 
                  dataKey="operator" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: 'var(--text-secondary)' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: 'var(--text-secondary)' }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--accent-hover)' }} />
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
        <div className="lg:col-span-4 bg-[var(--card-bg)] border border-[var(--border-soft)] p-6 rounded-xl shadow-soft flex flex-col justify-between overflow-hidden">
          <div>
            <h3 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-6">Breakdown</h3>
            <div className="space-y-5 overflow-y-auto max-h-[350px] custom-scrollbar pr-1">
              {data.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center group">
                  <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)] uppercase">{item.operator}</p>
                      <p className="text-[9px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">{item._count.id} TXNs</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-[var(--text-primary)]">₹{formatAmount(item._sum.profit)}</p>
                    <p className="text-[9px] text-emerald-500 font-semibold uppercase">+{((item._sum.profit / totalEarnings) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <MasterKeyModal
        isOpen={isMasterKeyModalOpen}
        onClose={() => setIsMasterKeyModalOpen(false)}
        onSuccess={(token) => {
          if (pendingAction) pendingAction(token);
        }}
      />
    </motion.div>
  );
}
