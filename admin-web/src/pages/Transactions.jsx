import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, Filter } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { motion } from 'framer-motion';

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
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight drop-shadow-sm uppercase italic">Audit <span className="text-cyan-600">Ledger</span></h1>
          <p className="text-[10px] md:text-sm text-slate-400 mt-1 font-bold uppercase tracking-widest">Real-time recharge telemetry</p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search ID/Mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-900 focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 outline-none transition-all placeholder:text-slate-400 shadow-inner"
            />
          </div>
          <button className="p-2.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-200 transition-all shadow-sm hover:shadow-md hover:text-cyan-600">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </motion.header>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white/70 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Mobile</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4">Provider</th>
                <th className="px-6 py-4 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr><td colSpan="6" className="p-12 text-center text-slate-500 font-medium">Loading transactions...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan="6" className="p-12 text-center text-slate-500 font-medium">No transactions found</td></tr>
              ) : (
                filteredData.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-[10px] text-slate-400 group-hover:text-cyan-600 transition-colors">{String(tx.id).slice(-8)}</td>
                    <td className="px-6 py-4 font-bold text-slate-700">
                      {tx.mobile || tx.mobileNumber ? `+91 ${tx.mobile || tx.mobileNumber}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-900">₹{tx.amount}</td>
                    <td className="px-6 py-4 text-center">
                      {(() => {
                        const status = tx.status?.toLowerCase();
                        return (
                          <span className={`px-3 py-1 text-[10px] font-black rounded-full uppercase border ${
                            status === 'success' ? 'text-emerald-600 bg-emerald-50 border-emerald-100 shadow-sm' : 
                            status === 'failed' ? 'text-rose-600 bg-rose-50 border-rose-100 shadow-sm' : 
                            'text-amber-600 bg-amber-50 border-amber-100 shadow-sm'
                          }`}>
                            {status?.toUpperCase() || 'PENDING'}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                      <span className="bg-slate-100 px-2 py-1 rounded-md border border-slate-200">{tx.provider || 'Smart'}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500 font-medium">{new Date(tx.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination placeholder if needed, right now backend handles default 50 */}
        <div className="p-5 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-400 bg-slate-50/30">
          <div>Showing {filteredData.length} entries</div>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-all shadow-sm text-slate-600">Previous</button>
            <button className="px-4 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-all shadow-sm text-slate-600">Next</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
