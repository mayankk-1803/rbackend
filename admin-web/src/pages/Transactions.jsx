import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, Filter } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';

export const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { useSocketEvent } = useSocket();

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/admin/transactions');
      setTransactions(Array.isArray(data?.data?.transactions) ? data.data.transactions : (Array.isArray(data?.data) ? data.data : []));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  useSocketEvent('recharge_success', () => fetchTransactions());
  useSocketEvent('recharge_failed', () => fetchTransactions());

  const filteredData = transactions.filter(t => t.mobileNumber?.includes(searchTerm) || t._id?.includes(searchTerm));

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Transactions</h1>
          <p className="text-slate-500 mt-1">View and manage all system recharges</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search mobile or ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-64"
            />
          </div>
          <button className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">Transaction ID</th>
                <th className="px-6 py-4">Mobile</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Provider</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-400">Loading transactions...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-400">No transactions found</td></tr>
              ) : (
                filteredData.map(tx => (
                  <tr key={tx._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{tx._id.slice(-8)}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800">{tx.mobileNumber}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium">₹{tx.amount}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider
                        ${tx.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : ''}
                        ${tx.status === 'FAILED' ? 'bg-red-100 text-red-700' : ''}
                        ${tx.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : ''}
                      `}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-xs font-medium">{tx.provider}</td>
                    <td className="px-6 py-4 text-slate-500 text-xs">{new Date(tx.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
