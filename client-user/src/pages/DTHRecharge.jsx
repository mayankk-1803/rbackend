import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Tv, ShieldCheck, ChevronRight, Activity, Wallet } from 'lucide-react';
import PaymentModal from '../components/PaymentModal';
import RechargePaymentModal from '../components/RechargePaymentModal';

export default function DTHRecharge() {
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('Tata Play');
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const navigate = useNavigate();

  const handleRechargeDirectly = async () => {
    setShowRechargeModal(false);
    if(!number || !amount || Number(amount) <= 0) {
      return toast.error("Please enter a valid Customer ID and amount");
    }
    const loadingToast = toast.loading('Processing DTH recharge...');
    setLoading(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const { data } = await api.post('/recharge', {
        mobile: number,
        amount: Number(amount),
        operator,
        type: 'dth'
      }, {
        headers: { 'x-idempotency-key': idempotencyKey }
      });
      
      toast.success(data.message || 'Recharge initiated', { id: loadingToast });
      navigate('/history');
    } catch(err) {
      const errorMsg = err.response?.data?.message || 'Recharge failed';
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
      <div className="bg-white/70 backdrop-blur-2xl border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-purple-500/5 to-transparent pointer-events-none"></div>
        
        <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
              <Tv className="w-8 h-8 text-purple-600 fill-purple-600/10" />
              DTH <span className="text-purple-600">Stream</span>
            </h2>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Satellite entertainment settlement protocol</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-purple-50 border border-purple-100 rounded-full">
            <ShieldCheck className="w-3 h-3 text-purple-600" />
            <span className="text-[8px] font-black text-purple-600 uppercase tracking-widest">Secure Uplink</span>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setShowRechargeModal(true); }} className="p-10 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Customer ID / SmartCard</label>
                <div className="relative group">
                  <input
                    type="text"
                    required
                    value={number}
                    onChange={e => setNumber(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-black tracking-widest outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-600 transition-all placeholder:text-slate-300"
                    placeholder="ENTER ID"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Service Provider</label>
                  <select
                    value={operator}
                    onChange={e => setOperator(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-black tracking-widest outline-none focus:border-purple-600 transition-all appearance-none"
                  >
                    <option value="Tata Play">TATA PLAY</option>
                    <option value="Airtel DTH">AIRTEL DTH</option>
                    <option value="Dish TV">DISH TV</option>
                    <option value="Videocon d2h">VIDEOCON D2H</option>
                    <option value="Sun Direct">SUN DIRECT</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Recharge Amount (₹)</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-2xl font-black tracking-tighter outline-none focus:border-emerald-500 transition-all placeholder:text-slate-300"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
               <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2rem] relative overflow-hidden group">
                  <div className="relative z-10 space-y-4">
                     <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center border border-purple-200">
                        <Activity className="w-6 h-6 text-purple-600" />
                     </div>
                     <h4 className="text-slate-900 font-black uppercase italic tracking-tight">Signal Injection</h4>
                     <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Direct carrier integration ensures your smartcard is authorized within seconds of successful settlement.</p>
                  </div>
                  <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl group-hover:bg-purple-500/10 transition-all duration-700"></div>
               </div>

               <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                     <Wallet className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">Instant recharge requires sufficient wallet liquidity.</p>
               </div>
            </div>
          </div>

          <div className="flex justify-end pt-10 border-t border-slate-100">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={loading || !number || !amount}
              type="submit"
              className="px-12 py-5 bg-purple-600 text-white font-black rounded-2xl shadow-lg shadow-purple-600/20 hover:shadow-purple-600/30 transition-all text-[11px] uppercase tracking-[0.2em] flex items-center gap-3 disabled:opacity-30"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Injecting...
                </>
              ) : (
                <>
                  Authorize Recharge <ChevronRight className="w-4 h-4" />
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
        title="DTH Recharge Settlement"
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
