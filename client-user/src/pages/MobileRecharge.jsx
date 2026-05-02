import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import PaymentModal from '../components/PaymentModal';
import RechargePaymentModal from '../components/RechargePaymentModal';

import { io } from "socket.io-client";

export default function MobileRecharge() {
  const [rechargeStatus, setRechargeStatus] = useState('IDLE'); // IDLE, PROCESSING, SUCCESS, FAILED
  const [txnId, setTxnId] = useState(null);
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

  // Task 3 & 4: Real-time Sync + Fallback
  useEffect(() => {
    if (!txnId || rechargeStatus !== 'PROCESSING') return;

    const socket = io("http://localhost:5000");

    const handleSuccess = (data) => {
      if (String(data.txnId) === String(txnId)) {
        setRechargeStatus('SUCCESS');
        toast.success("Recharge Successful! ✅", { id: 'recharge-status' });
        setTimeout(() => navigate('/history'), 2000);
      }
    };

    const handleFailure = (data) => {
      if (String(data.txnId) === String(txnId)) {
        setRechargeStatus('FAILED');
        toast.error("Recharge Failed ❌. Refunded to wallet.", { id: 'recharge-status' });
      }
    };

    socket.on("recharge_success", handleSuccess);
    socket.on("recharge_failed", handleFailure);
    socket.on("recharge_update", (data) => {
      if (String(data.txnId) === String(txnId)) {
        if (data.status === 'SUCCESS') handleSuccess(data);
        if (data.status === 'FAILED') handleFailure(data);
      }
    });

    // Fallback: Check DB status after 10 seconds
    const fallbackTimeout = setTimeout(async () => {
      try {
        const { data } = await api.get(`/status/${txnId}`);
        if (data.success) {
          if (data.data.status === 'SUCCESS') {
            setRechargeStatus('SUCCESS');
            toast.success("Recharge Confirmed! ✅", { id: 'recharge-status' });
            setTimeout(() => navigate('/history'), 2000);
          } else if (data.data.status === 'FAILED') {
            setRechargeStatus('FAILED');
            toast.error("Recharge Failed (Confirmed) ❌", { id: 'recharge-status' });
          }
        }
      } catch (err) {
        console.error("Fallback check failed", err);
      }
    }, 10000);

    return () => {
      socket.disconnect();
      clearTimeout(fallbackTimeout);
    };
  }, [txnId, rechargeStatus, navigate]);

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

      if (data.success && data.data.status === "PENDING") {
        const newTxnId = data.data.id;
        setTxnId(newTxnId);
        setRechargeStatus('PROCESSING');
        toast.loading('Processing ⏳', { id: loadingToast });
      } else if (data.success && data.data.status === "SUCCESS") {
        setRechargeStatus('SUCCESS');
        toast.success("Recharge Successful ✅", { id: loadingToast });
        setTimeout(() => navigate('/history'), 2000);
      }
      
      // We don't navigate yet if PENDING, we wait for socket/polling status
    } catch(err) {
      setRechargeStatus('FAILED');
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-4 md:space-y-8"
    >
      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl md:rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.3)] overflow-hidden">
        <div className="px-6 md:px-8 py-5 md:py-6 border-b border-white/10 bg-white/[0.02]">
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight drop-shadow-md">Mobile Recharge</h2>
          <p className="text-[10px] md:text-sm text-slate-400 mt-1 font-medium tracking-wide">Instant power-up for your connection</p>
        </div>

        <div className="p-6 md:p-8 space-y-6 md:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Left: Input Form */}
            <div className="space-y-4 md:space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Mobile Number</label>
                <div className="relative group">
                  <input
                    type="text"
                    required
                    maxLength="10"
                    value={number}
                    onChange={e => setNumber(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 transition-all text-lg font-bold tracking-wider group-hover:border-white/20"
                    placeholder="Enter 10-digit number"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                    {detecting && (
                      <span className="animate-spin h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full"></span>
                    )}
                    {operator && (
                      <motion.div 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 bg-cyan-400/10 border border-cyan-400/30 px-3 py-1 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                      >
                        {operatorLogo && (
                          <img src={operatorLogo} alt={operator} className="w-4 h-4 object-contain" />
                        )}
                        <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">{operator}</span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Amount (₹)</label>
                <div className="relative group">
                  <input
                    type="number"
                    required
                    min="1"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400 transition-all text-lg font-bold group-hover:border-white/20"
                    placeholder="0.00"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                    {/* Symbol is already in input for simplicity or can be absolute */}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Quick Info/Feedback */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 md:p-6 flex md:flex-col justify-between md:justify-center items-center text-left md:text-center gap-4">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-xl md:rounded-2xl flex items-center justify-center border border-white/10 shadow-inner flex-shrink-0">
                <span className="text-xl md:text-3xl">⚡</span>
              </div>
              <div className="flex-1">
                <h4 className="text-white text-xs md:text-sm font-bold tracking-tight">Cyber-Fast Processing</h4>
                <p className="text-[10px] text-slate-500 mt-0.5 md:mt-1 max-w-[200px]">Your recharge is processed through our high-speed primary gateway.</p>
              </div>
            </div>
          </div>

          {/* Browse Plans Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Recommended Plans</h3>
              <div className="h-[1px] flex-1 mx-4 bg-white/10"></div>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar">
              {[
                { id: 1, price: 299, data: '2GB/Day', validity: '28 Days', desc: 'Unlimited Calls + 100 SMS/Day' },
                { id: 2, price: 666, data: '1.5GB/Day', validity: '84 Days', desc: 'Unlimited Calls + Disney+ Hotstar' },
                { id: 3, price: 719, data: '2GB/Day', validity: '84 Days', desc: 'Truly Unlimited + Prime Video' },
                { id: 4, price: 155, data: '1GB Total', validity: '24 Days', desc: 'Budget Plan for secondary use' }
              ].map((plan) => (
                <motion.div
                  key={plan.id}
                  whileHover={{ scale: 1.02, y: -5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setAmount(plan.price.toString())}
                  className={`flex-shrink-0 w-64 p-5 rounded-2xl border transition-all cursor-pointer snap-start ${
                    amount === plan.price.toString() 
                    ? 'bg-cyan-500/10 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.2)]' 
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-2xl font-black text-white">₹{plan.price}</span>
                    {amount === plan.price.toString() && (
                      <span className="bg-cyan-400 text-slate-900 text-[8px] font-black uppercase px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]">Selected</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <span>Data</span>
                      <span className="text-white">{plan.data}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <span>Validity</span>
                      <span className="text-white">{plan.validity}</span>
                    </div>
                  </div>
                  <p className="mt-4 text-[10px] text-slate-400 font-medium leading-relaxed">{plan.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading || !number || !amount || rechargeStatus === 'PROCESSING'}
              onClick={() => setShowRechargeModal(true)}
              className="w-full md:w-auto px-10 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs md:text-sm uppercase tracking-widest shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:shadow-[0_0_40px_rgba(139,92,246,0.4)] flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Initiating...
                </>
              ) : rechargeStatus === 'PROCESSING' ? (
                <>
                  <span className="animate-pulse h-2 w-2 bg-white rounded-full"></span>
                  Processing ⏳
                </>
              ) : rechargeStatus === 'SUCCESS' ? (
                'Recharge Successful ✅'
              ) : rechargeStatus === 'FAILED' ? (
                'Recharge Failed ❌'
              ) : 'Confirm Recharge'}
            </motion.button>
          </div>
        </div>
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