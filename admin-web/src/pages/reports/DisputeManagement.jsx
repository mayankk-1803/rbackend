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
      toast.error("Failed to load global disputes");
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
      OPEN: 'text-rose-600 bg-rose-50 border-rose-100',
      UNDER_REVIEW: 'text-amber-600 bg-amber-50 border-amber-100',
      PROVIDER_ESCALATED: 'text-indigo-600 bg-indigo-50 border-indigo-100',
      RESOLVED: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      REJECTED: 'text-slate-500 bg-slate-50 border-slate-200'
    };
    return map[status] || map.OPEN;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 p-6 lg:p-8"
    >
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Dispute <span className="text-rose-600">Resolution</span></h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Master console for transaction conflict management</p>
        </div>
        <button 
          onClick={fetchData}
          className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-rose-600 transition-all"
        >
          <RefreshCw className={`w-5 h-5 text-rose-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* List */}
        <div className="lg:col-span-7 space-y-4">
          {loading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-white border border-slate-100 rounded-3xl animate-pulse" />
            ))
          ) : disputes.length > 0 ? (
            disputes.map((dispute) => (
              <motion.div 
                key={dispute.id}
                whileHover={{ scale: 1.01 }}
                onClick={() => setSelectedDispute(dispute)}
                className={`p-6 bg-white border rounded-3xl cursor-pointer transition-all ${selectedDispute?.id === dispute.id ? 'border-rose-500 ring-4 ring-rose-500/5' : 'border-slate-100 hover:border-slate-200 shadow-sm'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{dispute.user?.name || 'Unknown User'}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">TXN: #{dispute.transactionId}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(dispute.status)}`}>
                    {dispute.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-4 flex justify-between items-end">
                  <p className="text-xs text-slate-500 font-medium line-clamp-1 italic">"{dispute.description}"</p>
                  <p className="text-[10px] font-black text-slate-900">₹{formatAmount(dispute.transaction?.amount)}</p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="py-20 text-center bg-slate-50 border border-slate-100 rounded-[2.5rem] border-dashed">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No active conflicts detected</p>
            </div>
          )}
        </div>

        {/* Action Panel */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl p-8 sticky top-8">
            {selectedDispute ? (
              <div className="space-y-8">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <ShieldAlert className="w-6 h-6 text-rose-600" />
                    <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">Case <span className="text-rose-600">Details</span></h2>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Number</p>
                      <p className="text-xs font-black text-slate-900">{selectedDispute.transaction?.mobile}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Operator</p>
                      <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{selectedDispute.transaction?.operator}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">TXN Status</p>
                      <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{selectedDispute.transaction?.status}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Timestamp</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">{new Date(selectedDispute.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Customer Complaint</p>
                  <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl">
                    <p className="text-xs text-rose-900 font-medium italic leading-relaxed">"{selectedDispute.description}"</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Resolution Actions</p>
                  <textarea 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] resize-none"
                    placeholder="Add resolution remarks or evidence notes..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => handleResolve(selectedDispute.id, 'RESOLVED')}
                      disabled={resolving}
                      className="py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                    >
                      Resolve Case
                    </button>
                    <button 
                      onClick={() => handleResolve(selectedDispute.id, 'REJECTED')}
                      disabled={resolving}
                      className="py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
                    >
                      Reject Case
                    </button>
                  </div>
                  <button 
                    onClick={() => handleResolve(selectedDispute.id, 'PROVIDER_ESCALATED')}
                    disabled={resolving}
                    className="w-full py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all disabled:opacity-50"
                  >
                    Escalate to Operator
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <MessageSquare className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Select a case to begin triage</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
