import React, { useState, useEffect } from 'react';
import { 
   ShieldCheck, 
   AlertTriangle, 
   Plus, 
   RefreshCw, 
   Lock, 
   Eye, 
   EyeOff, 
   Wallet as WalletIcon,
   CheckCircle
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function AdminWalletFunding() {
  const [adminUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("dizipay_admin_data")) || {};
    } catch {
      return {};
    }
  });

  const isSuperAdmin = adminUser.role === 'SUPER_ADMIN';

  // Stats states
  const [stats, setStats] = useState({
    balance: 0,
    reservedBalance: 0,
    minimumOperationalBalance: 0,
    availableBalance: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Form states
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [masterKey, setMasterKey] = useState('');
  const [showMasterKey, setShowMasterKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch wallet statistics
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const { data } = await api.get('/admin/master-wallet');
      if (data && data.success) {
        // Stats are located in data.data or root
        const walletData = data.data || {};
        const balance = Number(walletData.balance || data.balance || 0);
        const reservedBalance = Number(walletData.reservedBalance || data.reservedBalance || 0);
        const minimumOperationalBalance = Number(walletData.minimumOperationalBalance || 0);
        const availableBalance = balance - reservedBalance - minimumOperationalBalance;

        setStats({
          balance,
          reservedBalance,
          minimumOperationalBalance,
          availableBalance
        });
      }
    } catch (err) {
      console.error("Failed to fetch wallet stats:", err);
      toast.error("Failed to load wallet balance statistics.");
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleFundSubmit = async (e) => {
    if (e) e.preventDefault();

    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      return toast.error("Please enter a valid positive amount.");
    }
    if (!remarks.trim()) {
      return toast.error("Remarks / Reason is required.");
    }
    if (!masterKey.trim()) {
      return toast.error("Please enter the System Master Key.");
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/admin/master-wallet/add-funds', {
        amount: amt,
        remarks: remarks.trim(),
        masterKey: masterKey.trim()
      });

      if (data && data.success) {
        toast.success(data.message || `Replenished Admin Wallet with ₹${amt} successfully!`);
        setAmount('');
        setRemarks('');
        setMasterKey('');
        fetchStats();
      }
    } catch (err) {
      if (err.response?.data?.message) {
        toast.error(err.response.data.message);
      } else {
        toast.error(" replenishment failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Determine status color and label
  const getStatusColor = (avail) => {
    if (avail > 1000) return { bg: 'bg-emerald-500/10', text: 'text-emerald-500', dot: 'bg-emerald-500', label: 'Healthy Balance' };
    if (avail >= 0) return { bg: 'bg-amber-500/10', text: 'text-amber-500', dot: 'bg-amber-500', label: 'Low Balance Warning' };
    return { bg: 'bg-rose-500/10', text: 'text-rose-500', dot: 'bg-rose-500', label: 'Deficit / Operational Stop' };
  };

  const statusIndicator = getStatusColor(stats.availableBalance);

  return (
    <div className="p-6 space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[var(--color-primary-glow)] text-[var(--color-primary)] rounded-full border border-[var(--border-soft)]">
            <ShieldCheck className="w-3 h-3" />
            <span className="text-[9px] font-semibold uppercase tracking-wider">Super Admin Topup Authority</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            Admin Wallet <span className="text-[var(--color-primary)]">replenishment</span>
          </h2>
          <p className="text-[var(--text-secondary)] text-xs font-medium max-w-xl">
            Inject corporate capital credits into the primary admin vault. This directly increases the vault balance available for user funding.
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loadingStats}
          className="p-2 bg-[var(--card-bg)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loadingStats ? "animate-spin" : ""}`} />
        </button>
      </div>

      {!isSuperAdmin && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs font-semibold flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>Restricted Access: You are not authorized. Only SUPER_ADMIN accounts can perform manual vault replenishment.</span>
        </div>
      )}

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Current Balance */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] p-5 rounded-2xl shadow-soft">
          <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">Current Balance</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg md:text-2xl font-black text-[var(--text-primary)]">
              ₹{stats.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Reserved Balance */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] p-5 rounded-2xl shadow-soft">
          <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">Reserved Balance</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg md:text-2xl font-black text-[var(--text-secondary)]">
              ₹{stats.reservedBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Min Operational Balance */}
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] p-5 rounded-2xl shadow-soft">
          <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">Min Operational Balance</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg md:text-2xl font-black text-[var(--text-secondary)]">
              ₹{stats.minimumOperationalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Available Balance */}
        <div className={`border p-5 rounded-2xl shadow-soft border-l-4 ${statusIndicator.bg} ${
          stats.availableBalance > 1000 ? 'border-emerald-500' : stats.availableBalance >= 0 ? 'border-amber-500' : 'border-rose-500'
        }`}>
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1.5">Available Balance</span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wide ${statusIndicator.bg} ${statusIndicator.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusIndicator.dot} animate-pulse`}></span>
              {statusIndicator.label}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className={`text-lg md:text-2xl font-black ${statusIndicator.text}`}>
              ₹{stats.availableBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Container */}
        <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-soft space-y-6">
          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2 border-b border-[var(--border-soft)] pb-3">
            <Plus className="w-4.5 h-4.5 text-[var(--color-primary)]" />
            Admin Vault Replenishment Form
          </h3>

          <form onSubmit={handleFundSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Amount input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Amount to Credit (₹)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--text-secondary)]">₹</span>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={submitting || !isSuperAdmin}
                    className="w-full pl-8 pr-4 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] focus:border-[var(--color-primary)] outline-none transition-all placeholder:text-[var(--text-muted)]"
                  />
                </div>
              </div>

              {/* Master Key Input */}
              <div className="space-y-1.5 relative">
                <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">System Master Key</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                    <Lock className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type={showMasterKey ? "text" : "password"}
                    required
                    placeholder="Enter system key..."
                    value={masterKey}
                    onChange={(e) => setMasterKey(e.target.value)}
                    disabled={submitting || !isSuperAdmin}
                    className="w-full pl-10 pr-10 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] focus:border-[var(--color-primary)] outline-none transition-all placeholder:text-[var(--text-muted)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMasterKey(!showMasterKey)}
                    disabled={!isSuperAdmin}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer disabled:opacity-50"
                  >
                    {showMasterKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Remarks Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Remarks / Replenishment Audit Reason</label>
              <textarea
                required
                placeholder="Explain the source or intent of this corporate vault credit..."
                rows="3"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={submitting || !isSuperAdmin}
                className="w-full px-4 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs font-medium text-[var(--text-primary)] focus:border-[var(--color-primary)] outline-none transition-all resize-none placeholder:text-[var(--text-muted)]"
              />
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={submitting || !isSuperAdmin}
                className="px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-glow)] hover:text-[var(--color-primary)] text-[var(--bg-primary)] rounded-xl font-bold uppercase tracking-wider text-xs hover:border-[var(--border-soft)] border border-transparent transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm min-w-[200px]"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Funds To Admin Wallet
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Security Warning Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl text-[11px] leading-relaxed font-semibold">
            <h4 className="font-black uppercase tracking-wider mb-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Replenishment Safe Protocol
            </h4>
            <ul className="list-disc pl-4 space-y-2">
              <li>Manual topups represent physical corporate bank deposits or gateway transfers.</li>
              <li>This increases the central ledger balance and registers as an `ADMIN_WALLET_TOPUP` transaction type.</li>
              <li>Always execute this action with double-verified remarks to prevent reconciliation blockages during month-end audits.</li>
              <li>Master Key lockouts apply to this module. Lockout threshold is 5 attempts.</li>
            </ul>
          </div>

          <div className="p-5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 rounded-2xl text-[11px] leading-relaxed font-semibold flex gap-3">
            <CheckCircle className="w-5 h-5 text-cyan-500 flex-shrink-0" />
            <div className="space-y-0.5">
              <span className="block font-black uppercase tracking-wider text-xs text-cyan-600 dark:text-cyan-400">Realtime sync active</span>
              <span>Submitting replenishment immediately updates available pools across client merchant nodes. No service restart required.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
