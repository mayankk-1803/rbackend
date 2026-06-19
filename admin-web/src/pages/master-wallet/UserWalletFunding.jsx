import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Users as UsersIcon, 
  Wallet as WalletIcon, 
  ShieldCheck, 
  AlertTriangle, 
  Plus, 
  RefreshCw, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle,
  X
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function UserWalletFunding() {
  const [adminUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("dizipay_admin_data")) || {};
    } catch {
      return {};
    }
  });

  const isSuperAdmin = adminUser.role === 'SUPER_ADMIN';

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [userList, setUserList] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form states
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [masterKey, setMasterKey] = useState('');
  const [showMasterKey, setShowMasterKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Admin Wallet Stats state
  const [adminStats, setAdminStats] = useState({ availableBalance: 0 });

  const fetchAdminStats = async () => {
    try {
      const { data } = await api.get('/admin/master-wallet');
      if (data && data.success) {
        const walletData = data.data || {};
        const balance = Number(walletData.balance || data.balance || 0);
        const reservedBalance = Number(walletData.reservedBalance || data.reservedBalance || 0);
        const minimumOperationalBalance = Number(walletData.minimumOperationalBalance || 0);
        const availableBalance = balance - reservedBalance - minimumOperationalBalance;
        setAdminStats({ availableBalance });
      }
    } catch (err) {
      console.error("Failed to fetch admin stats:", err);
    }
  };

  useEffect(() => {
    fetchAdminStats();
  }, []);

  // Search users handler (debounced or triggered on type)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setUserList([]);
      return;
    }
    
    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get('/admin/users', {
          params: { search: searchQuery.trim(), page: 1, limit: 10 }
        });
        if (data && data.success) {
          setUserList(data.data.users || []);
        }
      } catch (err) {
        console.error("Failed to search users:", err);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Refresh selected user balance
  const refreshSelectedUser = async () => {
    if (!selectedUser) return;
    try {
      const { data } = await api.get(`/admin/users/${selectedUser.id}`);
      if (data && data.success) {
        setSelectedUser(data.data);
      }
    } catch (err) {
      console.error("Failed to refresh user:", err);
    }
  };

  const handleFundSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!selectedUser) {
      return toast.error("Please select a target user to fund.");
    }
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
      const { data } = await api.post(`/admin/users/${selectedUser.id}/fund-wallet`, {
        amount: amt,
        remarks: remarks.trim(),
        masterKey: masterKey.trim()
      });

      if (data && data.success) {
        toast.success(data.message || `Funded User ${selectedUser.name} with ₹${amt} successfully!`);
        setAmount('');
        setRemarks('');
        setMasterKey('');
        refreshSelectedUser();
        fetchAdminStats();
      }
    } catch (err) {
      // API interceptor handles rendering toast notifications for errors, but fallback error message display:
      if (err.response?.data?.message) {
        toast.error(err.response.data.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 pb-12">
      {/* Header */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[var(--color-primary-glow)] text-[var(--color-primary)] rounded-full border border-[var(--border-soft)]">
          <ShieldCheck className="w-3 h-3" />
          <span className="text-[9px] font-semibold uppercase tracking-wider">Super Admin Security Restricted</span>
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          User <span className="text-[var(--color-primary)]">Wallet Funding</span>
        </h2>
        <p className="text-[var(--text-secondary)] text-xs font-medium max-w-xl">
          Directly inject capital credits into any client merchant wallet. All actions require Master Key verification and are recorded in the central treasury audit logs.
        </p>
      </div>

      {!isSuperAdmin && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs font-semibold flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>Restricted Access: You are not authorized. Only SUPER_ADMIN accounts can perform manual user wallet adjustments.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Search Panel */}
        <div className="lg:col-span-1 bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-5 shadow-soft flex flex-col h-[520px]">
          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3.5 flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-[var(--color-primary)]" />
            1. Select Target User
          </h3>

          {/* Search Input */}
          <div className="relative mb-4">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search by name, email or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={!isSuperAdmin}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs font-medium text-[var(--text-primary)] focus:border-[var(--color-primary)] outline-none transition-all placeholder:text-[var(--text-muted)]"
            />
            {searching && (
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--color-primary)]" />
              </span>
            )}
          </div>

          {/* User Results List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-soft)] pr-1 custom-scrollbar">
            {userList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 text-[var(--text-secondary)] space-y-2 opacity-60">
                <UsersIcon className="w-8 h-8 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-wider">
                  {searchQuery.trim() ? "No users matched" : "Type to search users"}
                </p>
                <p className="text-[10px] max-w-[160px] leading-relaxed">
                  Enter merchant email, phone number, or name to find the user profile.
                </p>
              </div>
            ) : (
              userList.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full py-3 px-3 text-left rounded-xl transition-all flex items-center justify-between border cursor-pointer my-1 ${
                    selectedUser?.id === user.id
                      ? "bg-[var(--color-primary-glow)] border-[var(--color-primary)]/30 text-[var(--color-primary)]"
                      : "bg-transparent border-transparent hover:bg-[var(--accent-hover)] text-[var(--text-primary)]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{user.name || "Unnamed User"}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-0.5 truncate">{user.email || "No email"}</p>
                    <p className="text-[9px] text-[var(--text-muted)] font-bold tracking-wide mt-0.5">{user.phone}</p>
                  </div>
                  <span className={`px-1.5 py-0.5 text-[8px] font-black rounded uppercase ${
                    user.role === 'SUPER_ADMIN' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                  }`}>
                    {user.role}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Selected User Details & Form */}
        <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-soft min-h-[520px] flex flex-col justify-between">
          <div className="space-y-6">
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2 border-b border-[var(--border-soft)] pb-3">
              <Plus className="w-4.5 h-4.5 text-[var(--color-primary)]" />
              2. Funding Execution Form
            </h3>

            <AnimatePresence mode="wait">
              {selectedUser ? (
                <motion.div
                  key={selectedUser.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {/* Selected User Profile Summary Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[var(--bg-secondary)]/30 border border-[var(--border-soft)] rounded-2xl">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 bg-[var(--color-primary-glow)] rounded-xl border border-[var(--border-soft)] flex items-center justify-center text-[var(--color-primary)] font-black text-sm">
                        {selectedUser.name ? selectedUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'US'}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-[var(--text-primary)]">{selectedUser.name}</h4>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{selectedUser.email || "No email"}</p>
                        <p className="text-[10px] text-[var(--text-secondary)] font-bold">{selectedUser.phone}</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="p-3 bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl text-center min-w-[100px] shadow-sm">
                        <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-0.5">Wallet Balance</span>
                        <span className="text-xs font-extrabold text-cyan-500">
                          ₹{Number(selectedUser.wallet?.balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="p-3 bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl text-center min-w-[100px] shadow-sm">
                        <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-0.5">Cashback Balance</span>
                        <span className="text-xs font-extrabold text-emerald-500">
                          ₹{Number(selectedUser.wallet?.cashbackBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Informational Balance and Warning Banners */}
                  <div className="space-y-3">
                    <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 rounded-xl text-xs font-semibold flex items-center justify-between">
                      <span>Available Admin Wallet Balance:</span>
                      <span className="font-black">₹{adminStats.availableBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    {adminStats.availableBalance <= 0 && (
                      <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs font-semibold flex items-start gap-2.5">
                        <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Admin Wallet balance is insufficient.</p>
                          <p className="text-[10px] mt-0.5 opacity-90">Please add funds to the Admin Wallet before funding users.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Form fields */}
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
                      <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Remarks / Reason / Audit details</label>
                      <textarea
                        required
                        placeholder="Provide detailed explanation for this manual balance credit..."
                        rows="2.5"
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
                        className="px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-glow)] hover:text-[var(--color-primary)] text-[var(--bg-primary)] rounded-xl font-bold uppercase tracking-wider text-xs hover:border-[var(--border-soft)] border border-transparent transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm min-w-[180px]"
                      >
                        {submitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Credit User Wallet
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-16 text-center text-[var(--text-secondary)] space-y-2 border border-dashed border-[var(--border-soft)] rounded-2xl bg-[var(--bg-secondary)]/5"
                >
                  <WalletIcon className="w-10 h-10 mx-auto opacity-20" />
                  <p className="text-sm font-bold uppercase tracking-wider">Form Suspended</p>
                  <p className="text-xs">Please select a client merchant profile from the left sidebar to unlock the funding screen.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Audit warnings footer */}
          <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl text-[10px] leading-relaxed font-semibold flex gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div className="space-y-0.5">
              <span className="block font-black uppercase tracking-wider">IMMUTABLE TREASURY LOGGING ACTIVE</span>
              <span>
                Manual credits debit the central Admin Master Wallet and credit the user wallet in a serializable database transaction. This bypasses gateways but validates Master Key attempts. Account lockout is activated after 5 failed tries. All actions are logged permanently.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
