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

const StatCard = ({ title, value, colorClass, icon: Icon }) => (
  <motion.div 
    whileHover={{ y: -1 }}
    className="bg-[var(--card-bg)] border border-[var(--border-soft)] p-5 rounded-xl shadow-soft relative overflow-hidden flex justify-between items-start"
  >
    <div>
      <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-tight">{value}</h3>
    </div>
    <div className={`p-2.5 rounded-lg ${colorClass}`}>
      <Icon className="w-4.5 h-4.5" />
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
  }, [filters]);

  const handleManualRefresh = () => {
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
        return prev;
      }

      if (existing.updatedAt && updatedTxnObj?.updatedAt) {
        const existingTime = new Date(existing.updatedAt).getTime();
        const incomingTime = new Date(updatedTxnObj.updatedAt).getTime();
        if (incomingTime < existingTime) {
          return prev;
        }
      }

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
      SUCCESS: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      FAILED: "bg-rose-500/10 text-rose-500 border-rose-500/20",
      PENDING: "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-soft)]",
      PENDING_REVIEW: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      PROCESSING: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      REFUNDED: "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-soft)]"
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
      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider border ${styles[status] || styles.PENDING}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="space-y-0.5">
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">Master <span className="text-[var(--color-primary)]">Ledger</span></h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Global transaction telemetry & reconciliation</p>
        </div>
        <div className="flex gap-2 w-full lg:w-auto">
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} /> {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button 
            onClick={handleManualRefresh}
            className="p-2.5 bg-[var(--color-primary)] text-[var(--bg-primary)] rounded-xl hover:opacity-90 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4.5 h-4.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <StatCard title="Network Volume" value={`₹${formatAmount(summary.totalVolume)}`} colorClass="bg-[var(--color-primary-glow)] text-[var(--color-primary)]" icon={Database} />
        <StatCard title="Successful Nodes" value={(summary.totalSuccess || 0).toLocaleString()} colorClass="bg-emerald-500/10 text-emerald-500" icon={CheckCircle2} />
        <StatCard title="Total Failures" value={(summary.totalFailed || 0).toLocaleString()} colorClass="bg-rose-500/10 text-rose-500" icon={XCircle} />
        <StatCard title="Total Refunds" value={(summary.totalRefunded || 0).toLocaleString()} colorClass="bg-[var(--bg-secondary)] text-[var(--text-secondary)]" icon={ArrowUpRight} />
      </div>

      {/* Filters */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] p-5 rounded-xl shadow-soft space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[250px] relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input 
              type="text"
              placeholder="Search ID, Mobile, Operator Ref, User..."
              className="w-full pl-9 pr-4 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--admin-focus-ring)] transition-all outline-none placeholder:text-[var(--text-muted)]"
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value, page: 1})}
            />
          </div>
          <select 
            className="px-4 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] text-[var(--text-primary)] rounded-xl text-xs outline-none cursor-pointer"
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
          <div className="flex items-center gap-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] text-[var(--text-primary)] rounded-xl px-3 text-xs">
            <Calendar className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <input 
              type="date" 
              className="bg-transparent py-2 outline-none text-xs text-[var(--text-primary)]"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value, page: 1})}
            />
            <span className="text-[var(--text-secondary)]">to</span>
            <input 
              type="date" 
              className="bg-transparent py-2 outline-none text-xs text-[var(--text-primary)]"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value, page: 1})}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border-soft)]">
                <th className="px-6 py-4 text-left text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Transaction / User</th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Target / Op</th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Financials</th>
                <th className="px-6 py-4 text-left text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)] text-xs text-[var(--text-primary)]">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-[var(--bg-secondary)] rounded-full w-full"></div></td>
                  </tr>
                ))
              ) : transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[var(--accent-hover)] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--bg-secondary)] rounded-lg">
                          <User className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[var(--text-primary)]">{tx.user?.name || 'Unknown'}</p>
                          <p className="text-[9px] text-[var(--text-secondary)] font-mono mt-0.5">ID: #{tx.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-[var(--text-primary)] uppercase">{tx.operator}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] font-semibold mt-0.5">{tx.mobile}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">{tx.type || 'RECHARGE'}</p>
                      <p className="text-[9px] text-[var(--text-muted)] font-mono mt-0.5">REF: {tx.providerRef || 'N/A'}</p>
                    </td>

                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-[var(--text-primary)]">₹{formatAmount(tx.amount)}</p>
                      <p className="text-[9px] text-emerald-500 font-semibold mt-0.5">CB: ₹{formatAmount(tx.cashback)}</p>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(tx.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        {!['SUCCESS', 'FAILED', 'REFUNDED'].includes(tx.status) && (
                          <button 
                            onClick={() => handleRefreshStatus(tx.id)}
                            disabled={refreshingTxnId === tx.id}
                            className="p-1.5 hover:bg-[var(--bg-secondary)] border border-transparent rounded-lg text-[var(--text-secondary)] hover:text-[var(--color-primary)] transition-all disabled:opacity-50 cursor-pointer" 
                            title="Refresh Status"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshingTxnId === tx.id ? "animate-spin" : ""}`} />
                          </button>
                        )}
                        <button 
                          onClick={() => { setSelectedTxn(tx); setShowInvoice(true); }}
                          className="p-1.5 hover:bg-[var(--bg-secondary)] border border-transparent rounded-lg text-[var(--text-secondary)] hover:text-[var(--color-primary)] transition-all cursor-pointer" 
                          title="Print Invoice"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {(tx.status === "PENDING_REVIEW" || tx.status === "FAILED") && (
                          <button 
                            onClick={() => setConfirmRetryTxn(tx)}
                            disabled={retryingId === tx.id}
                            className="p-1.5 hover:bg-[var(--bg-secondary)] border border-transparent rounded-lg text-[var(--text-secondary)] hover:text-rose-500 transition-all disabled:opacity-50 cursor-pointer" 
                            title="Retry Recharge"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${retryingId === tx.id ? "animate-spin" : ""}`} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-xs font-semibold text-[var(--text-secondary)]">
                    No global signatures found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 bg-[var(--bg-secondary)]/30 border-t border-[var(--border-soft)] flex justify-between items-center text-xs font-semibold text-[var(--text-secondary)]">
            <button 
              disabled={filters.page === 1}
              onClick={() => setFilters({...filters, page: filters.page - 1})}
              className="flex items-center gap-1.5 hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="font-semibold text-[var(--text-secondary)] text-[10px] uppercase">Page {filters.page} / {pagination.pages}</span>
            <button 
              disabled={filters.page === pagination.pages}
              onClick={() => setFilters({...filters, page: filters.page + 1})}
              className="flex items-center gap-1.5 hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors cursor-pointer"
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
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-6 max-w-md w-full shadow-medium space-y-5"
            >
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-primary)]">Admin Retry</p>
                <h3 className="text-base font-bold text-[var(--text-primary)] uppercase tracking-tight mt-0.5">Retry Recharge</h3>
                <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mt-1.5">
                  This will execute the real recharge API for transaction #{confirmRetryTxn.id}.
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4 text-[10px] uppercase tracking-wider text-[var(--text-secondary)] space-y-2">
                <div className="flex justify-between"><span>Mobile</span><strong className="text-[var(--text-primary)]">{confirmRetryTxn.mobile}</strong></div>
                <div className="flex justify-between"><span>Amount</span><strong className="text-[var(--text-primary)]">INR {formatAmount(confirmRetryTxn.amount)}</strong></div>
                <div className="flex justify-between"><span>Status</span><strong className="text-[var(--text-primary)]">{confirmRetryTxn.status}</strong></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setConfirmRetryTxn(null)} className="py-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-[10px] font-bold uppercase tracking-wider cursor-pointer">
                  Cancel
                </button>
                <button onClick={() => handleRetry(confirmRetryTxn.id)} disabled={retryingId === confirmRetryTxn.id} className="py-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--bg-primary)] text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer">
                  <RefreshCw className={`w-4 h-4 ${retryingId === confirmRetryTxn.id ? "animate-spin" : ""}`} />
                  Retry
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
