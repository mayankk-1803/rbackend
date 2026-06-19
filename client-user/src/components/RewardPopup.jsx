import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, X, Sparkles, Wallet, CheckCircle2, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import socket from '../services/socket';
import { useWallet } from '../context/WalletContext';
import { convertCashbackToCoins } from '../utils/rewardDisplayHelper';

// Custom lightweight particle confetti simulation
const ConfettiParticle = ({ index }) => {
  const angle = (index * 36) * (Math.PI / 180);
  const velocity = 80 + Math.random() * 80;
  const x = Math.cos(angle) * velocity;
  const y = Math.sin(angle) * velocity - 20;
  const colors = ['#f59e0b', '#fbbf24', '#f59e0b', '#fb923c', '#eab308'];
  const color = colors[index % colors.length];

  return (
    <motion.div
      initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
      animate={{ 
        x, 
        y, 
        scale: [0, 1.2, 0.5, 0],
        opacity: [1, 1, 0.8, 0],
        rotate: 360 * (Math.random() > 0.5 ? 1 : -1)
      }}
      transition={{ duration: 1.5, ease: "easeOut" }}
      className="absolute w-2 h-2 rounded-full pointer-events-none"
      style={{ backgroundColor: color }}
    />
  );
};

// Animated Count Up component
const AnimatedCountUp = ({ value, duration = 1.2 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const end = Math.round(Number(value || 0));
    if (end === 0) {
      setCount(0);
      return;
    }
    const totalMilliseconds = duration * 1000;
    const startTime = performance.now();

    let animationFrameId;
    const updateCount = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / totalMilliseconds, 1);
      
      // easeOutQuad ease
      const easeProgress = progress * (2 - progress);
      const currentCount = Math.floor(easeProgress * end);
      setCount(currentCount);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCount);
      } else {
        setCount(end);
      }
    };

    animationFrameId = requestAnimationFrame(updateCount);
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [value, duration]);

  return <>{count}</>;
};

export default function RewardPopup() {
  const [reward, setReward] = useState(null);
  const [isWelcome, setIsWelcome] = useState(false);
  const { wallet, fetchWallet } = useWallet();
  const navigate = useNavigate();

  useEffect(() => {
    const handleRechargeSuccess = (data) => {
      // Data includes rewardAmount from the worker/webhook
      if (data && data.rewardAmount > 0) {
        // Trigger a fresh wallet fetch so that the updated cashback Balance is loaded
        fetchWallet().catch(() => {});

        const welcomeShown = localStorage.getItem("dizipay_welcome_popup_shown");
        if (!welcomeShown) {
          setIsWelcome(true);
          localStorage.setItem("dizipay_welcome_popup_shown", "true");
        } else {
          setIsWelcome(false);
        }

        setReward({
          txnId: data.txnId || data.transactionId || (data.transaction && data.transaction.id),
          amount: data.rewardAmount,
          rechargeAmount: data.transaction?.amount || data.amount || 0,
          operator: data.transaction?.operator || data.operator || "Service"
        });

        // Auto-close after 8 seconds
        const timer = setTimeout(() => {
          setReward(null);
          setIsWelcome(false);
        }, 8000);
        return () => clearTimeout(timer);
      }
    };

    socket.on("recharge_success", handleRechargeSuccess);
    return () => socket.off("recharge_success", handleRechargeSuccess);
  }, [fetchWallet]);

  const coinsEarned = reward ? convertCashbackToCoins(reward.amount) : 0;
  const coinBalance = wallet ? convertCashbackToCoins(wallet.cashbackBalance) : 0;

  return (
    <AnimatePresence>
      {reward && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/75 backdrop-blur-md">
          {/* Backdrop click closes popup without blocking flow */}
          <div className="absolute inset-0 cursor-pointer" onClick={() => { setReward(null); setIsWelcome(false); }} />
          
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 40 }}
            className="bg-gradient-to-br from-[var(--glass-modal-bg)] via-[var(--bg-secondary)]/95 to-[var(--glass-modal-bg)] backdrop-blur-3xl p-8 max-w-sm w-full text-center relative overflow-hidden shadow-2xl border border-amber-500/25 rounded-[2.5rem] z-10"
          >
            {/* Confetti particles */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              {Array.from({ length: 15 }).map((_, i) => (
                <ConfettiParticle key={i} index={i} />
              ))}
            </div>

            {/* Close Button */}
            <button 
              onClick={() => { setReward(null); setIsWelcome(false); }}
              className="absolute top-6 right-6 p-2 text-[var(--text-secondary)] hover:text-amber-400 transition-colors cursor-pointer rounded-full hover:bg-[var(--glass-button-bg)]"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 3D Coin Spin Animation */}
            <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <motion.div
                animate={{ 
                  rotateY: 360,
                  boxShadow: ["0 0 15px rgba(245,158,11,0.2)", "0 0 25px rgba(245,158,11,0.5)", "0 0 15px rgba(245,158,11,0.2)"]
                }}
                transition={{ 
                  rotateY: { repeat: Infinity, duration: 2.2, ease: "linear" },
                  boxShadow: { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
                }}
                className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 border border-amber-300 rounded-full flex items-center justify-center relative shadow-lg"
                style={{ transformStyle: "preserve-3d" }}
              >
                {isWelcome ? (
                  <Gift className="w-10 h-10 text-slate-950 fill-slate-950/10" style={{ transform: "translateZ(1px)" }} />
                ) : (
                  <Coins className="w-10 h-10 text-slate-950 fill-slate-950/10" style={{ transform: "translateZ(1px)" }} />
                )}
              </motion.div>
              <div className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 p-1 rounded-full shadow-lg">
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </div>

            {isWelcome ? (
              <>
                {/* First Recharge Welcome Layout */}
                <h2 className="text-2xl font-black text-[var(--text-color)] tracking-tighter uppercase italic mb-1">
                  🎉 Congratulations!
                </h2>
                <p className="text-[var(--text-secondary)] text-[8px] font-black uppercase tracking-[0.25em] mb-6">Welcome Bonus Rewards</p>

                <div className="bg-gradient-to-br from-[var(--bg-tertiary)]/40 to-amber-500/5 border border-amber-500/10 rounded-2xl p-5 mb-6 relative">
                  <p className="text-sm font-bold text-[var(--text-color)] leading-relaxed">
                    You earned <span className="text-amber-400 font-extrabold font-mono"><AnimatedCountUp value={coinsEarned || 150} /></span> Coins from your recharge.
                  </p>
                  <p className="text-[9px] text-[var(--text-muted)] mt-2 font-medium">
                    Keep recharging to unlock more rewards.
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Standard Coins Credited Layout */}
                <h2 className="text-2xl font-black text-[var(--text-color)] tracking-tighter uppercase italic mb-1">
                  🎉 Coins <span className="text-amber-400 amber-glow">Credited</span>
                </h2>
                <p className="text-[var(--text-secondary)] text-[8px] font-black uppercase tracking-[0.25em] mb-6">Gamified Rewards Incentive</p>
                
                {/* Amount details card */}
                <div className="bg-gradient-to-br from-[var(--bg-tertiary)]/40 to-amber-500/5 border border-amber-500/10 rounded-2xl p-5 mb-6 relative">
                  <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2">Transaction Value: ₹{reward.rechargeAmount}</p>
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="text-4xl font-black text-amber-400 font-mono tracking-tighter amber-glow">
                      +<AnimatedCountUp value={coinsEarned} />
                    </span>
                    <span className="text-xs font-black text-amber-400 uppercase tracking-widest">Coins</span>
                  </div>
                </div>
              </>
            )}

            {/* Wallet Info row */}
            <div className="flex items-center justify-between text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-wider bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-4 py-3.5 rounded-xl mb-6 shadow-inner">
              <div className="flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-amber-400" />
                <span>Coin Balance</span>
              </div>
              <span className="text-amber-400 font-mono">{coinBalance} Coins</span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setReward(null);
                  setIsWelcome(false);
                  navigate('/reports/ledger');
                }}
                className="w-full bg-[var(--glass-button-bg)] hover:bg-[var(--glass-border-hover)] text-[var(--text-color)] border border-[var(--glass-border)] py-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm active:scale-95"
              >
                View Wallet
              </button>
              <button
                onClick={() => { setReward(null); setIsWelcome(false); }}
                className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-md active:scale-95 shadow-amber-500/10"
              >
                Continue
              </button>
            </div>

            {/* Progress bar for auto-close */}
            <motion.div 
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 8, ease: "linear" }}
              className="absolute bottom-0 left-0 h-1 bg-amber-500/40"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

