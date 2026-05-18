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
      className="max-w-5xl mx-auto space-y-8 py-6"
    >
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Wallet <span className="text-indigo-600">Audit</span></h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Immutable financial ledger records</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} /> {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button 
            onClick={fetchData}
            className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-600 transition-all"
          >
            <RefreshCw className={`w-5 h-5 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-indigo-600" />
            <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Chronological Stream</h2>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Entries: {pagination.total}</span>
        </div>

        <div className="divide-y divide-slate-50">
          {loading ? (
             Array(5).fill(0).map((_, i) => (
              <div key={i} className="px-8 py-6 flex justify-between items-center animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-32"></div>
                    <div className="h-2 bg-slate-50 rounded w-24"></div>
                  </div>
                </div>
                <div className="h-4 bg-slate-100 rounded w-20"></div>
              </div>
            ))
          ) : entries.length > 0 ? (
            entries.map((entry) => (
              <div key={entry.id} className="px-8 py-6 flex justify-between items-center hover:bg-slate-50/50 transition-all group">
                <div className="flex items-center gap-5">
                  <div className={`p-3 rounded-2xl ${entry.amount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {entry.amount > 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{entry.description || entry.type.replace(/_/g, ' ')}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                       <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(entry.createdAt).toLocaleString()}
                      </p>
                      <span className="text-slate-200">|</span>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Type: {entry.type}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black tracking-tighter ${entry.amount > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {entry.amount > 0 ? '+' : ''}₹{formatAmount(entry.amount)}
                  </p>
                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-1">Balance: ₹{formatAmount(entry.balanceAfter)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
              The ledger is currently empty
            </div>
          )}
        </div>

        {pagination.total > filters.limit && (
          <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
            <button 
              disabled={filters.page === 1}
              onClick={() => setFilters({...filters, page: filters.page - 1})}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button 
              disabled={entries.length < filters.limit}
              onClick={() => setFilters({...filters, page: filters.page + 1})}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
