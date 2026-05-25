import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, Filter, RefreshCw } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshingTxnId, setRefreshingTxnId] = useState(null);
  const { useSocketEvent } = useSocket();

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/admin/transactions');
      const txns = Array.isArray(data?.data?.transactions) 
        ? data.data.transactions 
        : (Array.isArray(data?.data) ? data.data : []);
      setTransactions(txns);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("[FETCH][TRANSACTIONS] Initial load");
    fetchTransactions();
  }, []);

  const handleSocketTransactionUpdate = (data) => {
    console.log("[SOCKET_ROW_UPDATE] Received transaction updated event in admin transactions list:", data);
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
        console.log(`[SOCKET_STALE_BLOCKED] Stale socket update blocked. Current: ${existing.status}, Incoming: ${nextStatus}`);
        return prev;
      }

      if (existing.updatedAt && incomingTxn?.updatedAt) {
        const existingTime = new Date(existing.updatedAt).getTime();
        const incomingTime = new Date(incomingTxn.updatedAt).getTime();
        if (incomingTime < existingTime) {
          console.log(`[SOCKET_STALE_BLOCKED] Older update blocked. Current: ${existing.updatedAt}, Incoming: ${incomingTxn.updatedAt}`);
          return prev;
        }
      }

      console.log(`[SOCKET_ROW_UPDATE] Patching transaction #${updatedTxnId} status from ${existing.status} to ${nextStatus}`);
      return prev.map(tx => 
        tx.id === updatedTxnId ? { ...tx, ...incomingTxn, status: nextStatus } : tx
      );
    });
  };

  useSocketEvent('transaction_updated', handleSocketTransactionUpdate);
  useSocketEvent('recharge_success', handleSocketTransactionUpdate);
  useSocketEvent('recharge_failed', handleSocketTransactionUpdate);

  const softRefresh = async () => {
    console.log("[UI_AUTO_REFRESH] Soft refreshing visible rows...");
    try {
      const { data } = await api.get('/admin/transactions');
      const freshTxns = Array.isArray(data?.data?.transactions) 
        ? data.data.transactions 
        : (Array.isArray(data?.data) ? data.data : []);

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
      console.warn("[UI_AUTO_REFRESH] failed", err);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      softRefresh();
    }, 60000);
    return () => clearInterval(timer);
  }, []);

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

  const filteredData = transactions.filter(t => 
    (t.mobile?.toString() || '').includes(searchTerm) || 
    (t.mobileNumber?.toString() || '').includes(searchTerm) ||
    t.id?.toString().includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <motion.header 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-xl md:text-2xl font-black text-[var(--text-color)] tracking-tight drop-shadow-sm uppercase italic">Audit <span className="text-cyan-600">Ledger</span></h1>
          <p className="text-[10px] md:text-sm text-[var(--text-secondary)] mt-1 font-bold uppercase tracking-widest">Real-time recharge telemetry</p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search ID/Mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2.5 glass-input rounded-xl text-xs font-black uppercase tracking-widest text-[var(--text-color)] focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 outline-none transition-all placeholder:text-[var(--text-muted)] shadow-inner"
            />
          </div>
          <button 
            onClick={() => { console.log("[MANUAL_REFRESH] Triggered"); fetchTransactions(); }}
            className="p-2.5 bg-[var(--glass-button-bg)] border border-[var(--glass-border)] text-[var(--text-color)] rounded-xl hover:bg-[var(--glass-border-hover)] transition-all shadow-sm hover:shadow-md hover:text-cyan-600"
            title="Refresh Transactions"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="p-2.5 bg-[var(--glass-button-bg)] border border-[var(--glass-border)] text-[var(--text-color)] rounded-xl hover:bg-[var(--glass-border-hover)] transition-all shadow-sm hover:shadow-md hover:text-cyan-600">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </motion.header>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card border border-[var(--glass-border)] rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-tertiary)] border-b border-[var(--glass-border)] text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Mobile</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4">Operator</th>
                <th className="px-6 py-4 text-right">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border)] text-xs">
              {loading ? (
                <tr><td colSpan="7" className="p-12 text-center text-[var(--text-muted)] font-medium">Loading transactions...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan="7" className="p-12 text-center text-[var(--text-muted)] font-medium">No transactions found</td></tr>
              ) : (
                filteredData.map(tx => (
                  <tr key={tx.id} className="hover:bg-[var(--glass-button-bg)] transition-colors group">
                    <td className="px-6 py-4 font-mono text-[10px] text-[var(--text-muted)] group-hover:text-cyan-600 transition-colors">{String(tx.id).slice(-8)}</td>
                    <td className="px-6 py-4 font-bold text-[var(--text-secondary)]">
                      {tx.mobile || tx.mobileNumber ? `+91 ${tx.mobile || tx.mobileNumber}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-[var(--text-color)]">₹{tx.amount}</td>
                    <td className="px-6 py-4 text-center">
                      {(() => {
                         const status = tx.status?.toLowerCase();
                         return (
                           <span className={`px-3 py-1 text-[10px] font-black rounded-full uppercase border ${
                             status === 'success' ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 shadow-sm' : 
                             status === 'failed' ? 'text-rose-600 bg-rose-500/10 border-rose-500/20 shadow-sm' : 
                             'text-amber-600 bg-amber-500/10 border-amber-500/20 shadow-sm'
                           }`}>
                             {status?.toUpperCase() || 'PENDING'}
                           </span>
                         );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-secondary)] uppercase text-[10px] font-black tracking-widest">
                      <span className="bg-[var(--bg-tertiary)] px-2 py-1 rounded-md border border-[var(--glass-border)]">{tx.provider || 'Smart'}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-[var(--text-muted)] font-medium">{new Date(tx.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      {!['SUCCESS', 'FAILED', 'REFUNDED'].includes(tx.status) && (
                        <button 
                          onClick={() => handleRefreshStatus(tx.id)}
                          disabled={refreshingTxnId === tx.id}
                          className="p-2 hover:bg-[var(--glass-border-hover)] border border-transparent rounded-xl text-[var(--text-muted)] hover:text-cyan-600 transition-all disabled:opacity-50 inline-flex items-center justify-center cursor-pointer" 
                          title="Refresh Status"
                        >
                          <RefreshCw className={`w-4 h-4 ${refreshingTxnId === tx.id ? "animate-spin" : ""}`} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination footer */}
        <div className="p-5 border-t border-[var(--glass-border)] flex justify-between items-center text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-tertiary)]">
          <div>Showing {filteredData.length} entries</div>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-[var(--glass-border)] rounded-xl bg-[var(--bg-primary)] hover:bg-[var(--glass-button-bg)] text-[var(--text-color)] transition-all shadow-sm">Previous</button>
            <button className="px-4 py-2 border border-[var(--glass-border)] rounded-xl bg-[var(--bg-primary)] hover:bg-[var(--glass-button-bg)] text-[var(--text-color)] transition-all shadow-sm">Next</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
