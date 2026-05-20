import React, { useState, useEffect } from 'react';
import { 
  Wallet as WalletIcon, 
  ArrowUpCircle, 
  History, 
  CreditCard, 
  Plus, 
  CheckCircle2, 
  Clock, 
  XCircle,
  RefreshCw,
  Zap,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

import { useLocation, useNavigate } from 'react-router-dom';

export const Wallet = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/wallet/stats');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      if (!toast.isActive('wallet-error')) {
        toast.error("Failed to fetch wallet stats", { id: 'wallet-error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async (orderId) => {
    const tid = toast.loading("Verifying your payment...");
    try {
      const res = await api.get(`/admin/wallet/verify/${orderId}`);
      if (res.data.success) {
        toast.success(res.data.message || "Wallet credited successfully!", { id: tid });
        fetchStats(); // Refresh balance
      } else {
        toast.error(res.data.message || "Payment verification pending", { id: tid });
      }
    } catch (err) {
      toast.error("Verification failed", { id: tid });
    } finally {
      // Clear URL params to avoid re-verification on refresh
      navigate('/wallet', { replace: true });
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('status');
    const orderId = params.get('order_id');

    if (status === 'verify' && orderId) {
      verifyPayment(orderId);
    } else {
      fetchStats();
    }
  }, [location.search]);

  const handleTopup = async (e) => {
    e.preventDefault();
    if (!topupAmount || topupAmount < 100) return toast.error("Minimum topup is ₹100");

    setTopupLoading(true);
    try {
      const res = await api.post('/admin/wallet/topup', { amount: Number(topupAmount) });

      if (res.data.success && res.data.paymentUrl) {
        window.location.href = res.data.paymentUrl;
      } else {
        toast.error("Failed to initiate payment");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Payment initiation failed");
    } finally {
      setTopupLoading(false);
    }
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-600 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 text-purple-600 rounded-full border border-purple-500/20">
            <Zap className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Admin Wallet Terminal</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic">
            Capital <span className="text-purple-600">Wallet</span>
          </h1>
          <p className="text-slate-500 text-xs font-medium max-w-md">
            Manage administrative liquidity, settle provider balances, and track internal settlements in real-time.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Balance & Topup */}
        <div className="lg:col-span-2 space-y-8">
          {/* Main Balance Card */}
          <div className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-purple-900/10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10">
                    <WalletIcon className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Current Liquidity</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-6xl font-black italic tracking-tighter">₹{Number(stats?.balance || 0).toLocaleString()}</span>
                  <span className="text-purple-400 text-sm font-black uppercase tracking-widest">INR</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">+12.4% from last period</span>
                </div>
              </div>

              <div className="w-full md:w-auto bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Authorization Level</p>
                <div className="flex items-center justify-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  <span className="text-sm font-black uppercase italic">FINANCE_ADMIN</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Topup Form */}
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-slate-200/40">
            <div className="flex items-center gap-4 mb-8">
               <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center border border-purple-100">
                  <ArrowUpCircle className="w-6 h-6 text-purple-600" />
               </div>
               <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Replenish <span className="text-purple-600">Wallet</span></h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Add funds via secure gateway</p>
               </div>
            </div>

            <form onSubmit={handleTopup} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Credits to Add (₹)</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-black text-slate-400">₹</span>
                    <input 
                      type="number" 
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-12 pr-6 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-xl font-black text-slate-900 focus:border-purple-500 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <button 
                    type="submit"
                    disabled={topupLoading}
                    className="w-full py-5 bg-purple-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs hover:bg-purple-700 transition-all shadow-xl shadow-purple-600/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {topupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4" /> Initialize Topup</>}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4 border border-slate-100">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-200 text-slate-400">
                   <Clock className="w-4 h-4" />
                </div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                  Payments are processed instantly via our secure gateway. Ensure your <span className="text-purple-600">Merchant Token</span> is active.
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* Right Side: Recent Activity */}
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/40 h-full">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5 text-purple-600" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Recent Logs</h3>
                </div>
                <button onClick={fetchStats} className="p-2 hover:bg-slate-50 rounded-xl transition-all">
                   <RefreshCw className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="space-y-6">
                {stats?.recentPayments?.length > 0 ? stats.recentPayments.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 rounded-3xl border border-slate-50 hover:bg-slate-50 transition-all">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                      p.status === 'SUCCESS' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                      p.status === 'FAILED' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                      'bg-amber-50 border-amber-100 text-amber-600'
                    }`}>
                      {p.status === 'SUCCESS' ? <CheckCircle2 className="w-5 h-5" /> : 
                       p.status === 'FAILED' ? <XCircle className="w-5 h-5" /> : 
                       <Clock className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Topup Request</p>
                        <span className="text-[10px] font-black text-slate-900">₹{p.amount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{new Date(p.createdAt).toLocaleString()}</p>
                        <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${
                          p.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' :
                          p.status === 'FAILED' ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{p.status}</span>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="py-20 flex flex-col items-center justify-center text-center opacity-30 gap-4">
                     <History className="w-12 h-12" />
                     <p className="text-[10px] font-black uppercase tracking-widest">No activity detected</p>
                  </div>
                )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
