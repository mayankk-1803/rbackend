import React, { useState, useEffect } from 'react';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import { motion } from 'framer-motion';
import socket from '../services/socket';
import { toast } from 'react-hot-toast';

import { sanitizeErrorMessage } from '../utils/sanitizeErrorMessage';

export default function Status() {
  const [txnId, setTxnId] = useState('');
  const [txn, setTxn] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleUpdate = (data) => {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) if (import.meta.env.DEV) console.log('[Status Update Received]:', data);
      }
      
      setTxn((prev) => {
        if (prev && prev.id === data.txnId) {
          const updated = { ...prev, status: data.status?.toLowerCase(), ...data.transaction };
          
          if (data.status === "success") {
            toast.success("Recharge Successful");
          } else if (data.status === "failed") {
            toast.error(sanitizeErrorMessage(data.reason));
          }
          
          return updated;
        }
        return prev;
      });
    };

    socket.on('recharge_update', handleUpdate);
    socket.on('recharge_status', handleUpdate);

    return () => {
      socket.off('recharge_update', handleUpdate);
      socket.off('recharge_status', handleUpdate);
    };
  }, []);

  const checkStatus = async (e) => {
    e.preventDefault();
    if(!txnId) return;
    setLoading(true);
    setTxn(null);
    setError('');
    try {
      const res = await api.get(API_ROUTES.RECHARGE.STATUS(txnId));
      if (res?.data?.success) {
        setTxn(res?.data?.data);
      } else {
        setError(sanitizeErrorMessage(res?.data?.message || 'Transaction not found'));
      }
    } catch(err) {
      setError(err.safeMessage || sanitizeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const status = txn?.status?.toLowerCase();

  return (
    <div className="py-12 md:py-20 flex items-center justify-center p-4 md:p-6 relative z-10">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto space-y-6 w-full"
      >
        <div className="glass-card border border-[var(--glass-border)] rounded-2xl md:rounded-3xl shadow-xl overflow-hidden">
          <div className="px-6 md:px-8 py-5 md:py-6 border-b border-[var(--glass-border)] bg-[var(--glass-button-bg)]">
            <h2 className="text-lg md:text-xl font-black text-[var(--text-color)] tracking-tight uppercase italic">Track <span className="text-[var(--color-accent)] purple-glow">Status</span></h2>
            <p className="text-[10px] md:text-sm text-[var(--text-secondary)] mt-1 font-bold uppercase tracking-widest">Enter tracking ID for real-time telemetry</p>
          </div>
          
          <form onSubmit={checkStatus} className="p-6 md:p-8">
            <div className="flex flex-col sm:flex-row gap-4">
              <input 
                type="text"
                value={txnId}
                onChange={e => setTxnId(e.target.value)}
                placeholder="e.g. 64c9f1e..."
                className="flex-1 px-4 py-3 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-color)] text-sm focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_15px_var(--color-accent-glow)] transition-all placeholder:text-[var(--text-muted)] font-mono"
              />
              <button 
                type="submit"
                disabled={loading || !txnId}
                className="px-8 py-3 bg-[var(--color-accent)] text-white font-black rounded-xl hover:opacity-90 disabled:opacity-30 transition-all text-[10px] uppercase tracking-widest shadow-lg shadow-purple-600/10 cursor-pointer"
              >
                {loading ? 'Searching...' : 'Check Status'}
              </button>
            </div>
          </form>

          {(txn || error) && (
            <div className="border-t border-[var(--glass-border)] bg-[var(--glass-button-bg)] p-6 md:p-8">
              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs font-black uppercase tracking-widest text-center">
                  {error}
                </div>
              )}
              
              {txn && (
                <div className="bg-[var(--glass-card-bg)] border border-[var(--glass-border)] rounded-2xl overflow-hidden shadow-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--glass-border)] border-b border-[var(--glass-border)]">
                    <div className="p-4 md:p-5">
                      <span className="block text-[8px] md:text-[10px] text-[var(--text-muted)] uppercase font-black tracking-widest mb-1.5">Transaction ID</span>
                      <span className="font-mono text-[var(--text-color)] text-xs md:text-sm break-all">{txn.id}</span>
                    </div>
                    <div className="p-4 md:p-5">
                      <span className="block text-[8px] md:text-[10px] text-[var(--text-muted)] uppercase font-black tracking-widest mb-1.5">Current State</span>
                      {status === "pending" ? (
                        <span className="flex items-center gap-2 text-[var(--color-accent)] purple-glow font-black text-[10px] md:text-xs tracking-widest uppercase">
                          <span className="animate-spin h-3 w-3 border-2 border-[var(--color-accent)] border-t-transparent rounded-full"></span>
                          PROCESSING...
                        </span>
                      ) : (
                        <span className={`px-3 py-1 rounded-lg text-[10px] md:text-xs font-black tracking-widest uppercase shadow-sm ${
                          status === "success" 
                            ? "text-emerald-500 bg-emerald-500/10 border border-emerald-500/20" 
                            : "text-rose-500 bg-rose-500/10 border border-rose-500/20"
                        }`}>
                          {status?.toUpperCase() || 'UNKNOWN'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-[var(--glass-border)]">
                    <div className="p-4 md:p-5">
                      <span className="block text-[8px] md:text-[10px] text-[var(--text-muted)] uppercase font-black tracking-widest mb-1.5">Payment</span>
                      <span className="font-black text-[var(--text-color)] text-lg md:text-xl tracking-tighter">₹{txn.amount}</span>
                    </div>
                    <div className="p-4 md:p-5">
                      <span className="block text-[8px] md:text-[10px] text-[var(--text-muted)] uppercase font-black tracking-widest mb-1.5">Destination</span>
                      <div className="space-y-0.5">
                        <p className="text-[var(--text-color)] text-xs md:text-sm font-black tracking-tight">{txn.mobile}</p>
                        <p className="text-[9px] text-[var(--text-secondary)] font-black uppercase">{txn.operator}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
