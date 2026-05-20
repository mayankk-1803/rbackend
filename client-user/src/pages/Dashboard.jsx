import React, { useState, useEffect, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Clock, ShieldCheck, Zap, ChevronRight, Activity, Smartphone, FileText, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';
import { formatAmount, safeArray, safeValue } from '../utils/helpers';
import socket from '../services/socket';
import { InvoiceModal } from '../components/reports/InvoiceModal';
import { DisputeModal } from '../components/reports/DisputeModal';
import toast from 'react-hot-toast';


const StatCard = memo(({ title, value, icon: Icon, color, subtitle, trend, suffix = "" }) => (
  <motion.div 
    whileHover={window.innerWidth > 768 ? { y: -8, backgroundColor: 'rgba(255,255,255,1)' } : {}}
    className="bg-white border border-slate-200 p-4 md:p-6 rounded-3xl shadow-sm relative overflow-hidden group transition-all"
  >
    <div className="flex justify-between items-start mb-4 md:mb-6">
      <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl ${color} shadow-sm`}>
        <Icon className="w-5 h-5 md:w-6 md:h-6" />
      </div>
      {trend && (
        <span className="text-[8px] md:text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 md:px-3 py-0.5 md:py-1 rounded-full border border-emerald-100 shadow-sm">+{trend}%</span>
      )}
    </div>
    <h3 className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 md:mb-2">{title}</h3>
    <p className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter">{suffix}{formatAmount(value)}</p>
    {subtitle && <p className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-3 md:mt-4">{subtitle}</p>}
    
    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>
  </motion.div>
));

export default function Dashboard() {
  const [wallet, setWallet] = useState(null);
  const [stats, setStats] = useState({
    totalSpent: 0,
    totalAdded: 0,
    successRatio: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);

  // Modal states
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showDispute, setShowDispute] = useState(false);

  const fetchData = useCallback(async () => {

    try {
      const [walletRes, txnRes] = await Promise.all([
        api.get("/wallet"),
        api.get('/user/transactions?limit=10')
      ]);

      const transactions = safeArray(txnRes.data.data);
      const spent = transactions
        .filter(t => t.direction === 'DEBIT' && t.status === 'SUCCESS')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);
      
      const added = transactions
        .filter(t => t.direction === 'CREDIT' && t.type === 'TOPUP' && t.status === 'SUCCESS')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);

      const successCount = transactions.filter(t => t.status === 'SUCCESS').length;
      const ratio = transactions.length > 0 ? (successCount / transactions.length) * 100 : 0;

      setWallet(walletRes.data.wallet || walletRes.data.data);
      setStats({
        totalSpent: spent,
        totalAdded: added,
        successRatio: Math.round(ratio),
        recentActivity: transactions.slice(0, 5)
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.error("Dashboard data error:", err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const handleUpdate = () => fetchData();
    socket.on("wallet_updated", handleUpdate);
    socket.on("recharge_success", handleUpdate);
    socket.on("recharge_failed", handleUpdate);
    return () => {
      socket.off("wallet_updated", handleUpdate);
      socket.off("recharge_success", handleUpdate);
      socket.off("recharge_failed", handleUpdate);
    };
  }, [fetchData]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto space-y-10 py-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
        <div className="space-y-1 md:space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Ledger <span className="text-cyan-600">Wallet</span></h1>
            <div className="px-2 md:px-3 py-0.5 md:py-1 bg-cyan-50 border border-cyan-100 rounded-lg">
              <span className="text-[7px] md:text-[8px] font-black text-cyan-600 uppercase tracking-[0.3em] animate-pulse">Live</span>
            </div>
          </div>
          <p className="text-slate-400 text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em]">Secure Transaction History</p>
        </div>
        <div className="flex items-center gap-2 px-3 md:px-5 py-1.5 md:py-2.5 bg-emerald-50 text-emerald-600 rounded-xl md:rounded-2xl border border-emerald-100 shadow-sm">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">Verified Account</span>
        </div>
      </div>

      {/* Stat Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          title="Wallet Balance" 
          value={wallet?.balance} 
          icon={Wallet} 
          color="bg-cyan-50 text-cyan-600"
          subtitle="Available for use"
          suffix="₹"
        />
        <StatCard 
          title="Cashback Earned" 
          value={wallet?.cashbackBalance || 0} 
          icon={Zap} 
          color="bg-amber-50 text-amber-600"
          subtitle="Total Savings"
          suffix="₹"
        />
        <StatCard 
          title="Success Rate" 
          value={stats.successRatio} 
          icon={Activity} 
          color="bg-emerald-50 text-emerald-600"
          subtitle="Successful Recharges"
          suffix="%"
        />
        <StatCard 
          title="Total Spent" 
          value={stats.totalSpent} 
          icon={TrendingDown} 
          color="bg-rose-50 text-rose-600"
          subtitle="Total amount spent"
          suffix="₹"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm relative">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-cyan-600" />
                <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Recent Transactions</h2>
              </div>
              <Link to="/history" className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 hover:text-cyan-600 transition-colors">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            
            <div className="p-4 space-y-3">
              {loading ? (
                <div className="py-20 text-center space-y-4">
                  <div className="animate-spin h-8 w-8 border-3 border-cyan-600 border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading History...</p>
                </div>
              ) : safeArray(stats.recentActivity).length > 0 ? (
                <AnimatePresence mode='popLayout'>
                  {stats.recentActivity.map((txn, idx) => (
                    <motion.div 
                      key={txn.id || idx} 
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="px-6 py-4 flex justify-between items-center bg-white border border-slate-100 rounded-2xl hover:border-cyan-200 hover:shadow-md transition-all group cursor-pointer"
                      onClick={() => { setSelectedTxn(txn); setShowInvoice(true); }}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl shadow-sm ${txn.type === 'RECHARGE' ? 'bg-cyan-50 text-cyan-600' : 'bg-purple-50 text-purple-600'}`}>
                          {txn.type === 'RECHARGE' ? <Smartphone className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight group-hover:text-cyan-600 transition-colors">
                            {txn.operator || 'Wallet Entry'} {txn.mobile && <span className="text-slate-300 font-mono ml-2">[{txn.mobile}]</span>}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${
                              txn.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 
                              txn.status === 'PENDING' ? 'bg-cyan-50 text-cyan-600' : 
                              'bg-rose-50 text-rose-600'
                            }`}>
                              {txn.status}
                            </span>
                            <span className="text-[7px] text-slate-300 font-bold uppercase tracking-tighter">
                              {new Date(txn?.createdAt || Date.now()).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className={`text-base font-black tracking-tighter ${txn.direction === 'DEBIT' ? 'text-slate-900' : 'text-emerald-600'}`}>
                            {txn.direction === 'DEBIT' ? '-' : '+'}₹{formatAmount(txn.amount)}
                          </p>
                          <p className="text-[8px] font-mono text-slate-300">#{safeValue(txn.id).toString().toUpperCase()}</p>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedTxn(txn); setShowInvoice(true); }}
                            className="p-2 hover:bg-cyan-50 rounded-lg text-slate-400 hover:text-cyan-600 transition-all"
                            title="Receipt"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedTxn(txn); setShowDispute(true); }}
                            className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-all"
                            title="Dispute"
                          >
                            <AlertCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              ) : (
                <div className="py-20 text-center bg-slate-50/50 rounded-3xl border border-slate-100 border-dashed">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No transactions found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modals */}
        <InvoiceModal 
          isOpen={showInvoice} 
          onClose={() => setShowInvoice(false)} 
          transaction={selectedTxn} 
        />
        <DisputeModal 
          isOpen={showDispute} 
          onClose={() => setShowDispute(false)} 
          transaction={selectedTxn} 
        />


        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          <motion.div 
            whileHover={window.innerWidth > 768 ? { scale: 1.02 } : {}}
            className="bg-gradient-to-br from-cyan-600 to-blue-700 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group"
          >
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/20">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-black mb-3 italic tracking-tight uppercase">DiziPay <span className="text-cyan-200">Wallet</span></h3>
              <p className="text-white/60 text-[10px] font-bold leading-relaxed mb-8 uppercase tracking-widest">A simple and secure way to recharge your phone and pay utility bills.</p>
              <Link 
                to="/recharge"
                className="block text-center w-full bg-white text-slate-900 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:shadow-2xl transition-all group-hover:-translate-y-1"
              >
                Recharge Now
              </Link>
            </div>
            <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
          </motion.div>

          <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Usage Summary</h3>
              <Activity className="w-4 h-4 text-cyan-600" />
            </div>
            <div className="space-y-6">
              {[
                { label: 'Mobile Recharge', percent: 65, color: 'bg-cyan-500' },
                { label: 'DTH & Utility', percent: 25, color: 'bg-indigo-500' },
                { label: 'Wallet Entry', percent: 10, color: 'bg-slate-400' },
              ].map((item, idx) => (
                <div key={idx} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                    <span className="text-[10px] font-black text-slate-900">{item.percent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${item.percent}%` }}
                      transition={{ duration: 1, delay: idx * 0.1 }}
                      className={`h-full ${item.color} rounded-full`} 
                    ></motion.div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
