import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import { Smartphone, Wallet, Search, Filter, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatAmount, safeArray, safeValue } from '../utils/helpers';

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get(API_ROUTES.USER.TRANSACTIONS);
      setTransactions(safeArray(res.data.data));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredHistory = safeArray(transactions).filter(txn => 
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase italic">Ledger <span className="text-cyan-400">Vault</span></h1>
          <p className="text-slate-500 text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em]">Authorized Transaction Archive</p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-80 group">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
            <input 
              type="text"
              placeholder="Search ID, Mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 text-xs md:text-sm text-white placeholder:text-slate-600 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {['All', 'RECHARGE', 'SUCCESS', 'FAILED', 'CASHBACK', 'REFUND'].map((filter) => (
          <button
            key={filter}
            onClick={() => setSearchTerm(filter === 'All' ? '' : filter)}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${
              (searchTerm === filter || (filter === 'All' && searchTerm === ''))
                ? 'bg-cyan-500 text-slate-900 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                : 'bg-white/5 text-slate-500 border-white/10 hover:border-white/20'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="animate-spin h-8 w-8 border-3 border-cyan-400 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Decrypting Records...</p>
          </div>
        ) : filteredHistory.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {filteredHistory.map((txn, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.03)' }}
                className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group transition-all"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg ${
                    txn.type === 'RECHARGE' ? 'bg-cyan-500/10 text-cyan-400 shadow-cyan-500/5' : 
                    txn.type === 'CASHBACK' ? 'bg-emerald-500/10 text-emerald-400 shadow-emerald-500/5' :
                    'bg-purple-500/10 text-purple-400 shadow-purple-500/5'
                  }`}>
                    {txn.type === 'RECHARGE' ? <Smartphone className="w-5 h-5 md:w-6 md:h-6" /> : <Wallet className="w-5 h-5 md:w-6 md:h-6" />}
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-black text-white uppercase tracking-tight">
                      {safeValue(txn.operator, 'Wallet')} {txn.mobile && <span className="text-slate-600 font-mono ml-1 md:ml-2">[{txn.mobile}]</span>}
                    </p>
                    <div className="flex items-center gap-1.5 md:gap-2 mt-0.5 md:mt-1">
                      <Calendar className="w-2.5 h-2.5 md:w-3 md:h-3 text-slate-600" />
                      <p className="text-[7px] md:text-[8px] text-slate-500 font-bold uppercase tracking-tighter">
                        {new Date(txn?.createdAt || Date.now()).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right hidden sm:block">
                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Reference</p>
                    <p className="text-[10px] font-mono text-slate-400">#{safeValue(txn.id, 'N/A').toString().slice(-8).toUpperCase()}</p>
                  </div>
                  
                  <div className="text-right">
                    <p className={`text-lg font-black tracking-tighter ${txn.direction === 'DEBIT' ? 'text-white' : 'text-emerald-400'}`}>
                      {txn.direction === 'DEBIT' ? '-' : '+'}₹{formatAmount(txn.amount)}
                    </p>
                    <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-lg mt-1 inline-block ${
                      txn.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' : 
                      txn.status === 'PENDING' ? 'bg-cyan-500/10 text-cyan-400' : 
                      'bg-rose-500/10 text-rose-400'
                    }`}>
                      {safeValue(txn.status)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center bg-white/5 border border-white/10 rounded-3xl border-dashed">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No matching records found in archive</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
