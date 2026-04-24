import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, Filter } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { Card } from '../components/ui/Card';

export const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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

  useSocketEvent('recharge_success', () => fetchTransactions());
  useSocketEvent('recharge_failed', () => fetchTransactions());

  const filteredData = transactions.filter(t => 
    (t.mobile?.toString() || '').includes(searchTerm) || 
    (t.mobileNumber?.toString() || '').includes(searchTerm) ||
    t._id?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Transactions</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Audit log of all system recharges</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search mobile or ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-white border border-[#E2E8F0] rounded-md text-sm focus:ring-2 focus:ring-[#2563EB]/10 focus:border-[#2563EB] outline-none w-64 transition-all"
            />
          </div>
          <button className="p-2 bg-white border border-[#E2E8F0] text-[#64748B] rounded-md hover:bg-[#F1F5F9] transition-all">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </header>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                <th className="px-6 py-3">ID</th>
                <th className="px-6 py-3">Mobile</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Provider</th>
                <th className="px-6 py-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-xs">
              {loading ? (
                <tr><td colSpan="6" className="p-12 text-center text-[#94A3B8]">Loading transactions...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan="6" className="p-12 text-center text-[#94A3B8]">No transactions found</td></tr>
              ) : (
                filteredData.map(tx => (
                  <tr key={tx._id} className="hover:bg-[#F1F5F9] transition-colors">
                    <td className="px-6 py-4 font-mono text-[10px] text-[#94A3B8]">{tx._id.slice(-8)}</td>
                    <td className="px-6 py-4 font-medium text-[#0F172A]">
                      {tx.mobile || tx.mobileNumber ? `+91 ${tx.mobile || tx.mobileNumber}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-[#0F172A]">₹{tx.amount}</td>
                    <td className="px-6 py-4">
                      {(() => {
                        const status = tx.status?.toLowerCase();
                        return (
                          <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${
                            status === 'success' ? 'text-green-600 bg-green-100' : 
                            status === 'failed' ? 'text-red-600 bg-red-100' : 'text-yellow-600 bg-yellow-100'
                          }`}>
                            {status?.toUpperCase() || 'PENDING'}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-[#64748B] uppercase text-[10px] font-bold tracking-tight">{tx.provider || 'Smart'}</td>
                    <td className="px-6 py-4 text-right text-[#94A3B8] font-medium">{new Date(tx.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination placeholder if needed, right now backend handles default 50 */}
        <div className="p-4 border-t border-[#E2E8F0] flex justify-between items-center text-xs text-[#64748B]">
          <div>Showing {filteredData.length} entries</div>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-[#E2E8F0] rounded bg-white hover:bg-[#F8FAFC]">Previous</button>
            <button className="px-3 py-1 border border-[#E2E8F0] rounded bg-white hover:bg-[#F8FAFC]">Next</button>
          </div>
        </div>
      </Card>
    </div>
  );
};
