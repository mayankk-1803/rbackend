import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Loader2, Phone, Zap } from 'lucide-react';

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
    // 2-3 sec fake loading as requested
    await new Promise(resolve => setTimeout(resolve, 2500));
    onConfirm();
  };

  const getOperatorLogo = (op) => {
    const name = op?.toLowerCase() || '';
    if (name.includes('jio')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Reliance_Jio_Logo.svg/1200px-Reliance_Jio_Logo.svg.png";
    if (name.includes('airtel')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Airtel_logo.svg/1024px-Airtel_logo.svg.png";
    if (name.includes('vi') || name.includes('idea') || name.includes('vodafone')) return "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Vi_logo.svg/1200px-Vi_logo.svg.png";
    if (name.includes('bsnl')) return "https://upload.wikimedia.org/wikipedia/en/thumb/d/d7/BSNL_Logo.svg/1200px-BSNL_Logo.svg.png";
    return null;
  };

  const operatorLogo = getOperatorLogo(operator);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-900/20 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">{title}</h3>
              {step === 'confirm' && (
                <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors p-2 hover:bg-slate-100 rounded-full">
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
                  <div className="bg-slate-50 rounded-2xl p-5 md:p-6 border border-slate-100 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center gap-4 mb-6 relative z-10">
                      <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden shadow-sm">
                        {operatorLogo ? (
                          <img src={operatorLogo} alt={operator} className="w-8 h-8 md:w-10 md:h-10 object-contain" />
                        ) : (
                          <Zap className="w-6 h-6 text-cyan-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{operator || 'Mobile'}</p>
                        <p className="text-lg md:text-xl font-black text-slate-900 tracking-tight">{mobile}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-between items-end relative z-10">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Settle Amount</span>
                      <span className="text-2xl md:text-3xl font-black text-cyan-600 tracking-tighter">₹{amount}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <button
                      onClick={handleConfirm}
                      className="w-full py-4 bg-cyan-600 text-white font-black rounded-xl shadow-lg shadow-cyan-600/10 hover:bg-cyan-700 transition-all transform active:scale-95 text-xs uppercase tracking-widest"
                    >
                      Authorize Transaction
                    </button>
                    <button
                      onClick={onClose}
                      className="w-full py-4 bg-slate-50 text-slate-400 font-black rounded-xl border border-slate-100 hover:bg-slate-100 hover:text-slate-900 transition-all text-xs uppercase tracking-widest"
                    >
                      Abort Sequence
                    </button>
                  </div>
                  
                  <p className="text-center text-[8px] text-slate-400 font-black uppercase tracking-widest italic">
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
                    <Loader2 className="w-16 h-16 text-cyan-600 animate-spin" />
                    <Zap className="w-6 h-6 text-cyan-600 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Processing <span className="text-cyan-600">Signal</span></h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Communicating with {operator} gateway...</p>
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
