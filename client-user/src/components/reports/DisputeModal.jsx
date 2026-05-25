import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, AlertCircle, Info, ShieldAlert, CheckCircle2 } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';

export const DisputeModal = ({ isOpen, onClose, transaction }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!transaction) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // Prevent double clicks
    
    if (!transaction?.id) {
      return toast.error("Invalid transaction selection");
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      return toast.error("Please provide a reason for the dispute");
    }

    if (trimmedReason.length < 10) {
      return toast.error("Dispute reason must be at least 10 characters long");
    }

    setLoading(true);
    try {
      const res = await api.post('/disputes', {
        transactionId: transaction.id,
        reason: trimmedReason,
        type: 'TRANSACTION_ISSUE'
      });
      setSuccess(true);
      toast.success(res?.data?.message || "Dispute raised successfully");
      setTimeout(() => {
        setSuccess(false);
        setReason('');
        onClose();
      }, 2000);
    } catch (err) {
      toast.error(err?.safeMessage || err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg glass-modal shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden border border-white/10 rounded-[2.5rem]"
          >
            <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-slate-950/20">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 text-rose-400 rose-glow" />
                <h2 className="text-xl font-black text-white tracking-tighter uppercase italic">Raise <span className="text-rose-400 rose-glow">Dispute</span></h2>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-900/50 rounded-full transition-colors text-slate-400 hover:text-white cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8">
              {success ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-12"
                >
                  <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 emerald-glow" />
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tighter uppercase mb-2">Submission Received</h3>
                  <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Case ID: #{transaction.id}_DIS</p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl flex gap-3">
                    <Info className="w-5 h-5 text-indigo-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Transaction Details</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        {transaction.operator} | ₹{transaction.amount} | {transaction.mobile}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block px-2">Reason for dispute</label>
                    <textarea 
                      className="w-full glass-input rounded-2xl p-4 text-sm text-white outline-none focus:border-rose-500 transition-all min-h-[120px] resize-none"
                      placeholder="e.g. Balance deducted but recharge not received, wrong amount charged, etc."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>

                  <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    <p className="text-[9px] text-rose-400 font-bold uppercase leading-relaxed tracking-widest">
                      Misuse of the dispute system or providing false information may lead to account suspension.
                    </p>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-rose-500 hover:bg-rose-400 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all shadow-xl shadow-rose-500/20 flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? <span className="animate-spin text-lg">◌</span> : <><Send className="w-4 h-4" /> Finalize Submission</>}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
