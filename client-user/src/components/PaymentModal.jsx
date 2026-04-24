import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, QrCode, Copy, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const PaymentModal = ({ isOpen, onClose, amount, onPaymentSuccess, title = "Complete Payment" }) => {
  const [step, setStep] = useState('pay'); // pay, verifying, success, failed
  const upiId = "demo@upi";

  useEffect(() => {
    if (!isOpen) {
      setStep('pay');
    }
  }, [isOpen]);

  const handlePaid = () => {
    setStep('verifying');
    // Simulate payment verification (2-5 seconds as requested)
    const delay = Math.floor(Math.random() * 3000) + 2000;
    setTimeout(() => {
      // In a real app, this would check with the backend
      // For this "Fake UPI" flow, we'll just succeed
      setStep('success');
      setTimeout(() => {
        onPaymentSuccess();
        onClose();
      }, 2000);
    }, delay);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(upiId);
    toast.success("UPI ID copied!");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 overflow-hidden relative"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          {step === 'pay' && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col items-center text-center">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Scan QR to Pay</p>
                <div className="bg-white p-3 rounded-lg shadow-sm mb-4">
                  <div className="w-48 h-48 bg-gray-100 flex items-center justify-center relative group">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${upiId}&pn=Dizipay&am=${amount}`}
                      alt="Payment QR"
                      className="w-full h-full"
                    />
                    <div className="absolute inset-0 bg-white/10 group-hover:bg-transparent transition-colors"></div>
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-2xl font-black text-gray-900">₹{Number(amount).toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">Amount to be paid</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white rounded flex items-center justify-center border border-gray-100">
                      <ShieldCheck className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">UPI ID</p>
                      <p className="text-sm font-mono font-bold text-gray-700">{upiId}</p>
                    </div>
                  </div>
                  <button 
                    onClick={copyToClipboard}
                    className="p-2 hover:bg-white rounded-md transition-colors border border-transparent hover:border-gray-200"
                  >
                    <Copy className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>

              <button
                onClick={handlePaid}
                className="w-full bg-[#6D28D9] text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-purple-200 hover:bg-[#5B21B6] transition-all active:scale-[0.98]"
              >
                I have paid ₹{amount}
              </button>
              
              <p className="text-center text-[10px] text-gray-400 uppercase font-bold tracking-tighter">
                Secure 256-bit encrypted payment
              </p>
            </div>
          )}

          {step === 'verifying' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-20 h-20 border-4 border-purple-100 border-t-purple-600 rounded-full"
                />
                <Loader2 className="w-8 h-8 text-purple-600 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="text-center">
                <h4 className="text-xl font-bold text-gray-900 mb-2">Verifying Payment</h4>
                <p className="text-sm text-gray-500 max-w-[200px]">Please wait while we confirm your transaction with the bank...</p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 10 }}
                className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center"
              >
                <CheckCircle className="w-14 h-14 text-green-600" />
              </motion.div>
              <div className="text-center">
                <h4 className="text-2xl font-black text-gray-900 mb-1">Payment Success!</h4>
                <p className="text-sm text-gray-500 font-medium">Wallet updated successfully</p>
                <div className="mt-4 px-4 py-2 bg-green-50 rounded-full inline-block">
                  <p className="text-xs font-bold text-green-700">TXN ID: DIZIPAY{Math.floor(Math.random() * 1000000)}</p>
                </div>
              </div>
            </div>
          )}

          {step === 'failed' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-14 h-14 text-red-600" />
              </div>
              <div className="text-center">
                <h4 className="text-2xl font-black text-gray-900 mb-1">Payment Failed</h4>
                <p className="text-sm text-gray-500 font-medium">Something went wrong with the transaction</p>
                <button
                  onClick={() => setStep('pay')}
                  className="mt-6 px-8 py-2 bg-gray-900 text-white rounded-lg font-bold hover:bg-black transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PaymentModal;
