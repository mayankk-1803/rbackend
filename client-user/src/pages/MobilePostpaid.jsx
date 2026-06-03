import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import RechargePaymentModal from '../components/RechargePaymentModal';
import OperatorInputAdornment from '../components/OperatorInputAdornment';
import { OPERATORS, operatorMeta } from '../config/operators';
import { Smartphone, ChevronDown, CheckCircle2, Activity, ShieldCheck, Zap, Receipt, Search, User, Calendar, FileText } from 'lucide-react';
import { isIOSDevice } from '../utils/device';

const OperatorDropdown = memo(({ selected, onSelect, activeOperatorOptions = [] }) => {
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
        className="w-full flex items-center justify-between px-4 py-5 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] font-bold focus:border-[var(--color-primary)] transition-all shadow-inner cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-black uppercase tracking-tight">
            {selected ? operatorMeta[selected]?.label : "Select Operator"}
          </span>
          {selected && <div className={`w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse`} />}
        </div>
        <ChevronDown className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <Motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute z-[100] top-full mt-2 w-full bg-[var(--glass-modal-bg)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto"
          >
            {activeOperatorOptions.map(op => {
              const meta = operatorMeta[op];
              return (
                <button
                  key={op}
                  onClick={() => { onSelect(op); setIsOpen(false); }}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-[var(--color-primary-glow)] transition-all border-b border-[var(--glass-border)] last:border-none cursor-pointer"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{meta.label}</span>
                  {selected === op && <CheckCircle2 className="w-4 h-4 text-[var(--color-primary)]" />}
                </button>
              );
            })}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

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

  const [activeOperatorOptions, setActiveOperatorOptions] = useState(Object.keys(OPERATORS).filter(k => k !== 'UNKNOWN').map(k => OPERATORS[k]));

  useEffect(() => {
    const loadActiveOperators = async () => {
      try {
        const { data } = await api.get('/recharge/operators');
        if (data.success && Array.isArray(data.data)) {
          const dbActiveNames = data.data.map(op => op.name.toUpperCase());
          const dbActiveCodes = data.data.map(op => String(op.code || op.codes));
          
          const allOptions = Object.keys(OPERATORS).filter(k => k !== 'UNKNOWN').map(k => OPERATORS[k]);
          const filtered = allOptions.filter(op => {
            const meta = operatorMeta[op];
            if (!meta) return false;
            const nameMatch = dbActiveNames.includes(op.toUpperCase()) || dbActiveNames.includes(meta.label.toUpperCase());
            const codeMatch = dbActiveCodes.includes(String(meta.code));
            return nameMatch || codeMatch;
          });
          setActiveOperatorOptions(filtered);
        }
      } catch (err) {
        console.error("Failed to load active operators", err);
      }
    };
    loadActiveOperators();
  }, []);
  const isIOS = isIOSDevice();
  const detectionStateRef = useRef({
    operator: '',
    detectedCircle: '',
    fallbackMode: false,
    hasBillDetails: false,
  });

  useEffect(() => {
    detectionStateRef.current = {
      operator,
      detectedCircle,
      fallbackMode,
      hasBillDetails: Boolean(billDetails),
    };
  }, [operator, detectedCircle, fallbackMode, billDetails]);

  // Debounced Auto-Detection & BBPS Bill Fetching
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
            setOperator('');
            setFallbackMode(true);
            toast.error("Automatic detection unavailable.");
          }
        } catch {
          setOperator('');
          setFallbackMode(true);
          toast.error("Unable to load recharge plans.");
        } finally {
          setDetecting(false);
        }
      }, isIOS ? 1000 : 800);

      return () => clearTimeout(timer);
    } else if (
      detectionStateRef.current.operator ||
      detectionStateRef.current.detectedCircle ||
      detectionStateRef.current.fallbackMode ||
      detectionStateRef.current.hasBillDetails
    ) {
      const resetTimer = setTimeout(() => {
        setBillDetails(null);
        setDetectedCircle('');
        setOperator('');
        setFallbackMode(false);
      }, isIOS ? 120 : 0);
      return () => clearTimeout(resetTimer);
    }
    return undefined;
  }, [number, isIOS]);

  const handleNumberChange = useCallback((e) => {
    setNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
  }, []);

  const handleAmountChange = useCallback((e) => {
    setAmount(e.target.value.replace(/\D/g, ''));
  }, []);

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
    let toastResolved = false;
    try {
      const opCode = operatorMeta[operator]?.code;
      const { data } = await api.post('/recharge/pay-postpaid-bill', { 
        mobile: number, 
        operatorCode: opCode, 
        amount: Number(amount)
      });
      
      if (data.success) {
        toast.success("Recharge queued", { id: lt });
        toastResolved = true;
        navigate('/reports/transactions');
      } else {
        throw new Error(data.message || "Payment failed");
      }
    } catch(err) {
      const errorMsg = err.safeMessage || err.message || "Recharge could not be processed.";
      toast.error(errorMsg, { id: lt });
      toastResolved = true;

      const isInsufficient = errorMsg.toLowerCase().includes("insufficient") || 
                           err.response?.data?.message?.toLowerCase().includes("insufficient") ||
                           err.message?.toLowerCase().includes("insufficient");
      if (isInsufficient) {
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } finally { 
      setLoading(false); 
      if (!toastResolved) {
        toast.dismiss(lt);
      }
    }
  };

  return (
    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-8 py-6 px-4 md:px-0 relative z-10">
      {/* Header */}
      <div className="glass-card border border-[var(--glass-border)] rounded-[2.5rem] shadow-xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-[var(--color-primary-glow)] to-transparent pointer-events-none"></div>
        <div className="px-6 md:px-10 py-8 border-b border-[var(--glass-border)] bg-[var(--bg-tertiary)]/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Receipt className="w-6 h-6 text-[var(--color-accent)] purple-glow" />
              <h2 className="text-2xl md:text-3xl font-black text-[var(--text-color)] tracking-tight uppercase italic">Mobile <span className="text-[var(--color-accent)] purple-glow">Postpaid</span></h2>
            </div>
            <p className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-widest">Secure Payment</p>
          </div>
          {operator && detectedCircle && (
            <div className="flex max-w-full flex-wrap items-center gap-2 px-4 py-2.5 bg-[var(--bg-secondary)]/60 border border-[var(--glass-border)] rounded-2xl shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">OPERATOR:</span>
              <span className="min-w-0 break-words text-xs font-black uppercase tracking-wider text-[var(--color-primary)]">{operatorMeta[operator]?.label} • {detectedCircle}</span>
            </div>
          )}
        </div>

        <div className="p-6 md:p-10 space-y-8 relative z-10">
          {/* Input Section */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className={`md:col-span-${fallbackMode ? '4' : '6'} space-y-2`}>
              <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Mobile Number</label>
              <div className="relative">
                <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-[var(--text-secondary)]" />
                <input 
                  type="tel" 
                  maxLength="10" 
                  value={number} 
                  onChange={handleNumberChange} 
                  className="w-full pl-14 pr-20 py-5 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] text-lg sm:text-xl font-bold focus:border-[var(--color-primary)] transition-all outline-none shadow-inner" 
                  placeholder="Enter 10-digit postpaid number" 
                />
                <OperatorInputAdornment operator={operator} loading={detecting} accent="purple" />
              </div>
              <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest ml-1">Auto-fetches pending BBPS bill</p>
            </div>

            {/* Fallback Manual Operator Dropdown */}
            {fallbackMode && (
              <Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="md:col-span-4 space-y-2">
                <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Operator Gateway</label>
                <OperatorDropdown selected={operator} onSelect={setOperator} activeOperatorOptions={activeOperatorOptions} />
                <p className="text-[9px] text-amber-400 font-bold uppercase tracking-widest ml-1">Manual Selection Mode</p>
              </Motion.div>
            )}

            {/* Fallback Manual Amount Input */}
            {fallbackMode && (
              <Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="md:col-span-4 space-y-2">
                <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Bill Amount (₹)</label>
                <input 
                  type="tel" 
                  value={amount} 
                  onChange={handleAmountChange} 
                  className="w-full px-6 py-5 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] text-xl font-bold focus:border-[var(--color-primary)] transition-all outline-none shadow-inner" 
                  placeholder="0.00" 
                />
                <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest ml-1">Enter custom bill amount</p>
              </Motion.div>
            )}

            {!fallbackMode && !billDetails && (
              <div className="md:col-span-6 flex items-center justify-end h-full pt-6">
                <div className="flex items-center gap-6 px-8 py-5 bg-[var(--bg-secondary)]/80 border border-[var(--glass-border)] text-[var(--text-color)] rounded-2xl shadow-lg w-full md:w-auto justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-[var(--color-primary)]" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider">Bharat BillPay Engine</p>
                      <p className="text-[9px] text-[var(--text-muted)] font-medium">Instant Bill Verification Active</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-3 py-1 bg-[var(--glass-button-bg)] rounded-xl text-[var(--color-primary)] border border-[var(--glass-border)]">BBPS</span>
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
                className="w-full md:w-auto px-12 py-5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:opacity-90 text-white font-black rounded-2xl shadow-xl shadow-[var(--color-primary-glow)] border-none transition-all text-xs uppercase tracking-widest active:scale-95 cursor-pointer"
              >
                {loading ? 'Authorizing...' : 'Proceed with Manual Bill Payment'}
              </button>
            </div>
          )}

          {/* Fetched Bill Summary Card */}
          {billDetails && !fallbackMode && (
            <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[var(--bg-tertiary)]/20 border border-[var(--glass-border)] p-8 rounded-3xl shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary-glow)] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-[var(--glass-border)] pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[var(--color-primary-glow)] border border-[var(--color-primary)]/20 text-[var(--color-primary)] rounded-2xl flex items-center justify-center shadow-sm">
                    <User className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Customer Name</span>
                    <span className="text-xl font-black text-[var(--text-color)] tracking-tight">{billDetails.customerName}</span>
                  </div>
                </div>
 
                <div className="text-left md:text-right">
                  <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Bill Amount</span>
                  <span className="text-4xl font-black text-[var(--color-primary)] tracking-tighter">₹{billDetails.billAmount}</span>
                </div>
              </div>
 
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-[var(--bg-secondary)]/60 p-6 rounded-2xl border border-[var(--glass-border)]">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
                  <div>
                    <span className="block text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Due Date</span>
                    <span className="text-sm font-black text-[var(--text-color)]">{billDetails.dueDate || "N/A"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[var(--color-primary)]" />
                  <div>
                    <span className="block text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Bill Number</span>
                    <span className="text-sm font-black text-[var(--text-color)] font-mono">{billDetails.billNumber || "N/A"}</span>
                  </div>
                </div>
              </div>
 
              <div className="flex justify-end">
                <button
                  onClick={() => validateForm() && setShowRechargeModal(true)}
                  className="w-full md:w-auto px-12 py-5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:opacity-90 text-white font-black rounded-2xl shadow-xl shadow-[var(--color-primary-glow)] border-none transition-all text-xs uppercase tracking-widest active:scale-95 flex items-center justify-center gap-3 cursor-pointer"
                >
                  Pay Bill Now ₹{billDetails.billAmount}
                  <Zap className="w-4 h-4 fill-current" />
                </button>
              </div>
            </Motion.div>
          )}

          {/* Awaiting Input Prompt */}
          {number.length < 10 && (
            <div className="py-20 border-2 border-dashed border-[var(--glass-border)] rounded-3xl flex flex-col items-center justify-center gap-4 text-center bg-[var(--bg-tertiary)]/20">
              <div className="w-16 h-16 bg-[var(--bg-secondary)]/60 rounded-2xl shadow-sm flex items-center justify-center border border-[var(--glass-border)] text-[var(--color-primary)]">
                <Receipt className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-black text-[var(--text-color)] uppercase tracking-widest">Awaiting 10-Digit Postpaid Number</p>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">Enter number above to instantly verify and pay pending bills</p>
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
    </Motion.div>
  );
}
