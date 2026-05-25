import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, ArrowRight, Wallet, ShieldCheck, RefreshCw } from 'lucide-react';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import { formatAmount } from '../utils/helpers';
import toast from 'react-hot-toast';

const STATUS_STATES = {
  VERIFYING: 'VERIFYING',
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED'
};

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('order_id') || searchParams.get('paymentId');
  
  const [state, setState] = useState(STATUS_STATES.VERIFYING);
  const [paymentData, setPaymentData] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [countdown, setCountdown] = useState(5);

  const fetchStatus = useCallback(async () => {
    if (!orderId) {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.error("[Status] Missing orderId");
      }
      setState(STATUS_STATES.FAILED);
      return;
    }

    try {
      const res = await api.get(API_ROUTES.PAYMENT.VERIFY_STATUS(orderId));
      
      // SAFE ACCESS: Support both direct data and .payload wrapper
      const data = res?.data;
      const payload = data?.payload || (data?.success ? data : null);
      const status = payload?.status;
      const success = data?.success || payload?.success;

      if (success && payload) {
        setPaymentData(payload);
        
        if (status === 'SUCCESS') {
          setState(STATUS_STATES.SUCCESS);
          toast.success("Payment Verified!");
        } else if (status === 'FAILED') {
          setState(STATUS_STATES.FAILED);
        } else {
          setState(STATUS_STATES.PENDING);
        }
      } else {
        if (import.meta.env.DEV) {
          if (import.meta.env.DEV) console.warn("[Status] Backend reported failure or missing payload:", data?.message);
        }
        if (status === 'FAILED') setState(STATUS_STATES.FAILED);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.error("[Status Fetch Error]:", err.message);
      }
      // We don't fail immediately on network error, we let polling continue
    }
  }, [orderId]);

  // Polling Logic with Progressive Backoff
  useEffect(() => {
    let timer;
    if (state === STATUS_STATES.VERIFYING || state === STATUS_STATES.PENDING) {
      // Extended window for SUCCESS redirects (20 retries ~ 2 mins)
      const isSuccessRedirect = searchParams.get('status') === 'SUCCESS' || searchParams.get('status') === 'PAID';
      const maxRetries = 3;

      if (retryCount >= maxRetries) {
        setState(STATUS_STATES.EXPIRED);
        return;
      }

      const backoff = Math.min(2000 + retryCount * 1000, 10000); // 2s, 3s, 4s... max 10s
      timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        fetchStatus();
      }, backoff);
    }
    return () => clearTimeout(timer);
  }, [state, retryCount, fetchStatus, searchParams]);

  // Initial Fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Redirect Countdown
  useEffect(() => {
    let timer;
    if (state === STATUS_STATES.SUCCESS && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (state === STATUS_STATES.SUCCESS && countdown === 0) {
      navigate('/dashboard');
    }
    return () => clearInterval(timer);
  }, [state, countdown, navigate]);

  const renderContent = () => {
    switch (state) {
      case STATUS_STATES.VERIFYING:
      case STATUS_STATES.PENDING:
        return (
          <div className="flex flex-col items-center gap-6 py-12">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-cyan-500/10 border-t-cyan-400 rounded-full animate-spin"></div>
              <Clock className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-cyan-400 cyan-glow" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-black text-[var(--text-color)] uppercase tracking-tight italic">Verifying <span className="text-cyan-400 cyan-glow">Payment</span></h2>
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-[0.2em]">Synchronizing with banking infrastructure...</p>
              {retryCount > 0 && (
                <p className="text-[8px] text-amber-405 font-black text-amber-500 uppercase tracking-widest animate-pulse">
                  Waiting for bank confirmation (Attempt {retryCount}/3)
                </p>
              )}
            </div>
          </div>
        );

      case STATUS_STATES.SUCCESS:
        return (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-8 py-10"
          >
            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border-4 border-emerald-500/20 shadow-xl shadow-emerald-500/5">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 emerald-glow" />
            </div>
            
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-black text-[var(--text-color)] uppercase tracking-tighter italic">Topup <span className="text-emerald-400 emerald-glow">Successful</span></h2>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest">Verified Transaction</span>
              </div>
            </div>

            <div className="w-full bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-[var(--glass-border)]">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Amount Credited</span>
                <span className="text-2xl font-black text-[var(--text-color)] tracking-tighter">₹{formatAmount(paymentData?.amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">New Balance</span>
                <div className="flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5 text-cyan-400 cyan-glow" />
                  <span className="text-sm font-black text-cyan-400 tracking-tight cyan-glow">₹{formatAmount(paymentData?.walletBalance)}</span>
                </div>
              </div>
            </div>

            <div className="w-full space-y-4">
               <button 
                onClick={() => navigate('/dashboard')}
                className="w-full py-4 bg-purple-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-purple-400 transition-all group cursor-pointer"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <p className="text-center text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">
                Redirecting automatically in <span className="text-[var(--text-color)]">{countdown}s</span>
              </p>
            </div>
          </motion.div>
        );

      case STATUS_STATES.FAILED:
      case STATUS_STATES.EXPIRED:
        return (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-8 py-10"
          >
            <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center border-4 border-rose-500/20 shadow-xl shadow-rose-500/5">
              <XCircle className="w-12 h-12 text-rose-400 red-glow" />
            </div>
            
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-black text-[var(--text-color)] uppercase tracking-tighter italic">Payment <span className="text-rose-400 red-glow">Failed</span></h2>
              <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest leading-relaxed px-10">
                {state === STATUS_STATES.EXPIRED 
                  ? "Verification timed out. If money was debited, it will be added to your wallet within 30 minutes automatically."
                  : "The transaction was declined by your bank. Please try again."}
              </p>
            </div>

            <div className="w-full grid grid-cols-2 gap-4">
              <Link 
                to="/recharge"
                className="py-4 bg-[var(--glass-button-bg)] border border-[var(--glass-border)] text-[var(--text-color)] rounded-2xl text-[10px] font-black uppercase tracking-widest text-center hover:bg-[var(--glass-border)] transition-all cursor-pointer"
              >
                Try Again
              </Link>
              <Link 
                to="/profile/support"
                className="py-4 bg-cyan-400 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center shadow-lg shadow-cyan-400/25 hover:bg-cyan-300 transition-all cursor-pointer"
              >
                Get Support
              </Link>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 relative z-10">
      <div className="max-w-md w-full glass-card border border-[var(--glass-border)] rounded-[2.5rem] shadow-2xl overflow-hidden relative bg-[var(--glass-card-bg)]">
        {/* Subtle background glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 p-8">
          {renderContent()}
        </div>

        {/* Footer info */}
        <div className="px-8 py-4 bg-[var(--bg-secondary)]/30 border-t border-[var(--glass-border)] flex justify-center items-center gap-2">
           <ShieldCheck className="w-3 h-3 text-[var(--text-muted)]" />
           <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">End-to-End Encrypted Transactions</span>
        </div>
      </div>
    </div>
  );
}
