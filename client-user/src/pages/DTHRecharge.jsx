import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import PaymentModal from '../components/PaymentModal';
import RechargePaymentModal from '../components/RechargePaymentModal';

export default function DTHRecharge() {
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('Tata Sky');
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const navigate = useNavigate();

  const handleRechargeDirectly = async () => {
    setShowRechargeModal(false);
    const loadingToast = toast.loading('Processing DTH recharge...');
    setLoading(true);
    try {
      console.log("[DTH] Initiating recharge directly from wallet...");
      const idempotencyKey = crypto.randomUUID();
      const { data } = await api.post('/api/recharge', {
        mobile: number,
        amount: Number(amount),
        operator,
        type: 'dth'
      }, {
        headers: { 'x-idempotency-key': idempotencyKey }
      });
      
      console.log("[DTH] Response:", data);

      toast.success(data.message || 'Recharge initiated', { id: loadingToast });
      navigate('/history');
    } catch(err) {
      console.error("[DTH Error]:", err);
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
      console.log("[Payment] Creating TOPUP order for DTH...");
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
        console.log("[Payment] TOPUP Success, proceeding to DTH recharge");
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

  return (    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-[#E5E7EB] bg-[#F8FAFC]">
          <h2 className="text-lg font-semibold text-[#0F172A]">DTH Recharge</h2>
          <p className="text-sm text-[#64748B] mt-1">Recharge your DTH set-top box instantly</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setShowRechargeModal(true); }} className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">Subscriber ID / VC Number</label>
              <input
                type="text"
                required
                value={number}
                onChange={e => setNumber(e.target.value)}
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-[#6D28D9] focus:border-[#6D28D9] sm:text-sm"
                placeholder="Enter subscriber ID or VC number"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1">DTH Provider</label>
                <select
                  value={operator}
                  onChange={e => setOperator(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E7EB] bg-white rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-[#6D28D9] focus:border-[#6D28D9] sm:text-sm text-[#0F172A]"
                >
                  <option value="Tata Sky">Tata Sky</option>
                  <option value="Dish TV">Dish TV</option>
                  <option value="Airtel Digital">Airtel Digital</option>
                  <option value="Sun Direct">Sun Direct</option>
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