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
      // Normalize data structure from different potential API response shapes
      const txns = Array.isArray(data?.data?.transactions) 
        ? data.data.transactions 
        : (Array.isArray(data?.data) ? data.data : []);
      
      console.log('Sample Transaction Data:', txns[0]); // Debugging mobile field
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

  useSocketEvent('recharge_success', () => fetchTransactions());
  useSocketEvent('recharge_failed', () => fetchTransactions());

  const filteredData = transactions.filter(t => 
    (t.mobile?.toString() || '').includes(searchTerm) || 
    (t.mobileNumber?.toString() || '').includes(searchTerm) ||
    t._id?.includes(searchTerm)
  );

  return (
    <div className="p-6 bg-[#F9FAFB] min-h-screen font-sans text-[#111827]">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Transactions</h1>
          <p className="text-sm text-gray-500 mt-1">Audit log of all system recharges</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search mobile or ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 transition duration-150"
            />
          </div>
          <button className="p-2 bg-white border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 transition duration-150">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">ID</th>
                <th className="px-6 py-3">Mobile</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Provider</th>
                <th className="px-6 py-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs">
              {loading ? (
                <tr><td colSpan="6" className="p-12 text-center text-gray-400">Loading transactions...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan="6" className="p-12 text-center text-gray-400">No transactions found</td></tr>
              ) : (
                filteredData.map(tx => (
                  <tr key={tx._id} className="hover:bg-gray-50 transition duration-75">
                    <td className="px-6 py-4 font-mono text-[10px] text-gray-400">{tx._id.slice(-8)}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {tx.mobile || tx.mobileNumber ? `+91 ${tx.mobile || tx.mobileNumber}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900">₹{tx.amount}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase ${
                        tx.status === 'SUCCESS' || tx.status === 'success' ? 'bg-green-100 text-green-700' : 
                        tx.status === 'FAILED' || tx.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 uppercase text-[10px] font-bold tracking-tight">{tx.provider || 'Smart'}</td>
                    <td className="px-6 py-4 text-right text-gray-400 font-medium">{new Date(tx.createdAt).toLocaleDateString()}</td>
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
