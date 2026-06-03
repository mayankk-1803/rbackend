import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  History, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Download, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  Wallet,
  Clock,
  Shield
} from 'lucide-react';
import api from '../../api';
import { formatAmount, safeArray } from '../../utils/helpers';
import { downloadFile } from '../../utils/downloadFile';
import toast from 'react-hot-toast';

export default function WalletLedger() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [filters, setFilters] = useState({ page: 1, limit: 15 });
  const [pagination, setPagination] = useState({ total: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/wallet-ledger?page=${filters.page}&limit=${filters.limit}`);
      setEntries(safeArray(res.data.data));
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error("Failed to load ledger");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading("Exporting ledger...");
    try {
      await downloadFile(api, '/reports/export', `wallet_ledger_${Date.now()}.csv`, { type: 'LEDGER' });
      toast.success("Ledger exported", { id: toastId });
    } catch (err) {
      toast.error("Export failed", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto space-y-8 py-6 relative z-10"
    >
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-color)] tracking-tighter uppercase italic">Wallet <span className="text-[var(--color-accent)] purple-glow">Audit</span></h1>
          <p className="text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Immutable financial ledger records</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--glass-button-bg)] border border-[var(--glass-border)] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all shadow-sm disabled:opacity-50 cursor-pointer text-[var(--text-color)]"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} /> {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button 
            onClick={fetchData}
            className="p-3 bg-[var(--glass-button-bg)] border border-[var(--glass-border)] rounded-2xl shadow-sm hover:border-[var(--color-accent)] transition-all cursor-pointer text-[var(--text-color)]"
          >
            <RefreshCw className={`w-5 h-5 text-[var(--color-accent)] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="glass-card border border-[var(--glass-border)] rounded-3xl overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--bg-secondary)]/20">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-[var(--color-accent)]" />
            <h2 className="text-[10px] font-black text-[var(--text-color)] uppercase tracking-widest">Chronological Stream</h2>
          </div>
          <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Total Entries: {pagination.total}</span>
        </div>

        <div className="divide-y divide-[var(--glass-border)]">
          {loading ? (
             Array(5).fill(0).map((_, i) => (
              <div key={i} className="px-8 py-6 flex justify-between items-center animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[var(--bg-secondary)] rounded-xl"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-[var(--bg-secondary)] rounded w-32"></div>
                    <div className="h-2 bg-[var(--bg-tertiary)] rounded w-24"></div>
                  </div>
                </div>
                <div className="h-4 bg-[var(--bg-secondary)] rounded w-20"></div>
              </div>
            ))
          ) : entries.length > 0 ? (
            entries.map((entry) => (
              <div key={entry.id} className="px-8 py-6 flex justify-between items-center hover:bg-[var(--bg-secondary)]/10 transition-all group">
                <div className="flex items-center gap-5">
                  <div className={`p-3 rounded-2xl ${entry.amount > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {entry.amount > 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-xs font-black text-[var(--text-color)] uppercase tracking-tight">{entry.description || entry.type.replace(/_/g, ' ')}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                       <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(entry.createdAt).toLocaleString()}
                      </p>
                      <span className="text-[var(--glass-border)]">|</span>
                      <p className="text-[9px] text-[var(--text-secondary)] font-black uppercase tracking-widest">Type: {entry.type}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black tracking-tighter ${entry.amount > 0 ? 'text-emerald-400 emerald-glow' : 'text-[var(--text-color)]'}`}>
                    {entry.amount > 0 ? '+' : ''}₹{formatAmount(entry.amount)}
                  </p>
                  <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">Balance: ₹{formatAmount(entry.balanceAfter)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
              The ledger is currently empty
            </div>
          )}
        </div>

        {pagination.total > filters.limit && (
          <div className="px-8 py-6 bg-[var(--bg-secondary)]/20 border-t border-[var(--glass-border)] flex justify-between items-center">
            <button 
              disabled={filters.page === 1}
              onClick={() => setFilters({...filters, page: filters.page - 1})}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-color)] disabled:opacity-20 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button 
              disabled={entries.length < filters.limit}
              onClick={() => setFilters({...filters, page: filters.page + 1})}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-color)] disabled:opacity-20 transition-colors cursor-pointer"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
