import React, { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import RechargePaymentModal from '../components/RechargePaymentModal';
import { OPERATORS, operatorMeta } from '../config/operators';
import { Smartphone, ChevronDown, CheckCircle2, Activity, ShieldCheck, Zap, Wifi, Tv, PhoneCall, Award } from 'lucide-react';

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

const PlanCard = memo(({ plan, onSelect }) => (
  <motion.div
    whileHover={{ y: -4, borderColor: '#06b6d4', boxShadow: '0 12px 24px -8px rgba(6, 182, 212, 0.15)' }}
    className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col justify-between transition-all relative overflow-hidden group"
  >
    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
    
    <div>
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-3xl font-black text-slate-900 tracking-tighter">₹{plan.amount}</span>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Plan Voucher</p>
        </div>
        <span className="bg-cyan-50 text-cyan-600 border border-cyan-100 text-[9px] font-black uppercase px-3 py-1 rounded-full shadow-sm">
          {plan.validity}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 py-4 my-4 border-y border-slate-100 bg-slate-50/50 rounded-2xl p-4">
        <div className="flex items-center gap-2.5">
          <Wifi className="w-4 h-4 text-cyan-600" />
          <div>
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Data</span>
            <span className="text-xs font-black text-slate-900">{plan.data}</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <PhoneCall className="w-4 h-4 text-cyan-600" />
          <div>
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Voice</span>
            <span className="text-xs font-black text-slate-900 truncate">{plan.calls || plan.unlimitedCalls || "Unlimited"}</span>
          </div>
        </div>
      </div>

      {plan.ottBenefits && plan.ottBenefits !== "None" && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-purple-50 border border-purple-100 rounded-xl text-purple-700">
          <Tv className="w-4 h-4 flex-shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-wider truncate">{plan.ottBenefits} Included</span>
        </div>
      )}

      <p className="text-[11px] text-slate-500 font-medium leading-relaxed line-clamp-2 mb-6">
        {plan.description}
      </p>
    </div>

    <button
      onClick={() => onSelect(plan)}
      className="w-full py-4 bg-slate-900 group-hover:bg-cyan-600 text-white font-black rounded-2xl shadow-md group-hover:shadow-lg group-hover:shadow-cyan-600/20 transition-all transform active:scale-95 text-[11px] uppercase tracking-widest"
    >
      View Details
    </button>
  </motion.div>
));

const ShimmerCard = () => (
  <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl h-72 animate-pulse flex flex-col justify-between">
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div className="w-24 h-8 bg-slate-200 rounded-xl"></div>
        <div className="w-16 h-6 bg-slate-200 rounded-full"></div>
      </div>
      <div className="w-full h-16 bg-slate-200 rounded-2xl"></div>
      <div className="space-y-2">
        <div className="w-full h-3 bg-slate-200 rounded"></div>
        <div className="w-3/4 h-3 bg-slate-200 rounded"></div>
      </div>
    </div>
    <div className="w-full h-12 bg-slate-200 rounded-2xl"></div>
  </div>
);

const PlanDetailsModal = ({ isOpen, onClose, plan, operator, circle, onConfirm }) => {
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  if (!isOpen || !plan) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden relative flex flex-col max-h-[90vh]"
      >
        {/* Top Header */}
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between sticky top-0 z-20 backdrop-blur-sm">
          <div>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Plan details • ₹{plan.amount}</h3>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {plan.operator || operatorMeta[operator]?.label || 'Mobile'} • {plan.circle || circle || 'Delhi NCR'} • Prepaid Voucher
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-all"
          >
            <span className="text-2xl font-bold leading-none">&times;</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-8 space-y-8 overflow-y-auto flex-1 no-scrollbar">
          {/* Benefit Summary Section (Compact Info Cards Grid) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col items-center text-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Validity</span>
              <span className="text-base font-black text-slate-900">{plan.validity || 'N/A'}</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col items-center text-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Daily Data</span>
              <span className="text-base font-black text-slate-900">{plan.data || 'N/A'}</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col items-center text-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Calls</span>
              <span className="text-base font-black text-slate-900 truncate w-full">{plan.calls || plan.unlimitedCalls || 'Unlimited'}</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col items-center text-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SMS</span>
              <span className="text-base font-black text-slate-900 truncate w-full">{plan.sms || '100/day'}</span>
            </div>
          </div>

          {/* Full Description Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Full Description</h4>
            <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-6">
              <p className={`text-xs text-slate-600 font-medium leading-relaxed ${isDescExpanded ? '' : 'line-clamp-3'}`}>
                {plan.description || 'No description available.'}
              </p>
              {(plan.description?.length || 0) > 120 && (
                <div className="mt-4 pt-4 border-t border-slate-200/60 flex justify-center">
                  <button 
                    onClick={() => setIsDescExpanded(!isDescExpanded)}
                    className="text-xs font-black text-cyan-600 hover:text-cyan-700 uppercase tracking-widest flex items-center gap-1 transition-all"
                  >
                    {isDescExpanded ? 'View less' : 'View more'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* OTT Benefits Section */}
          {plan.ottList && plan.ottList.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">OTT & App Benefits</h4>
              <div className="grid grid-cols-1 gap-3">
                {plan.ottList.map((ott, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-purple-50/50 border border-purple-100 rounded-2xl">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0 text-purple-600">
                      <Tv className="w-6 h-6" />
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-slate-900 uppercase tracking-tight">{ott.name}</h5>
                      <p className="text-[11px] text-slate-600 font-medium mt-0.5">{ott.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan Meta Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Plan Information</h4>
            <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-6 divide-y divide-slate-100">
              <div className="flex justify-between py-3 first:pt-0">
                <span className="text-xs font-bold text-slate-500">Operator</span>
                <span className="text-xs font-black text-slate-900">{plan.operator || operatorMeta[operator]?.label || 'Mobile'}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-xs font-bold text-slate-500">Circle</span>
                <span className="text-xs font-black text-slate-900">{plan.circle || circle || 'Delhi NCR'}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-xs font-bold text-slate-500">5G Support</span>
                <span className={`text-xs font-black ${plan.has5G ? 'text-emerald-600' : 'text-slate-600'}`}>
                  {plan.has5G ? 'True 5G Unlimited Eligible' : 'Standard 4G/5G'}
                </span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-xs font-bold text-slate-500">Roaming Support</span>
                <span className="text-xs font-black text-slate-900">{plan.roaming || 'National Roaming Included'}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-xs font-bold text-slate-500">Fair Usage Policy</span>
                <span className="text-xs font-black text-slate-900">Post FUP speed 64 Kbps</span>
              </div>
              <div className="flex justify-between py-3 last:pb-0">
                <span className="text-xs font-bold text-slate-500">Updated Date</span>
                <span className="text-xs font-black text-slate-900">
                  {plan.updatedAt ? new Date(plan.updatedAt).toLocaleDateString() : new Date().toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Bottom CTA */}
        <div className="p-6 border-t border-slate-100 bg-white sticky bottom-0 z-20 shadow-lg flex justify-end">
          <button 
            onClick={() => onConfirm(plan)}
            className="w-full md:w-auto px-12 py-5 bg-slate-900 hover:bg-cyan-600 text-white font-black rounded-2xl shadow-xl shadow-slate-900/20 hover:shadow-cyan-600/20 transition-all text-xs uppercase tracking-widest active:scale-95"
          >
            Continue with ₹{plan.amount}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function MobilePrepaid() {
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('');
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [plansData, setPlansData] = useState({});
  const [activeTab, setActiveTab] = useState('popular');
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [selectedPlanDetails, setSelectedPlanDetails] = useState(null);
  const [showPlanDetailsModal, setShowPlanDetailsModal] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [detectedCircle, setDetectedCircle] = useState('');
  const navigate = useNavigate();

  // 800ms Debounce Auto-Detection & Live Plan Fetching
  useEffect(() => {
    if (number.length === 10 && /^[6-9]\d{9}$/.test(number)) {
      const timer = setTimeout(async () => {
        setDetecting(true);
        try {
          const { data } = await api.post('/recharge/prepaid/init', { mobile: number });
          if (data.success) {
            setPlansData(data.plans || {});
            setDetectedCircle(data.circle?.name || 'Delhi NCR');
            
            const opName = data.operator?.name?.toUpperCase() || '';
            if (opName.includes('AIRTEL')) setOperator(OPERATORS.AIRTEL);
            else if (opName.includes('VI') || opName.includes('VODAFONE') || opName.includes('IDEA')) setOperator(OPERATORS.VI);
            else if (opName.includes('BSNL')) setOperator(OPERATORS.BSNL_TOPUP);
            else if (opName.includes('JIO')) setOperator(OPERATORS.JIO);
            else setOperator(OPERATORS.JIO);

            if (data.fallbackFlags?.revealDropdown || data.fallbackFlags?.revealAmount) {
              setFallbackMode(true);
            } else {
              setFallbackMode(false);
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
      setPlansData({});
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
      toast.error("Please enter a valid amount");
      return false;
    }
    return true;
  };

  const handlePlanSelect = (plan) => {
    setSelectedPlanDetails(plan);
    setShowPlanDetailsModal(true);
  };

  const handlePlanDetailsConfirm = (plan) => {
    setAmount(plan.amount.toString());
    setShowPlanDetailsModal(false);
    setShowRechargeModal(true);
  };

  const handleRechargeDirectly = async () => {
    if (!validateForm()) return;
    setShowRechargeModal(false);
    const lt = toast.loading('Initiating secure recharge...');
    setLoading(true);
    try {
      const opCode = operatorMeta[operator]?.code;
      const { data } = await api.post('/recharge', { 
        mobile: number, 
        operatorCode: opCode, 
        amount: Number(amount) 
      });
      
      if (data.success) {
        toast.success("Recharge Authorized Successfully", { id: lt });
        navigate('/user/transactions');
      } else throw new Error(data.message || "Recharge failed");
    } catch(err) {
      toast.error(err.safeMessage || "Recharge could not be processed.", { id: lt });
    } finally { setLoading(false); }
  };

  const tabs = [
    { id: 'popular', label: 'Popular' },
    { id: 'unlimited', label: 'Truly Unlimited' },
    { id: 'data', label: 'Data' },
    { id: 'talktime', label: 'Talktime' },
    { id: 'annual', label: 'Annual' }
  ];

  const currentPlans = plansData[activeTab] || [];
  const hasPlans = Object.keys(plansData).some(k => plansData[k]?.length > 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-8 py-6 px-4 md:px-0">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-cyan-500/5 to-transparent pointer-events-none"></div>
        <div className="px-6 md:px-10 py-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Zap className="w-6 h-6 text-cyan-600" />
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase italic">Mobile <span className="text-cyan-600">Prepaid</span></h2>
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Intelligent Auto-Detect Recharge Gateway</p>
          </div>
          {operator && detectedCircle && (
            <div className="flex items-center gap-3 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Signal:</span>
              <span className="text-xs font-black uppercase tracking-wider text-cyan-600">{operatorMeta[operator]?.label} • {detectedCircle}</span>
            </div>
          )}
        </div>

        <div className="p-6 md:p-10 space-y-8 relative z-10">
          {/* Input Section */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className={`md:col-span-${fallbackMode ? '4' : '6'} space-y-2`}>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mobile Terminal</label>
              <div className="relative">
                <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
                <input 
                  type="tel" 
                  maxLength="10" 
                  value={number} 
                  onChange={e => setNumber(e.target.value.replace(/\D/g, ''))} 
                  className="w-full pl-14 pr-12 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-xl font-bold focus:border-cyan-50 transition-all outline-none shadow-inner" 
                  placeholder="Enter 10-digit number" 
                />
                {detecting && (
                  <div className="absolute right-5 top-1/2 -translate-y-1/2">
                    <div className="animate-spin h-5 w-5 border-2 border-cyan-600 border-t-transparent rounded-full"></div>
                  </div>
                )}
              </div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest ml-1">Auto-fetches operator & best plans</p>
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
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Recharge Amount (₹)</label>
                <input 
                  type="tel" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} 
                  className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-xl font-bold focus:border-cyan-50 transition-all outline-none shadow-inner" 
                  placeholder="0.00" 
                />
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest ml-1">Enter custom amount</p>
              </motion.div>
            )}

            {!fallbackMode && (
              <div className="md:col-span-6 flex items-center justify-end h-full pt-6">
                <div className="flex items-center gap-6 px-8 py-5 bg-slate-900 text-white rounded-2xl shadow-lg w-full md:w-auto justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-emerald-400" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider">LIVE NETWORK DETECTION</p>
                      <p className="text-[9px] text-slate-400 font-medium">REALTIME ROUTING ACTIVE</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-3 py-1 bg-white/10 rounded-xl text-cyan-300 border border-white/10">Protected</span>
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
                className="w-full md:w-auto px-12 py-5 bg-cyan-600 hover:bg-cyan-700 text-white font-black rounded-2xl shadow-xl shadow-cyan-600/20 transition-all text-xs uppercase tracking-widest active:scale-95"
              >
                {loading ? 'Authorizing...' : 'Proceed with Manual Recharge'}
              </button>
            </div>
          )}

          {/* Categorized Plans Section */}
          {!fallbackMode && number.length === 10 && (
            <div className="space-y-6 pt-6 border-t border-slate-100">
              {/* Category Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-slate-100">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex-shrink-0 ${
                      activeTab === tab.id
                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Plan Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                {detecting ? (
                  [1, 2, 3].map(i => <ShimmerCard key={i} />)
                ) : currentPlans.length > 0 ? (
                  currentPlans.map((plan, idx) => (
                    <PlanCard key={idx} plan={plan} onSelect={handlePlanSelect} />
                  ))
                ) : hasPlans ? (
                  <div className="col-span-full py-16 text-center bg-slate-50/50 rounded-3xl border border-slate-100 border-dashed">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No plans available in this category</p>
                  </div>
                ) : (
                  <div className="col-span-full py-16 text-center bg-slate-50/50 rounded-3xl border border-slate-100 border-dashed flex flex-col items-center justify-center gap-3">
                    <Activity className="w-8 h-8 text-slate-300" />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No live plans found for this number</p>
                    <button onClick={() => setFallbackMode(true)} className="mt-2 text-xs font-black text-cyan-600 uppercase tracking-widest underline">
                      Enter Amount Manually
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Awaiting Input Prompt */}
          {number.length < 10 && (
            <div className="py-20 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center gap-4 text-center bg-slate-50/30">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-slate-100">
                <Smartphone className="w-8 h-8 text-cyan-600" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-700 uppercase tracking-widest">Awaiting 10-Digit Mobile Number</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Enter number above to instantly unlock premium operator plans</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showPlanDetailsModal && (
          <PlanDetailsModal 
            isOpen={showPlanDetailsModal} 
            onClose={() => setShowPlanDetailsModal(false)} 
            plan={selectedPlanDetails} 
            operator={operator} 
            circle={detectedCircle} 
            onConfirm={handlePlanDetailsConfirm} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRechargeModal && (
          <RechargePaymentModal 
            isOpen={showRechargeModal} 
            onClose={() => setShowRechargeModal(false)} 
            onConfirm={handleRechargeDirectly} 
            amount={amount} 
            mobile={number} 
            operator={operator} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
