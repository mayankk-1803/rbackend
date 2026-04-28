import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import PaymentModal from '../components/PaymentModal';
import RechargePaymentModal from '../components/RechargePaymentModal';

export default function MobileRecharge() {
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('');
  const [operatorLogo, setOperatorLogo] = useState('');
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (number.length === 10 && /^[6-9]\d{9}$/.test(number)) {
      const detectOperator = async () => {
        setDetecting(true);
        console.log(`[Detection] Fetching operator for: ${number}`);
        try {
          const { data } = await api.get(`/operator-detect/${number}`);
          if (data.success && data.data.operator) {
            setOperator(data.data.operator);
            setOperatorLogo(data.data.logo);
            console.log(`[Detection] Result:`, data.data);
            toast.success(`Detected: ${data.data.operator}`, { 
              icon: '📡',
              style: { borderRadius: '10px', background: '#333', color: '#fff' }
            });
          }
        } catch (err) {
          console.error("Operator detection failed", err);
        } finally {
          setDetecting(false);
        }
      };
      
      const timeoutId = setTimeout(detectOperator, 300); // 300ms debounce
      return () => clearTimeout(timeoutId);
    } else {
      setOperator('');
      setOperatorLogo('');
    }
  }, [number]);

  const handleRechargeDirectly = async () => {
    setShowRechargeModal(false);
    const loadingToast = toast.loading('Processing Mobile recharge...');
    setLoading(true);
    try {
      console.log("[Recharge] Initiating recharge directly from wallet...");
      const idempotencyKey = crypto.randomUUID();
      const safeOperator = operator || 'Unknown';
      const { data } = await api.post('/recharge', {
        mobile: number,
        amount: Number(amount),
        providerCode: safeOperator.toLowerCase(),
        operator: safeOperator,
        type: 'mobile'
      }, {
        headers: { 'x-idempotency-key': idempotencyKey }
      });
      
      console.log("[Recharge] Response:", data);

      toast.success(data.message || 'Recharge initiated', { id: loadingToast });
      navigate('/history');
    } catch(err) {
      console.error("[Recharge Error]:", err);
      const errorMsg = err.response?.data?.message || 'Recharge failed';
      toast.error(errorMsg, { id: loadingToast });
      
      if (errorMsg.includes("Insufficient")) {
        // Option to top up
        setShowPayment(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTopUpSuccess = async () => {
    console.log("[TopUp] Success, retrying recharge...");
    setShowPayment(false);
    await handleRechargeDirectly();
  };

  const handlePaymentFlow = async () => {
    try {
      console.log("[Payment] Creating TOPUP order for recharge...");
      const res = await api.post('/payment/create-order', {
        amount: Number(amount),
        upiId: 'demo@upi',
        intent: 'RECHARGE'
      }, {
        headers: {
          "x-idempotency-key": crypto.randomUUID()
        }
      });
      
      const paymentId = res.data.data.id;
      console.log("[Payment] Order created:", paymentId);

      console.log("[Payment] Confirming payment...");
      const confirmRes = await api.post('/payment/confirm', { paymentId });
      
      if (confirmRes.data.success) {
        console.log("[Payment] TOPUP Success, proceeding to recharge");
        await handleTopUpSuccess();
      } else {
        throw new Error("Payment confirmation failed");
      }
    } catch (err) {
      console.error("[Payment Error]:", err);
      toast.error(err.response?.data?.message || "Payment failed");
      setShowPayment(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-[#E5E7EB] bg-[#F8FAFC]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Mobile Recharge</h2>
          <p className="text-sm text-[#64748B] mt-1">Recharge your mobile number instantly</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setShowRechargeModal(true); }} className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">Mobile Number</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  maxLength="10"
                  value={number}
                  onChange={e => setNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-[#6D28D9] focus:border-[#6D28D9] sm:text-sm"
                  placeholder="Enter 10-digit mobile number"
                />
                {detecting && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <span className="animate-spin h-4 w-4 border-2 border-[#6D28D9] border-t-transparent rounded-full inline-block"></span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1">Operator</label>
                <div className="relative">
                  <div className="flex items-center gap-2 w-full px-3 py-2 border border-[#E5E7EB] bg-[#F8FAFC] rounded-md sm:text-sm text-[#0F172A]">
                    {operatorLogo ? (
                      <motion.img 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        src={operatorLogo} 
                        alt={operator} 
                        className="w-6 h-6 object-contain"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    ) : (
                      <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-[10px] text-gray-500 font-bold">?</span>
                      </div>
                    )}
                    <span className="font-medium">{operator || 'Detecting...'}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1">Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-[#6D28D9] focus:border-[#6D28D9] sm:text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-md p-4 text-sm text-[#64748B]">
            Ensure the details are correct. Recharge will be deducted from your wallet.
          </div>

          <div className="flex justify-end border-t border-[#E5E7EB] pt-6 mt-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              disabled={loading || !number || !amount}
              type="submit"
              className="px-6 py-2 bg-[#6D28D9] text-white font-medium rounded-md hover:bg-[#5B21B6] disabled:bg-[#94A3B8] disabled:cursor-not-allowed transition-colors text-sm shadow-sm"
            >
              {loading ? 'Processing...' : 'Recharge Now'}
            </motion.button>
          </div>
        </form>
      </div>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        amount={amount}
        onPaymentSuccess={handlePaymentFlow}
        title="Top Up Wallet & Recharge"
      />

      <RechargePaymentModal
        isOpen={showRechargeModal}
        onClose={() => setShowRechargeModal(false)}
        onConfirm={handleRechargeDirectly}
        amount={amount}
        mobile={number}
        operator={operator}
      />
    </motion.div>
  );
}