import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, ArrowRight, Wallet, ShieldCheck, RefreshCw } from 'lucide-react';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import { formatAmount } from '../utils/helpers';
import toast from 'react-hot-toast';
import socket from '../services/socket';

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
  const [countdown, setCountdown] = useState(2);
  const [isSlow, setIsSlow] = useState(false);
  const redirectingRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    if (!orderId || orderId === "undefined") {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.log("[Status] Missing or invalid orderId");
      }
      setState(STATUS_STATES.PENDING);
      return;
    }

    try {
      const res = await api.get(API_ROUTES.PAYMENT.VERIFY_STATUS(orderId));
      
      const data = res?.data;
      const payload = data?.payload || (data?.success ? data : null);
      const status = data?.status || data?.paymentStatus || payload?.status || payload?.paymentStatus;
      const success = data?.success || payload?.success;

      if (success && (status || payload)) {
        setPaymentData({
          amount: data?.amount ?? payload?.amount,
          walletBalance: data?.walletBalance ?? payload?.walletBalance,
          ...payload
        });
        
        const normalizedStatus = String(status || "").trim().toUpperCase();
        
        const SUCCESS_STATES = ["SUCCESS", "COMPLETED", "PAID"];
        const FAILED_STATES = ["FAILED", "EXPIRED", "CANCELLED", "REJECTED"];

        if (SUCCESS_STATES.includes(normalizedStatus)) {
          setState(STATUS_STATES.SUCCESS);
          toast.success("Payment successful");
          window.dispatchEvent(new Event("wallet-refresh"));
        } else if (FAILED_STATES.includes(normalizedStatus)) {
          setState(STATUS_STATES.FAILED);
        } else {
          // Default all other values (including intermediate states like PENDING/PROCESSING) to PENDING
          setState(STATUS_STATES.PENDING);
        }
      } else {
        if (import.meta.env.DEV) {
          if (import.meta.env.DEV) console.warn("[Status] Backend reported success: false or missing payload. Retrying...");
        }
        // Protect against temporary API failures or empty payloads -> NEVER treat as FAILED!
        setState(STATUS_STATES.PENDING);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.error("[Status Fetch Error]:", err.message);
      }
      // Protect against temporary API/Network failures -> NEVER treat as FAILED!
      setState(STATUS_STATES.PENDING);
    }
  }, [orderId]);

  // Slow verification timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSlow(true);
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  // Listen for realtime payment_processing event
  useEffect(() => {
    const handleProcessing = (data) => {
      if (data.orderId && Number(data.orderId) === Number(orderId)) {
        setIsSlow(true);
        setState(STATUS_STATES.PENDING);
      }
    };
    
    socket.on('payment_processing', handleProcessing);
    return () => {
      socket.off('payment_processing', handleProcessing);
    };
  }, [orderId]);

  // Polling Logic: flat 3 seconds, max 120 seconds (40 retries)
  useEffect(() => {
    let timer;
    if (state === STATUS_STATES.VERIFYING || state === STATUS_STATES.PENDING) {
      const maxRetries = 40;

      if (retryCount >= maxRetries) {
        setState(STATUS_STATES.EXPIRED);
        return;
      }

      timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        fetchStatus();
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [state, retryCount, fetchStatus]);

  // Initial Fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Redirect Countdown: Auto-redirect only on confirmed SUCCESS
  useEffect(() => {
    let timer;
    let fallbackTimer;
    let mobileRedirectTimer;

    if (state === STATUS_STATES.SUCCESS) {
      const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        mobileRedirectTimer = setTimeout(() => {
          window.location.href = `irechargein://payment-success?order_id=${orderId}`;
        }, 1500);
      } else {
        if (countdown > 0) {
          timer = setInterval(() => {
            setCountdown(prev => prev - 1);
          }, 1000);
        } else if (countdown === 0) {
          if (!redirectingRef.current) {
            redirectingRef.current = true;
            window.dispatchEvent(new Event("wallet-refresh"));
            navigate('/dashboard', { replace: true });
          }
        }
        fallbackTimer = setTimeout(() => {
          if (!redirectingRef.current) {
            redirectingRef.current = true;
            window.dispatchEvent(new Event("wallet-refresh"));
            window.location.replace("/dashboard");
          }
        }, 2500);
      }
    }
    return () => {
      if (timer) clearInterval(timer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (mobileRedirectTimer) clearTimeout(mobileRedirectTimer);
    };
  }, [state, countdown, navigate, orderId]);

  const renderContent = () => {
    switch (state) {
      case STATUS_STATES.VERIFYING:
      case STATUS_STATES.PENDING:
        return (
          <div className="flex flex-col items-center gap-6 py-12">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-[var(--color-accent)]/10 border-t-[var(--color-accent)] rounded-full animate-spin"></div>
              <Clock className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-[var(--color-accent)] purple-glow" />
            </div>
            <div className="text-center space-y-2 flex flex-col items-center">
              <h2 className="text-xl font-black text-[var(--text-color)] uppercase tracking-tight italic">Verifying <span className="text-[var(--color-accent)] purple-glow">Payment</span></h2>
              
              {isSlow ? (
                <div className="space-y-1 bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 max-w-xs mt-1">
                  <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider animate-pulse">
                    Provider is taking longer than expected.
                  </p>
                  <p className="text-[9px] text-[var(--text-secondary)] font-medium uppercase tracking-wide">
                    Your payment is still being verified automatically.
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-[0.2em]">Synchronizing with banking infrastructure...</p>
              )}

              {retryCount > 0 && (
                <p className="text-[8px] text-amber-500 font-black uppercase tracking-widest animate-pulse mt-2">
                  Waiting for bank confirmation (Attempt {retryCount}/15)
                </p>
              )}
            </div>
          </div>
        );

      case STATUS_STATES.SUCCESS:
        const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
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
              {isMobile ? (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[var(--text-color)]">Opening DiziPay App...</p>
                  <p className="text-[10px] text-[var(--text-secondary)] font-medium">
                    If the app does not open automatically, tap the button below.
                  </p>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Verified Transaction</span>
                </div>
              )}
            </div>

            <div className="w-full bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-[var(--glass-border)]">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Amount Credited</span>
                <span className="text-2xl font-black text-[var(--text-color)] tracking-tighter">₹{formatAmount(paymentData?.amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">New Balance</span>
                <div className="flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5 text-[var(--color-accent)] purple-glow" />
                  <span className="text-sm font-black text-[var(--color-accent)] tracking-tight purple-glow">₹{formatAmount(paymentData?.walletBalance)}</span>
                </div>
              </div>
            </div>

            <div className="w-full space-y-4">
              {isMobile ? (
                <button 
                  onClick={() => {
                    window.location.href = `irechargein://payment-success?order_id=${orderId}`;
                  }}
                  className="w-full py-4 bg-purple-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-purple-400 transition-all cursor-pointer"
                >
                  Open DiziPay App
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => {
                      window.dispatchEvent(new Event("wallet-refresh"));
                      navigate('/dashboard');
                    }}
                    className="w-full py-4 bg-purple-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-purple-400 transition-all group cursor-pointer"
                  >
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <p className="text-center text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">
                    Redirecting automatically in <span className="text-[var(--text-color)]">{countdown}s</span>
                  </p>
                </>
              )}
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
                className="py-4 bg-[var(--color-accent)] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest text-center shadow-lg shadow-purple-500/20 hover:opacity-90 transition-all cursor-pointer"
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
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-[var(--color-accent)]/10 rounded-full blur-3xl pointer-events-none"></div>
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
