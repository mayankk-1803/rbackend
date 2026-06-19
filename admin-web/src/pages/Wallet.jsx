import React, { useState, useEffect } from 'react';
import { 
  Wallet as WalletIcon, 
  ArrowUpCircle, 
  ArrowDownCircle,
  History, 
  Plus, 
  Clock, 
  RefreshCw,
  Zap,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  X,
  FileSpreadsheet,
  Server
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export const Wallet = () => {
  const [stats, setStats] = useState(null);
  const [rechargePool, setRechargePool] = useState({ balance: 0, status: 'UNKNOWN', lastUpdated: null });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Form States
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');

  // Modal States
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [masterKey, setMasterKey] = useState('');
  const [showMasterKey, setShowMasterKey] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [res, poolRes] = await Promise.all([
        api.get('/admin/master-wallet'),
        api.get('/admin/recharge-pool-balance').catch(err => {
          console.error("[Wallet] Pool balance fetch error:", err);
          return { data: { success: false } };
        })
      ]);

      if (res.data.success) {
        setStats(res.data.data);
      }
      if (poolRes?.data?.success) {
        setRechargePool({
          balance: Number(poolRes.data.balance || 0),
          status: poolRes.data.status || 'ACTIVE',
          lastUpdated: poolRes.data.lastUpdated
        });
      }
    } catch (err) {
      if (!toast.isActive('wallet-error')) {
        toast.error("Failed to fetch Master Wallet stats", { id: 'wallet-error' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleAddFunds = async (e) => {
    if (e) e.preventDefault();

    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      return toast.error("Please enter a valid positive amount");
    }
    if (!remarks.trim()) {
      return toast.error("Remarks / Reason are required for adding funds");
    }

    setActionLoading(true);
    try {
      const res = await api.post('/admin/master-wallet/credit', {
        amount: amt,
        remarks: remarks.trim()
      });

      if (res.data.success) {
        toast.success(res.data.message || "Funds added to Master Wallet instantly!");
        setAmount('');
        setRemarks('');
        fetchStats();
      }
    } catch (err) {
      // Error handled by global API interceptor, but fallback:
      if (err.response?.data?.message) {
        toast.error(err.response.data.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdrawFundsClick = (e) => {
    if (e) e.preventDefault();

    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      return toast.error("Please enter a valid positive amount");
    }
    if (!remarks.trim()) {
      return toast.error("Remarks / Reason are required for withdrawing funds");
    }

    // Open verification modal
    setIsWithdrawModalOpen(true);
  };

  const handleWithdrawSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!masterKey.trim()) {
      return toast.error("Please enter the Master Key");
    }

    setActionLoading(true);
    try {
      const res = await api.post('/admin/master-wallet/debit', {
        amount: Number(amount),
        remarks: remarks.trim(),
        masterKey: masterKey.trim()
      });

      if (res.data.success) {
        toast.success(res.data.message || "Funds withdrawn from Master Wallet successfully!");
        setAmount('');
        setRemarks('');
        setMasterKey('');
        setIsWithdrawModalOpen(false);
        fetchStats();
      }
    } catch (err) {
      // Fallback display if not caught by axios interceptor
      if (err.response?.data?.message) {
        toast.error(err.response.data.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !stats) return (
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
            <span className="text-[9px] font-semibold uppercase tracking-wider">Master Wallet Terminal</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            Manage <span className="text-[var(--color-primary)]">Capital Wallet</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-xs font-medium max-w-lg">
            Direct treasury capital injection and secure withdrawals. Restricted to authorized administrators.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchStats}
            className="p-2 bg-[var(--card-bg)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Statistics Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {/* Current Balance */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-5 relative overflow-hidden shadow-soft">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Current Balance</span>
              <h3 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
                ₹{Number(stats?.balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-2 bg-[var(--color-primary-glow)] rounded-lg text-[var(--color-primary)]">
              <WalletIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-3 text-[9px] font-medium text-[var(--text-secondary)] uppercase tracking-wide">
            Total ledger balance inside database
          </p>
        </div>

        {/* Available Balance */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-5 relative overflow-hidden shadow-soft">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Available Balance</span>
              <h3 className="text-2xl font-black text-emerald-500 tracking-tight">
                ₹{Number(stats?.availableBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-3 text-[9px] font-medium text-[var(--text-secondary)] uppercase tracking-wide">
            Liquid funds available for users
          </p>
        </div>

        {/* Total Credits */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-5 relative overflow-hidden shadow-soft">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Total Credits</span>
              <h3 className="text-2xl font-black text-emerald-500 tracking-tight">
                ₹{Number(stats?.totalCredits || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
              <ArrowUpCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-3 text-[9px] font-medium text-[var(--text-secondary)] uppercase tracking-wide">
            Lifetime manual credit injections
          </p>
        </div>

        {/* Total Debits */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-5 relative overflow-hidden shadow-soft">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Total Debits</span>
              <h3 className="text-2xl font-black text-rose-500 tracking-tight">
                ₹{Number(stats?.totalDebits || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500">
              <ArrowDownCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-3 text-[9px] font-medium text-[var(--text-secondary)] uppercase tracking-wide">
            Lifetime manual debit withdrawals
          </p>
        </div>

        {/* Recharge Pool Balance */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-5 relative overflow-hidden shadow-soft">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Recharge Pool Balance</span>
              <h3 className={`text-2xl font-black tracking-tight ${rechargePool.status === 'ACTIVE' ? 'text-emerald-500' : 'text-rose-500'}`}>
                ₹{Number(rechargePool.balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className={`p-2 rounded-lg ${rechargePool.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
              <Server className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-1 text-[9px] font-medium text-[var(--text-secondary)] uppercase tracking-wide">
            {rechargePool.balance === 0 ? (
              <span className="text-rose-500 font-bold">Recharge Services May Be Interrupted</span>
            ) : rechargePool.balance > 0 && rechargePool.balance < 50 ? (
              <span className="text-amber-500 font-bold">Recharge Pool Balance Running Low</span>
            ) : (
              <span>Available provider pool liquidity</span>
            )}
            {rechargePool.lastUpdated && (
              <span className="text-[8px] text-[var(--text-muted)] font-semibold mt-0.5">
                Last Sync: {new Date(rechargePool.lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pending User Approvals */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-4 flex items-center justify-between shadow-soft">
          <div className="space-y-0.5">
            <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Pending User Approvals</span>
            <p className="text-base font-black text-amber-500">
              {stats?.pendingCount || 0} Request(s) (₹{Number(stats?.pendingAmount || 0).toLocaleString("en-IN")})
            </p>
          </div>
          <Lock className="w-7 h-7 text-amber-500/40" />
        </div>

        {/* Today's Credits */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-4 flex items-center justify-between shadow-soft">
          <div className="space-y-0.5">
            <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Today's Credits</span>
            <p className="text-base font-black text-emerald-500">
              {stats?.todayCreditsCount || 0} Txn(s) (₹{Number(stats?.todayCreditsAmount || 0).toLocaleString("en-IN")})
            </p>
          </div>
          <ArrowUpCircle className="w-7 h-7 text-emerald-500/40" />
        </div>

        {/* Today's Debits */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-4 flex items-center justify-between shadow-soft">
          <div className="space-y-0.5">
            <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Today's Debits</span>
            <p className="text-base font-black text-rose-500">
              {stats?.todayDebitsCount || 0} Txn(s) (₹{Number(stats?.todayDebitsAmount || 0).toLocaleString("en-IN")})
            </p>
          </div>
          <ArrowDownCircle className="w-7 h-7 text-rose-500/40" />
        </div>
      </div>

      {/* Forms Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Treasury Funding Form */}
        <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-6 shadow-soft">
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-10 h-10 bg-[var(--color-primary-glow)] rounded-lg flex items-center justify-center border border-[var(--border-soft)]">
              <Plus className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">Manual Adjustments</h3>
              <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Add treasury funds or execute safe capital withdrawals</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Adjustment Amount (₹)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--text-secondary)]">₹</span>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={actionLoading}
                    className="w-full pl-8 pr-4 py-3 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-sm font-medium text-[var(--text-primary)] focus:border-[var(--color-primary)] outline-none transition-all placeholder:text-[var(--text-muted)]"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Remarks / Reason / Audit Details</label>
              <textarea 
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Provide detailed explanation for the audit trail..."
                rows="3"
                disabled={actionLoading}
                className="w-full px-4 py-3 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-sm font-medium text-[var(--text-primary)] focus:border-[var(--color-primary)] outline-none transition-all resize-none placeholder:text-[var(--text-muted)]"
              />
            </div>

            <div className="flex flex-col md:flex-row gap-4 pt-2">
              <button 
                type="button"
                onClick={handleAddFunds}
                disabled={actionLoading}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Add Funds</>}
              </button>

              <button 
                type="button"
                onClick={handleWithdrawFundsClick}
                disabled={actionLoading}
                className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><ArrowDownCircle className="w-4 h-4" /> Withdraw Funds</>}
              </button>
            </div>
          </div>
        </div>

        {/* Security & Audit Warning */}
        <div className="lg:col-span-1">
          <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-6 shadow-soft h-full flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4.5 h-4.5 text-[var(--color-primary)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">Treasury Rules</h3>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-[var(--bg-secondary)]/50 rounded-xl border border-[var(--border-soft)]">
                  <h4 className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">Add Funds (Credit)</h4>
                  <p className="text-[9px] text-[var(--text-secondary)] leading-relaxed">
                    Treasury additions are executed instantly. This bypasses payment gateway and Master Key checks, allowing immediate liquidity provision.
                  </p>
                </div>

                <div className="p-3 bg-[var(--bg-secondary)]/50 rounded-xl border border-[var(--border-soft)]">
                  <h4 className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">Withdraw Funds (Debit)</h4>
                  <p className="text-[9px] text-[var(--text-secondary)] leading-relaxed">
                    Withdrawals require validation of the System Master Key. The wallet balance must be greater than or equal to the withdrawal amount.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 mt-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-[9px] font-semibold flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                All capital movements are permanently logged in the Admin Ledger with administrator ID, IP address, and timestamp.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Withdraw Master Key verification modal overlay */}
      <AnimatePresence>
        {isWithdrawModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWithdrawModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-md bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-soft)] shadow-2xl p-6 z-10 overflow-hidden"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-[var(--border-soft)]">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                      Confirm Withdrawal
                    </h3>
                    <p className="text-[10px] text-[var(--text-secondary)] font-medium">
                      Enter System Master Key to authorize debit of ₹{Number(amount).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="p-1 hover:bg-[var(--bg-secondary)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleWithdrawSubmit} className="mt-5 space-y-4">
                <div className="space-y-1.5 relative">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    System Master Key
                  </label>
                  <div className="relative">
                    <input
                      type={showMasterKey ? "text" : "password"}
                      required
                      placeholder="Enter Master Key"
                      value={masterKey}
                      onChange={(e) => setMasterKey(e.target.value)}
                      disabled={actionLoading}
                      className="w-full pl-3 pr-10 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--color-primary)] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMasterKey(!showMasterKey)}
                      className="absolute right-3 top-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      {showMasterKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-[9px] font-semibold flex gap-2">
                  <span>⚠️</span>
                  <span>
                    Failed Master Key attempts will result in account lockout. Ensure the key is correct.
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsWithdrawModalOpen(false)}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] rounded-xl text-xs font-bold uppercase transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Withdrawing...
                      </>
                    ) : (
                      "Authorize Debit"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
