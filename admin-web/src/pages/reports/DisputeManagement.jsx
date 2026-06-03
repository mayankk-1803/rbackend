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
  ChevronRight,
  Info,
  UserCheck
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

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
      IN_PROGRESS: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
      PROVIDER_ESCALATED: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
      RESOLVED: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      REJECTED: 'text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-[var(--border-soft)]'
    };
    return map[status] || map.OPEN;
  };

  // Dynamic Statistics
  const totalCount = disputes.length;
  const openCount = disputes.filter(d => d.status === 'OPEN').length;
  const reviewCount = disputes.filter(d => d.status === 'UNDER_REVIEW' || d.status === 'IN_PROGRESS').length;
  const resolvedCount = disputes.filter(d => d.status === 'RESOLVED').length;
  const rejectedCount = disputes.filter(d => d.status === 'REJECTED').length;

  // Filter disputes
  const filteredDisputes = disputes.filter(d => {
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
    const matchesSearch = 
      searchTerm === '' ||
      d.id.toString().includes(searchTerm) ||
      d.transactionId.toString().includes(searchTerm) ||
      d.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.transaction?.mobile?.includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

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

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { title: "Total Disputes", count: totalCount, color: "text-[var(--text-primary)] bg-[var(--bg-secondary)]" },
          { title: "Open Cases", count: openCount, color: "text-rose-500 bg-rose-500/10" },
          { title: "Under Review", count: reviewCount, color: "text-amber-500 bg-amber-500/10" },
          { title: "Resolved", count: resolvedCount, color: "text-emerald-500 bg-emerald-500/10" },
          { title: "Rejected", count: rejectedCount, color: "text-[var(--text-secondary)] bg-[var(--bg-secondary)]" }
        ].map((c, i) => (
          <div key={i} className="p-5 border border-[var(--border-soft)] rounded-xl bg-[var(--card-bg)] shadow-xs">
            <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{c.title}</p>
            <p className={`text-xl font-bold ${c.color.split(' ')[0]}`}>{c.count}</p>
          </div>
        ))}
      </div>

      {/* Toolbar / Filters */}
      <div className="flex flex-wrap gap-4 bg-[var(--card-bg)] border border-[var(--border-soft)] p-4 rounded-xl shadow-xs">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input 
            type="text"
            placeholder="Search Dispute ID, TXN ID, Mobile, User..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs outline-none focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-[var(--text-primary)]"
          />
        </div>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
        >
          <option value="ALL">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="PROVIDER_ESCALATED">Escalated</option>
          <option value="RESOLVED">Resolved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table List */}
        <div className="lg:col-span-7 bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-soft)]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Details</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Status</th>
                  <th className="px-2 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)] text-xs text-[var(--text-primary)]">
                {loading ? (
                  Array(4).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-4 py-6"><div className="h-4 bg-[var(--bg-secondary)] rounded-full w-full"></div></td>
                    </tr>
                  ))
                ) : filteredDisputes.length > 0 ? (
                  filteredDisputes.map((dispute) => (
                    <tr 
                      key={dispute.id} 
                      onClick={() => {
                        setSelectedDispute(dispute);
                        setRemarks(dispute.remarks || '');
                      }}
                      className={`hover:bg-[var(--accent-hover)] transition-colors cursor-pointer ${selectedDispute?.id === dispute.id ? 'bg-[var(--color-primary-glow)]/40 font-semibold' : ''}`}
                    >
                      <td className="px-4 py-4">
                        <p className="font-bold text-[var(--color-primary)]">#{dispute.id}</p>
                        <p className="text-[9px] text-[var(--text-secondary)] font-mono mt-0.5">{new Date(dispute.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold">{dispute.user?.name || 'System User'}</p>
                        <p className="text-[9px] text-[var(--text-secondary)] font-mono mt-0.5">{dispute.user?.phone || 'N/A'}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold uppercase tracking-tight text-[10px]">{dispute.transaction?.operator || 'Telecom'}</p>
                        <p className="text-[9px] text-[var(--text-secondary)] mt-0.5 truncate max-w-[150px]">{dispute.description}</p>
                      </td>
                      <td className="px-4 py-4 font-bold">
                        ₹{formatAmount(dispute.transaction?.amount)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${getStatusColor(dispute.status)}`}>
                          {dispute.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-2 py-4 text-right">
                        <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-xs text-[var(--text-secondary)] font-medium">
                      No active conflicts detected
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Triage Panel */}
        <div className="lg:col-span-5">
          <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl shadow-soft p-6 md:p-8 sticky top-6">
            {selectedDispute ? (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldAlert className="w-5 h-5 text-[var(--color-primary)]" />
                    <h2 className="text-base font-bold text-[var(--text-primary)] uppercase tracking-wider">Triage Panel</h2>
                  </div>
                  
                  {/* Dispute Details section */}
                  <div className="space-y-4">
                    <div className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-soft)] space-y-2">
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest border-b border-[var(--border-soft)] pb-1.5 flex justify-between">
                        <span>Dispute Information</span>
                        <span className="text-[var(--color-primary)]">ID: #{selectedDispute.id}</span>
                      </p>
                      <div className="grid grid-cols-2 gap-y-2 text-xs">
                        <div>
                          <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide">Case Status</p>
                          <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-bold uppercase border mt-0.5 ${getStatusColor(selectedDispute.status)}`}>
                            {selectedDispute.status}
                          </span>
                        </div>
                        <div>
                          <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide">Priority</p>
                          <span className="inline-block px-2 py-0.5 rounded text-[8px] font-bold uppercase border mt-0.5 text-amber-500 bg-amber-500/10 border-amber-500/20">
                            MEDIUM
                          </span>
                        </div>
                        <div>
                          <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide">Created At</p>
                          <p className="font-semibold text-[var(--text-primary)] mt-0.5">{new Date(selectedDispute.createdAt).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide">Assignee</p>
                          <p className="font-semibold text-[var(--text-primary)] mt-0.5 flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-indigo-400" /> Unassigned
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Transaction Details section */}
                    <div className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-soft)] space-y-2">
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest border-b border-[var(--border-soft)] pb-1.5">
                        Transaction Information
                      </p>
                      <div className="grid grid-cols-2 gap-y-2 text-xs">
                        <div>
                          <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide">Transaction ID</p>
                          <p className="font-bold text-[var(--text-primary)] mt-0.5">#{selectedDispute.transactionId}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide">Target Mobile</p>
                          <p className="font-bold text-[var(--text-primary)] mt-0.5">{selectedDispute.transaction?.mobile || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide">Operator / Type</p>
                          <p className="font-bold text-[var(--text-primary)] uppercase tracking-tight mt-0.5">{selectedDispute.transaction?.operator} ({selectedDispute.type})</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide">Amount Charged</p>
                          <p className="font-bold text-[var(--text-primary)] mt-0.5">₹{formatAmount(selectedDispute.transaction?.amount)}</p>
                        </div>
                        {selectedDispute.transaction?.providerRefId && (
                          <div className="col-span-2">
                            <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide">Provider Ref ID</p>
                            <p className="font-mono text-[10px] text-[var(--text-primary)] mt-0.5">{selectedDispute.transaction.providerRefId}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* User Details section */}
                    <div className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-soft)] space-y-2">
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest border-b border-[var(--border-soft)] pb-1.5">
                        Customer Information
                      </p>
                      <div className="grid grid-cols-2 gap-y-2 text-xs">
                        <div>
                          <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide">Name</p>
                          <p className="font-bold text-[var(--text-primary)] mt-0.5">{selectedDispute.user?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide">Phone Number</p>
                          <p className="font-bold text-[var(--text-primary)] mt-0.5">{selectedDispute.user?.phone || 'N/A'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wide">Email Address</p>
                          <p className="font-bold text-[var(--text-primary)] mt-0.5">{selectedDispute.user?.email || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide ml-0.5">Customer Message</p>
                  <div className="p-3.5 bg-rose-500/5 border border-rose-500/20 rounded-xl text-rose-500 font-medium italic text-xs leading-relaxed">
                    "{selectedDispute.description}"
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide ml-0.5">Resolution Notes & Remarks</p>
                    <textarea 
                      className="w-full bg-[var(--admin-input-bg)] border border-[var(--border-soft)] text-[var(--text-primary)] rounded-xl p-3.5 text-xs outline-none focus:ring-2 focus:ring-[var(--admin-focus-ring)] focus:border-[var(--color-primary)] min-h-[100px] resize-none leading-relaxed placeholder:text-[var(--text-muted)]"
                      placeholder="Add resolution remarks or evidence notes..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button 
                      onClick={() => handleResolve(selectedDispute.id, 'RESOLVED')}
                      disabled={resolving}
                      className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      Resolve Case
                    </button>
                    <button 
                      onClick={() => handleResolve(selectedDispute.id, 'REJECTED')}
                      disabled={resolving}
                      className="py-3 bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-soft)] hover:bg-[var(--bg-tertiary)] rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Reject Case
                    </button>
                  </div>
                  <button 
                    onClick={() => handleResolve(selectedDispute.id, 'UNDER_REVIEW')}
                    disabled={resolving}
                    className="w-full py-3 bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--border-soft)] hover:opacity-95 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Mark Under Review
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-24 space-y-3.5">
                <div className="w-12 h-12 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mx-auto border border-[var(--border-soft)]">
                  <MessageSquare className="w-5 h-5 text-[var(--text-secondary)] animate-pulse" />
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
