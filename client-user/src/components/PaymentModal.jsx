import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { formatAmount } from '../utils/helpers';

export default function PaymentModal({ isOpen, onClose, amount, onPaymentSuccess, onSuccess, title = "Recharge" }) {
  if (!isOpen) return null;

  const handlePayment = async () => {
    if (onPaymentSuccess) {
      await onPaymentSuccess();
    }
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 md:p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-[var(--glass-modal-bg)] backdrop-blur-2xl rounded-2xl md:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-[var(--glass-border)] relative"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--bg-secondary)]/20">
            <h2 className="text-lg font-black text-[var(--text-color)] uppercase italic tracking-tighter">{title} <span className="text-[var(--color-primary)]">Payment</span></h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-[var(--glass-button-bg)] rounded-full transition-colors text-[var(--text-secondary)] hover:text-[var(--text-color)] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-8">
            <div className="text-center mb-8">
              <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.2em] mb-1">Authorization Amount</p>
              <h3 className="text-4xl md:text-5xl font-black text-[var(--text-color)] tracking-tighter">₹{formatAmount(amount)}</h3>
            </div>

            <div className="space-y-6">
              <div className="bg-[var(--bg-secondary)]/40 p-5 rounded-2xl border border-[var(--glass-border)] relative overflow-hidden group">
                <div className="absolute inset-0 bg-[var(--color-primary-glow)] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10 flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 bg-[var(--color-primary-glow)] border border-[var(--color-primary)]/20 text-[var(--color-primary)] rounded-xl flex items-center justify-center font-black text-xs shadow-md">
                    UPI
                  </div>
                  <div>
                    <p className="text-sm font-black text-[var(--text-color)] uppercase tracking-tight">Dizipay Wallet Secure</p>
                    <p className="text-[8px] text-[var(--color-primary)]/60 font-black uppercase tracking-widest">Bank-Grade Encryption Active</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 ml-auto" />
                </div>
                <div className="flex gap-1.5 relative z-10">
                  <div className="flex-1 h-1 bg-emerald-500/30 rounded-full overflow-hidden">
                    <motion.div initial={{ x: '-100%' }} animate={{ x: '0%' }} transition={{ duration: 1 }} className="h-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></motion.div>
                  </div>
                  <div className="flex-1 h-1 bg-emerald-500/30 rounded-full overflow-hidden">
                    <motion.div initial={{ x: '-100%' }} animate={{ x: '0%' }} transition={{ duration: 1, delay: 0.2 }} className="h-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></motion.div>
                  </div>
                  <div className="flex-1 h-1 bg-emerald-500/30 rounded-full overflow-hidden">
                    <motion.div initial={{ x: '-100%' }} animate={{ x: '0%' }} transition={{ duration: 1, delay: 0.4 }} className="h-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></motion.div>
                  </div>
                </div>
              </div>

              <button 
                onClick={handlePayment}
                className="w-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:opacity-90 text-white py-5 rounded-2xl font-black text-xs md:text-sm uppercase tracking-[0.2em] shadow-lg shadow-[var(--color-primary-glow)] transition-all active:scale-[0.98] cursor-pointer border-none"
              >
                Execute Secure Payment
              </button>

              <div className="flex items-center justify-center gap-2 pt-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span className="text-[8px] text-[var(--text-muted)] font-black uppercase tracking-widest">PCI-DSS COMPLIANT • SECURED TRANSACTION</span>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-secondary)]/20 px-8 py-4 border-t border-[var(--glass-border)]">
            <div className="flex justify-between items-center text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">
              <span>Sequence ID</span>
              <span className="font-mono text-[var(--text-secondary)]">TXN_{Math.floor(Math.random() * 1000000)}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
