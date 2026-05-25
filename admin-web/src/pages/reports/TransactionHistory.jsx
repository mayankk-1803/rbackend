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
  User,
  Database,
  ArrowUpRight
} from 'lucide-react';
import api from '../../services/api';
import { formatAmount, safeArray } from '../../utils/helpers';
import { downloadFile } from '../../utils/downloadFile';
import { InvoiceModal } from '../../components/InvoiceModal';
import toast from 'react-hot-toast';
import { useSocket } from '../../hooks/useSocket';


const StatCard = ({ title, value, color, icon: Icon }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm relative overflow-hidden group"
  >
    <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-5 blur-3xl -mr-12 -mt-12 rounded-full`}></div>
    <div className="flex justify-between items-start">
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{value}</h3>
      </div>
      <div className={`p-3 rounded-2xl ${color.replace('bg-', 'bg-opacity-10 ')}`}>
        <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
  </motion.div>
);

export default function AdminTransactionHistory() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    status: '',
    type: '',
    search: '',
    startDate: '',
    endDate: ''
  });
  const [pagination, setPagination] = useState({ pages: 1 });
  const [isExporting, setIsExporting] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [confirmRetryTxn, setConfirmRetryTxn] = useState(null);
  const [refreshingTxnId, setRefreshingTxnId] = useState(null);
  const { useSocketEvent } = useSocket();

  const fetchSummary = useCallback(async () => {
    console.log("[FETCH][SUMMARY] Triggered");
    try {
      const { data } = await api.get('/admin/reports/summary');
      setSummary(data.data);
    } catch (err) {
      console.error("[SUMMARY][ERROR]", err);
    }
  }, []);

  const isFetching = React.useRef(false);

  const fetchTransactions = useCallback(async () => {
    if (isFetching.current) return;
    console.log(`[FETCH][TRANSACTIONS] Triggered | Page: ${filters.page}`);
    
    isFetching.current = true;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const { data } = await api.get(`/admin/reports/transactions?${queryParams}`);
      setTransactions(safeArray(data.data));
      setPagination(data.pagination);
    } catch (err) {
      console.error("[TRANSACTIONS][ERROR]", err);
      toast.error("Failed to fetch transactions");
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [filters]); // Only depends on filters

  const handleManualRefresh = () => {
    console.log("[MANUAL_REFRESH] Triggered");
    fetchTransactions();
    fetchSummary();
  };

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleSocketTransactionUpdate = useCallback((payload) => {
    console.log("[SOCKET_ROW_UPDATE] Received realtime event:", payload);
    const updatedTxnId = payload.transactionId || payload.txnId;
    const nextStatus = payload.status;
    const updatedTxnObj = payload.transaction;

    if (!updatedTxnId) return;

    setTransactions(prev => {
      const existing = prev.find(t => t.id === updatedTxnId);
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
        console.log(`[SOCKET_STALE_BLOCKED] Stale socket update blocked. Current: ${existing.status}, Incoming: ${nextStatus}`);
        return prev;
      }

      if (existing.updatedAt && updatedTxnObj?.updatedAt) {
        const existingTime = new Date(existing.updatedAt).getTime();
        const incomingTime = new Date(updatedTxnObj.updatedAt).getTime();
        if (incomingTime < existingTime) {
          console.log(`[SOCKET_STALE_BLOCKED] Older update blocked. Current: ${existing.updatedAt}, Incoming: ${updatedTxnObj.updatedAt}`);
          return prev;
        }
      }

      console.log(`[SOCKET_ROW_UPDATE] Patching transaction #${updatedTxnId} status from ${existing.status} to ${nextStatus}`);
      return prev.map(t => {
        if (t.id === updatedTxnId) {
          return {
            ...t,
            status: nextStatus,
            providerRef: updatedTxnObj?.providerTxnId || payload.providerTxnId || t.providerRef,
            providerTxnId: updatedTxnObj?.providerTxnId || payload.providerTxnId || t.providerTxnId,
            cashback: updatedTxnObj?.cashback !== undefined ? updatedTxnObj.cashback : t.cashback,
            refundStatus: updatedTxnObj?.refundStatus || t.refundStatus,
            apiResponse: updatedTxnObj?.apiResponse || t.apiResponse,
            updatedAt: updatedTxnObj?.updatedAt || new Date().toISOString()
          };
        }
        return t;
      });
    });

    fetchSummary();
  }, [fetchSummary]);

  useSocketEvent('recharge_queued', handleSocketTransactionUpdate);
  useSocketEvent('recharge_processing', handleSocketTransactionUpdate);
  useSocketEvent('recharge_success', handleSocketTransactionUpdate);
  useSocketEvent('recharge_failed', handleSocketTransactionUpdate);
  useSocketEvent('refund_completed', handleSocketTransactionUpdate);
  useSocketEvent('transaction_updated', handleSocketTransactionUpdate);

  const softRefresh = useCallback(async () => {
    console.log("[UI_AUTO_REFRESH] Soft refreshing visible rows...");
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const { data } = await api.get(`/admin/reports/transactions?${queryParams}`);
      const fetched = safeArray(data.data);
      
      setTransactions(prev => {
        return prev.map(oldTxn => {
          const fresh = fetched.find(f => f.id === oldTxn.id);
          if (fresh) {
            return {
              ...oldTxn,
              status: fresh.status,
              providerRef: fresh.providerRef || fresh.providerTxnId || oldTxn.providerRef,
              providerTxnId: fresh.providerTxnId || oldTxn.providerTxnId,
              cashback: fresh.cashback,
              refundStatus: fresh.refundStatus,
              updatedAt: fresh.updatedAt
            };
          }
          return oldTxn;
        });
      });
    } catch (err) {
      console.warn("[UI_AUTO_REFRESH] Soft refresh failed:", err);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setInterval(() => {
      softRefresh();
    }, 60000);
    return () => clearInterval(timer);
  }, [softRefresh]);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading("Preparing global export...");
    try {
      await downloadFile(api, '/admin/reports/export', `master_ledger_${Date.now()}.csv`, filters);
      toast.success("Master ledger exported", { id: toastId });
    } catch (err) {
      toast.error("Global export failed", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefreshStatus = async (txnId) => {
    if (refreshingTxnId === txnId) return;
    setRefreshingTxnId(txnId);
    console.log(`[MANUAL_REFRESH] Refresh requested for txn: ${txnId}`);
    try {
      const { data } = await api.get(`/recharge/${txnId}/refresh-status`);
      if (data.success && data.transaction) {
        toast.success("Status synced successfully");
        setTransactions(prev =>
          prev.map(txn =>
            txn.id === data.transaction.id
              ? { ...txn, ...data.transaction }
              : txn
          )
        );
        fetchSummary();
      } else {
        toast.error("Failed to sync status");
      }
    } catch (err) {
      if (err.response && err.response.status === 429) {
        toast.error("Rate limit: Please wait 10 seconds between refreshes.");
      } else {
        toast.error("Failed to sync status");
      }
    } finally {
      setRefreshingTxnId(null);
    }
  };

    const handleRetry = async (txnId) => {
      if (retryingId) return;
      setRetryingId(txnId);
      const toastId = toast.loading("Recharge processing...");
      try {
        const { data } = await api.post(`/admin/retry/${txnId}`);
        if (data.success) {
          toast.success("Recharge processing", { id: toastId });
          console.log("[RETRY_REFRESH] Triggered");
          fetchTransactions(); 
          fetchSummary();
        } else {
          toast.error("Recharge failed", { id: toastId });
        }
      } catch (err) {
        toast.error("Recharge failed", { id: toastId });
      } finally {
        setRetryingId(null);
        setConfirmRetryTxn(null);
      }
    };

    const getStatusBadge = (status) => {
      const styles = {
        SUCCESS: "bg-emerald-50 text-emerald-600 border-emerald-100",
        FAILED: "bg-rose-50 text-rose-600 border-rose-100",
        PENDING: "bg-amber-50 text-amber-600 border-amber-100",
        PENDING_REVIEW: "bg-purple-50 text-purple-600 border-purple-100",
        PROCESSING: "bg-cyan-50 text-cyan-600 border-cyan-100",
        REFUNDED: "bg-cyan-50 text-cyan-600 border-cyan-100"
      };
      const labels = {
        PENDING_REVIEW: "Pending Review",
        PROCESSING: "Processing",
        SUCCESS: "Success",
        FAILED: "Failed",
        REFUNDED: "Refunded",
        PENDING: "Pending"
      };
      return (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${styles[status] || styles.PENDING}`}>
          {labels[status] || status}
        </span>
      );
    };

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-8 p-6 lg:p-8"
      >
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Master <span className="text-indigo-600">Ledger</span></h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Global transaction telemetry & reconciliation</p>
          </div>
          <div className="flex gap-3 w-full lg:w-auto">
            <button 
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm disabled:opacity-50"
            >
              <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} /> {isExporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <button 
              onClick={handleManualRefresh}
              className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20 hover:scale-105 transition-all"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
  
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatCard title="Network Volume" value={`₹${formatAmount(summary.totalVolume)}`} color="bg-indigo-500" icon={Database} />
          <StatCard title="Successful Nodes" value={summary.totalSuccess || 0} color="bg-emerald-500" icon={CheckCircle2} />
          <StatCard title="Total Failures" value={summary.totalFailed || 0} color="bg-rose-500" icon={XCircle} />
          <StatCard title="Total Refunds" value={summary.totalRefunded || 0} color="bg-cyan-500" icon={ArrowUpRight} />
        </div>
  
        {/* Filters */}
        <div className="bg-white border border-slate-200 p-6 rounded-[2.5rem] shadow-sm space-y-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[250px] relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Search ID, Mobile, Operator Ref, User..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value, page: 1})}
              />
            </div>
            <select 
              className="px-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none"
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value, page: 1})}
            >
              <option value="">All Statuses</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="PROCESSING">Processing</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </select>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-2xl px-4">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                className="bg-transparent py-3 text-xs outline-none"
                value={filters.startDate}
                onChange={(e) => setFilters({...filters, startDate: e.target.value, page: 1})}
              />
              <span className="text-slate-300">to</span>
              <input 
                type="date" 
                className="bg-transparent py-3 text-xs outline-none"
                value={filters.endDate}
                onChange={(e) => setFilters({...filters, endDate: e.target.value, page: 1})}
              />
            </div>
          </div>
        </div>
  
        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction / User</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Target / Op</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Type</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Financials</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Manage</th>
  
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-8 py-6"><div className="h-4 bg-slate-100 rounded-full w-full"></div></td>
                    </tr>
                  ))
                ) : transactions.length > 0 ? (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-50 rounded-lg">
                            <User className="w-3.5 h-3.5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{tx.user?.name || 'Unknown'}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">ID: #{tx.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{tx.operator}</p>
                        <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1">{tx.mobile}</p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-xs font-bold text-slate-600 uppercase">{tx.type || 'RECHARGE'}</p>
                        <p className="text-[9px] text-slate-400 font-mono mt-1">REF: {tx.providerRef || 'N/A'}</p>
                      </td>
  
                      <td className="px-8 py-6">
                        <p className="text-sm font-black text-slate-900 tracking-tighter">₹{formatAmount(tx.amount)}</p>
                        <p className="text-[9px] text-emerald-600 font-bold uppercase mt-1">Cashback: ₹{formatAmount(tx.cashback)}</p>
                      </td>
                      <td className="px-8 py-6">
                        {getStatusBadge(tx.status)}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2">
                          {!['SUCCESS', 'FAILED', 'REFUNDED'].includes(tx.status) && (
                            <button 
                              onClick={() => handleRefreshStatus(tx.id)}
                              disabled={refreshingTxnId === tx.id}
                              className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 transition-all disabled:opacity-50" 
                              title="Refresh Status"
                            >
                              <RefreshCw className={`w-4 h-4 ${refreshingTxnId === tx.id ? "animate-spin" : ""}`} />
                            </button>
                          )}
                          <button 
                            onClick={() => { setSelectedTxn(tx); setShowInvoice(true); }}
                            className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 transition-all" 
                            title="Print Invoice"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {(tx.status === "PENDING_REVIEW" || tx.status === "FAILED") && (
                            <button 
                              onClick={() => setConfirmRetryTxn(tx)}
                              disabled={retryingId === tx.id}
                              className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl text-slate-400 hover:text-rose-600 transition-all disabled:opacity-50" 
                              title="Retry Recharge"
                            >
                              <RefreshCw className={`w-4 h-4 ${retryingId === tx.id ? "animate-spin" : ""}`} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      No global signatures found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
            <button 
              disabled={filters.page === 1}
              onClick={() => setFilters({...filters, page: filters.page - 1})}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Page {filters.page} / {pagination.pages}</span>
            <button 
              disabled={filters.page === pagination.pages}
              onClick={() => setFilters({...filters, page: filters.page + 1})}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <InvoiceModal 
        isOpen={showInvoice} 
        onClose={() => setShowInvoice(false)} 
        transaction={selectedTxn} 
      />

      <AnimatePresence>
        {confirmRetryTxn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              className="glass-modal border border-[var(--glass-border)] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5"
            >
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--color-accent)]">Admin Retry</p>
                <h3 className="text-lg font-black uppercase tracking-tight text-[var(--text-color)]">Retry Recharge</h3>
                <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest mt-2">
                  This will execute the real recharge API for transaction #{confirmRetryTxn.id}.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-button-bg)] p-4 text-[10px] uppercase tracking-widest text-[var(--text-secondary)] space-y-2">
                <div className="flex justify-between"><span>Mobile</span><strong>{confirmRetryTxn.mobile}</strong></div>
                <div className="flex justify-between"><span>Amount</span><strong>INR {formatAmount(confirmRetryTxn.amount)}</strong></div>
                <div className="flex justify-between"><span>Status</span><strong>{confirmRetryTxn.status}</strong></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setConfirmRetryTxn(null)} className="py-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-button-bg)] text-[var(--text-color)] text-[9px] font-black uppercase tracking-widest">
                  Cancel
                </button>
                <button onClick={() => handleRetry(confirmRetryTxn.id)} disabled={retryingId === confirmRetryTxn.id} className="py-3 rounded-xl bg-[var(--color-accent)] text-white text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60">
                  <RefreshCw className={`w-4 h-4 ${retryingId === confirmRetryTxn.id ? "animate-spin" : ""}`} />
                  Retry
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
