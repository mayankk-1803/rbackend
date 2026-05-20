import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import PaymentModal from '../components/PaymentModal';
import RechargePaymentModal from '../components/RechargePaymentModal';
import { OPERATORS, operatorMeta } from '../config/operators';
import socket from '../services/socket';
import { Smartphone, ChevronDown, CheckCircle2, Activity } from 'lucide-react';

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

const PlanCard = memo(({ plan, isSelected, onClick }) => (
  <motion.div
    whileTap={{ scale: 0.98 }}
    onClick={() => onClick(plan.amount.toString())}
    className={`flex-shrink-0 w-64 p-5 rounded-2xl border transition-all cursor-pointer snap-start ${
      isSelected ? 'bg-cyan-50 border-cyan-200' : 'bg-white border-slate-100'
    }`}
  >
    <div className="flex justify-between items-start mb-4">
      <div className="flex flex-col">
        <span className="text-2xl font-black text-slate-900">₹{plan.amount}</span>
        {plan.category && <span className="text-[8px] font-black uppercase text-cyan-600 tracking-tighter">{plan.category}</span>}
      </div>
      {isSelected && <span className="bg-cyan-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Active</span>}
    </div>
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
        <span>Data</span>
        <span className="text-slate-900">{plan.data}</span>
      </div>
      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
        <span>Validity</span>
        <span className="text-slate-900">{plan.validity}</span>
      </div>
    </div>
    <p className="mt-4 text-[10px] text-slate-400 font-medium leading-relaxed line-clamp-2">{plan.description}</p>
  </motion.div>
));

export default function MobileRecharge() {
  const [rechargeStatus, setRechargeStatus] = useState('IDLE');
  const [txnId, setTxnId] = useState(null);
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('');
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const navigate = useNavigate();
  
  const opAbortRef = useRef(null);

  useEffect(() => {
    if (number.length === 10 && /^[6-9]\d{9}$/.test(number)) {
      const detectOp = async () => {
        if (opAbortRef.current) opAbortRef.current.abort();
        const controller = new AbortManageler();
        opAbortRef.current = controller;
        setDetecting(true);
        try {
          // Use the dedicated developer endpoint for best accuracy
          const { data } = await api.get(`/v1/dev/operator/${number}`, { signal: controller.signal });
          if (data.success && data.operator) {
            const detected = data.operator.toUpperCase();
            // Match against our standard OPERATORS list
            const matchedKey = Object.keys(OPERATORS).find(k => k === detected || OPERATORS[k] === detected);
            if (matchedKey) {
              setOperator(OPERATORS[matchedKey]);
              toast.success(`Detected: ${operatorMeta[OPERATORS[matchedKey]].label}`);
            }
          }
        } catch (err) {
          if (err.name !== 'CanceledError') setOperator('');
        } finally {
          if (opAbortRef.current === controller) setDetecting(false);
        }
      };
      detectOp();
    }
  }, [number]);

  useEffect(() => {
    if (operator && number.length === 10) {
      const getPlans = async () => {
        setPlansLoading(true);
        try {
          const opCode = operatorMeta[operator]?.code || "1";
          const { data } = await api.get(`/v1/dev/plans?operatorCode=${opCode}&mobile=${number}&circle=Delhi`);
          if (data.success) setPlans(data.data || []);
        } catch (err) {
          setPlans([]);
        } finally {
          setPlansLoading(false);
        }
      };
      getPlans();
    } else setPlans([]);
  }, [operator, number]);

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

  const handleRechargeDirectly = async () => {
    if (!validateForm()) return;
    setShowRechargeModal(false);
    const lt = toast.loading('Initiating...');
    setLoading(true);
    try {
      const opCode = operatorMeta[operator]?.code;
      const { data } = await api.post('/v1/dev/recharge', { 
        mobile: number, 
        operatorCode: opCode, 
        amount: Number(amount) 
      });
      
      if (data.success) {
        setTxnId(data.data?.transactionId || data.data?.id);
        setRechargeStatus('PROCESSING');
        toast.success("Recharge Authorized", { id: lt });
      } else throw new Error(data.message || "Failed");
    } catch(err) {
      setRechargeStatus('FAILED');
      toast.error(err.safeMessage || "Recharge could not be processed.", { id: lt });
      if (err.response?.status === 400 && err.response?.data?.message?.includes("balance")) setShowPayment(true);
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-4">
      <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Secure <span className="text-cyan-600">Recharge</span></h2>
          {operator && (
            <div className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm">
               <span className="text-[10px] font-black uppercase text-slate-400">Signal:</span>
               <span className="text-[10px] font-black uppercase text-cyan-600">{operatorMeta[operator].label} (Code: {operatorMeta[operator].code})</span>
            </div>
          )}
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Mobile Terminal</label>
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="tel" 
                    maxLength="10" 
                    value={number} 
                    onChange={e => setNumber(e.target.value.replace(/\D/g, ''))} 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-xl font-bold focus:border-cyan-500 transition-all outline-none" 
                    placeholder="Enter 10-digit number" 
                  />
                  {detecting && <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full" />}
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Operator Network</label>
                <OperatorDropdown selected={operator} onSelect={setOperator} />
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Recharge Credits (₹)</label>
                <input 
                  type="tel" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-xl font-bold focus:border-cyan-500 transition-all outline-none" 
                  placeholder="0.00" 
                />
              </div>
              <div className="p-6 bg-slate-900 rounded-[2rem] text-center space-y-2">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">Authorized Operator</p>
                <p className="text-white text-xs font-black uppercase italic tracking-tighter">Secure <span className="text-cyan-400">Payment</span></p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Recommended Signals</h3>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {plansLoading ? [1, 2, 3].map(i => <div key={i} className="flex-shrink-0 w-64 h-32 bg-slate-50 rounded-2xl border border-slate-100 animate-pulse"></div>) :
               plans.length > 0 ? plans.map((plan, idx) => <PlanCard key={idx} plan={plan} isSelected={amount === plan.amount.toString()} onClick={setAmount} />) :
               <div className="flex-1 py-12 border-2 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center gap-3 grayscale opacity-30">
                  <Activity className="w-8 h-8" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Awaiting Valid Input</span>
               </div>}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button 
              disabled={loading || rechargeStatus === 'PROCESSING'} 
              onClick={() => validateForm() && setShowRechargeModal(true)} 
              className="w-full md:w-auto px-12 py-5 bg-slate-900 text-white font-black rounded-[1.5rem] disabled:opacity-50 hover:bg-black transition-all text-[11px] font-black uppercase tracking-widest shadow-xl"
            >
              {loading ? 'Processing sequence...' : 'Authorize Terminal Recharge'}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPayment && (
          <PaymentModal isOpen={showPayment} onClose={() => setShowPayment(false)} amount={amount} onPaymentSuccess={() => navigate('/wallet')} title="Top Up & Recharge" />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRechargeModal && (
          <RechargePaymentModal isOpen={showRechargeModal} onClose={() => setShowRechargeModal(false)} onConfirm={handleRechargeDirectly} amount={amount} mobile={number} operator={operator} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}