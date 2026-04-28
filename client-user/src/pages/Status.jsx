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
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-[#E5E7EB] bg-[#F8FAFC]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Track Status</h2>
          <p className="text-sm text-[#64748B] mt-1">Enter your tracking ID to view details in real-time</p>
        </div>
        
        <form onSubmit={checkStatus} className="p-6">
          <div className="flex gap-4">
            <input 
              type="text"
              value={txnId}
              onChange={e => setTxnId(e.target.value)}
              placeholder="e.g. 64c9f1e..."
              className="flex-1 px-4 py-2 border border-[#E5E7EB] rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-[#6D28D9] focus:border-[#6D28D9] sm:text-sm"
            />
            <button 
              type="submit"
              disabled={loading || !txnId}
              className="px-6 py-2 bg-[#6D28D9] text-white font-medium rounded-md hover:bg-[#5B21B6] disabled:bg-[#94A3B8] transition-colors text-sm shadow-sm whitespace-nowrap"
            >
              {loading ? 'Searching...' : 'Check Status'}
            </button>
          </div>
        </form>

        {(txn || error) && (
          <div className="border-t border-[#E5E7EB] bg-[#F8FAFC] p-6">
            {error && (
              <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] rounded-md text-sm font-medium">
                {error}
              </div>
            )}
            
            {txn && (
              <div className="bg-white border border-[#E5E7EB] rounded-md overflow-hidden text-sm">
                <div className="grid grid-cols-2 divide-x divide-[#E5E7EB] border-b border-[#E5E7EB]">
                  <div className="p-4">
                    <span className="block text-xs text-[#64748B] uppercase font-bold tracking-wider mb-1">Transaction ID</span>
                    <span className="font-mono text-[#0F172A] break-all">{txn.id}</span>
                  </div>
                  <div className="p-4">
                    <span className="block text-xs text-[#64748B] uppercase font-bold tracking-wider mb-1">Status</span>
                    {status === "pending" ? (
                      <span className="flex items-center gap-2 text-yellow-600 font-semibold text-xs">
                        <span className="animate-spin h-3 w-3 border-2 border-yellow-500 border-t-transparent rounded-full"></span>
                        PROCESSING...
                      </span>
                    ) : (
                      <span className={
                        status === "success" 
                          ? "text-green-600 bg-green-100 px-2 py-1 rounded text-xs font-semibold uppercase" 
                          : "text-red-600 bg-red-100 px-2 py-1 rounded text-xs font-semibold uppercase"
                      }>
                        {status?.toUpperCase() || 'UNKNOWN'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-[#E5E7EB]">
                  <div className="p-4">
                    <span className="block text-xs text-[#64748B] uppercase font-bold tracking-wider mb-1">Amount</span>
                    <span className="font-semibold text-[#0F172A]">₹{txn.amount}</span>
                  </div>
                  <div className="p-4">
                    <span className="block text-xs text-[#64748B] uppercase font-bold tracking-wider mb-1">Target</span>
                    <span className="text-[#0F172A]">{txn.mobile} ({txn.operator})</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
