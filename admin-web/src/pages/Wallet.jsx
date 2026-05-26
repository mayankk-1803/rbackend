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
import { motion } from 'framer-motion';
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
        fetchStats();
      } else {
        toast.error(res.data.message || "Payment verification pending", { id: tid });
      }
    } catch (err) {
      toast.error("Verification failed", { id: tid });
    } finally {
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
    <div className="h-full flex items-center justify-center py-20">
      <div className="w-10 h-10 border-3 border-[var(--border-soft)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[var(--color-primary-glow)] text-[var(--color-primary)] rounded-full border border-[var(--border-soft)]">
            <Zap className="w-3 h-3" />
            <span className="text-[9px] font-semibold uppercase tracking-wider">Admin Wallet Terminal</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            Capital <span className="text-[var(--color-primary)]">Wallet</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-xs font-medium max-w-lg">
            Manage administrative liquidity, settle provider balances, and track internal settlements in real-time.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Balance & Topup */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Balance Card */}
          <div className="relative overflow-hidden bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-8 shadow-soft">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[var(--bg-secondary)] rounded-lg flex items-center justify-center border border-[var(--border-soft)]">
                    <WalletIcon className="w-4 h-4 text-[var(--color-primary)]" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Current Liquidity</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-[var(--text-primary)] tracking-tight">₹{Number(stats?.balance || 0).toLocaleString()}</span>
                  <span className="text-[var(--color-primary)] text-xs font-bold uppercase tracking-wider">INR</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-500">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-semibold tracking-wide">+12.4% from last period</span>
                </div>
              </div>

              <div className="w-full md:w-auto bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl p-5 space-y-2">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] text-center">Authorization Level</p>
                <div className="flex items-center justify-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-primary)]">FINANCE_ADMIN</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Topup Form */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-6 md:p-8 shadow-soft">
            <div className="flex items-center gap-3.5 mb-6">
               <div className="w-10 h-10 bg-[var(--color-primary-glow)] rounded-lg flex items-center justify-center border border-[var(--border-soft)]">
                  <ArrowUpCircle className="w-5 h-5 text-[var(--color-primary)]" />
               </div>
               <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">Replenish Wallet</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Add funds via secure gateway</p>
               </div>
            </div>

            <form onSubmit={handleTopup} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Credits to Add (₹)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--text-secondary)]">₹</span>
                    <input 
                      type="number" 
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-sm font-medium text-[var(--text-primary)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--admin-focus-ring)] outline-none transition-all placeholder:text-[var(--text-muted)]"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <button 
                    type="submit"
                    disabled={topupLoading}
                    className="w-full py-3 bg-[var(--color-primary)] text-[var(--bg-primary)] rounded-xl font-bold uppercase tracking-wider text-xs hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    {topupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4" /> Initialize Topup</>}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-[var(--bg-secondary)] rounded-xl flex items-center gap-3 border border-[var(--border-soft)]">
                <div className="w-7 h-7 bg-[var(--card-bg)] rounded-lg flex items-center justify-center border border-[var(--border-soft)] text-[var(--text-secondary)]">
                   <Clock className="w-3.5 h-3.5" />
                </div>
                <p className="text-[10px] font-medium text-[var(--text-secondary)] leading-relaxed">
                  Payments are processed instantly via our secure gateway. Ensure your <span className="text-[var(--color-primary)] font-semibold">Merchant Token</span> is active.
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* Right Side: Recent Activity */}
        <div className="lg:col-span-1">
           <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-6 shadow-soft h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <History className="w-4.5 h-4.5 text-[var(--color-primary)]" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">Recent Logs</h3>
                </div>
                <button onClick={fetchStats} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-lg transition-all cursor-pointer">
                   <RefreshCw className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                </button>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                {stats?.recentPayments?.length > 0 ? stats.recentPayments.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/30 hover:bg-[var(--accent-hover)] transition-all">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                      p.status === 'SUCCESS' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                      p.status === 'FAILED' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
                      'bg-amber-500/10 border-amber-500/20 text-amber-500'
                    }`}>
                      {p.status === 'SUCCESS' ? <CheckCircle2 className="w-4 h-4" /> : 
                       p.status === 'FAILED' ? <XCircle className="w-4 h-4" /> : 
                       <Clock className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <p className="text-[10px] font-semibold text-[var(--text-primary)] uppercase tracking-tight">Topup Request</p>
                        <span className="text-[10px] font-bold text-[var(--text-primary)]">₹{p.amount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[8px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">{new Date(p.createdAt).toLocaleDateString()}</p>
                        <span className={`text-[7px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          p.status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-500' :
                          p.status === 'FAILED' ? 'bg-rose-500/20 text-rose-500' :
                          'bg-amber-500/20 text-amber-500'
                        }`}>{p.status}</span>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center opacity-40 gap-3">
                     <History className="w-10 h-10 text-[var(--text-secondary)]" />
                     <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">No activity detected</p>
                  </div>
                )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
