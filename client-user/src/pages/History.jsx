import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import { Smartphone, Wallet, Search, Filter, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatAmount, safeArray, safeValue } from '../utils/helpers';

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get(API_ROUTES.USER.TRANSACTIONS);
      setHistory(safeArray(res.data.data));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredHistory = safeArray(history).filter(txn => 
    safeValue(txn.type, "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    safeValue(txn.mobile, "").includes(searchTerm) ||
    safeValue(txn.operator, "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Transaction History</h1>
          <p className="text-[#64748B] text-sm">View and track all your account activities.</p>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input 
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#6D28D9] text-sm"
            />
          </div>
          <button className="p-2 border border-[#E5E7EB] rounded-md hover:bg-[#F8FAFC] transition-colors">
            <Filter className="w-4 h-4 text-[#64748B]" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                <th className="px-6 py-4 text-xs font-bold text-[#64748B] uppercase tracking-wider">Transaction Details</th>
                <th className="px-6 py-4 text-xs font-bold text-[#64748B] uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-[#64748B] uppercase tracking-wider">Date & Time</th>
                <th className="px-6 py-4 text-xs font-bold text-[#64748B] uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-[#64748B] uppercase tracking-wider text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-[#64748B]">Loading transactions...</td>
                </tr>
              ) : filteredHistory.length > 0 ? filteredHistory.map((txn, idx) => (
                <tr key={idx} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        txn.type === 'RECHARGE' ? 'bg-blue-50' : 'bg-green-50'
                      }`}>
                        {txn.type === 'RECHARGE' ? (
                          <Smartphone className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Wallet className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#0F172A]">{safeValue(txn.operator, 'Wallet')} {txn.mobile && `(${txn.mobile})`}</p>
                        <p className="text-[10px] text-[#64748B] font-medium">ID: {safeValue(txn.providerTxnId || txn.id, 'N/A')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-[#0F172A] capitalize">{safeValue(txn.type)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-[#64748B]">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-xs">{new Date(txn?.createdAt || Date.now()).toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                      txn.status === 'SUCCESS' ? 'bg-green-100 text-green-700' : 
                      txn.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 
                      'bg-red-100 text-red-700'
                    }`}>
                      {safeValue(txn.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className={`text-sm font-bold ${txn.direction === 'DEBIT' ? 'text-[#0F172A]' : 'text-green-600'}`}>
                      {txn.direction === 'DEBIT' ? '-' : '+'}₹{formatAmount(txn.amount)}
                    </p>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-[#64748B]">
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
