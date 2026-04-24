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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">{title}</h3>
              {step === 'confirm' && (
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="p-8">
              {step === 'confirm' && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="space-y-8"
                >
                  {/* Summary Card */}
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 rounded-full bg-white border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                        {operatorLogo ? (
                          <img src={operatorLogo} alt={operator} className="w-10 h-10 object-contain" />
                        ) : (
                          <Zap className="w-6 h-6 text-[#6D28D9]" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">{operator || 'Mobile'}</p>
                        <p className="text-xl font-bold text-gray-900">{mobile}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200 flex justify-between items-end">
                      <span className="text-gray-600 font-medium">Recharge Amount</span>
                      <span className="text-3xl font-black text-[#6D28D9]">₹{amount}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <button
                      onClick={handleConfirm}
                      className="w-full py-4 bg-[#6D28D9] text-white font-bold rounded-xl shadow-lg shadow-purple-200 hover:bg-[#5B21B6] transition-all transform active:scale-95"
                    >
                      Confirm & Pay
                    </button>
                    <button
                      onClick={onClose}
                      className="w-full py-4 bg-white text-gray-600 font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                  
                  <p className="text-center text-xs text-gray-400 italic">
                    Amount will be deducted from your wallet balance instantly.
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
                    <Loader2 className="w-16 h-16 text-[#6D28D9] animate-spin" />
                    <Zap className="w-6 h-6 text-[#6D28D9] absolute inset-0 m-auto" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">Processing Recharge</h4>
                    <p className="text-gray-500 mt-2">Communicating with {operator} server...</p>
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
