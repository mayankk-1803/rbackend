import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Smartphone, Tv, Zap, Droplets, Flame, Wifi, CreditCard, MoreHorizontal, ArrowUpRight, X, Plus, History as HistoryIcon } from 'lucide-react';
import { io } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import PaymentModal from '../components/PaymentModal';
import { formatAmount, safeArray, safeValue } from '../utils/helpers';

export default function Home() {
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await api.get(API_ROUTES.USER.TRANSACTIONS);
      setRecentTransactions(safeArray(res.data.data).slice(0, 5));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await api.get('/wallet');
      if (res.data && res.data.wallet) {
        setWallet(res.data.wallet);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleAddMoney = async () => {
    if (!amount || Number(amount) <= 0) {
      return toast.error("Please enter a valid amount");
    }
    setShowAddMoney(false);
    setShowPayment(true);
  };

  const handlePaymentFlow = async () => {
    setLoading(true);
    try {
      const res = await api.post('/payment/create-order', { 
        amount: Number(amount),
        upiId: 'demo@upi',
        intent: 'TOPUP'
      }, {
        headers: {
          "x-idempotency-key": crypto.randomUUID()
        }
      });
      
      if (res.data && res.data.data) {
        const paymentId = res.data.data.id;
        const confirmRes = await api.post('/payment/confirm', { paymentId });
        
        if (confirmRes.data.success) {
          toast.success("Money added successfully!");
          await fetchWallet();
          await fetchTransactions();
        } else {
          throw new Error("Payment confirmation failed");
        }
      }
    } catch (err) {
      console.error("[Wallet Error]:", err);
      toast.error(err.response?.data?.message || "Failed to add money");
    } finally {
      setLoading(false);
      setShowPayment(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchWallet();

    const socket = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000');

    const handleRechargeUpdate = (data) => {
      setRecentTransactions((prev) => 
        safeArray(prev).map((txn) => 
          txn.id === data.txnId 
            ? { ...txn, status: (data.status || "").toLowerCase(), ...data.transaction } 
            : txn
        )
      );
    };

    socket.on('recharge_update', handleRechargeUpdate);
    socket.on('wallet_updated', () => {
      fetchWallet();
      fetchTransactions();
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchTransactions, fetchWallet]);

  const services = [
    { icon: Smartphone, label: 'Mobile Prepaid', path: '/recharge' },
    { icon: Tv, label: 'DTH Recharge', path: '/recharge' },
    { icon: Zap, label: 'Electricity', path: '/recharge' },
    { icon: Droplets, label: 'Water Bill', path: '/recharge' },
    { icon: Flame, label: 'Gas cylinder', path: '/recharge' },
    { icon: Wifi, label: 'Broadband', path: '/recharge' },
    { icon: CreditCard, label: 'Loan EMI', path: '/recharge' },
    { icon: MoreHorizontal, label: 'More Services', path: '/recharge' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-10 py-4"
    >
      {/* Welcome & Balance Header */}
      <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
        <div className="flex-1 bg-white/5 backdrop-blur-2xl rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 border border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-cyan-500/20 transition-all duration-700" />
          
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]"></div>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Session Active</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase italic">
              Digital <span className="text-cyan-400 text-shadow-glow">Vault</span>
            </h1>
            <p className="text-slate-500 text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em]">Authorized: {user.name || 'Spectral Entity'}</p>
          </div>
        </div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="lg:w-[400px] bg-gradient-to-br from-slate-900 via-[#0B0F19] to-[#1a0b2e] rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl border border-purple-500/20 relative overflow-hidden flex flex-col justify-between"
        >
          <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/5 rounded-t-[2.5rem] pointer-events-none" />
          
          <div className="relative z-10 flex justify-between items-start">
            <div className="w-14 h-14 bg-purple-500/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-purple-500/30 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
              <Wallet className="w-8 h-8 text-cyan-400" />
            </div>
            <button 
              onClick={() => setShowAddMoney(true)}
              className="w-10 h-10 bg-cyan-400 text-slate-900 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:scale-110 transition-all active:scale-95"
            >
              <Plus className="w-6 h-6 stroke-[3]" />
            </button>
          </div>

          <div className="relative z-10 mt-8">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Available Liquidity</p>
            <h2 className="text-4xl font-black tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">₹{formatAmount(wallet?.balance)}</h2>
            {Number(wallet?.cashbackBalance) > 0 && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-lg font-black uppercase border border-emerald-500/20">
                  + ₹{formatAmount(wallet?.cashbackBalance)} Yield
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Services Grid */}
      <div className="space-y-6">
        <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] ml-2">Terminal Services</h3>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3 md:gap-6">
          {services.map((service, idx) => (
            <Link key={idx} to={service.path}>
              <motion.div 
                whileHover={{ y: -5, backgroundColor: 'rgba(255,255,255,0.05)' }}
                className="bg-white/5 backdrop-blur-xl p-4 md:p-8 rounded-2xl md:rounded-[2rem] border border-white/5 flex flex-col items-center gap-3 md:gap-4 transition-all shadow-xl group hover:border-cyan-500/30"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-900/80 rounded-xl md:rounded-2xl flex items-center justify-center border border-white/5 group-hover:border-cyan-500/40 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all">
                  <service.icon className="w-5 h-5 md:w-7 md:h-7 text-slate-500 group-hover:text-cyan-400 transition-all" />
                </div>
                <span className="text-[8px] md:text-[10px] font-black text-slate-400 group-hover:text-white uppercase tracking-widest text-center">{service.label}</span>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl md:rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="px-6 md:px-8 py-5 md:py-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
          <h2 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-3">
            <HistoryIcon className="w-4 h-4 text-cyan-400" />
            Signal History
          </h2>
          <Link to="/history" className="text-[9px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2 hover:text-cyan-300">
            View <span className="hidden md:inline">Archive</span> <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="p-4 space-y-3">
          {recentTransactions.length > 0 ? recentTransactions.map((txn, idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="px-6 py-4 flex justify-between items-center bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 transition-all group"
            >
              <div className="flex items-center gap-5">
                <div className={`p-3 rounded-xl ${txn.type === 'RECHARGE' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  {txn.type === 'RECHARGE' ? <Smartphone className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-sm font-black text-white uppercase tracking-tight group-hover:text-cyan-400 transition-colors">
                    {safeValue(txn.type)} <span className="text-slate-600 mx-2">|</span> {txn.operator || 'Wallet'}
                  </p>
                  <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter mt-1">{new Date(txn?.createdAt || Date.now()).toLocaleDateString()} • {safeValue(txn.mobile, 'Wallet')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-lg font-black tracking-tighter ${txn.direction === 'DEBIT' ? 'text-white' : 'text-emerald-400'}`}>
                  {txn.direction === 'DEBIT' ? '-' : '+'}₹{formatAmount(txn.amount)}
                </p>
                <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-lg mt-1 inline-block ${
                  txn.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' : 
                  txn.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' : 
                  'bg-rose-500/10 text-rose-400'
                }`}>
                  {safeValue(txn.status)}
                </span>
              </div>
            </motion.div>
          )) : (
            <div className="py-20 text-center bg-black/20 rounded-3xl border border-white/5 border-dashed">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No spectral traces found</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Money Modal */}
      <AnimatePresence>
        {showAddMoney && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#0B0F19] border border-white/10 rounded-[2.5rem] p-10 w-full max-w-lg shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8">
                <button onClick={() => setShowAddMoney(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-8">
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Inject <span className="text-cyan-400">Liquidity</span></h2>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Authorize wallet expansion sequence</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Credits Amount (₹)</label>
                    <input 
                      type="number" 
                      placeholder="0.00" 
                      value={amount} 
                      onChange={(e) => setAmount(e.target.value)} 
                      className="w-full bg-white/5 border border-white/10 p-6 rounded-2xl text-white text-3xl font-black tracking-tighter outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10 transition-all placeholder:text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[100, 500, 1000].map(val => (
                      <button
                        key={val}
                        onClick={() => setAmount(val.toString())}
                        className="py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-cyan-400/50 hover:text-white transition-all active:scale-95"
                      >
                        +₹{val}
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={handleAddMoney}
                    disabled={loading || !amount}
                    className="w-full bg-cyan-400 text-slate-900 py-6 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(34,211,238,0.3)] hover:shadow-[0_0_50px_rgba(34,211,238,0.5)] transition-all disabled:opacity-30 disabled:shadow-none"
                  >
                    Execute Protocol
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        amount={amount}
        onPaymentSuccess={handlePaymentFlow}
        onSuccess={() => {
          fetchWallet();
        }}
        title="Add Money"
      />
    </motion.div>
  );
}
