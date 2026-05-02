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
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight drop-shadow-md uppercase italic">Audit <span className="text-cyan-400">Ledger</span></h1>
          <p className="text-[10px] md:text-sm text-slate-500 mt-1 font-bold uppercase tracking-widest">Real-time recharge telemetry</p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search ID/Mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-white focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 outline-none transition-all placeholder:text-slate-700 shadow-inner"
            />
          </div>
          <button className="p-2.5 bg-white/5 backdrop-blur-md border border-white/10 text-slate-400 rounded-xl hover:bg-white/10 transition-all shadow-sm hover:shadow-md hover:text-cyan-400">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </motion.header>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-xl shadow-black/40 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Mobile</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4">Provider</th>
                <th className="px-6 py-4 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {loading ? (
                <tr><td colSpan="6" className="p-12 text-center text-slate-500 font-medium">Loading transactions...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan="6" className="p-12 text-center text-slate-500 font-medium">No transactions found</td></tr>
              ) : (
                filteredData.map(tx => (
                  <tr key={tx.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 font-mono text-[10px] text-slate-500 group-hover:text-cyan-400 transition-colors">{String(tx.id).slice(-8)}</td>
                    <td className="px-6 py-4 font-bold text-slate-300">
                      {tx.mobile || tx.mobileNumber ? `+91 ${tx.mobile || tx.mobileNumber}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-white">₹{tx.amount}</td>
                    <td className="px-6 py-4 text-center">
                      {(() => {
                        const status = tx.status?.toLowerCase();
                        return (
                          <span className={`px-3 py-1 text-[10px] font-black rounded-full uppercase border ${
                            status === 'success' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 
                            status === 'failed' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.15)]' : 
                            'text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                          }`}>
                            {status?.toUpperCase() || 'PENDING'}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-slate-400 uppercase text-[10px] font-black tracking-widest">
                      <span className="bg-white/5 px-2 py-1 rounded-md border border-white/5">{tx.provider || 'Smart'}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500 font-medium">{new Date(tx.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination placeholder if needed, right now backend handles default 50 */}
        <div className="p-5 border-t border-white/5 flex justify-between items-center text-xs font-bold text-slate-500 bg-white/2">
          <div>Showing {filteredData.length} entries</div>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-white/10 rounded-xl bg-white/5 hover:bg-white/10 transition-all shadow-sm text-slate-300">Previous</button>
            <button className="px-4 py-2 border border-white/10 rounded-xl bg-white/5 hover:bg-white/10 transition-all shadow-sm text-slate-300">Next</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
