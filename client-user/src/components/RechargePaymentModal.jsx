import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Loader2, Phone, Zap } from 'lucide-react';
import OperatorLogo from './OperatorLogo';

export default function RechargePaymentModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  amount, 
  mobile, 
  operator,
  title = "Confirm Recharge" 
}) {
  const [step, setStep] = useState('confirm'); // confirm | loading | success

  useEffect(() => {
    if (isOpen) {
      setStep('confirm');
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    setStep('loading');
    await onConfirm();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-md bg-[var(--glass-modal-bg)] backdrop-blur-2xl rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden border border-[var(--glass-border)]"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--bg-secondary)]/20">
              <h3 className="text-lg font-black text-[var(--text-color)] uppercase italic tracking-tighter">{title}</h3>
              {step === 'confirm' && (
                <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-colors p-2 hover:bg-[var(--glass-button-bg)] rounded-full cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="p-6 md:p-8">
              {step === 'confirm' && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="space-y-6 md:space-y-8"
                >
                  {/* Summary Card */}
                  <div className="bg-[var(--bg-secondary)]/40 rounded-2xl p-5 md:p-6 border border-[var(--glass-border)] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[var(--color-primary-glow)] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center gap-4 mb-6 relative z-10">
                      <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shadow-sm">
                        {operator ? (
                          <OperatorLogo operator={operator} imageClassName="w-8 h-8 md:w-10 md:h-10" />
                        ) : (
                          <Zap className="w-6 h-6 text-[var(--color-primary)]" />
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest">{operator || 'Mobile'}</p>
                        <p className="text-lg md:text-xl font-black text-[var(--text-color)] tracking-tight">{mobile}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[var(--glass-border)] flex justify-between items-end relative z-10">
                      <span className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest">Settle Amount</span>
                      <span className="text-2xl md:text-3xl font-black text-[var(--color-primary)]">₹{amount}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <button
                      onClick={handleConfirm}
                      className="w-full py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:opacity-90 text-white font-black rounded-xl shadow-lg shadow-[var(--color-primary-glow)] transition-all transform active:scale-95 text-xs uppercase tracking-widest cursor-pointer border-none"
                    >
                      Authorize Transaction
                    </button>
                    <button
                      onClick={onClose}
                      className="w-full py-4 bg-[var(--glass-button-bg)] text-[var(--text-color)] font-black rounded-xl border border-[var(--glass-border)] hover:bg-[var(--glass-border-hover)] transition-all text-xs uppercase tracking-widest cursor-pointer"
                    >
                      Abort Sequence
                    </button>
                  </div>
                  
                  <p className="text-center text-[8px] text-[var(--text-muted)] font-black uppercase tracking-widest italic">
                    Credits will be deducted from your vault balance.
                  </p>
                </motion.div>
              )}

              {step === 'loading' && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-12 flex flex-col items-center justify-center text-center space-y-6"
                >
                  <div className="relative">
                    <Loader2 className="w-16 h-16 text-[var(--color-primary)] animate-spin" />
                    <Zap className="w-6 h-6 text-[var(--color-accent)] absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-[var(--text-color)] uppercase italic tracking-tighter">Secure <span className="text-[var(--color-primary)]">Payment</span></h4>
                    <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest mt-2">Processing Payment</p>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
