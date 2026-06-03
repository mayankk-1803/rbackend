import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  AlertCircle, 
  FileText,
  Calendar,
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import api from '../../api';
import socket from '../../services/socket';
import { formatAmount, safeArray } from '../../utils/helpers';
import { downloadFile } from '../../utils/downloadFile';
import { InvoiceModal } from '../../components/reports/InvoiceModal';
import { DisputeModal } from '../../components/reports/DisputeModal';
import toast from 'react-hot-toast';



const StatCard = ({ title, value, color, icon: Icon }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="glass-card p-6 rounded-3xl relative overflow-hidden group border border-[var(--glass-border)]"
  >
    <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-5 blur-3xl -mr-12 -mt-12 rounded-full`}></div>
    <div className="flex justify-between items-start">
      <div>
        <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-2xl font-black text-[var(--text-color)] tracking-tighter">{value}</h3>
      </div>
      <div className={`p-3 rounded-2xl ${color.replace('bg-', 'bg-opacity-10 ')}`}>
        <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
  </motion.div>
);

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: '',
    type: '',
    search: '',
    startDate: '',
    endDate: ''
  });
  const [pagination, setPagination] = useState({ pages: 1 });
  const [isExporting, setIsExporting] = useState(false);
  const [refreshingTxnId, setRefreshingTxnId] = useState(null);
  
  // Modal states
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showDispute, setShowDispute] = useState(false);

  const fetchData = useCallback(async () => {

    setLoading(true);
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const [historyRes, summaryRes] = await Promise.all([
        api.get(`/reports/transactions?${queryParams}`),
        api.get('/reports/summary')
      ]);

      setTransactions(safeArray(historyRes.data.data));
      setPagination(historyRes.data.pagination);
      setSummary(summaryRes.data.data);
    } catch (err) {
      toast.error("Failed to fetch reports");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSocketTransactionUpdate = useCallback((data) => {
    if (import.meta.env.DEV) console.log("[SOCKET_ROW_UPDATE] Received transaction update event in client reports history:", data);
    const updatedTxnId = data?.transactionId || data?.txnId || data?.transaction?.id;
    const nextStatus = data?.status || data?.transaction?.status;
    const incomingTxn = data?.transaction || data;

    if (!updatedTxnId) return;

    setTransactions(prev => {
      const existing = prev.find(tx => tx.id === updatedTxnId);
      if (!existing) return prev;

      const statusPriority = {
        SUCCESS: 6,
        REFUNDED: 5,
        FAILED: 4,
        PROCESSING: 3,
        PENDING_REVIEW: 2,
        PENDING: 1
      };

      const existingPriority = statusPriority[existing.status] || 0;
      const nextPriority = statusPriority[nextStatus] || 0;

      if (nextPriority < existingPriority) {
        if (import.meta.env.DEV) console.log(`[SOCKET_STALE_BLOCKED] Stale socket update blocked. Current: ${existing.status}, Incoming: ${nextStatus}`);
        return prev;
      }

      if (existing.updatedAt && incomingTxn?.updatedAt) {
        const existingTime = new Date(existing.updatedAt).getTime();
        const incomingTime = new Date(incomingTxn.updatedAt).getTime();
        if (incomingTime < existingTime) {
          if (import.meta.env.DEV) console.log(`[SOCKET_STALE_BLOCKED] Older update blocked. Current: ${existing.updatedAt}, Incoming: ${incomingTxn.updatedAt}`);
          return prev;
        }
      }

      if (import.meta.env.DEV) console.log(`[SOCKET_ROW_UPDATE] Patching transaction #${updatedTxnId} status from ${existing.status} to ${nextStatus}`);
      return prev.map(tx => 
        tx.id === updatedTxnId ? { ...tx, ...incomingTxn, status: nextStatus } : tx
      );
    });
  }, []);

  useEffect(() => {
    const handleUpdate = (data) => handleSocketTransactionUpdate(data);
    socket.on("recharge_success", handleUpdate);
    socket.on("recharge_failed", handleUpdate);
    socket.on("recharge_queued", handleUpdate);
    socket.on("recharge_processing", handleUpdate);
    socket.on("refund_completed", handleUpdate);
    socket.on("transaction_updated", handleUpdate);
    return () => {
      socket.off("recharge_success", handleUpdate);
      socket.off("recharge_failed", handleUpdate);
      socket.off("recharge_queued", handleUpdate);
      socket.off("recharge_processing", handleUpdate);
      socket.off("refund_completed", handleUpdate);
      socket.off("transaction_updated", handleUpdate);
    };
  }, [handleSocketTransactionUpdate]);

  const handleRefreshStatus = async (txnId) => {
    if (refreshingTxnId === txnId) return;
    setRefreshingTxnId(txnId);
    try {
      const response = await api.get(`/recharge/${txnId}/refresh-status`);
      const updatedTxn = response?.data?.transaction;
      if (updatedTxn) {
        setTransactions(prev =>
          prev.map(txn =>
            txn.id === updatedTxn.id
              ? { ...txn, ...updatedTxn }
              : txn
          )
        );
        toast.success("Status updated");
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error("[REFRESH_ERROR] Error manual-refreshing status:", err);
    } finally {
      setRefreshingTxnId(null);
    }
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading("Preparing export...");
    try {
      await downloadFile(api, '/reports/export', `transactions_${Date.now()}.csv`, filters);
      toast.success("Export successful", { id: toastId });
    } catch (err) {
      toast.error("Export failed", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };


  const getStatusBadge = (status) => {
    const styles = {
      SUCCESS: "bg-emerald-500/10 text-emerald-400 border-emerald-500/15",
      FAILED: "bg-rose-500/10 text-rose-400 border-rose-500/15",
      PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/15",
      REFUNDED: "bg-indigo-500/10 text-indigo-400 border-indigo-500/15"
    };
    return (
      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${styles[status] || styles.PENDING}`}>
        {status}
      </span>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto space-y-8 py-6 relative z-10"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-color)] tracking-tighter uppercase italic">Reports <span className="text-[var(--color-accent)] purple-glow">Wallet</span></h1>
          <p className="text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Audit-grade financial telemetry</p>
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
            className="p-3 bg-[var(--color-accent)] hover:opacity-90 text-white rounded-2xl shadow-lg shadow-purple-500/20 hover:scale-105 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard title="Success Volume" value={`₹${formatAmount(summary.totalVolume)}`} color="bg-emerald-500" icon={CheckCircle2} />
        <StatCard title="Total Success" value={summary.totalSuccess || 0} color="bg-emerald-500" icon={ArrowUpRight} />
        <StatCard title="Failed/Refund" value={summary.totalFailed || 0} color="bg-rose-500" icon={XCircle} />
        <StatCard title="Closing Balance" value={`₹${formatAmount(summary.closingBalance)}`} color="bg-purple-500" icon={FileText} />
      </div>

      {/* Filters */}
      <div className="glass-card border border-[var(--glass-border)] p-6 rounded-[2.5rem] shadow-sm space-y-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input 
              type="text"
              placeholder="Search ID, Mobile, Reference..."
              className="w-full pl-12 pr-4 py-3 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-sm focus:ring-2 focus:ring-[var(--color-accent)]/10 focus:border-[var(--color-accent)] text-[var(--text-color)] transition-all outline-none placeholder:text-[var(--text-muted)]"
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value, page: 1})}
            />
          </div>
          <select 
            className="px-6 py-3 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-sm outline-none text-[var(--text-color)] focus:ring-2 focus:ring-[var(--color-accent)]/10 focus:border-[var(--color-accent)]"
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value, page: 1})}
          >
            <option value="" className="bg-[var(--glass-modal-bg)] text-[var(--text-color)]">All Statuses</option>
            <option value="SUCCESS" className="bg-[var(--glass-modal-bg)] text-[var(--text-color)]">Success</option>
            <option value="FAILED" className="bg-[var(--glass-modal-bg)] text-[var(--text-color)]">Failed</option>
            <option value="PENDING" className="bg-[var(--glass-modal-bg)] text-[var(--text-color)]">Pending</option>
            <option value="REFUNDED" className="bg-[var(--glass-modal-bg)] text-[var(--text-color)]">Refunded</option>
          </select>
          <div className="flex items-center gap-2 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl px-4 text-[var(--text-color)]">
            <Calendar className="w-4 h-4 text-[var(--text-secondary)]" />
            <input 
              type="date" 
              className="bg-transparent py-3 text-xs outline-none text-[var(--text-color)]"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value, page: 1})}
            />
            <span className="text-[var(--text-muted)]">to</span>
            <input 
              type="date" 
              className="bg-transparent py-3 text-xs outline-none text-[var(--text-color)]"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value, page: 1})}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card border border-[var(--glass-border)] rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[var(--glass-button-bg)] border-b border-[var(--glass-border)]">
                <th className="px-8 py-5 text-left text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">ID / Timestamp</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Operator / Mobile</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Type</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Amount</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Status</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)]">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-6"><div className="h-4 bg-[var(--bg-tertiary)] rounded-full w-full"></div></td>
                  </tr>
                ))
              ) : transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[var(--glass-button-bg)] transition-colors group">
                    <td className="px-8 py-6">
                      <p className="text-xs font-black text-[var(--text-color)]">#{tx.id}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase mt-1">{new Date(tx.createdAt).toLocaleString()}</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--glass-button-bg)] border border-[var(--glass-border)] rounded-lg group-hover:bg-[var(--bg-tertiary)] transition-colors">
                          <Smartphone className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-[var(--text-color)] uppercase tracking-tight">{tx.operator}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] font-bold tracking-widest mt-1">{tx.mobile}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{tx.type}</span>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-black text-[var(--text-color)] tracking-tighter">₹{formatAmount(tx.amount)}</p>
                    </td>
                    <td className="px-8 py-6">
                      {getStatusBadge(tx.status)}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        {['PENDING', 'PENDING_REVIEW', 'PROCESSING'].includes(tx.status) && (
                          <button 
                            onClick={() => handleRefreshStatus(tx.id)}
                            disabled={refreshingTxnId === tx.id}
                            className="p-2 hover:bg-[var(--color-accent-glow)] border border-transparent hover:border-[var(--color-accent)]/20 rounded-xl text-[var(--text-secondary)] hover:text-[var(--color-accent)] transition-all cursor-pointer disabled:opacity-50"
                            title="Refresh Status"
                          >
                            <RefreshCw className={`w-4 h-4 ${refreshingTxnId === tx.id ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                        <button 
                          onClick={() => { setSelectedTxn(tx); setShowInvoice(true); }}
                          className="p-2 hover:bg-[var(--color-accent-glow)] border border-transparent hover:border-[var(--color-accent)]/20 rounded-xl text-[var(--text-secondary)] hover:text-[var(--color-accent)] transition-all cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => { setSelectedTxn(tx); setShowDispute(true); }}
                          className="p-2 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-xl text-[var(--text-secondary)] hover:text-rose-400 transition-all cursor-pointer"
                        >
                          <AlertCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                    No transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modals */}
        <InvoiceModal 
          isOpen={showInvoice} 
          onClose={() => setShowInvoice(false)} 
          transaction={selectedTxn} 
        />
        <DisputeModal 
          isOpen={showDispute} 
          onClose={() => setShowDispute(false)} 
          transaction={selectedTxn} 
        />


        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-8 py-6 bg-[var(--glass-button-bg)] border-t border-[var(--glass-border)] flex justify-between items-center">
            <button 
              disabled={filters.page === 1}
              onClick={() => setFilters({...filters, page: filters.page - 1})}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-color)] disabled:opacity-20 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Prev Trace
            </button>
            <div className="flex gap-2">
              {[...Array(pagination.pages)].map((_, i) => (
                <button 
                  key={i}
                  onClick={() => setFilters({...filters, page: i + 1})}
                  className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all cursor-pointer ${filters.page === i + 1 ? 'bg-[var(--color-accent)] text-white shadow-lg shadow-purple-500/20' : 'text-[var(--text-secondary)] hover:bg-[var(--glass-button-bg)] border border-transparent hover:border-[var(--glass-border)]'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button 
              disabled={filters.page === pagination.pages}
              onClick={() => setFilters({...filters, page: filters.page + 1})}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-color)] disabled:opacity-20 transition-colors cursor-pointer"
            >
              Next Trace <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
