import React from "react";
import { motion } from "framer-motion";
import { Wallet, Gift, Smartphone, ShoppingBag, Coins, TrendingUp, Zap } from "lucide-react";

export default function AuthLeftPanel() {
  // Staggered floating animations for 6 widgets
  const floatTransition = (delay = 0, duration = 6) => ({
    y: {
      duration: duration,
      repeat: Infinity,
      repeatType: "reverse",
      ease: "easeInOut",
      delay: delay,
    },
    x: {
      duration: duration * 1.2,
      repeat: Infinity,
      repeatType: "reverse",
      ease: "easeInOut",
      delay: delay + 0.5,
    }
  });

  const floatAnimate = {
    y: [0, -12, 0],
    x: [0, 6, 0]
  };

  return (
    <div className="relative w-full h-full min-h-[400px] md:min-h-screen flex flex-col justify-between p-8 md:p-16 overflow-hidden bg-[var(--bg-primary)] transition-colors duration-500 border-r border-[var(--glass-border)]/10 select-none">
      {/* Background Neural Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] pointer-events-none transition-opacity duration-500"
        style={{
          backgroundImage: `linear-gradient(to right, var(--text-muted) 1px, transparent 1px), linear-gradient(to bottom, var(--text-muted) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Floating Ambient Glowing Blobs */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            x: [0, 30, 0],
            y: [0, -20, 0],
            opacity: [0.15, 0.25, 0.15]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-purple-500 rounded-full blur-[120px]"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.15, 1],
            x: [0, -40, 0],
            y: [0, 30, 0],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-10 right-0 w-[350px] h-[350px] bg-indigo-500 rounded-full blur-[100px]"
        />
      </div>

      {/* Logo & Header section */}
      <div className="relative z-10 flex items-center gap-3">
        <div className="w-10 h-10 bg-[var(--color-primary-glow)] rounded-xl flex items-center justify-center border border-[var(--color-primary)]/20 shadow-lg">
          <Zap className="w-5 h-5 text-[var(--color-primary)] fill-[var(--color-primary-glow)]" />
        </div>
        <span className="text-xl font-black text-[var(--text-color)] lowercase">
          irecharge
        </span>
      </div>

      {/* Center Widget Area & Brand Messaging */}
      <div className="relative z-10 my-auto py-12 flex flex-col md:grid md:grid-cols-12 gap-8 items-center w-full">
        {/* Left Side: Brand Text */}
        <div className="col-span-12 lg:col-span-7 space-y-6 text-left w-full">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--glass-button-bg)] border border-[var(--glass-border)] backdrop-blur-md shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-color)]">
              Next-Gen FinTech
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[var(--text-color)] tracking-tight leading-[1.05] italic uppercase">
            Digital Payments<br/>
            <span className="inline-block not-italic -skew-x-12 text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-indigo-500 dark:from-purple-400 dark:to-indigo-400 pr-4">
              Reimagined
            </span>
          </h1>

          <p className="text-[var(--text-secondary)] text-sm sm:text-base max-w-md font-medium leading-relaxed">
            Recharge, Wallet, Marketplace and Rewards in one intelligent platform. Build wealth, earn cashback, and manage capital seamlessly.
          </p>

          {/* Core Pillars badges */}
          <div className="flex flex-wrap gap-2 pt-2">
            {["Recharge", "Wallet", "Marketplace", "Rewards"].map((pill) => (
              <span 
                key={pill}
                className="text-[9px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-lg bg-[var(--glass-button-bg)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:border-[var(--color-primary)]/30 transition-all shadow-sm"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>

        {/* Right Side: Animated Floating Widgets Container */}
        <div className="col-span-12 lg:col-span-5 relative w-full h-[320px] md:h-[400px] flex items-center justify-center">
          
          {/* Card 1: Available Balance */}
          <motion.div
            animate={floatAnimate}
            transition={floatTransition(0, 6.5)}
            whileHover={{ scale: 1.05, y: -5 }}
            className="absolute top-[5%] left-[2%] w-48 p-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-card)] backdrop-blur-xl z-20 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-500">
                <Wallet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider">Available Balance</p>
                <p className="text-base font-black text-[var(--text-color)] mt-0.5">₹2,450</p>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Cashback Earned */}
          <motion.div
            animate={floatAnimate}
            transition={floatTransition(1.2, 7.2)}
            whileHover={{ scale: 1.05, y: -5 }}
            className="absolute top-[28%] right-[2%] w-44 p-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-card)] backdrop-blur-xl z-10 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-500">
                <Gift className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider">Cashback Earned</p>
                <p className="text-base font-black text-emerald-500 mt-0.5">₹125</p>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Mobile Recharge Success */}
          <motion.div
            animate={floatAnimate}
            transition={floatTransition(2.5, 6.8)}
            whileHover={{ scale: 1.05, y: -5 }}
            className="absolute bottom-[28%] left-[0%] w-48 p-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-card)] backdrop-blur-xl z-20 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-500">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider">Mobile Recharge</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-black uppercase text-blue-500">Success</span>
                  <span className="w-3.5 h-3.5 rounded-full bg-blue-500/20 flex items-center justify-center text-[8px] font-bold text-blue-500">✓</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 4: Recent Order Completed */}
          <motion.div
            animate={floatAnimate}
            transition={floatTransition(0.8, 8)}
            whileHover={{ scale: 1.05, y: -5 }}
            className="absolute bottom-[4%] right-[4%] w-48 p-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-card)] backdrop-blur-xl z-10 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-500">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider">Recent Order</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-black uppercase text-indigo-500">Completed</span>
                  <span className="w-3.5 h-3.5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[8px] font-bold text-indigo-500">✓</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 5: Reward Coins */}
          <motion.div
            animate={floatAnimate}
            transition={floatTransition(3.1, 7.5)}
            whileHover={{ scale: 1.05, y: -5 }}
            className="absolute top-[52%] left-[45%] -translate-x-1/2 -translate-y-1/2 w-44 p-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-card)] backdrop-blur-xl z-30 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500">
                <Coins className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider">Reward Coins</p>
                <p className="text-base font-black text-amber-500 mt-0.5">1,250 Coins</p>
              </div>
            </div>
          </motion.div>

          {/* Card 6: Wallet Growth */}
          <motion.div
            animate={floatAnimate}
            transition={floatTransition(1.9, 6.2)}
            whileHover={{ scale: 1.05, y: -5 }}
            className="absolute top-[5%] right-[5%] w-36 p-3.5 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-card)] backdrop-blur-xl z-10 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7.5 h-7.5 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-500">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[8px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider">Wallet Growth</p>
                <p className="text-xs font-black text-rose-500 mt-0.5">+18.2%</p>
              </div>
            </div>
          </motion.div>

        </div>
      </div>

      {/* Footer text */}
      <div className="relative z-10 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
        © {new Date().getFullYear()} irecharge. All Rights Reserved.
      </div>
    </div>
  );
}
