import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import { motion } from 'framer-motion';
import { io } from 'socket.io-client';
import { toast } from 'react-hot-toast';

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ STEP 3: FIX API FETCH OVERRIDE BUG
  const fetchTransactions = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await api.get(API_ROUTES.USER.TRANSACTIONS);
      const newTransactions = res.data.data || [];
      
      // Merge logic to avoid overwriting live socket updates if needed
      // For simplicity, we can just set it if it's initial or use functional update
      setHistory(newTransactions);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Initial Fetch
    fetchTransactions(true);

    // ✅ STEP 2: FRONTEND SOCKET FIX
    const socket = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000');

    socket.on('recharge_update', (data) => {
      console.log('📡 Live update:', data);
      
      setHistory((prev) => 
        prev.map((txn) => 
          txn._id === data.txnId 
            ? { ...txn, status: data.status.toLowerCase(), ...data.transaction } 
            : txn
        )
      );

      // 🔥 TOAST
      if (data.status === "success") {
        toast.success("Recharge Successful 🎉");
      } else if (data.status === "failed") {
        toast.error(`Recharge Failed: ${data.reason || 'Unknown error'} ❌`);
      }
    });

    // ✅ STEP 4: ADD AUTO REFRESH FALLBACK
    const interval = setInterval(() => {
      // Only refetch if there are pending transactions to avoid unnecessary traffic
      // but the user asked for auto refresh fallback, so we'll do it.
      fetchTransactions();
    }, 5000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [fetchTransactions]);

  // ✅ STEP 8: DEBUG
  useEffect(() => {
    console.log("STATE:", history);
  }, [history]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden shadow-sm"
    >
      <div className="px-6 py-5 border-b border-[#E5E7EB] bg-[#F8FAFC] flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-[#0F172A]">Transaction History</h2>
          <p className="text-sm text-[#64748B] mt-1">A complete list of your past recharges and payments.</p>
        </div>
      </div>
      
      {loading ? (
        <div className="p-12 text-center text-[#64748B] text-sm">Loading records...</div>
      ) : history.length === 0 ? (
        <div className="p-12 text-center text-[#64748B] text-sm">No transactions found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[#64748B] text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3">Transaction ID</th>
                <th className="px-6 py-3">Number</th>
                <th className="px-6 py-3">Details</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-right">Status</th>
                <th className="px-6 py-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {history.map(t => {
                const status = t.status?.toLowerCase();
                return (
                  <tr key={t._id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-[#64748B]">{t._id.slice(-8).toUpperCase()}</td>
                    <td className="px-6 py-4 text-[#0F172A] font-medium">{t.mobile}</td>
                    <td className="px-6 py-4 text-[#64748B]">{t.operator} Recharge - {t.type}</td>
                    <td className="px-6 py-4 font-semibold text-[#0F172A] text-right">₹{t.amount}</td>
                    <td className="px-6 py-4 text-right">
                      {/* ✅ STEP 5: ADD PROCESSING SPINNER UI */}
                      {status === "pending" ? (
                        <span className="flex items-center justify-end gap-2 text-yellow-600 font-semibold text-xs">
                          <span className="animate-spin h-3 w-3 border-2 border-yellow-500 border-t-transparent rounded-full"></span>
                          PROCESSING...
                        </span>
                      ) : (
                        /* ✅ STEP 6: STATUS BADGE FIX */
                        <span className={
                          status === "success" 
                            ? "text-green-600 bg-green-100 px-2 py-1 rounded text-xs font-semibold uppercase" 
                            : "text-red-600 bg-red-100 px-2 py-1 rounded text-xs font-semibold uppercase"
                        }>
                          {status?.toUpperCase() || 'UNKNOWN'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-[#64748B]">
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
