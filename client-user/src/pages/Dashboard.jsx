import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Clock, ShieldCheck, Zap, ChevronRight, Activity } from 'lucide-react';
import api from '../api';
import { formatAmount, safeArray, safeValue } from '../utils/helpers';

export default function Dashboard() {
  const [wallet, setWallet] = useState(null);
  const [stats, setStats] = useState({
    totalSpent: 0,
    totalAdded: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);

  const fetchWallet = async () => {
    try {
      const res = await api.get("/wallet");
      setWallet(res.data.wallet);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
    try {
      const txnRes = await api.get('/user/transactions');
      const transactions = safeArray(txnRes.data.data);
      
      const spent = transactions
        .filter(t => t.direction === 'DEBIT' && t.status === 'SUCCESS')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);
      
      const added = transactions
        .filter(t => t.direction === 'CREDIT' && t.type === 'TOPUP' && t.status === 'SUCCESS')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);

      setStats({
        totalSpent: spent,
        totalAdded: added,
        recentActivity: transactions.slice(0, 5)
      });
    } catch (err) {
      console.error("Dashboard stats error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
    fetchStats();
  }, []);

  const handleReferral = () => {
    const code = "REF" + Math.floor(Math.random() * 10000);
    const link = `${window.location.origin}/register?ref=${code}`;
    navigator.clipboard.writeText(link);
    alert("Referral link copied!");
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <motion.div 
      whileHover={{ y: -8, backgroundColor: 'rgba(255,255,255,1)' }}
      className="bg-white/70 backdrop-blur-2xl border border-slate-200 p-4 md:p-6 rounded-3xl shadow-xl relative overflow-hidden group transition-all"
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
      <p className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter">₹{formatAmount(value)}</p>
      {subtitle && <p className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-3 md:mt-4">{subtitle}</p>}
      
      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>
    </motion.div>
  );

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
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Control <span className="text-cyan-600">Center</span></h1>
            <div className="px-2 md:px-3 py-0.5 md:py-1 bg-cyan-50 border border-cyan-100 rounded-lg">
              <span className="text-[7px] md:text-[8px] font-black text-cyan-600 uppercase tracking-[0.3em] animate-pulse">Live</span>
            </div>
          </div>
          <p className="text-slate-400 text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em]">Real-time encrypted financial telemetry</p>
        </div>
        <div className="flex items-center gap-2 px-3 md:px-5 py-1.5 md:py-2.5 bg-emerald-50 text-emerald-600 rounded-xl md:rounded-2xl border border-emerald-100 shadow-sm">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">Authorized Access</span>
        </div>
      </div>

      {/* Stat Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          title="Vault Balance" 
          value={wallet?.balance} 
          icon={Wallet} 
          color="bg-cyan-50 text-cyan-600"
          subtitle="Available for instant execution"
          trend="12"
        />
        <StatCard 
          title="Outbound Flow" 
          value={stats.totalSpent} 
          icon={TrendingDown} 
          color="bg-rose-50 text-rose-600"
          subtitle="Total debits detected"
          trend="5"
        />
        <StatCard 
          title="Inbound Flow" 
          value={stats.totalAdded} 
          icon={TrendingUp} 
          color="bg-emerald-50 text-emerald-600"
          subtitle="Liquidity injected"
          trend="18"
        />
        <StatCard 
          title="Reward Points" 
          value={wallet?.cashbackBalance} 
          icon={Zap} 
          color="bg-purple-50 text-purple-600"
          subtitle="Cumulative yield"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white/70 backdrop-blur-2xl border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-xl relative">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-cyan-600" />
                <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Transaction Telemetry</h2>
              </div>
              <motion.button 
                whileHover={{ x: 5 }}
                className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 hover:text-slate-900 transition-colors"
              >
                Full Archive <ChevronRight className="w-3 h-3" />
              </motion.button>
            </div>
            
            <div className="p-4 space-y-3">
              {loading ? (
                <div className="py-20 text-center space-y-4">
                  <div className="animate-spin h-8 w-8 border-3 border-cyan-600 border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Decrypting Logs...</p>
                </div>
              ) : safeArray(stats.recentActivity).length > 0 ? stats.recentActivity.map((txn, idx) => (
                  <motion.div 
                   key={idx} 
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: idx * 0.05 }}
                   className="px-6 py-4 flex justify-between items-center bg-slate-50/50 border border-slate-100 rounded-2xl hover:border-slate-200 hover:bg-slate-100/50 transition-all group"
                 >
                   <div className="flex items-center gap-5">
                     <div className={`p-2 md:p-3 rounded-lg md:rounded-xl shadow-sm ${txn.direction === 'DEBIT' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {txn.direction === 'DEBIT' ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      )}
                    </div>
                     <div>
                       <p className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tight group-hover:text-cyan-600 transition-colors">
                         {safeValue(txn.type)} <span className="text-slate-200 mx-1 md:mx-2">|</span> {txn.operator || 'Wallet'}
                       </p>
                       <p className="text-[7px] md:text-[8px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5 md:mt-1">{new Date(txn?.createdAt || Date.now()).toLocaleDateString()} AT {new Date(txn?.createdAt || Date.now()).toLocaleTimeString()}</p>
                     </div>
                  </div>
                   <div className="text-right">
                     <p className={`text-lg font-black tracking-tighter ${txn.direction === 'DEBIT' ? 'text-slate-900' : 'text-emerald-600'}`}>
                       {txn.direction === 'DEBIT' ? '-' : '+'}₹{formatAmount(txn.amount)}
                     </p>
                     <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${txn.status === 'SUCCESS' ? 'text-emerald-600' : 'text-rose-600'}`}>
                       {safeValue(txn.status)}
                     </p>
                   </div>
                </motion.div>
              )) : (
                 <div className="py-20 text-center bg-slate-50/50 rounded-3xl border border-slate-100 border-dashed">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No spectral signatures detected</p>
                 </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group"
          >
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/20">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-black mb-3 italic tracking-tight uppercase">Network Growth</h3>
              <p className="text-white/60 text-xs font-medium leading-relaxed mb-8 uppercase tracking-widest">Inject liquidity into the network and earn ₹50 yield per node activation.</p>
              <button 
                onClick={handleReferral}
                className="w-full bg-white text-slate-900 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:shadow-2xl transition-all group-hover:-translate-y-1"
              >
                Copy Referral Link
              </button>
            </div>
            <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
          </motion.div>

          <div className="bg-white/70 backdrop-blur-2xl border border-slate-200 p-8 rounded-[2.5rem] shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Spectral Analysis</h3>
              <Activity className="w-4 h-4 text-cyan-600" />
            </div>
            <div className="space-y-6">
              {[
                { label: 'Mobile Recharge', percent: 65, color: 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]' },
                { label: 'DTH & Utility', percent: 25, color: 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' },
                { label: 'Cyber Wallet', percent: 10, color: 'bg-slate-600' },
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
