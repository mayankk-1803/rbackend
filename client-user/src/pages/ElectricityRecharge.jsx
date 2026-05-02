import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Zap, ShieldCheck, ChevronRight, Activity, Wallet } from 'lucide-react';
import PaymentModal from '../components/PaymentModal';
import RechargePaymentModal from '../components/RechargePaymentModal';

export default function ElectricityRecharge() {
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('BSES');
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const navigate = useNavigate();

  const handleRechargeDirectly = async () => {
    setShowRechargeModal(false);
    if(!number || !amount || Number(amount) <= 0) {
      return toast.error("Please enter a valid consumer number and amount");
    }
    const loadingToast = toast.loading('Processing Electricity bill payment...');
    setLoading(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const { data } = await api.post('/recharge', {
        mobile: number,
        amount: Number(amount),
        operator,
        type: 'electricity'
      }, {
        headers: { 'x-idempotency-key': idempotencyKey }
      });
      
      toast.success(data.message || 'Payment initiated', { id: loadingToast });
      navigate('/history');
    } catch(err) {
      const errorMsg = err.response?.data?.message || 'Payment failed';
      toast.error(errorMsg, { id: loadingToast });
      if (errorMsg.includes("Insufficient")) setShowPayment(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentFlow = async () => {
    try {
      const res = await api.post('/payment/create-order', {
        amount: Number(amount),
        upiId: 'demo@upi',
        intent: 'TOPUP'
      });
      
      const paymentId = res.data.data.id;
      const confirmRes = await api.post('/payment/confirm', { paymentId });
      
      if (confirmRes.data.success) {
        setShowPayment(false);
        await handleRechargeDirectly();
      } else {
        throw new Error("Payment confirmation failed");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Payment failed");
      setShowPayment(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-amber-500/5 to-transparent pointer-events-none"></div>
        
        <div className="px-10 py-8 border-b border-white/10 bg-white/[0.02] flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic flex items-center gap-3">
              <Zap className="w-8 h-8 text-amber-400 fill-amber-400/20" />
              Electricity <span className="text-amber-400">Vault</span>
            </h2>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Authorized utility settlement gateway</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Secure Node</span>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setShowRechargeModal(true); }} className="p-10 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Consumer Number / ID</label>
                <div className="relative group">
                  <input
                    type="text"
                    required
                    value={number}
                    onChange={e => setNumber(e.target.value)}
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black tracking-widest outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 transition-all placeholder:text-slate-800"
                    placeholder="ENTER ID"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Service Board</label>
                  <select
                    value={operator}
                    onChange={e => setOperator(e.target.value)}
                    className="w-full px-6 py-4 bg-[#0B0F19] border border-white/10 rounded-2xl text-white font-black tracking-widest outline-none focus:border-amber-400 transition-all appearance-none"
                  >
                    <option value="BSES">BSES (DELHI)</option>
                    <option value="TATA POWER">TATA POWER</option>
                    <option value="ADANI ELECT.">ADANI ELECTRICITY</option>
                    <option value="MSEB">MSEB (MAHARASHTRA)</option>
                    <option value="BESCOM">BESCOM (KARNATAKA)</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Settlement Amount (₹)</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-2xl font-black tracking-tighter outline-none focus:border-emerald-400 transition-all placeholder:text-slate-800"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
               <div className="p-8 bg-black/40 rounded-[2rem] border border-white/5 relative overflow-hidden group">
                  <div className="relative z-10 space-y-4">
                     <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
                        <Activity className="w-6 h-6 text-amber-400" />
                     </div>
                     <h4 className="text-white font-black uppercase italic tracking-tight">Quantum Settlement</h4>
                     <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Payments are routed through encrypted primary utility nodes for 100% confirmation within 120ms.</p>
                  </div>
                  <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-all duration-700"></div>
               </div>

               <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                     <Wallet className="w-5 h-5 text-slate-600" />
                  </div>
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest leading-relaxed">Ensure credits are available for instant protocol execution.</p>
               </div>
            </div>
          </div>

          <div className="flex justify-end pt-10 border-t border-white/5">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={loading || !number || !amount}
              type="submit"
              className="px-12 py-5 bg-amber-500 text-slate-900 font-black rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:shadow-[0_0_50px_rgba(245,158,11,0.5)] transition-all text-[11px] uppercase tracking-[0.2em] flex items-center gap-3 disabled:opacity-30"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full"></div>
                  Initializing...
                </>
              ) : (
                <>
                  Authorize Payment <ChevronRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </div>
        </form>
      </div>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        amount={amount}
        onPaymentSuccess={handlePaymentFlow}
        title="Electricity Settlement"
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
