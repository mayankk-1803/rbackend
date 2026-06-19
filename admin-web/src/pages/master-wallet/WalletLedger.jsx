import React, { useState, useEffect } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { 
  Search, 
  Calendar, 
  FileSpreadsheet, 
  ChevronLeft, 
  ChevronRight,
  RefreshCw,
  Filter
} from "lucide-react";

export default function WalletLedger() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // today, week, month, custom, all
  const [type, setType] = useState(""); // MANUAL_CREDIT, MANUAL_DEBIT, SETTLEMENT_DEBIT etc.
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/master-wallet/ledger", {
        params: {
          page,
          limit: 20,
          filter,
          type: type || undefined,
          startDate: filter === "custom" ? startDate : undefined,
          endDate: filter === "custom" ? endDate : undefined
        }
      });
      if (response.data?.success) {
        setItems(response.data.data.items);
        setPagination(response.data.data.pagination);
      }
    } catch (err) {
      toast.error("Failed to load ledger history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [page, filter, type]);

  const handleCustomRangeSearch = (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      return toast.error("Please select both start and end dates.");
    }
    setPage(1);
    fetchLedger();
  };

  const handleExportCSV = () => {
    if (items.length === 0) {
      return toast.error("No entries available to export.");
    }

    const headers = ["Date", "Type", "Amount (INR)", "Opening Balance (INR)", "Closing Balance (INR)", "Reference ID", "Performed By", "Description"];
    const rows = items.map(item => [
      new Date(item.createdAt).toLocaleString(),
      item.type,
      Number(item.amount).toFixed(2),
      Number(item.openingBalance).toFixed(2),
      Number(item.closingBalance).toFixed(2),
      item.referenceId || "N/A",
      `"${(item.metadata?.performedBy || 'System').replace(/"/g, '""')}"`,
      `"${item.description.replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `master_wallet_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Ledger exported successfully.");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wider text-[var(--text-primary)]">
            Master Wallet <span className="text-[var(--color-primary)]">Ledger Audit</span>
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Review detailed financial records, manual entries, and auto-settlements.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleExportCSV}
            className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={fetchLedger}
            disabled={loading}
            className="p-2 bg-[var(--card-bg)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter Options Panel */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-end lg:items-center justify-between">
          <div className="flex flex-wrap gap-3 w-full lg:w-auto">
            {/* Quick Filters */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Date range</label>
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--color-primary)] cursor-pointer"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Type Filter */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Adjustment Type</label>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--color-primary)] cursor-pointer"
              >
                <option value="">All Transactions</option>
                <option value="MANUAL_CREDIT">Manual Credits</option>
                <option value="MANUAL_DEBIT">Manual Debits</option>
                <option value="SETTLEMENT_DEBIT">Auto Settlements</option>
                <option value="CASHBACK_REVENUE">Cashback Split</option>
                <option value="ADMIN_WALLET_TOPUP">Admin Topups</option>
              </select>
            </div>
          </div>

          {/* Custom Date Form */}
          {filter === "custom" && (
            <form onSubmit={handleCustomRangeSearch} className="flex flex-wrap items-end gap-3 w-full lg:w-auto">
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Start Date</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--color-primary)] cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">End Date</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--color-primary)] cursor-pointer"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" />
                Filter
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Ledger Table Section */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <div className="w-10 h-10 border-4 border-[var(--color-primary)]/10 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Fetching entries...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-[var(--text-secondary)] space-y-2">
            <Filter className="w-10 h-10 mx-auto opacity-20" />
            <p className="text-sm font-bold uppercase tracking-wider">No ledger entries found</p>
            <p className="text-xs">Try selecting a different filter range or transaction type.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]/50">
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest text-right">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest text-right">Opening Bal</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest text-right">Closing Bal</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Ref ID</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Performed By</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Description</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isCredit = Number(item.amount) >= 0;
                  return (
                    <tr key={item.id} className="border-b border-[var(--border-soft)] hover:bg-[var(--accent-hover)] transition-all">
                      <td className="px-6 py-4 text-xs font-bold text-[var(--text-primary)]">
                        {new Date(item.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short"
                        })}
                      </td>
                      <td className="px-6 py-4 text-xs font-black">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                          item.type === "MANUAL_CREDIT" || item.type === "CASHBACK_REVENUE" || item.type === "ADMIN_WALLET_TOPUP"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-rose-500/10 text-rose-500"
                        }`}>
                          {item.type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-xs font-black text-right ${
                        isCredit ? "text-emerald-500" : "text-rose-500"
                      }`}>
                        {isCredit ? "+" : ""}₹{Number(item.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-[var(--text-secondary)] text-right">
                        ₹{Number(item.openingBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-xs font-black text-[var(--text-primary)] text-right">
                        ₹{Number(item.closingBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-[var(--text-secondary)]">
                        {item.referenceId || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-[var(--text-primary)]">
                        {item.metadata?.performedBy || "System"}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-[var(--text-primary)] max-w-xs truncate" title={item.description}>
                        {item.description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Strip */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 bg-[var(--bg-secondary)]/30 border-t border-[var(--border-soft)] flex justify-between items-center">
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Showing page {pagination.page} of {pagination.pages} ({pagination.total} entries)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage(prev => prev - 1)}
                className="p-1.5 bg-[var(--card-bg)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-lg text-[var(--text-secondary)] disabled:opacity-40 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= pagination.pages || loading}
                onClick={() => setPage(prev => prev + 1)}
                className="p-1.5 bg-[var(--card-bg)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-lg text-[var(--text-secondary)] disabled:opacity-40 transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
