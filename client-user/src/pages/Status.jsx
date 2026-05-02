import React, { useState, useEffect } from 'react';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import { motion } from 'framer-motion';
import { io } from 'socket.io-client';
import { toast } from 'react-hot-toast';

export default function Status() {
  const [txnId, setTxnId] = useState('');
  const [txn, setTxn] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Initialize Socket.io for live updates
    const socket = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000');

    const handleUpdate = (data) => {
      console.log('📡 Status Update Received:', data);
      
      setTxn((prev) => {
        if (prev && prev.id === data.txnId) {
          const updated = { ...prev, status: data.status?.toLowerCase(), ...data.transaction };
          
          if (data.status === "success") {
            toast.success("Recharge Successful 🎉");
          } else if (data.status === "failed") {
            toast.error(`Recharge Failed: ${data.reason || 'Unknown error'} ❌`);
          }
          
          return updated;
        }
        return prev;
      });
    };

    socket.on('recharge_update', handleUpdate);
    socket.on('recharge_status', handleUpdate);

    return () => {
      socket.disconnect();
    };
  }, []);

  const checkStatus = async (e) => {
    e.preventDefault();
    if(!txnId) return;
    setLoading(true);
    setTxn(null);
    setError('');
    try {
      const { data } = await api.get(API_ROUTES.RECHARGE.STATUS(txnId));
      setTxn(data.data);
    } catch(err) {
      setError(err.response?.data?.message || 'Transaction not found');
    } finally {
      setLoading(false);
    }
  };

  const status = txn?.status?.toLowerCase();

  return (
    <div className="py-12 md:py-20 flex items-center justify-center p-4 md:p-6">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto space-y-6 w-full"
      >
        <div className="bg-white/70 backdrop-blur-2xl border border-slate-200 rounded-2xl md:rounded-3xl shadow-xl overflow-hidden">
          <div className="px-6 md:px-8 py-5 md:py-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight uppercase italic">Track <span className="text-cyan-600">Status</span></h2>
            <p className="text-[10px] md:text-sm text-slate-400 mt-1 font-bold uppercase tracking-widest">Enter tracking ID for real-time telemetry</p>
          </div>
          
          <form onSubmit={checkStatus} className="p-6 md:p-8">
            <div className="flex flex-col sm:flex-row gap-4">
              <input 
                type="text"
                value={txnId}
                onChange={e => setTxnId(e.target.value)}
                placeholder="e.g. 64c9f1e..."
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all placeholder:text-slate-300 font-mono"
              />
              <button 
                type="submit"
                disabled={loading || !txnId}
                className="px-8 py-3 bg-cyan-600 text-white font-black rounded-xl hover:bg-cyan-700 disabled:opacity-30 transition-all text-[10px] uppercase tracking-widest shadow-lg shadow-cyan-600/10"
              >
                {loading ? 'Searching...' : 'Check Status'}
              </button>
            </div>
          </form>

          {(txn || error) && (
            <div className="border-t border-slate-100 bg-slate-50/30 p-6 md:p-8">
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-black uppercase tracking-widest text-center">
                  {error}
                </div>
              )}
              
              {txn && (
                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-b border-slate-100">
                    <div className="p-4 md:p-5">
                      <span className="block text-[8px] md:text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1.5">Transaction ID</span>
                      <span className="font-mono text-slate-900 text-xs md:text-sm break-all">{txn.id}</span>
                    </div>
                    <div className="p-4 md:p-5">
                      <span className="block text-[8px] md:text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1.5">Current State</span>
                      {status === "pending" ? (
                        <span className="flex items-center gap-2 text-cyan-600 font-black text-[10px] md:text-xs tracking-widest uppercase">
                          <span className="animate-spin h-3 w-3 border-2 border-cyan-600 border-t-transparent rounded-full"></span>
                          PROCESSING...
                        </span>
                      ) : (
                        <span className={`px-3 py-1 rounded-lg text-[10px] md:text-xs font-black tracking-widest uppercase shadow-sm ${
                          status === "success" 
                            ? "text-emerald-600 bg-emerald-50 border border-emerald-100" 
                            : "text-rose-600 bg-rose-50 border border-rose-100"
                        }`}>
                          {status?.toUpperCase() || 'UNKNOWN'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-slate-100">
                    <div className="p-4 md:p-5">
                      <span className="block text-[8px] md:text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1.5">Settlement</span>
                      <span className="font-black text-slate-900 text-lg md:text-xl tracking-tighter">₹{txn.amount}</span>
                    </div>
                    <div className="p-4 md:p-5">
                      <span className="block text-[8px] md:text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1.5">Destination</span>
                      <div className="space-y-0.5">
                        <p className="text-slate-900 text-xs md:text-sm font-black tracking-tight">{txn.mobile}</p>
                        <p className="text-[9px] text-slate-400 font-black uppercase">{txn.operator}</p>
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
