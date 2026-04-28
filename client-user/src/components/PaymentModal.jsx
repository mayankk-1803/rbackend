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
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden border border-[#E5E7EB]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#E5E7EB] flex justify-between items-center bg-[#F8FAFC]">
            <h2 className="text-lg font-bold text-[#0F172A]">{title} Payment</h2>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-[#E2E8F0] rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-[#64748B]" />
            </button>
          </div>

          <div className="p-8">
            <div className="text-center mb-8">
              <p className="text-sm text-[#64748B] font-medium mb-1">Total Payable Amount</p>
              <h3 className="text-4xl font-bold text-[#0F172A]">₹{formatAmount(amount)}</h3>
            </div>

            <div className="space-y-4">
              <div className="bg-[#F8FAFC] p-4 rounded-lg border border-[#E5E7EB]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-[#6D28D9] rounded-md flex items-center justify-center text-white font-bold text-xs">
                    UPI
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0F172A]">Dizipay UPI Secure</p>
                    <p className="text-[10px] text-[#64748B] font-medium uppercase tracking-wider">Fast & Reliable</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-600 ml-auto" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 h-1.5 bg-green-500 rounded-full"></div>
                  <div className="flex-1 h-1.5 bg-green-500 rounded-full"></div>
                  <div className="flex-1 h-1.5 bg-green-500 rounded-full"></div>
                </div>
              </div>

              <button 
                onClick={handlePayment}
                className="w-full bg-[#6D28D9] hover:bg-[#5B21B6] text-white py-4 rounded-lg font-bold text-lg shadow-lg shadow-[#6D28D9]/20 transition-all active:scale-[0.98]"
              >
                Pay Securely
              </button>

              <div className="flex items-center justify-center gap-2 pt-4">
                <ShieldCheck className="w-4 h-4 text-[#64748B]" />
                <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-widest">PCI-DSS Compliant • 256-bit SSL</span>
              </div>
            </div>
          </div>

          <div className="bg-[#F8FAFC] px-8 py-4 border-t border-[#E5E7EB]">
            <div className="flex justify-between items-center text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
              <span>Transaction ID</span>
              <span>TXN_{Math.floor(Math.random() * 1000000)}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
