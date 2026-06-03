import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, Sparkles, CheckCircle2 } from 'lucide-react';
import socket from '../services/socket';

export default function RewardPopup() {
  const [reward, setReward] = useState(null);

  useEffect(() => {
    const handleRechargeSuccess = (data) => {
      // Data now includes rewardAmount from the worker
      if (data.rewardAmount > 0) {
        setReward({
          txnId: data.txnId,
          amount: data.rewardAmount
        });

        // Auto-close after 5 seconds
        setTimeout(() => setReward(null), 5000);
      }
    };

    socket.on("recharge_success", handleRechargeSuccess);
    return () => socket.off("recharge_success", handleRechargeSuccess);
  }, []);

  return (
    <AnimatePresence>
      {reward && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            className="bg-[var(--glass-modal-bg)] backdrop-blur-3xl p-10 max-w-sm w-full text-center relative overflow-hidden shadow-2xl border border-[var(--glass-border)] rounded-[3rem]"
          >
            {/* Celebratory background particles */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-10 left-10 w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div>
              <div className="absolute bottom-10 right-10 w-2 h-2 bg-indigo-400 rounded-full animate-ping delay-300"></div>
            </div>

            <button 
              onClick={() => setReward(null)}
              className="absolute top-8 right-8 p-2 text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 relative shadow-lg shadow-emerald-500/15">
              <Sparkles className="w-12 h-12 text-emerald-400 emerald-glow animate-pulse" />
              <div className="absolute -top-2 -right-2 bg-emerald-400 text-slate-950 p-1.5 rounded-full shadow-lg">
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
              </div>
            </div>

            <h2 className="text-3xl font-black text-[var(--text-color)] tracking-tighter uppercase italic mb-2">
              Cashback <span className="text-emerald-400 emerald-glow">Credited</span>
            </h2>
            <p className="text-[var(--text-secondary)] text-[10px] font-black uppercase tracking-[0.25em] mb-8">Automatic Wallet Incentive</p>
            
            <div className="bg-[var(--bg-secondary)]/40 border border-[var(--glass-border)] rounded-3xl p-8 mb-8 relative">
              <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3">Amount Added</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-black text-[var(--text-secondary)]">₹</span>
                <span className="text-5xl font-black text-[var(--text-color)] tracking-tighter emerald-glow">{reward.amount.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 py-4 rounded-2xl border border-emerald-500/20 shadow-inner">
              <Zap className="w-4 h-4 fill-current text-emerald-400 animate-bounce" />
              <span>Available in your Wallet</span>
            </div>

            {/* Progress bar for auto-close */}
            <motion.div 
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 5, ease: "linear" }}
              className="absolute bottom-0 left-0 h-1.5 bg-emerald-500/40"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
