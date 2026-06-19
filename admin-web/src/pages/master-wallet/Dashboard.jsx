import React, { useState, useEffect } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Lock, 
  Settings, 
  RefreshCw, 
  TrendingUp, 
  ShieldCheck, 
  AlertTriangle,
  FileSpreadsheet
} from "lucide-react";
import { MasterKeyModal } from "../../components/MasterKeyModal";

export default function MasterWalletDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  
  // Form States
  const [adjustType, setAdjustType] = useState("CREDIT"); // CREDIT or DEBIT
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustRemarks, setAdjustRemarks] = useState("");
  const [minBalanceVal, setMinBalanceVal] = useState("");

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/master-wallet/stats");
      if (response.data?.success) {
        setStats(response.data.data);
        setMinBalanceVal(response.data.data.minimumOperationalBalance.toString());
      }
    } catch (err) {
      toast.error("Failed to load Master Wallet statistics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleAdjustWallet = async (e) => {
    e.preventDefault();
    if (!adjustAmount || isNaN(Number(adjustAmount)) || Number(adjustAmount) <= 0) {
      return toast.error("Please enter a valid amount.");
    }
    if (!adjustRemarks.trim()) {
      return toast.error("Please provide remarks for this manual adjustment.");
    }

    setActionLoading(true);
    try {
      const response = await api.post("/admin/master-wallet/adjust", {
        amount: Number(adjustAmount),
        type: adjustType,
        remarks: adjustRemarks
      });

      if (response.data?.success) {
        toast.success(response.data.message || "Wallet adjusted successfully.");
        setAdjustAmount("");
        setAdjustRemarks("");
        fetchStats();
      }
    } catch (err) {
      // Error is handled by API interceptor (e.g. Master Key prompt)
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateMinBalance = async (e) => {
    e.preventDefault();
    if (minBalanceVal === "" || isNaN(Number(minBalanceVal)) || Number(minBalanceVal) < 0) {
      return toast.error("Please enter a valid non-negative number.");
    }

    setActionLoading(true);
    try {
      const response = await api.post("/admin/master-wallet/min-balance", {
        minimumOperationalBalance: Number(minBalanceVal)
      });

      if (response.data?.success) {
        toast.success(response.data.message || "Minimum operational balance updated.");
        fetchStats();
      }
    } catch (err) {
      // Error handled by interceptor
    } finally {
      setActionLoading(false);
    }
  };

  const isSessionActive = () => {
    return !!(window.masterKeySession && window.masterKeySessionExpiry && window.masterKeySessionExpiry > Date.now());
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wider text-[var(--text-primary)]">
            Master Wallet <span className="text-[var(--color-primary)]">Control Center</span>
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Manage funding sources, settlement validation layers, and manual ledger adjustments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
            isSessionActive() 
              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
              : "bg-amber-500/10 text-amber-500 border-amber-500/20"
          }`}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Master Session: {isSessionActive() ? "Active" : "Locked"}</span>
          </div>
          {!isSessionActive() && (
            <button 
              onClick={() => setIsKeyModalOpen(true)}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              Authorize
            </button>
          )}
          <button 
            onClick={fetchStats}
            disabled={loading}
            className="p-2 bg-[var(--card-bg)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && !stats ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <div className="w-10 h-10 border-4 border-[var(--color-primary)]/10 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Loading stats...</span>
        </div>
      ) : (
        <>
          {/* Main Balance Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Available Balance */}
            <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-5 relative overflow-hidden shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">Available Balance</p>
                  <h3 className="text-2xl font-black text-emerald-400 mt-1 tracking-tight">
                    ₹{stats?.availableBalance?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </h3>
                </div>
                <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                <span>Current Liquid Funds available for User Settlement</span>
              </div>
            </div>

            {/* Current Balance */}
            <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-5 relative overflow-hidden shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">Current balance</p>
                  <h3 className="text-2xl font-black text-[var(--text-primary)] mt-1 tracking-tight">
                    ₹{stats?.balance?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </h3>
                </div>
                <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-500">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                Total Ledger Balance inside database
              </div>
            </div>

            {/* Reserved Balance */}
            <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-5 relative overflow-hidden shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">Reserved Balance</p>
                  <h3 className="text-2xl font-black text-amber-500 mt-1 tracking-tight">
                    ₹{stats?.reservedBalance?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </h3>
                </div>
                <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500">
                  <Lock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                Locked funds reserved for pending transactions
              </div>
            </div>

            {/* Operational Balance Limit */}
            <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-5 relative overflow-hidden shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">Operational Floor</p>
                  <h3 className="text-2xl font-black text-rose-500 mt-1 tracking-tight">
                    ₹{stats?.minimumOperationalBalance?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </h3>
                </div>
                <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-500">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                Required safety minimum buffer balance
              </div>
            </div>
          </div>

          {/* Secondary Stats Strip */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Total Credits</p>
                <p className="text-base font-black text-emerald-500 mt-0.5">₹{stats?.totalCredits?.toLocaleString("en-IN")}</p>
              </div>
              <ArrowUpRight className="w-7 h-7 text-emerald-500/40" />
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Total Debits</p>
                <p className="text-base font-black text-rose-500 mt-0.5">₹{stats?.totalDebits?.toLocaleString("en-IN")}</p>
              </div>
              <ArrowDownLeft className="w-7 h-7 text-rose-500/40" />
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Pending Approvals</p>
                <p className="text-base font-black text-amber-500 mt-0.5">
                  {stats?.pendingCount} (₹{stats?.pendingAmount?.toLocaleString("en-IN")})
                </p>
              </div>
              <Lock className="w-7 h-7 text-amber-500/40" />
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Cashback Earnings</p>
                <p className="text-base font-black text-purple-500 mt-0.5">₹{stats?.cashbackEarnings?.toLocaleString("en-IN")}</p>
              </div>
              <TrendingUp className="w-7 h-7 text-purple-500/40" />
            </div>
          </div>

          {/* Action Modules */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Adjustment Form */}
            <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-5 shadow-sm">
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4 text-[var(--color-primary)]" />
                Manual Wallet Adjustment
              </h4>
              <form onSubmit={handleAdjustWallet} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Action Type</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAdjustType("CREDIT")}
                        className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all cursor-pointer ${
                          adjustType === "CREDIT" 
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                            : "bg-[var(--bg-secondary)] border-[var(--border-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        Credit (Add Funds)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustType("DEBIT")}
                        className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all cursor-pointer ${
                          adjustType === "DEBIT" 
                            ? "bg-rose-500/10 text-rose-500 border-rose-500/20" 
                            : "bg-[var(--bg-secondary)] border-[var(--border-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        Debit (Remove)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 5000"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--color-primary)] transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Remarks / Reason</label>
                  <textarea
                    rows="3"
                    required
                    placeholder="Provide detailed explanation for audit trail..."
                    value={adjustRemarks}
                    onChange={(e) => setAdjustRemarks(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--color-primary)] transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? "Processing..." : "Submit Adjustment"}
                </button>
              </form>
            </div>

            {/* Minimum Buffer Settings */}
            <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-5 shadow-sm">
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Operational Buffer
              </h4>
              <p className="text-[10px] text-[var(--text-secondary)] mb-4 leading-relaxed">
                Define the minimum operational floor. Automatics settlements will be halted and routed to the pending credit queue once Available Balance falls below this limit.
              </p>
              <form onSubmit={handleUpdateMinBalance} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Floor Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 1000"
                    value={minBalanceVal}
                    onChange={(e) => setMinBalanceVal(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--color-primary)] transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? "Updating..." : "Update Floor"}
                </button>
              </form>
            </div>

          </div>
        </>
      )}

      {/* Verification modal overlay */}
      <MasterKeyModal 
        isOpen={isKeyModalOpen} 
        onClose={() => setIsKeyModalOpen(false)} 
        onSuccess={() => fetchStats()} 
      />
    </div>
  );
}
