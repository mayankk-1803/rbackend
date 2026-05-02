import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Flame, ShieldCheck, ChevronRight, Activity, Wallet } from 'lucide-react';
import PaymentModal from '../components/PaymentModal';
import RechargePaymentModal from '../components/RechargePaymentModal';

export default function GasRecharge() {
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('Indane');
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const navigate = useNavigate();

  const handleRechargeDirectly = async () => {
    setShowRechargeModal(false);
    if(!number || !amount || Number(amount) <= 0) {
      return toast.error("Please enter a valid Consumer ID and amount");
    }
    const loadingToast = toast.loading('Processing Gas bill payment...');
    setLoading(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const { data } = await api.post('/recharge', {
        mobile: number,
        amount: Number(amount),
        operator,
        type: 'gas'
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
      <div className="bg-white/70 backdrop-blur-2xl border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-rose-500/5 to-transparent pointer-events-none"></div>
        
        <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
              <Flame className="w-8 h-8 text-rose-600 fill-rose-600/10" />
              Gas <span className="text-rose-600">Circuit</span>
            </h2>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Energy resource settlement protocol</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-rose-50 border border-rose-100 rounded-full">
            <ShieldCheck className="w-3 h-3 text-rose-600" />
            <span className="text-[8px] font-black text-rose-600 uppercase tracking-widest">Secure Flow</span>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setShowRechargeModal(true); }} className="p-10 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Consumer Number / SV ID</label>
                <div className="relative group">
                  <input
                    type="text"
                    required
                    value={number}
                    onChange={e => setNumber(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-black tracking-widest outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-600 transition-all placeholder:text-slate-300"
                    placeholder="ENTER ID"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Gas Provider</label>
                  <select
                    value={operator}
                    onChange={e => setOperator(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-black tracking-widest outline-none focus:border-rose-600 transition-all appearance-none"
                  >
                    <option value="Indane">INDANE GAS</option>
                    <option value="HP Gas">HP GAS</option>
                    <option value="Bharat Gas">BHARAT GAS</option>
                    <option value="Adani Gas">ADANI TOTAL GAS</option>
                    <option value="MGL">MAHANAGAR GAS (MGL)</option>
                    <option value="IGL">INDRAPRASTHA GAS (IGL)</option>
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
                     <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center border border-rose-200">
                        <Activity className="w-6 h-6 text-rose-600" />
                     </div>
                     <h4 className="text-slate-900 font-black uppercase italic tracking-tight">Thermal Sync</h4>
                     <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Direct carrier API integration for LPG booking and PNG bill settlement with instant digital receipt generation.</p>
                  </div>
                  <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl group-hover:bg-rose-500/10 transition-all duration-700"></div>
               </div>

               <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                     <Wallet className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">Authorization requires verified wallet balance.</p>
               </div>
            </div>
          </div>

          <div className="flex justify-end pt-10 border-t border-slate-100">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={loading || !number || !amount}
              type="submit"
              className="px-12 py-5 bg-rose-600 text-white font-black rounded-2xl shadow-lg shadow-rose-600/20 hover:shadow-rose-600/30 transition-all text-[11px] uppercase tracking-[0.2em] flex items-center gap-3 disabled:opacity-30"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Igniting...
                </>
              ) : (
                <>
                  Authorize Settlement <ChevronRight className="w-4 h-4" />
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
        title="Gas Bill Settlement"
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