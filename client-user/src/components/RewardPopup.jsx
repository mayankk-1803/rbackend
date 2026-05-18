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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            className="bg-white border border-slate-200 rounded-[3rem] p-10 max-w-sm w-full text-center relative overflow-hidden shadow-2xl"
          >
            {/* Celebratory background particles */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-10 left-10 w-2 h-2 bg-purple-400 rounded-full animate-ping"></div>
              <div className="absolute bottom-10 right-10 w-2 h-2 bg-amber-400 rounded-full animate-ping delay-300"></div>
            </div>

            <button 
              onClick={() => setReward(null)}
              className="absolute top-8 right-8 p-2 text-slate-300 hover:text-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-24 h-24 bg-emerald-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 relative">
              <Sparkles className="w-12 h-12 text-emerald-500" />
              <div className="absolute -top-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full shadow-lg">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic mb-2">
              Cashback <span className="text-emerald-500">Credited</span>
            </h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mb-8">Automatic Wallet Incentive</p>
            
            <div className="bg-slate-50 border border-slate-100 rounded-3xl p-8 mb-8 relative">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Amount Added</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-black text-slate-400">₹</span>
                <span className="text-5xl font-black text-slate-900 tracking-tighter">{reward.amount.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 py-4 rounded-2xl border border-emerald-100">
              <Zap className="w-4 h-4 fill-current" />
              <span>Available in your Wallet</span>
            </div>

            {/* Progress bar for auto-close */}
            <motion.div 
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 5, ease: "linear" }}
              className="absolute bottom-0 left-0 h-1.5 bg-emerald-500/20"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
