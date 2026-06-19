import React, { useState, useEffect } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { 
  Check, 
  X, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  ShieldAlert,
  Loader,
  MessageSquare
} from "lucide-react";

export default function PendingSettlements() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("PENDING"); // PENDING, APPROVED, REJECTED, FAILED, ALL
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  // Rejection modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedPendingId, setSelectedPendingId] = useState(null);
  const [rejectionRemarks, setRejectionRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/master-wallet/pending", {
        params: { page, limit: 20, status }
      });
      if (response.data?.success) {
        setItems(response.data.data.items);
        setPagination(response.data.data.pagination);
      }
    } catch (err) {
      toast.error("Failed to load pending settlements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, [page, status]);

  const handleApprove = async (id) => {
    const confirmApprove = window.confirm("Are you sure you want to approve this settlement? User wallet will be credited.");
    if (!confirmApprove) return;

    setLoading(true);
    try {
      const response = await api.post("/admin/master-wallet/approve", { id });
      if (response.data?.success) {
        toast.success(response.data.message || "Settlement approved successfully.");
        fetchPending();
      }
    } catch (err) {
      // Handled by API interceptor
    } finally {
      setLoading(false);
    }
  };

  const openRejectModal = (id) => {
    setSelectedPendingId(id);
    setRejectionRemarks("");
    setIsRejectModalOpen(true);
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionRemarks.trim()) {
      return toast.error("Please enter rejection remarks.");
    }

    setSubmitting(true);
    try {
      const response = await api.post("/admin/master-wallet/reject", {
        id: selectedPendingId,
        remarks: rejectionRemarks.trim()
      });

      if (response.data?.success) {
        toast.success("Settlement rejected successfully.");
        setIsRejectModalOpen(false);
        fetchPending();
      }
    } catch (err) {
      // Handled by interceptor
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wider text-[var(--text-primary)]">
            Pending <span className="text-[var(--color-primary)]">Settlement Queue</span>
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Approve or reject manual wallet credit releases waiting for floor adjustments.
          </p>
        </div>
        <button
          onClick={fetchPending}
          disabled={loading}
          className="p-2 bg-[var(--card-bg)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-soft)] gap-4">
        {[
          { label: "Pending Approvals", value: "PENDING" },
          { label: "Approved Settlements", value: "APPROVED" },
          { label: "Rejected Requests", value: "REJECTED" },
          { label: "Failed Validations", value: "FAILED" },
          { label: "All Settlements", value: "ALL" }
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              status === tab.value
                ? "border-[var(--color-primary)] text-[var(--color-primary)] font-black"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table Section */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <div className="w-10 h-10 border-4 border-[var(--color-primary)]/10 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Fetching settlements...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-[var(--text-secondary)] space-y-2">
            <ShieldAlert className="w-10 h-10 mx-auto opacity-20" />
            <p className="text-sm font-bold uppercase tracking-wider">No settlements found</p>
            <p className="text-xs">There are no records in the queue matching this criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]/50">
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">User Details</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Payment ID</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Gateway Ref</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest text-right">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Received Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--border-soft)] hover:bg-[var(--accent-hover)] transition-all">
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-[var(--text-primary)]">{item.user?.name || "Anonymous User"}</div>
                      <div className="text-[10px] text-[var(--text-secondary)]">{item.user?.phone || "N/A"}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-[var(--text-secondary)]">
                      #{item.paymentId}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-[var(--text-secondary)]">
                      {item.payment?.gatewayTxnId || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-xs font-black text-[var(--text-primary)] text-right">
                      ₹{Number(item.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-[var(--text-secondary)]">
                      {new Date(item.createdAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short"
                      })}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        item.settlementStatus === "PENDING"
                          ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          : item.settlementStatus === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                      }`}>
                        {item.settlementStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center items-center gap-2">
                        {item.settlementStatus === "PENDING" ? (
                          <>
                            <button
                              onClick={() => handleApprove(item.id)}
                              className="p-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg transition-all cursor-pointer"
                              title="Approve Settlement"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openRejectModal(item.id)}
                              className="p-1.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-all cursor-pointer"
                              title="Reject Settlement"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-[var(--text-secondary)] font-medium italic">
                            {item.remarks ? `"${item.remarks}"` : "Processed"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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

      {/* Rejection Remarks Modal Overlay */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div 
            onClick={() => setIsRejectModalOpen(false)} 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-soft)] shadow-2xl p-6 z-10 overflow-hidden">
            <div className="flex justify-between items-center pb-4 border-b border-[var(--border-soft)]">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                    Provide Rejection Remarks
                  </h3>
                  <p className="text-[10px] text-[var(--text-secondary)] font-medium">
                    Remarks are mandatory and will be sent to the user.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="p-1 hover:bg-[var(--bg-secondary)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Rejection Reason
                </label>
                <textarea
                  required
                  rows="3"
                  placeholder="e.g. Transaction reference invalid / duplicate settlement..."
                  value={rejectionRemarks}
                  onChange={(e) => setRejectionRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--color-primary)] transition-all resize-none"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  disabled={submitting}
                  className="flex-1 py-2.5 border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] rounded-xl text-xs font-bold uppercase transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    "Confirm Reject"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
