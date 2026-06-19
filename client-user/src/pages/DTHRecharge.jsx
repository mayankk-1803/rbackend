import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import RechargePaymentModal from '../components/RechargePaymentModal';
import { OPERATORS, operatorMeta } from '../config/operators';
import { Tv, ChevronDown, CheckCircle2, Activity, ShieldCheck, User, CreditCard, Calendar, Info, RefreshCw } from 'lucide-react';

const MIN_DTH_RECHARGE_AMOUNT = 100;

const OperatorDropdown = memo(({ selected, onSelect, operatorList }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const clickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  // Use dynamic operator name directly or Select placeholder
  const selectedLabel = selected || "Select DTH Provider";

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-4 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] font-bold focus:border-[var(--color-primary)] transition-all cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-black uppercase tracking-tight">
            {selectedLabel}
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
            {operatorList.map(op => {
              return (
                <button
                  key={op.code}
                  type="button"
                  onClick={() => { onSelect(op.name); setIsOpen(false); }}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-[var(--color-primary-glow)] transition-all border-b border-[var(--glass-border)] last:border-none cursor-pointer text-left"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{op.name}</span>
                  {selected === op.name && <CheckCircle2 className="w-4 h-4 text-[var(--color-primary)]" />}
                </button>
              );
            })}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

const PlanCard = memo(({ plan, onSelect }) => (
  <Motion.div
    whileHover={{ y: -4, borderColor: 'var(--color-primary)', boxShadow: '0 12px 24px -8px var(--color-primary-glow)' }}
    className="glass-card border border-[var(--glass-border)] p-6 rounded-3xl shadow-sm flex flex-col justify-between transition-all relative overflow-hidden group"
  >
    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[var(--color-primary-glow)] to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
    <div>
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-3xl font-black text-[var(--text-color)] tracking-tighter">₹{plan.amount}</span>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">DTH Recharge</p>
        </div>
        <span className="bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 text-[9px] font-black uppercase px-3 py-1 rounded-full shadow-sm">
          {plan.validity}
        </span>
      </div>
      <p className="text-[11px] text-[var(--text-secondary)] font-medium leading-relaxed line-clamp-3 mb-6">
        {plan.description}
      </p>
    </div>

    <button
      type="button"
      onClick={() => onSelect(plan.amount.toString())}
      className="w-full py-3 bg-[var(--glass-button-bg)] border border-[var(--glass-border)] hover:bg-[var(--color-primary)] hover:text-white hover:border-[var(--color-primary)] text-[var(--text-color)] font-black rounded-2xl shadow-md hover:shadow-lg hover:shadow-[var(--color-primary-glow)] transition-all transform active:scale-95 text-[10px] uppercase tracking-widest cursor-pointer"
    >
      Select Amount
    </button>
  </Motion.div>
));

export default function DTHRecharge() {
  const [subscriberId, setSubscriberId] = useState('');
  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [plans, setPlans] = useState({});
  const [plansLoading, setPlansLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('');
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const navigate = useNavigate();

  const [operatorList, setOperatorList] = useState([]);
  const [customerVerified, setCustomerVerified] = useState(false);
  const [verifiedSubscriberId, setVerifiedSubscriberId] = useState(null);
  const [verifiedOperatorCode, setVerifiedOperatorCode] = useState(null);

  useEffect(() => {
    setCustomerVerified(false);
    setVerifiedSubscriberId(null);
    setVerifiedOperatorCode(null);
  }, [subscriberId, operator]);
  
  useEffect(() => {
    const fetchOperators = async () => {
      try {
        const { data } = await api.get('/recharge/operators');
        if (data.success && data.data) {
          const dthOps = data.data.filter(op => op.category === 'DTH' && op.active === true);
          setOperatorList(dthOps);
        }
      } catch (err) {
        console.error("Failed to fetch DTH operators:", err);
      }
    };
    fetchOperators();
  }, []);

  const getSelectedOperatorMeta = () => {
    const op = operatorList.find(o => o.name === operator);
    return {
      code: op ? String(op.code) : (operatorMeta[operator]?.code || ''),
      label: op ? op.name : (operatorMeta[operator]?.label || ''),
      color: operatorMeta[operator]?.color || 'bg-slate-50 text-slate-600 border-slate-100'
    };
  };

  // Fetch plans whenever operator is selected
  useEffect(() => {
    if (operator) {
      const getPlans = async () => {
        if (!amount || Number(amount) < 100) {
          toast.error('Minimum DTH recharge amount is ₹100');
          return;
        }
        setPlansLoading(true);
        try {
          const meta = getSelectedOperatorMeta();
          const opCode = meta.code;
          const { data } = await api.get(`/recharge/dth/plans?operatorCode=${opCode}&operatorName=${meta.label}`);
          if (data.success && data.plans) {
            setPlans(data.plans);
            const keys = Object.keys(data.plans);
            if (keys.length > 0) setActiveTab(keys[0]);
          } else {
            setPlans({});
          }
        } catch (err) {
          console.error("Plans fetch failed:", err);
          setPlans({});
        } finally {
          setPlansLoading(false);
        }
      };
      getPlans();
    } else {
      setPlans({});
      setActiveTab('');
    }
  }, [operator, operatorList, amount]);

  // Handle DTH subscriber details validation lookup
  const lookupCustomerDetails = async () => {
    if (!amount || Number(amount) < 100) {
      toast.error('Minimum DTH recharge amount is ₹100');
      return;
    }
    if (!subscriberId || subscriberId.length < 8 || subscriberId.length > 15 || !/^\d+$/.test(subscriberId)) {
      toast.error("Please enter a valid Subscriber ID (8-15 digits) first");
      return;
    }
    if (!operator) {
      toast.error("Please select a DTH provider");
      return;
    }

    setValidating(true);
    setCustomerInfo(null);
    const meta = getSelectedOperatorMeta();
    const opCode = meta.code;

    try {
      const { data } = await api.post('/recharge/dth/validate', {
        operatorCode: opCode,
        subscriberId: subscriberId
      });

      if (data.success) {
        setCustomerInfo(data);
        setCustomerVerified(true);
        setVerifiedSubscriberId(subscriberId);
        setVerifiedOperatorCode(opCode);
        toast.success("Customer record retrieved successfully!");
      } else {
        setCustomerVerified(false);
        setVerifiedSubscriberId(null);
        setVerifiedOperatorCode(null);
        toast.error(data.message || "Customer lookup details unavailable.");
      }
    } catch (err) {
      console.error(err);
      setCustomerVerified(false);
      setVerifiedSubscriberId(null);
      setVerifiedOperatorCode(null);
      toast.error(err.response?.data?.message || "Customer validation failed.");
    } finally {
      setValidating(false);
    }
  };

  const validateForm = () => {
    if (!subscriberId || subscriberId.length < 8 || subscriberId.length > 15 || !/^\d+$/.test(subscriberId)) {
      toast.error("Please enter a valid Subscriber ID / VC Number (8-15 digits)");
      return false;
    }
    if (!operator) {
      toast.error("Please select a DTH operator");
      return false;
    }
    if (!amount || Number(amount) < 100) {
      toast.error('Minimum DTH recharge amount is ₹100');
      return false;
    }
    const meta = getSelectedOperatorMeta();
    if (!customerVerified || verifiedSubscriberId !== subscriberId || verifiedOperatorCode !== meta.code) {
      setCustomerVerified(false);
      toast.error("Please verify the DTH customer before proceeding.");
      return false;
    }
    return true;
  };

  const handleRechargeDirectly = async () => {
    if (!validateForm()) return;
    setShowRechargeModal(false);
    const lt = toast.loading('Initiating secure payment sequence...');
    setLoading(true);
    try {
      const meta = getSelectedOperatorMeta();
      const opCode = meta.code;
      const { data } = await api.post('/recharge', {
        mobile: subscriberId,
        operatorCode: opCode,
        amount: Number(amount)
      });

      if (data.success) {
        toast.success("DTH Recharge queued successfully!", { id: lt });
        // Redirect to transaction details
        navigate(`/status?id=${data.transactionId}`);
      } else {
        throw new Error(data.message || "Failed to execute recharge");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Recharge could not be processed.", { id: lt });
    } finally {
      setLoading(false);
    }
  };

  const tabs = Object.keys(plans);
  const currentPlans = activeTab ? (plans[activeTab] || []) : [];

  return (
    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
      <div className="bg-[var(--glass-card-bg)] border border-[var(--glass-border)] rounded-[2.5rem] shadow-xl overflow-hidden backdrop-blur-2xl">
        <div className="px-8 py-6 border-b border-[var(--glass-border)] bg-[var(--glass-button-bg)]/50 flex justify-between items-center">
          <h2 className="text-2xl font-black text-[var(--text-color)] tracking-tight uppercase italic">DTH <span className="text-[var(--color-primary)]">Recharge</span></h2>
          <div className="flex items-center gap-2 px-3 py-1 bg-[var(--glass-button-bg)] border border-[var(--glass-border)] rounded-full">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-wider">Secure Channel</span>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Form Left */}
            <div className="space-y-6">
              <div>
                <label className="block text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3 ml-1">DTH Provider</label>
                <OperatorDropdown selected={operator} onSelect={setOperator} operatorList={operatorList} />
              </div>

              <div>
                <label className="block text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3 ml-1">Subscriber ID / VC Number</label>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      type="text" 
                      maxLength="15" 
                      value={subscriberId} 
                      onChange={e => setSubscriberId(e.target.value.replace(/\D/g, ''))} 
                      className="w-full pl-6 pr-4 py-4 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] text-lg font-bold focus:border-[var(--color-primary)] outline-none transition-all" 
                      placeholder="e.g. 10 to 12 digit VC" 
                    />
                  </div>
                  <button
                    type="button"
                    disabled={validating || !operator || !subscriberId}
                    onClick={lookupCustomerDetails}
                    className="px-4 bg-[var(--glass-button-bg)] border border-[var(--glass-border)] hover:bg-[var(--color-primary-glow)] rounded-2xl flex items-center justify-center text-[var(--color-primary)] disabled:opacity-30 cursor-pointer transition-all"
                    title="Validate Subscriber Details"
                  >
                    {validating ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-wider px-1">Verify</span>
                    )}
                  </button>
                </div>
                <div className="mt-2 ml-1 text-[10px] font-bold">
                  {customerVerified ? (
                    <span className="text-emerald-500">✓ Customer Verified</span>
                  ) : (
                    <span className="text-amber-500">Customer verification required</span>
                  )}
                </div>
              </div>
            </div>

            {/* Form Right */}
            <div className="space-y-6">
              <div>
                <label className="block text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3 ml-1">Recharge Amount (₹)</label>
                <input 
                  type="text" 
                  value={amount} 
                  onChange={e => {
                    let val = e.target.value.replace(/\D/g, '');
                    if (val.startsWith('0')) {
                      val = val.replace(/^0+/, '');
                    }
                    setAmount(val);
                  }} 
                  className="w-full px-6 py-4 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] text-xl font-bold focus:border-[var(--color-primary)] outline-none transition-all placeholder:text-[var(--text-muted)]" 
                  placeholder="0.00" 
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-1.5 ml-1">
                  Minimum recharge amount: ₹100
                </p>
                {amount && Number(amount) < 100 && (
                  <p className="text-[10px] text-red-500 font-bold mt-1 ml-1">
                    Recharge amount must be at least ₹100
                  </p>
                )}
              </div>

              {/* Customer Details Panel */}
              <AnimatePresence>
                {customerInfo && customerInfo.success && (
                  <Motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl space-y-3"
                  >
                    <div className="flex items-center gap-2 pb-2 border-b border-[var(--glass-border)] text-emerald-400">
                      <User className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-wider">Subscriber Details</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="block text-[8px] text-[var(--text-muted)] uppercase tracking-widest font-black">Customer Name</span>
                        <span className="font-bold text-[var(--text-color)]">{customerInfo.customerName}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] text-[var(--text-muted)] uppercase tracking-widest font-black">Current Balance</span>
                        <span className="font-bold text-[var(--text-color)]">₹{customerInfo.balance || "0.00"}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] text-[var(--text-muted)] uppercase tracking-widest font-black">Active Plan</span>
                        <span className="font-bold text-[var(--text-color)] truncate block max-w-full" title={customerInfo.planName}>{customerInfo.planName || "N/A"}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] text-[var(--text-muted)] uppercase tracking-widest font-black">Next Due Date</span>
                        <span className="font-bold text-[var(--text-color)]">{customerInfo.dueDate || "N/A"}</span>
                      </div>
                    </div>
                  </Motion.div>
                )}
              </AnimatePresence>

              {!customerInfo && (
                <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-3xl text-center flex flex-col items-center justify-center space-y-1.5 min-h-[120px]">
                  <Tv className="w-7 h-7 text-[var(--color-primary)] animate-pulse" />
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">Direct to Home</p>
                  <p className="text-white text-xs font-black uppercase italic tracking-tight">Real-Time Routing Enabled</p>
                </div>
              )}
            </div>
          </div>

          {/* DTH Plans Browsing */}
          {operator && (
            <div className="space-y-6 pt-6 border-t border-[var(--glass-border)]">
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-black text-[var(--text-color)] uppercase tracking-[0.3em]">DTH operator plans</h3>
                {plansLoading && (
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                    Fetching Plans
                  </div>
                )}
              </div>

              {plansLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                  <div className="h-44 bg-[var(--bg-tertiary)]/20 border border-[var(--glass-border)] rounded-3xl animate-pulse"></div>
                  <div className="h-44 bg-[var(--bg-tertiary)]/20 border border-[var(--glass-border)] rounded-3xl animate-pulse"></div>
                  <div className="h-44 bg-[var(--bg-tertiary)]/20 border border-[var(--glass-border)] rounded-3xl animate-pulse"></div>
                </div>
              ) : tabs.length > 0 ? (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-[var(--glass-border)]">
                    {tabs.map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all flex-shrink-0 cursor-pointer ${
                          activeTab === tab
                            ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary-glow)]'
                            : 'bg-[var(--glass-button-bg)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-color)] border border-[var(--glass-border)]'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                    {currentPlans.length > 0 ? (
                      currentPlans.map((plan, idx) => (
                        <PlanCard key={idx} plan={plan} onSelect={setAmount} />
                      ))
                    ) : (
                      <div className="col-span-full py-12 text-center bg-[var(--bg-tertiary)]/20 rounded-3xl border border-[var(--glass-border)] border-dashed">
                        <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">No plans found in this category</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-12 text-center bg-[var(--bg-tertiary)]/20 border border-[var(--glass-border)] border-dashed rounded-3xl flex flex-col items-center justify-center gap-2">
                  <Info className="w-5 h-5 text-[var(--text-muted)]" />
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">No live plans available for this operator.</p>
                  <p className="text-[9px] text-[var(--text-secondary)] uppercase font-bold">You can still enter amount manually and proceed with checkout.</p>
                </div>
              )}
            </div>
          )}

          {/* Awaiting Input State */}
          {!operator && (
            <div className="py-16 border border-dashed border-[var(--glass-border)] rounded-[2rem] flex flex-col items-center justify-center gap-4 text-center bg-[var(--bg-tertiary)]/20">
              <div className="w-14 h-14 bg-[var(--bg-secondary)] rounded-2xl shadow-sm flex items-center justify-center border border-[var(--glass-border)] text-[var(--color-primary)]">
                <Tv className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-black text-[var(--text-color)] uppercase tracking-widest">Awaiting Operator & VC Number</p>
                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">Select your provider and enter ID above to load details</p>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex justify-end pt-4 border-t border-[var(--glass-border)]">
            <button 
              type="button"
              disabled={loading || !operator || !subscriberId || !amount || Number(amount) < 100} 
              onClick={() => validateForm() && setShowRechargeModal(true)} 
              className="w-full md:w-auto px-12 py-4.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:opacity-95 text-white font-black rounded-2xl disabled:opacity-40 hover:shadow-lg hover:shadow-[var(--color-primary-glow)] transition-all transform active:scale-95 text-[11px] uppercase tracking-widest cursor-pointer border-none"
            >
              {loading ? 'Processing transaction...' : 'Authorize Recharge'}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showRechargeModal && (
          <RechargePaymentModal 
            isOpen={showRechargeModal} 
            onClose={() => setShowRechargeModal(false)} 
            onConfirm={handleRechargeDirectly} 
            amount={amount} 
            mobile={subscriberId} 
            operator={operator} 
          />
        )}
      </AnimatePresence>
    </Motion.div>
  );
}
