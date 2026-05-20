import React, { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import RechargePaymentModal from '../components/RechargePaymentModal';
import { OPERATORS, operatorMeta } from '../config/operators';
import { Smartphone, ChevronDown, CheckCircle2, Activity, ShieldCheck, Zap, Receipt, Search, User, Calendar, FileText } from 'lucide-react';

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
        className="w-full flex items-center justify-between px-4 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:border-purple-500 transition-all shadow-inner"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-black uppercase tracking-tight">
            {selected ? operatorMeta[selected]?.label : "Select Operator"}
          </span>
          {selected && <div className={`w-2 h-2 rounded-full bg-purple-500 animate-pulse`} />}
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
                  {selected === op && <CheckCircle2 className="w-4 h-4 text-purple-500" />}
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
  const [detecting, setDetecting] = useState(false);
  const [billDetails, setBillDetails] = useState(null);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [detectedCircle, setDetectedCircle] = useState('');
  const navigate = useNavigate();

  // 800ms Debounce Auto-Detection & BBPS Bill Fetching
  useEffect(() => {
    if (number.length === 10 && /^[6-9]\d{9}$/.test(number)) {
      const timer = setTimeout(async () => {
        setDetecting(true);
        setBillDetails(null);
        try {
          const { data } = await api.post('/recharge/postpaid/init', { mobile: number });
          if (data.success) {
            setDetectedCircle(data.circle?.name || 'Delhi NCR');
            
            const opName = data.operator?.name?.toUpperCase() || '';
            if (opName.includes('AIRTEL')) setOperator(OPERATORS.AIRTEL);
            else if (opName.includes('VI') || opName.includes('VODAFONE') || opName.includes('IDEA')) setOperator(OPERATORS.VI);
            else if (opName.includes('BSNL')) setOperator(OPERATORS.BSNL_TOPUP);
            else if (opName.includes('JIO')) setOperator(OPERATORS.JIO);
            else setOperator(OPERATORS.JIO);

            if (data.billDetails) {
              setBillDetails(data.billDetails);
              setAmount(data.billDetails.billAmount?.toString() || '');
              setFallbackMode(false);
              toast.success("Pending Bill Fetched Successfully");
            } else {
              setFallbackMode(true);
              toast.error("No pending bill found. Please enter amount manually.");
            }
          } else {
            setFallbackMode(true);
            toast.error("Automatic detection unavailable.");
          }
        } catch (err) {
          setFallbackMode(true);
          toast.error("Unable to load recharge plans.");
        } finally {
          setDetecting(false);
        }
      }, 800);

      return () => clearTimeout(timer);
    } else {
      setBillDetails(null);
      setDetectedCircle('');
      setFallbackMode(false);
    }
  }, [number]);

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
      toast.error("Please enter a valid bill amount");
      return false;
    }
    return true;
  };

  const handlePayBill = async () => {
    if (!validateForm()) return;
    setShowRechargeModal(false);
    const lt = toast.loading('Authorizing secure bill payment...');
    setLoading(true);
    try {
      const opCode = operatorMeta[operator]?.code;
      const { data } = await api.post('/recharge/pay-postpaid-bill', { 
        mobile: number, 
        operatorCode: opCode, 
        amount: Number(amount)
      });
      
      if (data.success) {
        toast.success("Bill Payment Authorized Successfully", { id: lt });
        navigate('/user/transactions');
      } else throw new Error(data.message || "Payment failed");
    } catch(err) {
      toast.error(err.safeMessage || "Recharge could not be processed.", { id: lt });
    } finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-8 py-6 px-4 md:px-0">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-purple-500/5 to-transparent pointer-events-none"></div>
        <div className="px-6 md:px-10 py-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Receipt className="w-6 h-6 text-purple-600" />
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase italic">Mobile <span className="text-purple-600">Postpaid</span></h2>
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Secure Payment</p>
          </div>
          {operator && detectedCircle && (
            <div className="flex items-center gap-3 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Signal:</span>
              <span className="text-xs font-black uppercase tracking-wider text-purple-600">{operatorMeta[operator]?.label} • {detectedCircle}</span>
            </div>
          )}
        </div>

        <div className="p-6 md:p-10 space-y-8 relative z-10">
          {/* Input Section */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className={`md:col-span-${fallbackMode ? '4' : '6'} space-y-2`}>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mobile Number</label>
              <div className="relative">
                <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
                <input 
                  type="tel" 
                  maxLength="10" 
                  value={number} 
                  onChange={e => setNumber(e.target.value.replace(/\D/g, ''))} 
                  className="w-full pl-14 pr-12 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-xl font-bold focus:border-purple-500 transition-all outline-none shadow-inner" 
                  placeholder="Enter 10-digit postpaid number" 
                />
                {detecting && (
                  <div className="absolute right-5 top-1/2 -translate-y-1/2">
                    <div className="animate-spin h-5 w-5 border-2 border-purple-600 border-t-transparent rounded-full"></div>
                  </div>
                )}
              </div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest ml-1">Auto-fetches pending BBPS bill</p>
            </div>

            {/* Fallback Manual Operator Dropdown */}
            {fallbackMode && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="md:col-span-4 space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Operator Gateway</label>
                <OperatorDropdown selected={operator} onSelect={setOperator} />
                <p className="text-[9px] text-amber-500 font-bold uppercase tracking-widest ml-1">Manual Selection Mode</p>
              </motion.div>
            )}

            {/* Fallback Manual Amount Input */}
            {fallbackMode && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="md:col-span-4 space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Bill Amount (₹)</label>
                <input 
                  type="tel" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} 
                  className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-xl font-bold focus:border-purple-500 transition-all outline-none shadow-inner" 
                  placeholder="0.00" 
                />
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest ml-1">Enter custom bill amount</p>
              </motion.div>
            )}

            {!fallbackMode && !billDetails && (
              <div className="md:col-span-6 flex items-center justify-end h-full pt-6">
                <div className="flex items-center gap-6 px-8 py-5 bg-slate-900 text-white rounded-2xl shadow-lg w-full md:w-auto justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-purple-400" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider">Bharat BillPay Engine</p>
                      <p className="text-[9px] text-slate-400 font-medium">Instant Bill Verification Active</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-3 py-1 bg-white/10 rounded-xl text-purple-300 border border-white/10">BBPS</span>
                </div>
              </div>
            )}
          </div>

          {/* Fallback Manual Submit Button */}
          {fallbackMode && (
            <div className="flex justify-end pt-2">
              <button 
                disabled={loading} 
                onClick={() => validateForm() && setShowRechargeModal(true)} 
                className="w-full md:w-auto px-12 py-5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl shadow-xl shadow-purple-600/20 transition-all text-xs uppercase tracking-widest active:scale-95"
              >
                {loading ? 'Authorizing...' : 'Proceed with Manual Bill Payment'}
              </button>
            </div>
          )}

          {/* Fetched Bill Summary Card */}
          {billDetails && !fallbackMode && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-slate-200 p-8 rounded-3xl shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-slate-100 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-purple-50 border border-purple-100 text-purple-600 rounded-2xl flex items-center justify-center shadow-sm">
                    <User className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Name</span>
                    <span className="text-xl font-black text-slate-900 tracking-tight">{billDetails.customerName}</span>
                  </div>
                </div>

                <div className="text-left md:text-right">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bill Amount</span>
                  <span className="text-4xl font-black text-purple-600 tracking-tighter">₹{billDetails.billAmount}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Due Date</span>
                    <span className="text-sm font-black text-slate-900">{billDetails.dueDate || "N/A"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-purple-600" />
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Bill Number</span>
                    <span className="text-sm font-black text-slate-900 font-mono">{billDetails.billNumber || "N/A"}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => validateForm() && setShowRechargeModal(true)}
                  className="w-full md:w-auto px-12 py-5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl shadow-xl shadow-purple-600/20 transition-all text-xs uppercase tracking-widest active:scale-95 flex items-center justify-center gap-3"
                >
                  Pay Bill Now ₹{billDetails.billAmount}
                  <Zap className="w-4 h-4 fill-current" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Awaiting Input Prompt */}
          {number.length < 10 && (
            <div className="py-20 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center gap-4 text-center bg-slate-50/30">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-slate-100">
                <Receipt className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-700 uppercase tracking-widest">Awaiting 10-Digit Postpaid Number</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Enter number above to instantly verify and pay pending bills</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showRechargeModal && (
          <RechargePaymentModal 
            isOpen={showRechargeModal} 
            onClose={() => setShowRechargeModal(false)} 
            onConfirm={handlePayBill} 
            amount={amount} 
            mobile={number} 
            operator={operator} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
