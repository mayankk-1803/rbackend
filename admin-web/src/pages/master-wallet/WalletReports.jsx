import React, { useState, useEffect } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { 
  BarChart, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw,
  PieChart
} from "lucide-react";

export default function WalletReports() {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/master-wallet/stats");
      if (response.data?.success) {
        setReportData(response.data.data);
      }
    } catch (err) {
      toast.error("Failed to load Master Wallet report data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wider text-[var(--text-primary)]">
            Master Wallet <span className="text-[var(--color-primary)]">Analytics & Reports</span>
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Overview of financial indicators, cashback collections, and buffer status.
          </p>
        </div>
        <button
          onClick={fetchReportData}
          disabled={loading}
          className="p-2 bg-[var(--card-bg)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <div className="w-10 h-10 border-4 border-[var(--color-primary)]/10 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Generating reports...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Summary Box */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)] border-b border-[var(--border-soft)] pb-3">
              Floor & Threshold Auditing
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-secondary)] font-bold">Ledger balance:</span>
                <span className="font-black">₹{reportData?.balance?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-secondary)] font-bold">Floor Threshold Limit:</span>
                <span className="font-black text-rose-500">₹{reportData?.minimumOperationalBalance?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-secondary)] font-bold">Reserved Balance:</span>
                <span className="font-black text-amber-500">₹{reportData?.reservedBalance?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-[var(--border-soft)] pt-3 flex justify-between items-center text-sm font-black">
                <span className="text-[var(--text-primary)]">Available Liquid Balance:</span>
                <span className="text-emerald-500">₹{reportData?.availableBalance?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Cashback & Sharing Summary */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)] border-b border-[var(--border-soft)] pb-3">
              Cashback Yield Analysis
            </h3>
            <div className="space-y-4 flex flex-col justify-center h-full">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-500">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Total Cashback Share Earned</p>
                  <h4 className="text-xl font-black text-purple-500 mt-0.5">
                    ₹{reportData?.cashbackEarnings?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </h4>
                </div>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                This includes all 0.5% / 1.0% cashback share collected automatically by splitting provider commissions based on yield thresholds.
              </p>
            </div>
          </div>

          {/* Credits Distribution */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-sm flex items-center justify-between">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                Total Credits Volume
              </span>
              <h4 className="text-xl font-black text-emerald-500">
                ₹{reportData?.totalCredits?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h4>
              <p className="text-[9px] text-[var(--text-secondary)] font-medium">Funds added through manual admin adjustments.</p>
            </div>
            <BarChart className="w-16 h-16 text-emerald-500/10" />
          </div>

          {/* Debits Distribution */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-sm flex items-center justify-between">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                <ArrowDownLeft className="w-4 h-4 text-rose-500" />
                Total Debits Volume
              </span>
              <h4 className="text-xl font-black text-rose-500">
                ₹{reportData?.totalDebits?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h4>
              <p className="text-[9px] text-[var(--text-secondary)] font-medium">Settlements paid for user wallet topups.</p>
            </div>
            <PieChart className="w-16 h-16 text-rose-500/10" />
          </div>
        </div>
      )}
    </div>
  );
}
