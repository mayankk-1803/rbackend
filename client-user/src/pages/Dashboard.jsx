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
    whileHover={{ y: -6, scale: 1.01 }}
    className="glass-card p-4 md:p-6 rounded-3xl border border-[var(--glass-border)] relative overflow-hidden group transition-all duration-300"
  >
    <div className="flex justify-between items-start mb-4 md:mb-6">
      <div className="p-3 md:p-4 rounded-xl md:rounded-2xl bg-[var(--glass-button-bg)] border border-[var(--glass-border)] shadow-sm text-[var(--color-accent)] group-hover:text-white group-hover:bg-[var(--color-accent)] transition-colors duration-300">
        <Icon className="w-5 h-5 md:w-6 md:h-6" />
      </div>
      {trend && (
        <span className="text-[8px] md:text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 md:px-3 py-0.5 md:py-1 rounded-full border border-emerald-500/20 shadow-sm animate-pulse">+{trend}%</span>
      )}
    </div>
    <h3 className="text-[8px] md:text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-1 md:mb-2">{title}</h3>
    <p className="text-xl md:text-3xl font-black text-[var(--text-color)] tracking-tighter flex items-baseline gap-0.5">
      {suffix && <span className="text-[var(--color-accent)] text-lg md:text-xl font-normal">{suffix}</span>}
      <span className="cyan-glow">{formatAmount(value)}</span>
    </p>
    {subtitle && <p className="text-[8px] md:text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-tighter mt-3 md:mt-4">{subtitle}</p>}
    
    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/0 rounded-full blur-3xl group-hover:bg-white/5 transition-all duration-700"></div>
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
    socket.on("recharge_queued", handleUpdate);
    socket.on("recharge_processing", handleUpdate);
    socket.on("recharge_success", handleUpdate);
    socket.on("recharge_failed", handleUpdate);
    socket.on("refund_completed", handleUpdate);
    return () => {
      socket.off("wallet_updated", handleUpdate);
      socket.off("recharge_queued", handleUpdate);
      socket.off("recharge_processing", handleUpdate);
      socket.off("recharge_success", handleUpdate);
      socket.off("recharge_failed", handleUpdate);
      socket.off("refund_completed", handleUpdate);
    };
  }, [fetchData]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="max-w-7xl mx-auto space-y-10 py-6 relative z-10"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
        <div className="space-y-1 md:space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-4xl font-black text-[var(--text-color)] tracking-tighter uppercase italic">Ledger <span className="text-[var(--color-accent)] cyan-glow">Wallet</span></h1>
            <div className="px-2 md:px-3 py-0.5 md:py-1 bg-[var(--color-accent-glow)] border border-[var(--color-accent)]/20 rounded-lg">
              <span className="text-[7px] md:text-[8px] font-black text-[var(--color-accent)] uppercase tracking-[0.3em] animate-pulse">Live</span>
            </div>
          </div>
          <p className="text-[var(--text-secondary)] text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em]">Secure Transaction History</p>
        </div>
        <div className="flex items-center gap-2 px-3 md:px-5 py-1.5 md:py-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl md:rounded-2xl border border-emerald-500/20 shadow-[var(--shadow-soft)]">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">Verified Account</span>
        </div>
      </div>

      {/* Stat Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          title="Wallet Balance" 
          value={wallet?.balance} 
          icon={Wallet} 
          subtitle="Available for use"
          suffix="₹"
        />
        <StatCard 
          title="Cashback Earned" 
          value={wallet?.cashbackBalance || 0} 
          icon={Zap} 
          subtitle="Total Savings"
          suffix="₹"
        />
        <StatCard 
          title="Success Rate" 
          value={stats.successRatio} 
          icon={Activity} 
          subtitle="Successful Recharges"
          suffix="%"
        />
        <StatCard 
          title="Total Spent" 
          value={stats.totalSpent} 
          icon={TrendingDown} 
          subtitle="Total amount spent"
          suffix="₹"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-8 space-y-6">
          <div className="glass-card border border-[var(--glass-border)] rounded-[2.5rem] overflow-hidden shadow-2xl relative">
            <div className="px-8 py-6 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--bg-tertiary)]/30">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-[var(--color-accent)] cyan-glow" />
                <h2 className="text-[10px] font-black text-[var(--text-color)] uppercase tracking-widest">Recent Transactions</h2>
              </div>
              <Link to="/history" className="text-[9px] font-black text-[var(--text-secondary)] hover:text-[var(--color-accent)] uppercase tracking-widest flex items-center gap-2 transition-colors duration-300">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            
            <div className="p-4 space-y-3">
              {loading ? (
                <div className="py-20 text-center space-y-4">
                  <div className="animate-spin h-8 w-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Loading History...</p>
                </div>
              ) : safeArray(stats.recentActivity).length > 0 ? (
                <AnimatePresence mode='popLayout'>
                  {stats.recentActivity.map((txn, idx) => (
                    <motion.div 
                      key={txn.id || idx} 
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="px-6 py-4 flex justify-between items-center bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl hover:border-[var(--color-accent)]/20 transition-all duration-300 group cursor-pointer"
                      onClick={() => { setSelectedTxn(txn); setShowInvoice(true); }}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl border transition-colors ${txn.type === 'RECHARGE' ? 'bg-[var(--color-accent-glow)] text-[var(--color-accent)] border-[var(--color-accent-glow)] group-hover:bg-[var(--color-accent)] group-hover:text-white' : 'bg-[var(--color-primary-glow)] text-[var(--color-primary)] border-[var(--color-primary-glow)] group-hover:bg-[var(--color-primary)] group-hover:text-white'}`}>
                          {txn.type === 'RECHARGE' ? <Smartphone className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-xs font-black text-[var(--text-color)] uppercase tracking-tight group-hover:text-[var(--color-accent)] transition-colors">
                            {txn.operator || 'Wallet Entry'} {txn.mobile && <span className="text-[var(--text-secondary)] font-mono ml-2">[{txn.mobile}]</span>}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded border transition-colors ${
                              txn.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10' : 
                              txn.status === 'PENDING' ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/10' : 
                              'bg-rose-500/10 text-rose-500 border-rose-500/10'
                            }`}>
                              {txn.status}
                            </span>
                            <span className="text-[7px] text-[var(--text-muted)] font-bold uppercase tracking-tighter">
                              {new Date(txn?.createdAt || Date.now()).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className={`text-base font-black tracking-tighter ${txn.direction === 'DEBIT' ? 'text-[var(--text-color)]' : 'text-emerald-500 emerald-glow'}`}>
                            {txn.direction === 'DEBIT' ? '-' : '+'}₹{formatAmount(txn.amount)}
                          </p>
                          <p className="text-[8px] font-mono text-[var(--text-muted)]">#{safeValue(txn.id).toString().toUpperCase()}</p>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedTxn(txn); setShowInvoice(true); }}
                            className="p-2 hover:bg-[var(--glass-border)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
                            title="Receipt"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedTxn(txn); setShowDispute(true); }}
                            className="p-2 hover:bg-[var(--glass-border)] rounded-lg text-[var(--text-secondary)] hover:text-rose-500 transition-colors cursor-pointer"
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
                <div className="py-20 text-center bg-[var(--bg-secondary)] rounded-3xl border border-[var(--glass-border)] border-dashed">
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">No transactions found</p>
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
            whileHover={{ scale: 1.01 }}
            className="bg-gradient-to-br from-[var(--color-primary-glow)]/20 via-[var(--bg-secondary)] to-[var(--color-accent-glow)]/20 border border-[var(--glass-border)] p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group shine-sweep-active"
          >
            <div className="relative z-10">
              <div className="w-12 h-12 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mb-6 border border-[var(--glass-border)] shadow-inner">
                <ShieldCheck className="w-6 h-6 text-[var(--color-accent)] cyan-glow" />
              </div>
              <h3 className="text-2xl font-black mb-3 italic tracking-tight uppercase text-[var(--text-color)]">DiziPay <span className="text-[var(--color-accent)] cyan-glow">Wallet</span></h3>
              <p className="text-[var(--text-secondary)] text-[10px] font-bold leading-relaxed mb-8 uppercase tracking-widest">A simple and secure way to recharge your phone and pay utility bills.</p>
              <Link 
                to="/recharge"
                className="block text-center w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-[var(--shadow-medium)] transition-all duration-300 cursor-pointer"
              >
                Recharge Now
              </Link>
            </div>
            <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/0 rounded-full blur-3xl group-hover:bg-white/5 transition-all duration-700"></div>
          </motion.div>

          <div className="glass-card border border-[var(--glass-border)] p-8 rounded-[2.5rem] shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Usage Summary</h3>
              <Activity className="w-4 h-4 text-[var(--color-accent)] cyan-glow" />
            </div>
            <div className="space-y-6">
              {[
                { label: 'Mobile Recharge', percent: 65, color: 'bg-[var(--color-accent)] shadow-[0_0_10px_var(--color-accent-glow)]' },
                { label: 'DTH & Utility', percent: 25, color: 'bg-[var(--color-primary)] shadow-[0_0_10px_var(--color-primary-glow)]' },
                { label: 'Wallet Entry', percent: 10, color: 'bg-[var(--text-muted)]' },
              ].map((item, idx) => (
                <div key={idx} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{item.label}</span>
                    <span className="text-[10px] font-black text-[var(--text-color)]">{item.percent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden border border-[var(--glass-border)]">
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
