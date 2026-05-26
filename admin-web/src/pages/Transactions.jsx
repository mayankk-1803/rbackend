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
    fetchTransactions();
  }, []);

  const handleSocketTransactionUpdate = (data) => {
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
        return prev;
      }

      if (existing.updatedAt && incomingTxn?.updatedAt) {
        const existingTime = new Date(existing.updatedAt).getTime();
        const incomingTime = new Date(incomingTxn.updatedAt).getTime();
        if (incomingTime < existingTime) {
          return prev;
        }
      }

      return prev.map(tx => 
        tx.id === updatedTxnId ? { ...tx, ...incomingTxn, status: nextStatus } : tx
      );
    });
  };

  useSocketEvent('transaction_updated', handleSocketTransactionUpdate);
  useSocketEvent('recharge_success', handleSocketTransactionUpdate);
  useSocketEvent('recharge_failed', handleSocketTransactionUpdate);

  const softRefresh = async () => {
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
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            Audit <span className="text-[var(--color-primary)]">Ledger</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Real-time recharge telemetry</p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search ID/Mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--admin-focus-ring)] outline-none transition-all placeholder:text-[var(--text-muted)]"
            />
          </div>
          <button 
            onClick={() => fetchTransactions()}
            className="p-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-tertiary)]/50 transition-all cursor-pointer"
            title="Refresh Transactions"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="p-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-tertiary)]/50 transition-all cursor-pointer">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </motion.header>

      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl shadow-soft overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border-soft)] text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Mobile</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4">Operator</th>
                <th className="px-6 py-4 text-right">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)] text-xs">
              {loading ? (
                <tr><td colSpan="7" className="p-12 text-center text-[var(--text-secondary)] font-medium">Loading transactions...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan="7" className="p-12 text-center text-[var(--text-secondary)] font-medium">No transactions found</td></tr>
              ) : (
                filteredData.map(tx => (
                  <tr key={tx.id} className="hover:bg-[var(--accent-hover)] transition-colors group">
                    <td className="px-6 py-4 font-mono text-[10px] text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-colors">{String(tx.id).slice(-8)}</td>
                    <td className="px-6 py-4 font-semibold text-[var(--text-primary)]">
                      {tx.mobile || tx.mobileNumber ? `+91 ${tx.mobile || tx.mobileNumber}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-[var(--text-primary)]">₹{tx.amount}</td>
                    <td className="px-6 py-4 text-center">
                      {(() => {
                         const status = tx.status?.toLowerCase();
                         return (
                           <span className={`px-2.5 py-0.5 text-[9px] font-semibold rounded uppercase border ${
                             status === 'success' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 
                             status === 'failed' ? 'text-rose-500 bg-rose-500/10 border-rose-500/20' : 
                             'text-amber-500 bg-amber-500/10 border-amber-500/20'
                           }`}>
                             {status || 'PENDING'}
                           </span>
                         );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-[var(--text-secondary)]">
                      <span className="bg-[var(--bg-secondary)] px-2 py-0.5 rounded border border-[var(--border-soft)] text-[10px] font-semibold uppercase tracking-wider">{tx.provider || 'Smart'}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-[var(--text-secondary)] font-medium">{new Date(tx.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      {!['SUCCESS', 'FAILED', 'REFUNDED'].includes(tx.status) && (
                        <button 
                          onClick={() => handleRefreshStatus(tx.id)}
                          disabled={refreshingTxnId === tx.id}
                          className="p-1.5 hover:bg-[var(--bg-secondary)] border border-transparent rounded-lg text-[var(--text-secondary)] hover:text-[var(--color-primary)] transition-all disabled:opacity-50 inline-flex items-center justify-center cursor-pointer" 
                          title="Refresh Status"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${refreshingTxnId === tx.id ? "animate-spin" : ""}`} />
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
        <div className="p-4 border-t border-[var(--border-soft)] flex justify-between items-center text-xs font-semibold text-[var(--text-secondary)] bg-[var(--bg-secondary)]/30">
          <div>Showing {filteredData.length} entries</div>
          <div className="flex gap-2">
            <button className="px-3.5 py-1.5 border border-[var(--border-soft)] rounded-xl bg-[var(--bg-primary)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] transition-all cursor-pointer">Previous</button>
            <button className="px-3.5 py-1.5 border border-[var(--border-soft)] rounded-xl bg-[var(--bg-primary)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] transition-all cursor-pointer">Next</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
