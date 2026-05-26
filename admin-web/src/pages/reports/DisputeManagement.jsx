import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldAlert, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw,
  Search,
  User,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import api from '../../services/api';
import { formatAmount, safeArray } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function DisputeManagement() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [resolving, setResolving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/disputes');
      setDisputes(safeArray(res.data.data));
    } catch (err) {
      toast.error("Failed to load disputes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResolve = async (id, status) => {
    if (!remarks.trim()) return toast.error("Please add resolution remarks");
    setResolving(true);
    try {
      await api.patch(`/admin/disputes/${id}`, { status, remarks });
      toast.success(`Dispute ${status.toLowerCase()} successfully`);
      setRemarks('');
      setSelectedDispute(null);
      fetchData();
    } catch (err) {
      toast.error("Resolution failed");
    } finally {
      setResolving(false);
    }
  };

  const getStatusColor = (status) => {
    const map = {
      OPEN: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
      UNDER_REVIEW: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      PROVIDER_ESCALATED: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      RESOLVED: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      REJECTED: 'text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-[var(--border-soft)]'
    };
    return map[status] || map.OPEN;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center">
        <div className="space-y-0.5">
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">Dispute <span className="text-[var(--color-primary)]">Resolution</span></h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Master console for transaction conflict management</p>
        </div>
        <button 
          onClick={fetchData}
          className="p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/50 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* List */}
        <div className="lg:col-span-7 space-y-3.5">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-[var(--bg-secondary)] animate-pulse border border-[var(--border-soft)] rounded-xl" />
            ))
          ) : disputes.length > 0 ? (
            disputes.map((dispute) => (
              <motion.div 
                key={dispute.id}
                whileHover={{ y: -1 }}
                onClick={() => setSelectedDispute(dispute)}
                className={`p-5 bg-[var(--card-bg)] border rounded-xl cursor-pointer transition-all shadow-soft ${selectedDispute?.id === dispute.id ? 'border-[var(--color-primary)]' : 'border-[var(--border-soft)] hover:bg-[var(--accent-hover)]'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[var(--bg-secondary)] rounded-lg flex items-center justify-center border border-[var(--border-soft)]">
                      <User className="w-4 h-4 text-[var(--text-secondary)]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[var(--text-primary)]">{dispute.user?.name || 'Unknown User'}</p>
                      <p className="text-[9px] text-[var(--text-secondary)] font-mono mt-0.5">TXN: #{dispute.transactionId}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${getStatusColor(dispute.status)}`}>
                    {dispute.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-4 flex justify-between items-end">
                  <p className="text-[11px] text-[var(--text-secondary)] font-medium line-clamp-1 italic">"{dispute.description}"</p>
                  <p className="text-xs font-bold text-[var(--text-primary)]">₹{formatAmount(dispute.transaction?.amount)}</p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="py-20 text-center bg-[var(--bg-secondary)]/30 border border-dashed border-[var(--border-soft)] rounded-xl">
              <p className="text-xs text-[var(--text-secondary)] font-medium">No active conflicts detected</p>
            </div>
          )}
        </div>

        {/* Action Panel */}
        <div className="lg:col-span-5">
          <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl shadow-soft p-6 md:p-8 sticky top-6">
            {selectedDispute ? (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldAlert className="w-5 h-5 text-[var(--color-primary)]" />
                    <h2 className="text-base font-bold text-[var(--text-primary)] uppercase tracking-wider">Case Details</h2>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-soft)] text-xs text-[var(--text-secondary)]">
                    <div>
                      <p className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">Target Number</p>
                      <p className="font-bold text-[var(--text-primary)]">{selectedDispute.transaction?.mobile}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">Operator</p>
                      <p className="font-bold text-[var(--text-primary)] uppercase tracking-tight">{selectedDispute.transaction?.operator}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">TXN Status</p>
                      <p className="font-bold text-[var(--text-primary)] uppercase tracking-tight">{selectedDispute.transaction?.status}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">Timestamp</p>
                      <p className="font-semibold text-[var(--text-primary)]">{new Date(selectedDispute.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Customer Complaint</p>
                  <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl text-rose-500 font-medium italic text-xs leading-relaxed">
                    "{selectedDispute.description}"
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Resolution Actions</p>
                    <textarea 
                      className="w-full bg-[var(--admin-input-bg)] border border-[var(--border-soft)] text-[var(--text-primary)] rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-[var(--admin-focus-ring)] focus:border-[var(--color-primary)] min-h-[100px] resize-none leading-relaxed placeholder:text-[var(--text-muted)]"
                      placeholder="Add resolution remarks or evidence notes..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button 
                      onClick={() => handleResolve(selectedDispute.id, 'RESOLVED')}
                      disabled={resolving}
                      className="py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      Resolve Case
                    </button>
                    <button 
                      onClick={() => handleResolve(selectedDispute.id, 'REJECTED')}
                      disabled={resolving}
                      className="py-2.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-soft)] rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--bg-tertiary)] transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Reject Case
                    </button>
                  </div>
                  <button 
                    onClick={() => handleResolve(selectedDispute.id, 'PROVIDER_ESCALATED')}
                    disabled={resolving}
                    className="w-full py-2.5 bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--border-soft)] rounded-xl text-[10px] font-bold uppercase tracking-wider hover:opacity-95 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Escalate to Operator
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 space-y-3">
                <div className="w-12 h-12 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mx-auto border border-[var(--border-soft)]">
                  <MessageSquare className="w-5 h-5 text-[var(--text-secondary)]" />
                </div>
                <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Select a case to begin triage</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
