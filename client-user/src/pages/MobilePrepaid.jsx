import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import RechargePaymentModal from '../components/RechargePaymentModal';
import OperatorInputAdornment from '../components/OperatorInputAdornment';
import OperatorLogo from '../components/OperatorLogo';
import { OPERATORS, operatorMeta } from '../config/operators';
import { Smartphone, ChevronDown, CheckCircle2, Activity, ShieldCheck, Zap, Wifi, Tv, PhoneCall, Award } from 'lucide-react';
import { isIOSDevice } from '../utils/device';

const OperatorDropdown = memo(({ selected, onSelect }) => {
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
        className="w-full flex items-center justify-between px-4 py-4 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] font-bold focus:border-cyan-500 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-black uppercase tracking-tight">
            {selected ? operatorMeta[selected]?.label : "Select Operator"}
          </span>
          {selected && <div className={`w-2 h-2 rounded-full bg-cyan-400 animate-pulse`} />}
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
            {PREPAID_OPERATOR_OPTIONS.map(op => {
              const meta = operatorMeta[op];
              return (
                <button
                  key={op}
                  onClick={() => { onSelect(op); setIsOpen(false); }}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-cyan-500/10 transition-all border-b border-[var(--glass-border)] last:border-none cursor-pointer"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{meta.label}</span>
                  {selected === op && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                </button>
              );
            })}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

const PREPAID_OPERATOR_OPTIONS = [
  OPERATORS.AIRTEL,
  OPERATORS.JIO,
  OPERATORS.VI,
  OPERATORS.BSNL_TOPUP,
  OPERATORS.BSNL_SPECIAL,
  OPERATORS.MTNL
].filter(Boolean);

const mapDetectedOperator = (operatorName = '') => {
  const opName = operatorName.toUpperCase();
  if (opName.includes('AIRTEL')) return OPERATORS.AIRTEL;
  if (opName.includes('VI') || opName.includes('VODAFONE') || opName.includes('IDEA')) return OPERATORS.VI;
  if (opName.includes('BSNL')) return OPERATORS.BSNL_TOPUP;
  if (opName.includes('MTNL')) return OPERATORS.MTNL;
  if (opName.includes('JIO')) return OPERATORS.JIO;
  return '';
};

const OperatorSwitchPanel = memo(({ selectedOperator, detectedOperator, isManualOverride, isOpen, loading, onToggle, onSelect }) => {
  if (!selectedOperator && !detectedOperator && !isOpen) return null;
  const displayOperator = selectedOperator || detectedOperator;

  return (
    <Motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex flex-col gap-3 rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-input-bg)]/80 p-4 shadow-lg shadow-cyan-950/5 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 shadow-inner">
              <OperatorLogo operator={displayOperator} imageClassName="h-8 w-8" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black uppercase tracking-tight text-[var(--text-color)]">
                {operatorMeta[displayOperator]?.label || 'Choose Operator'}
              </p>
              {displayOperator && (
                <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${
                  isManualOverride
                    ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                    : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                }`}>
                  {isManualOverride ? 'Manually Selected' : 'Detected Automatically'}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="mt-1 text-left text-[10px] font-black uppercase tracking-widest text-cyan-400 transition-colors hover:text-cyan-300"
            >
              {displayOperator ? 'Wrong operator? Change manually' : 'Select operator manually'}
            </button>
          </div>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            Refreshing Plans
          </div>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <Motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-3 rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-modal-bg)]/80 p-3 shadow-xl backdrop-blur-2xl sm:grid-cols-3 md:flex md:overflow-x-auto md:pb-4">
              {PREPAID_OPERATOR_OPTIONS.map((op) => {
                const active = selectedOperator === op;
                return (
                  <button
                    key={op}
                    type="button"
                    disabled={loading}
                    onClick={() => onSelect(op)}
                    className={`flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all md:min-w-[150px] ${
                      active
                        ? 'border-cyan-400 bg-cyan-400/15 shadow-lg shadow-cyan-500/10'
                        : 'border-[var(--glass-border)] bg-[var(--glass-button-bg)] hover:border-cyan-400/50 hover:bg-cyan-400/10'
                    } ${loading ? 'opacity-70' : ''}`}
                  >
                    <OperatorLogo operator={op} imageClassName="h-8 w-8" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black uppercase tracking-tight text-[var(--text-color)]">{operatorMeta[op]?.label}</p>
                      <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                        {detectedOperator === op ? 'Detected' : 'Prepaid'}
                      </p>
                    </div>
                    {active && <CheckCircle2 className="ml-auto h-4 w-4 flex-shrink-0 text-cyan-400" />}
                  </button>
                );
              })}
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </Motion.div>
  );
});

const PlanCard = memo(({ plan, onSelect }) => {
  const isIOS = isIOSDevice();

  return (
    <Motion.div
      whileHover={isIOS ? undefined : { y: -4, borderColor: 'var(--color-accent)', boxShadow: '0 12px 24px -8px var(--color-accent-glow)' }}
      className="glass-card border border-[var(--glass-border)] p-6 rounded-3xl shadow-sm flex flex-col justify-between transition-all relative overflow-hidden group"
    >
    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
    
    <div>
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-3xl font-black text-[var(--text-color)] tracking-tighter">₹{plan.amount}</span>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">Plan Voucher</p>
        </div>
        <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[9px] font-black uppercase px-3 py-1 rounded-full shadow-sm">
          {plan.validity}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 py-4 my-4 border-y border-[var(--glass-border)] bg-[var(--bg-tertiary)]/40 rounded-2xl p-4">
        <div className="flex items-center gap-2.5">
          <Wifi className="w-4 h-4 text-cyan-400" />
          <div>
            <span className="block text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Data</span>
            <span className="text-xs font-black text-[var(--text-color)]">{plan.data}</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <PhoneCall className="w-4 h-4 text-cyan-400" />
          <div>
            <span className="block text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Voice</span>
            <span className="text-xs font-black text-[var(--text-color)] truncate">{plan.calls || plan.unlimitedCalls || "Unlimited"}</span>
          </div>
        </div>
      </div>

      {plan.ottBenefits && plan.ottBenefits !== "None" && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
          <Tv className="w-4 h-4 flex-shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-wider truncate">{plan.ottBenefits} Included</span>
        </div>
      )}

      <p className="text-[11px] text-[var(--text-secondary)] font-medium leading-relaxed line-clamp-2 mb-6">
        {plan.description}
      </p>
    </div>

    <button
      onClick={() => onSelect(plan)}
      className="w-full py-4 bg-[var(--glass-button-bg)] border border-[var(--glass-border)] hover:bg-cyan-500 hover:text-slate-950 hover:border-cyan-500 text-[var(--text-color)] font-black rounded-2xl shadow-md hover:shadow-lg hover:shadow-cyan-600/20 transition-all transform active:scale-95 text-[11px] uppercase tracking-widest cursor-pointer"
    >
      View Details
    </button>
    </Motion.div>
  );
});

const ShimmerCard = () => (
  <div className="bg-[var(--bg-tertiary)]/20 border border-[var(--glass-border)] p-6 rounded-3xl h-72 animate-pulse flex flex-col justify-between">
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div className="w-24 h-8 bg-[var(--bg-secondary)] rounded-xl"></div>
        <div className="w-16 h-6 bg-[var(--bg-secondary)] rounded-full"></div>
      </div>
      <div className="w-full h-16 bg-[var(--bg-secondary)] rounded-2xl"></div>
      <div className="space-y-2">
        <div className="w-full h-3 bg-[var(--bg-secondary)] rounded"></div>
        <div className="w-3/4 h-3 bg-[var(--bg-secondary)] rounded"></div>
      </div>
    </div>
    <div className="w-full h-12 bg-[var(--bg-secondary)] rounded-2xl"></div>
  </div>
);

const PlanDetailsModal = ({ isOpen, onClose, plan, operator, circle, onConfirm }) => {
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [plan]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!isOpen || !plan) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 dark:bg-black/80 backdrop-blur-md overflow-hidden pointer-events-auto"
      style={{ willChange: 'opacity' }}
    >
      <Motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass-modal border border-[var(--glass-border)] rounded-[28px] shadow-2xl w-[calc(100vw-24px)] md:w-full md:max-w-[720px] overflow-hidden relative flex flex-col max-h-[90vh] min-h-0 gpu-accelerated pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 md:px-8 py-5 md:py-6 border-b border-[var(--glass-border)] bg-[var(--glass-modal-bg)] backdrop-blur-md flex items-center justify-between sticky top-0 z-30 min-h-0 sticky-layer-perf">
          <div className="min-w-0 flex-1">
            <h3 className="text-xl md:text-2xl font-black text-[var(--text-color)] tracking-tight text-break-anywhere break-words">Plan details • ₹{plan.amount}</h3>
            <p className="text-xs font-bold text-[var(--text-secondary)] mt-1 text-break-anywhere break-words">
              {plan.operator || operatorMeta[operator]?.label || 'Mobile'} • {plan.circle || circle || 'Delhi NCR'} • Prepaid Voucher
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 ml-4 rounded-full hover:bg-[var(--glass-button-bg)] text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-all cursor-pointer flex-shrink-0"
          >
            <span className="text-2xl font-bold leading-none">&times;</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div 
          ref={scrollContainerRef}
          tabIndex={0}
          onTouchMove={(e) => e.stopPropagation()}
          className="p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto overflow-x-hidden flex-1 premium-scrollbar min-h-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          {/* Benefit Summary Section (Compact Info Cards Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[var(--bg-secondary)]/60 border border-[var(--glass-border)] p-4 rounded-2xl flex flex-col items-center text-center min-w-0">
              <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Validity</span>
              <span className="text-base font-black text-[var(--text-color)] break-words w-full text-break-anywhere">{plan.validity || 'N/A'}</span>
            </div>
            <div className="bg-[var(--bg-secondary)]/60 border border-[var(--glass-border)] p-4 rounded-2xl flex flex-col items-center text-center min-w-0">
              <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Daily Data</span>
              <span className="text-base font-black text-[var(--text-color)] break-words w-full text-break-anywhere">{plan.data || 'N/A'}</span>
            </div>
            <div className="bg-[var(--bg-secondary)]/60 border border-[var(--glass-border)] p-4 rounded-2xl flex flex-col items-center text-center min-w-0">
              <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Calls</span>
              <span className="text-base font-black text-[var(--text-color)] break-words w-full text-break-anywhere">{plan.calls || plan.unlimitedCalls || 'Unlimited'}</span>
            </div>
            <div className="bg-[var(--bg-secondary)]/60 border border-[var(--glass-border)] p-4 rounded-2xl flex flex-col items-center text-center min-w-0">
              <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">SMS</span>
              <span className="text-base font-black text-[var(--text-color)] break-words w-full text-break-anywhere">{plan.sms || '100/day'}</span>
            </div>
          </div>

          {/* Full Description Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">Full Description</h4>
            <div className="bg-[var(--bg-secondary)]/60 border border-[var(--glass-border)] rounded-2xl p-6">
              <p className={`text-xs text-[var(--text-secondary)] font-medium leading-relaxed break-words text-break-anywhere ${isDescExpanded ? '' : 'line-clamp-3'}`}>
                {plan.description || 'No description available.'}
              </p>
              {(plan.description?.length || 0) > 120 && (
                <div className="mt-4 pt-4 border-t border-[var(--glass-border)] flex justify-center">
                  <button 
                    onClick={() => setIsDescExpanded(!isDescExpanded)}
                    className="text-xs font-black text-cyan-400 hover:text-cyan-300 uppercase tracking-widest flex items-center gap-1 transition-all cursor-pointer"
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
              <h4 className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">OTT & App Benefits</h4>
              <div className="grid grid-cols-1 gap-3">
                {plan.ottList.map((ott, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0 text-purple-400">
                      <Tv className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-black text-[var(--text-color)] uppercase tracking-tight break-words text-break-anywhere">{ott.name}</h5>
                      <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-0.5 break-words text-break-anywhere">{ott.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan Meta Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">Plan Information</h4>
            <div className="bg-[var(--bg-secondary)]/60 border border-[var(--glass-border)] rounded-2xl p-6 divide-y divide-[var(--glass-border)]">
              <div className="flex justify-between flex-wrap items-start sm:items-center gap-2 py-3 first:pt-0">
                <span className="text-xs font-bold text-[var(--text-secondary)]">Operator</span>
                <span className="text-xs font-black text-[var(--text-color)] break-words text-right text-break-anywhere">{plan.operator || operatorMeta[operator]?.label || 'Mobile'}</span>
              </div>
              <div className="flex justify-between flex-wrap items-start sm:items-center gap-2 py-3">
                <span className="text-xs font-bold text-[var(--text-secondary)]">Circle</span>
                <span className="text-xs font-black text-[var(--text-color)] break-words text-right text-break-anywhere">{plan.circle || circle || 'Delhi NCR'}</span>
              </div>
              <div className="flex justify-between flex-wrap items-start sm:items-center gap-2 py-3">
                <span className="text-xs font-bold text-[var(--text-secondary)]">5G Support</span>
                <span className={`text-xs font-black break-words text-right text-break-anywhere ${plan.has5G ? 'text-emerald-400' : 'text-[var(--text-secondary)]'}`}>
                  {plan.has5G ? 'True 5G Unlimited Eligible' : 'Standard 4G/5G'}
                </span>
              </div>
              <div className="flex justify-between flex-wrap items-start sm:items-center gap-2 py-3">
                <span className="text-xs font-bold text-[var(--text-secondary)]">Roaming Support</span>
                <span className="text-xs font-black text-[var(--text-color)] break-words text-right text-break-anywhere">{plan.roaming || 'National Roaming Included'}</span>
              </div>
              <div className="flex justify-between flex-wrap items-start sm:items-center gap-2 py-3">
                <span className="text-xs font-bold text-[var(--text-secondary)]">Fair Usage Policy</span>
                <span className="text-xs font-black text-[var(--text-color)] break-words text-right text-break-anywhere">{plan.fup || 'Post FUP speed 64 Kbps'}</span>
              </div>
              <div className="flex justify-between flex-wrap items-start sm:items-center gap-2 py-3 last:pb-0">
                <span className="text-xs font-bold text-[var(--text-secondary)]">Updated Date</span>
                <span className="text-xs font-black text-[var(--text-color)] break-words text-right text-break-anywhere">
                  {plan.updatedAt ? new Date(plan.updatedAt).toLocaleDateString() : new Date().toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Bottom CTA */}
        <div className="p-5 md:p-6 border-t border-[var(--glass-border)] bg-[var(--glass-modal-bg)] backdrop-blur-md sticky bottom-0 z-20 shadow-lg flex justify-end isolate sticky-layer-perf modal-footer-safe-area">
          <button 
            onClick={() => onConfirm(plan)}
            className="w-full sm:w-auto px-12 py-5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-cyan-600/20 hover:shadow-cyan-600/20 transition-all text-xs uppercase tracking-widest active:scale-95 cursor-pointer"
          >
            Continue with ₹{plan.amount}
          </button>
        </div>
      </Motion.div>
    </div>
  );
};

export default function MobilePrepaid() {
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [detectedOperator, setDetectedOperator] = useState('');
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [showOperatorSelector, setShowOperatorSelector] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansData, setPlansData] = useState({});
  const [activeTab, setActiveTab] = useState('popular');
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [selectedPlanDetails, setSelectedPlanDetails] = useState(null);
  const [showPlanDetailsModal, setShowPlanDetailsModal] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [detectedCircle, setDetectedCircle] = useState('');
  const [detectedCircleCode, setDetectedCircleCode] = useState('');
  const navigate = useNavigate();
  const isIOS = isIOSDevice();
  const operator = selectedOperator;
  const planRequestRef = useRef({ id: 0, controller: null });
  const detectionRequestRef = useRef({ id: 0, controller: null });
  const planCacheKeyRef = useRef('');
  const detectionStateRef = useRef({
    selectedOperator: '',
    detectedOperator: '',
    detectedCircle: '',
    detectedCircleCode: '',
    fallbackMode: false,
    hasPlans: false,
  });

  useEffect(() => {
    detectionStateRef.current = {
      selectedOperator,
      detectedOperator,
      detectedCircle,
      detectedCircleCode,
      fallbackMode,
      hasPlans: Object.keys(plansData).length > 0,
    };
  }, [selectedOperator, detectedOperator, detectedCircle, detectedCircleCode, fallbackMode, plansData]);

  const fetchPlansForOperator = useCallback(async (nextOperator, circleName = detectedCircle || 'Delhi NCR') => {
    if (!nextOperator || number.length !== 10 || !/^[6-9]\d{9}$/.test(number)) return;

    const meta = operatorMeta[nextOperator];
    const mplanCode = meta?.mplanCode;
    if (!mplanCode) {
      setPlansData({});
      return;
    }

    const fetchKey = `${number}:${nextOperator}:${circleName}`;
    if (planCacheKeyRef.current === fetchKey && Object.keys(plansData).length > 0) return;

    if (planRequestRef.current.controller) {
      planRequestRef.current.controller.abort();
    }

    const requestId = planRequestRef.current.id + 1;
    const controller = new AbortController();
    planRequestRef.current = { id: requestId, controller };
    setPlansLoading(true);
    console.log("[MPLAN_FETCH]", {
      operator: meta.label,
      circle: circleName,
      mplanCode
    });

    try {
      const { data } = await api.get('/recharge/plans', {
        params: {
          operatorCode: mplanCode,
          operatorName: meta.label,
          circleName,
          circleCode: detectedCircleCode || undefined
        },
        signal: controller.signal
      });

      if (planRequestRef.current.id !== requestId) return;

      if (data.success) {
        setPlansData(data.plans || {});
        planCacheKeyRef.current = fetchKey;
        const categories = Object.keys(data.plans || {}).filter((key) => Array.isArray(data.plans?.[key]) && data.plans[key].length > 0);
        const totalPlans = categories.reduce((sum, key) => sum + data.plans[key].length, 0);
        console.log("[PLAN_FETCH_SUCCESS]", { totalPlans, categories });
      } else {
        setPlansData({});
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        setPlansData({});
        toast.error("Unable to refresh plans for selected operator.");
      }
    } finally {
      if (planRequestRef.current.id === requestId) {
        setPlansLoading(false);
      }
    }
  }, [detectedCircle, detectedCircleCode, number, plansData]);

  // Debounced Auto-Detection & Live Plan Fetching
  useEffect(() => {
    if (number.length === 10 && /^[6-9]\d{9}$/.test(number)) {
      const timer = setTimeout(async () => {
        if (detectionRequestRef.current.controller) {
          detectionRequestRef.current.controller.abort();
        }

        const requestId = detectionRequestRef.current.id + 1;
        const controller = new AbortController();
        detectionRequestRef.current = { id: requestId, controller };
        setDetecting(true);
        try {
          const { data } = await api.post('/recharge/prepaid/init', { mobile: number }, { signal: controller.signal });
          if (detectionRequestRef.current.id !== requestId) return;

          if (data.success) {
            const circleName = data.circle?.name || 'Delhi NCR';
            const circleCode = data.circle?.code || 5;
            setPlansData(data.plans || {});
            setDetectedCircle(circleName);
            setDetectedCircleCode(String(circleCode));
            
            const detected = mapDetectedOperator(data.operator?.name || '') || OPERATORS.JIO;
            console.log("[HLR_DETECTED]", {
              mobile: number,
              operator: data.operator?.name || operatorMeta[detected]?.label,
              circle: circleName
            });
            setDetectedOperator(detected);
            setSelectedOperator(detected);
            setIsManualOverride(false);
            setShowOperatorSelector(false);
            planCacheKeyRef.current = `${number}:${detected}:${circleName}`;

            if (data.fallbackFlags?.revealDropdown || data.fallbackFlags?.revealAmount) {
              setFallbackMode(true);
            } else {
              setFallbackMode(false);
            }
          } else {
            setSelectedOperator('');
            setDetectedOperator('');
            setIsManualOverride(false);
            setShowOperatorSelector(true);
            setFallbackMode(true);
            toast.error("Automatic detection unavailable.");
          }
        } catch (err) {
          if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
          setSelectedOperator('');
          setDetectedOperator('');
          setIsManualOverride(false);
          setShowOperatorSelector(true);
          setFallbackMode(true);
          toast.error("Unable to load recharge plans.");
        } finally {
          if (detectionRequestRef.current.id === requestId) {
            setDetecting(false);
          }
        }
      }, isIOS ? 1000 : 800);

      return () => clearTimeout(timer);
    } else if (
      detectionStateRef.current.selectedOperator ||
      detectionStateRef.current.detectedOperator ||
      detectionStateRef.current.detectedCircle ||
      detectionStateRef.current.detectedCircleCode ||
      detectionStateRef.current.fallbackMode ||
      detectionStateRef.current.hasPlans
    ) {
      const resetTimer = setTimeout(() => {
        if (planRequestRef.current.controller) planRequestRef.current.controller.abort();
        if (detectionRequestRef.current.controller) detectionRequestRef.current.controller.abort();
        setPlansData({});
        setDetectedCircle('');
        setDetectedCircleCode('');
        setSelectedOperator('');
        setDetectedOperator('');
        setIsManualOverride(false);
        setShowOperatorSelector(false);
        setFallbackMode(false);
        planCacheKeyRef.current = '';
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

  const handleOperatorOverride = useCallback((nextOperator) => {
    if (!nextOperator || nextOperator === selectedOperator) {
      setShowOperatorSelector(false);
      return;
    }

    setSelectedOperator(nextOperator);
    setIsManualOverride(true);
    setShowOperatorSelector(false);
    setPlansData({});
    setSelectedPlanDetails(null);
    console.log("[MANUAL_OPERATOR_OVERRIDE]", {
      previousOperator: operatorMeta[selectedOperator]?.label || selectedOperator || 'None',
      selectedOperator: operatorMeta[nextOperator]?.label || nextOperator
    });
    fetchPlansForOperator(nextOperator);
  }, [fetchPlansForOperator, selectedOperator]);

  useEffect(() => {
    return () => {
      if (planRequestRef.current.controller) {
        planRequestRef.current.controller.abort();
      }
      if (detectionRequestRef.current.controller) {
        detectionRequestRef.current.controller.abort();
      }
    };
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
    if (!operatorMeta[operator]?.code) {
      toast.error("This operator is available for plan browsing only right now");
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
        toast.success("Recharge queued", { id: lt });
        navigate('/reports/transactions');
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
    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-8 py-6 px-4 md:px-0 relative z-10">
      {/* Header */}
      <div className="glass-card border border-[var(--glass-border)] rounded-[2.5rem] shadow-xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-cyan-500/5 to-transparent pointer-events-none"></div>
        <div className="px-6 md:px-10 py-8 border-b border-[var(--glass-border)] bg-[var(--bg-tertiary)]/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Zap className="w-6 h-6 text-cyan-400 cyan-glow" />
              <h2 className="text-2xl md:text-3xl font-black text-[var(--text-color)] tracking-tight uppercase italic">Mobile <span className="text-cyan-400 cyan-glow">Prepaid</span></h2>
            </div>
            <p className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-widest">Intelligent Auto-Detect Recharge Gateway</p>
          </div>
          {operator && detectedCircle && (
            <div className="flex max-w-full flex-wrap items-center gap-2 px-4 py-2.5 bg-[var(--bg-secondary)]/60 border border-[var(--glass-border)] rounded-2xl shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">OPERATOR:</span>
              <span className="min-w-0 break-words text-xs font-black uppercase tracking-wider text-cyan-400">{operatorMeta[operator]?.label} • {detectedCircle}</span>
            </div>
          )}
        </div>

        <div className="p-6 md:p-10 space-y-8 relative z-10">
          {/* Input Section */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className={`md:col-span-${fallbackMode ? '4' : '6'} space-y-2`}>
              <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Mobile Terminal</label>
              <div className="relative">
                <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-[var(--text-secondary)]" />
                <input 
                  type="tel" 
                  maxLength="10" 
                  value={number} 
                  onChange={handleNumberChange} 
                  className="w-full pl-14 pr-20 py-5 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] text-lg sm:text-xl font-bold focus:border-cyan-500 transition-all outline-none shadow-inner" 
                  placeholder="Enter 10-digit number" 
                />
                <OperatorInputAdornment operator={operator} loading={detecting} accent="cyan" />
              </div>
              <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest ml-1">Auto-fetches operator & best plans</p>
            </div>

            {/* Fallback Manual Operator Dropdown */}
            {fallbackMode && (
              <Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="md:col-span-4 space-y-2">
                <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Operator Gateway</label>
                <OperatorDropdown selected={operator} onSelect={handleOperatorOverride} />
                <p className="text-[9px] text-amber-400 font-bold uppercase tracking-widest ml-1">Manual Selection Mode</p>
              </Motion.div>
            )}

            {/* Fallback Manual Amount Input */}
            {fallbackMode && (
              <Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="md:col-span-4 space-y-2">
                <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Recharge Amount (₹)</label>
                <input 
                  type="tel" 
                  value={amount} 
                  onChange={handleAmountChange} 
                  className="w-full px-6 py-5 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] text-xl font-bold focus:border-cyan-500 transition-all outline-none shadow-inner" 
                  placeholder="0.00" 
                />
                <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest ml-1">Enter custom amount</p>
              </Motion.div>
            )}

            {!fallbackMode && (
              <div className="md:col-span-6 flex items-center justify-end h-full pt-6">
                <div className="flex items-center gap-6 px-8 py-5 bg-[var(--bg-secondary)]/80 border border-[var(--glass-border)] text-[var(--text-color)] rounded-2xl shadow-lg w-full md:w-auto justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-emerald-400" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider">LIVE NETWORK DETECTION</p>
                      <p className="text-[9px] text-[var(--text-muted)] font-medium">REALTIME ROUTING ACTIVE</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-3 py-1 bg-[var(--glass-button-bg)] rounded-xl text-cyan-300 border border-[var(--glass-border)]">Protected</span>
                </div>
              </div>
            )}
          </div>

          {number.length === 10 && (operator || detectedOperator || fallbackMode) && (
            <OperatorSwitchPanel
              selectedOperator={selectedOperator}
              detectedOperator={detectedOperator}
              isManualOverride={isManualOverride}
              isOpen={showOperatorSelector || fallbackMode}
              loading={plansLoading}
              onToggle={() => setShowOperatorSelector((value) => !value)}
              onSelect={handleOperatorOverride}
            />
          )}

          {/* Fallback Manual Submit Button */}
          {fallbackMode && (
            <div className="flex justify-end pt-2">
              <button 
                disabled={loading} 
                onClick={() => validateForm() && setShowRechargeModal(true)} 
                className="w-full md:w-auto px-12 py-5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-cyan-600/20 transition-all text-xs uppercase tracking-widest active:scale-95 cursor-pointer"
              >
                {loading ? 'Authorizing...' : 'Proceed with Manual Recharge'}
              </button>
            </div>
          )}

          {/* Categorized Plans Section */}
          {number.length === 10 && (!fallbackMode || hasPlans || plansLoading) && (
            <div className="space-y-6 pt-6 border-t border-[var(--glass-border)]">
              {/* Category Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-[var(--glass-border)]">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex-shrink-0 cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                        : 'bg-[var(--glass-button-bg)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-color)] border border-[var(--glass-border)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Plan Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                {detecting || plansLoading ? (
                  [1, 2, 3].map(i => <ShimmerCard key={i} />)
                ) : currentPlans.length > 0 ? (
                  currentPlans.map((plan, idx) => (
                     <PlanCard key={idx} plan={plan} onSelect={handlePlanSelect} />
                  ))
                ) : hasPlans ? (
                  <div className="col-span-full py-16 text-center bg-[var(--bg-tertiary)]/20 rounded-3xl border border-[var(--glass-border)] border-dashed">
                    <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">No plans available in this category</p>
                  </div>
                ) : (
                  <div className="col-span-full py-16 text-center bg-[var(--bg-tertiary)]/20 rounded-3xl border border-[var(--glass-border)] border-dashed flex flex-col items-center justify-center gap-3">
                    <Activity className="w-8 h-8 text-[var(--text-muted)] animate-pulse" />
                    <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">No live plans found for this number</p>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                      <button onClick={() => setShowOperatorSelector(true)} className="mt-2 text-xs font-black text-cyan-400 uppercase tracking-widest underline cursor-pointer">
                        Change Operator
                      </button>
                      <button onClick={() => setFallbackMode(true)} className="mt-2 text-xs font-black text-cyan-400 uppercase tracking-widest underline cursor-pointer">
                        Enter Amount Manually
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Awaiting Input Prompt */}
          {number.length < 10 && (
            <div className="py-20 border-2 border-dashed border-[var(--glass-border)] rounded-3xl flex flex-col items-center justify-center gap-4 text-center bg-[var(--bg-tertiary)]/20">
              <div className="w-16 h-16 bg-[var(--bg-secondary)]/60 rounded-2xl shadow-sm flex items-center justify-center border border-[var(--glass-border)] text-cyan-400">
                <Smartphone className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-black text-[var(--text-color)] uppercase tracking-widest">Awaiting 10-Digit Mobile Number</p>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-1">Enter number above to instantly unlock premium operator plans</p>
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
    </Motion.div>
  );
}
