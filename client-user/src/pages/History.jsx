import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import { Smartphone, ShoppingBag, Search, Calendar, FileText, AlertCircle, ReceiptText, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatAmount, safeArray, safeValue } from '../utils/helpers';
import socket from '../services/socket';
import toast from 'react-hot-toast';
import { DisputeModal } from '../components/reports/DisputeModal';
import { InvoiceModal } from '../components/reports/InvoiceModal';

const formatCurrency = (value) => `INR ${Number(value || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

const getOrderTotal = (order) => Number(order?.totalAmount || 0);

const statusMeta = {
  PENDING_REVIEW: { label: "Pending Review", className: "bg-purple-500/10 text-purple-500 border-purple-500/15" },
  PROCESSING: { label: "Processing", className: "bg-[var(--color-primary-glow)] text-[var(--color-primary)] border-[var(--color-primary)]/15" },
  SUCCESS: { label: "Success", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/15" },
  FAILED: { label: "Failed", className: "bg-rose-500/10 text-rose-500 border-rose-500/15" },
  REFUNDED: { label: "Refunded", className: "bg-indigo-500/10 text-indigo-500 border-indigo-500/15" },
  PENDING: { label: "Processing", className: "bg-amber-500/10 text-amber-500 border-amber-500/15" }
};

const getTimeline = (txn) => safeArray(txn?.invoiceSnapshot?.timeline);

export default function History() {
  const [transactions, setTransactions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSection, setActiveSection] = useState("RECHARGE");
  const [activeTab, setActiveTab] = useState("All");
  const [refreshingTxnId, setRefreshingTxnId] = useState(null);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [showDispute, setShowDispute] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const [txnRes, orderRes] = await Promise.all([
        api.get(API_ROUTES.USER.TRANSACTIONS),
        api.get("/imart/orders").catch(() => ({ data: { success: false, data: [] } }))
      ]);
      setTransactions(safeArray(txnRes.data.data));
      setOrders(orderRes.data?.success ? safeArray(orderRes.data.data) : []);
    } catch (err) {
      if (import.meta.env.DEV) if (import.meta.env.DEV) console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefreshStatus = async (txnId) => {
    if (refreshingTxnId === txnId) return;
    setRefreshingTxnId(txnId);
    if (import.meta.env.DEV) console.log(`[MANUAL_REFRESH] Refresh requested for txn: ${txnId}`);
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

  const handleSocketTransactionUpdate = useCallback((data) => {
    if (import.meta.env.DEV) console.log("[SOCKET_ROW_UPDATE] Received transaction update event in client history:", data);
    const updatedTxnId = data?.transactionId || data?.txnId || data?.transaction?.id;
    const nextStatus = data?.status || data?.transaction?.status;
    const incomingTxn = data?.transaction;

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

  const softRefresh = useCallback(async () => {
    if (import.meta.env.DEV) console.log("[UI_AUTO_REFRESH] Soft refreshing client history visible rows...");
    try {
      const txnRes = await api.get(API_ROUTES.USER.TRANSACTIONS);
      const freshTxns = safeArray(txnRes.data.data);
      setTransactions(prev => {
        return prev.map(oldTx => {
          const fresh = freshTxns.find(f => f.id === oldTx.id);
          if (fresh) {
            return {
              ...oldTx,
              ...fresh
            };
          }
          return oldTx;
        });
      });
    } catch (err) {
      if (import.meta.env.DEV) console.warn("[UI_AUTO_REFRESH] Soft refresh failed:", err);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

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

  useEffect(() => {
    const handleWalletUpdate = () => fetchHistory();
    socket.on("wallet_updated", handleWalletUpdate);
    return () => {
      socket.off("wallet_updated", handleWalletUpdate);
    };
  }, [fetchHistory]);

  useEffect(() => {
    const timer = setInterval(() => {
      softRefresh();
    }, 60000);
    return () => clearInterval(timer);
  }, [softRefresh]);

  const rechargeHistory = safeArray(transactions).filter((txn) => txn.type === "RECHARGE" || txn.type === "POSTPAID" || txn.type === "BILL_PAYMENT");
  const filteredRecharge = rechargeHistory.filter(txn => {
    const matchesTab =
      activeTab === 'All' ||
      (activeTab === 'SUCCESS' && txn.status === 'SUCCESS') ||
      (activeTab === 'FAILED' && txn.status === 'FAILED') ||
      (activeTab === 'PENDING_REVIEW' && txn.status === 'PENDING_REVIEW') ||
      (activeTab === 'PROCESSING' && (txn.status === 'PROCESSING' || txn.status === 'PENDING')) ||
      (activeTab === 'REFUNDED' && txn.status === 'REFUNDED');

    if (!matchesTab) return false;
    if (!searchTerm) return true;

    const term = searchTerm.toLowerCase();
    return (
      safeValue(txn.mobile, "").includes(term) ||
      safeValue(txn.operator, "").toLowerCase().includes(term) ||
      safeValue(txn.id, "").toString().includes(term)
    );
  });

  const filteredOrders = safeArray(orders).filter((order) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const itemNames = safeArray(order.items).map((item) => item.product?.name || "").join(" ").toLowerCase();
    return (
      String(order.id || "").includes(term) ||
      String(order.invoiceId || "").toLowerCase().includes(term) ||
      itemNames.includes(term)
    );
  });

  const tabs = ['All', 'PENDING_REVIEW', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="space-y-6 relative z-10"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black text-[var(--text-color)] tracking-tighter uppercase italic">
            Purchase <span className="text-[var(--color-accent)] purple-glow">History</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em]">
            Recharge and IMART records
          </p>
        </div>

        <div className="relative w-full md:w-80 group">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--color-accent)] transition-colors" />
          <input
            type="text"
            placeholder="Search ID, Mobile, Product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 glass-input rounded-xl md:rounded-2xl outline-none focus:border-[var(--color-accent)] text-xs md:text-sm text-[var(--text-color)] placeholder:text-[var(--text-muted)] transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--glass-button-bg)] border border-[var(--glass-border)] p-1">
        {[
          { id: "RECHARGE", label: "Recharge History", icon: Smartphone },
          { id: "IMART", label: "IMART Purchase History", icon: ShoppingBag },
        ].map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`min-h-12 px-3 py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                active
                  ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-lg shadow-purple-500/20'
                  : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-color)] hover:bg-[var(--glass-button-bg)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {section.label}
            </button>
          );
        })}
      </div>

      {activeSection === "RECHARGE" && (
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab
                  ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-lg shadow-purple-500/20'
                  : 'bg-[var(--glass-button-bg)] text-[var(--text-secondary)] border-[var(--glass-border)] hover:border-[var(--glass-border-hover)] hover:text-[var(--text-color)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="animate-spin h-8 w-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full mx-auto"></div>
            <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Loading History...</p>
          </div>
        ) : activeSection === "RECHARGE" ? (
          filteredRecharge.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredRecharge.map((txn, idx) => (
                  <motion.div
                    key={txn.id || idx}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.3 }}
                    className="glass-card border border-[var(--glass-border)] p-4 md:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group transition-all duration-300 hover:border-[var(--glass-border-hover)]"
                  >
                    <div className="flex items-center gap-3 md:gap-4 min-w-0">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center border bg-[var(--color-accent-glow)] text-[var(--color-accent)] border-[var(--color-accent)]/15">
                        <Smartphone className="w-5 h-5 md:w-6 md:h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm font-black text-[var(--text-color)] uppercase tracking-tight group-hover:text-[var(--color-accent)] transition-colors truncate">
                          {safeValue(txn.operator, 'Recharge')} {txn.mobile && <span className="text-[var(--text-muted)] font-mono ml-1 md:ml-2">[{txn.mobile}]</span>}
                        </p>
                        <div className="flex items-center gap-1.5 md:gap-2 mt-1">
                          <Calendar className="w-3 h-3 text-[var(--text-muted)]" />
                          <p className="text-[7px] md:text-[8px] text-[var(--text-secondary)] font-bold uppercase tracking-tighter">
                            {new Date(txn?.createdAt || Date.now()).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <span className={`text-[9px] font-black uppercase tracking-[0.16em] px-3 py-1 rounded-lg border ${
                        statusMeta[txn.status]?.className || statusMeta.PENDING.className
                      }`}>
                        {statusMeta[txn.status]?.label || txn.status}
                      </span>
                      <div className="text-right">
                        <p className={`text-lg font-black tracking-tighter ${txn.direction === 'DEBIT' ? 'text-[var(--text-color)]' : 'text-emerald-500 emerald-glow'}`}>
                          {txn.direction === 'DEBIT' ? '-' : '+'}INR {formatAmount(txn.amount)}
                        </p>
                        <p className="text-[8px] font-mono text-[var(--text-muted)]">#{safeValue(txn.id, 'N/A').toString().toUpperCase()}</p>
                      </div>
                      <div className="flex gap-1">
                        {!['SUCCESS', 'FAILED', 'REFUNDED'].includes(txn.status) && (
                          <button 
                            onClick={() => handleRefreshStatus(txn.id)}
                            disabled={refreshingTxnId === txn.id}
                            className="p-2 min-w-10 min-h-10 hover:bg-[var(--color-accent-glow)] rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--color-accent)] cursor-pointer disabled:opacity-50 inline-flex items-center justify-center" 
                            title="Refresh Status"
                          >
                            <RefreshCw className={`w-4 h-4 ${refreshingTxnId === txn.id ? "animate-spin" : ""}`} />
                          </button>
                        )}
                        <button 
                          onClick={() => { setSelectedTxn(txn); setShowInvoice(true); }}
                          className="p-2 min-w-10 min-h-10 hover:bg-[var(--color-accent-glow)] rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--color-accent)] cursor-pointer" 
                          title="View Invoice"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                         <button 
                           onClick={() => { setSelectedTxn(txn); setShowDispute(true); }}
                           className="p-2 min-w-10 min-h-10 hover:bg-rose-500/10 rounded-lg transition-colors text-[var(--text-secondary)] hover:text-rose-500 cursor-pointer" 
                           title="Raise Dispute"
                         >
                           <AlertCircle className="w-4 h-4" />
                         </button>
                      </div>
                    </div>
                    <div className="w-full border-t border-[var(--glass-border)] pt-3 mt-1">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: "PENDING_REVIEW", label: "Queued" },
                          { key: "PROCESSING", label: "Processing" },
                          { key: "SUCCESS", label: "Success" },
                          { key: "REFUNDED", label: "Refund" }
                        ].map((step) => {
                          const currentIndex = ["PENDING_REVIEW", "PROCESSING", "SUCCESS", "REFUNDED"].indexOf(txn.status);
                          const stepIndex = ["PENDING_REVIEW", "PROCESSING", "SUCCESS", "REFUNDED"].indexOf(step.key);
                          const active = txn.status === step.key || (currentIndex > stepIndex && txn.status !== "FAILED");
                          return (
                            <span key={step.key} className={`inline-flex items-center gap-1.5 text-[7px] font-black uppercase tracking-widest ${active ? "text-[var(--color-accent)]" : "text-[var(--text-muted)]"}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent-glow)]" : "bg-[var(--glass-border)]"}`}></span>
                              {step.label}
                            </span>
                          );
                        })}
                      </div>
                      <div className="mt-2 text-[8px] text-[var(--text-muted)] uppercase tracking-widest">
                        {txn.lastRetryAt && <span>Admin retry: {new Date(txn.lastRetryAt).toLocaleString()}</span>}
                        {txn.processingStartedAt && <span className="ml-3">Processing: {new Date(txn.processingStartedAt).toLocaleString()}</span>}
                        {getTimeline(txn).length > 0 && <span className="ml-3">{getTimeline(txn).length} timeline events</span>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <EmptyState text="No recharge history found" />
          )
        ) : filteredOrders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOrders.map((order) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card border border-[var(--glass-border)] rounded-2xl p-5 space-y-4 hover:border-[var(--glass-border-hover)] transition-all"
              >
                <div className="flex justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-[var(--color-primary-glow)] border border-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-[var(--text-color)] uppercase tracking-widest truncate">Order #{order.id}</p>
                      <p className="text-[8px] uppercase tracking-widest text-[var(--text-muted)]">{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className="h-fit px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[8px] font-black uppercase tracking-widest">
                    {order.paymentStatus}
                  </span>
                </div>

                <div className="space-y-2">
                  {safeArray(order.items).slice(0, 3).map((item) => (
                    <div key={item.id} className="flex justify-between gap-3 text-[10px] text-[var(--text-secondary)]">
                      <span className="font-bold truncate">{item.product?.name || "IMART Product"}</span>
                      <strong className="text-[var(--text-color)]">{formatCurrency(item.price)}</strong>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[var(--glass-border)] pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Invoice</p>
                    <p className="text-[9px] font-mono text-[var(--text-secondary)]">{order.invoiceId || `IMART-${order.id}`}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Total</p>
                    <p className="text-sm font-black text-[var(--color-accent)]">{formatCurrency(getOrderTotal(order))}</p>
                  </div>
                  <ReceiptText className="w-4 h-4 text-[var(--text-muted)]" />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState text="No IMART purchase history found" />
        )}
      </div>

      <DisputeModal 
        isOpen={showDispute} 
        onClose={() => setShowDispute(false)} 
        transaction={selectedTxn} 
      />
      <InvoiceModal 
        isOpen={showInvoice} 
        onClose={() => setShowInvoice(false)} 
        transaction={selectedTxn} 
      />
    </motion.div>
  );
}

const EmptyState = ({ text }) => (
  <div className="py-20 text-center bg-[var(--bg-tertiary)]/35 border border-[var(--glass-border)] rounded-3xl border-dashed">
    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">{text}</p>
  </div>
);
