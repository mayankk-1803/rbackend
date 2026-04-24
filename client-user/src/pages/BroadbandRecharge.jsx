import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import PaymentModal from '../components/PaymentModal';

export default function BroadbandRecharge() {
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('Airtel Broadband');
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const navigate = useNavigate();

  const handleRechargeDirectly = async () => {
    if(!number || !amount) return;

    const loadingToast = toast.loading('Processing Broadband bill payment...');
    setLoading(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const { data } = await api.post('/api/recharge', {
        mobile: number,
        amount: Number(amount),
        operator,
        type: 'broadband'
      }, {
        headers: { 'x-idempotency-key': idempotencyKey }
      });
      toast.success(data.message || 'Payment initiated', { id: loadingToast });
      navigate('/history');
    } catch(err) {
      console.error("[Broadband Error]:", err);
      const errorMsg = err.response?.data?.message || 'Payment failed';
      toast.error(errorMsg, { id: loadingToast });
      
      if (errorMsg.includes("Insufficient")) {
        setShowPayment(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTopUpSuccess = async () => {
    console.log("[TopUp] Success, retrying broadband payment...");
    setShowPayment(false);
    await handleRechargeDirectly();
  };

  const handlePaymentFlow = async () => {
    try {
      console.log("[Payment] Creating order for broadband...");
      const res = await api.post('/api/payment/create-order', {
        amount: Number(amount),
        upiId: 'demo@upi',
        intent: 'WALLET_TOPUP'
      });
      
      const paymentId = res.data.data._id;
      console.log("[Payment] Order created:", paymentId);

      console.log("[Payment] Confirming payment...");
      const confirmRes = await api.post('/api/payment/confirm', { paymentId });
      
      if (confirmRes.data.success) {
        console.log("[Payment] Success, proceeding to broadband payment");
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
          <h2 className="text-lg font-semibold text-[#0F172A]">Broadband Bill Payment</h2>
          <p className="text-sm text-[#64748B] mt-1">Pay your broadband bill instantly</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleRechargeDirectly(); }} className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">Account Number</label>
              <input
                type="text"
                required
                value={number}
                onChange={e => setNumber(e.target.value)}
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-[#6D28D9] focus:border-[#6D28D9] sm:text-sm"
                placeholder="Enter account number"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1">Broadband Provider</label>
                <select
                  value={operator}
                  onChange={e => setOperator(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E7EB] bg-white rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-[#6D28D9] focus:border-[#6D28D9] sm:text-sm text-[#0F172A]"
                >
                  <option value="Airtel Broadband">Airtel Broadband</option>
                  <option value="Jio Fiber">Jio Fiber</option>
                  <option value="ACT">ACT Broadband</option>
                  <option value="Hathway">Hathway Broadband</option>
                  <option value="Excitel">Excitel Broadband</option>
                </select>
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
            Ensure the details are correct. The amount will be deducted from your wallet balance instantly.
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
        title="Broadband Bill Payment"
      />
    </motion.div>
  );
}