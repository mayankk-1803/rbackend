import React, { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import RechargePaymentModal from '../components/RechargePaymentModal';
import { OPERATORS, operatorMeta } from '../config/operators';
import { Smartphone, ChevronDown, CheckCircle2, Activity, ShieldCheck, Zap, Receipt, Search } from 'lucide-react';

const OperatorDropdown = ({ selected, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const clickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:border-cyan-500 transition-all"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-black uppercase tracking-tight">
            {selected ? operatorMeta[selected]?.label : "Select Operator"}
          </span>
          {selected && <div className={`w-2 h-2 rounded-full bg-cyan-500 animate-pulse`} />}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute z-[100] top-full mt-2 w-full bg-white border border-slate-100 rounded-3xl shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto"
          >
            {Object.keys(OPERATORS).filter(k => k !== 'UNKNOWN').map(opKey => {
              const op = OPERATORS[opKey];
              const meta = operatorMeta[op];
              return (
                <button
                  key={op}
                  onClick={() => { onSelect(op); setIsOpen(false); }}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-all border-b border-slate-50 last:border-none"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{meta.label}</span>
                  {selected === op && <CheckCircle2 className="w-4 h-4 text-cyan-500" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function MobilePostpaid() {
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  
  const validateForm = () => {
    if (!/^[6-9]\d{9}$/.test(number)) {
      toast.error("Please enter a valid 10-digit mobile number");
      return false;
    }
    if (!operator) {
      toast.error("Please select an operator");
      return false;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return false;
    }
    return true;
  };

  const handlePayBill = async () => {
    if (!validateForm()) return;
    setShowRechargeModal(false);
    const lt = toast.loading('Initiating Payment...');
    setLoading(true);
    try {
      const opCode = operatorMeta[operator]?.code;
      const { data } = await api.post('/recharge/pay-postpaid-bill', { 
        mobile: number, 
        operatorCode: opCode, 
        amount: Number(amount)
      });
      
      if (data.success) {
        toast.success("Payment Authorized", { id: lt });
        setNumber('');
        setAmount('');
        setOperator('');
      } else throw new Error(data.message || "Failed");
    } catch(err) {
      toast.error(err.response?.data?.message || err.message, { id: lt });
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Mobile <span className="text-purple-600">Postpaid</span></h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Direct Bill Payments</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm">
             <ShieldCheck className="w-4 h-4 text-emerald-500" />
             <span className="text-[8px] font-black uppercase text-slate-500">Secure Billing Active</span>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Mobile Number</label>
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="tel" 
                    maxLength="10" 
                    value={number} 
                    onChange={e => setNumber(e.target.value.replace(/\D/g, ''))} 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-xl font-bold focus:border-purple-500 transition-all outline-none" 
                    placeholder="Enter postpaid mobile number" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Operator Gateway</label>
                <OperatorDropdown selected={operator} onSelect={setOperator} />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Bill Amount</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-400">₹</div>
                  <input 
                    type="tel" 
                    value={amount} 
                    onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} 
                    className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-xl font-bold focus:border-purple-500 transition-all outline-none" 
                    placeholder="Enter bill amount" 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden h-full flex flex-col justify-between min-h-[300px]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Network Status</h3>
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-tight text-white">Secure Connection</p>
                        <p className="text-[8px] font-medium text-slate-400">BBPS Search Active</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                        <Zap className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-tight text-white">99.9% SLA Status</p>
                        <p className="text-[8px] font-medium text-slate-400">Fast Response Routing Enabled</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5">
                   <p className="text-[7px] font-black text-slate-500 uppercase tracking-[0.4em]">Signal Channel Authenticated</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
              disabled={loading || !number || !operator || !amount} 
              onClick={() => validateForm() && setShowRechargeModal(true)} 
              className="w-full px-12 py-5 bg-slate-900 text-white font-black rounded-[1.5rem] disabled:opacity-50 hover:bg-black transition-all text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3"
            >
              {loading ? 'Authorizing Payment...' : 'Pay Postpaid Bill'}
              <Zap className="w-4 h-4 fill-current" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showRechargeModal && (
          <RechargePaymentModal isOpen={showRechargeModal} onClose={() => setShowRechargeModal(false)} onConfirm={handlePayBill} amount={amount} mobile={number} operator={operator} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
