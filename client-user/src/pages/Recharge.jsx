import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Smartphone, Tv, Zap, Droplets, Flame, Wifi, Landmark, ChevronRight, ShieldCheck } from 'lucide-react';

const rechargeTypes = [
  { type: 'Mobile Prepaid', path: '/recharge/mobile-prepaid', icon: Smartphone, desc: 'Instant prepaid recharge', color: 'from-cyan-500 to-blue-600' },
  { type: 'Mobile Postpaid', path: '/recharge/mobile-postpaid', icon: Smartphone, desc: 'Mobile bill payments', color: 'from-purple-500 to-indigo-600' },
  { type: 'DTH', path: '/recharge/dth', icon: Tv, desc: 'Direct-to-Home television', color: 'from-purple-500 to-indigo-600' },
  { type: 'Electricity', path: '/recharge/electricity', icon: Zap, desc: 'Electricity utility payments', color: 'from-amber-400 to-orange-600' },
  { type: 'Water', path: '/recharge/water', icon: Droplets, desc: 'Municipal water services', color: 'from-blue-400 to-cyan-600' },
  { type: 'Gas', path: '/recharge/gas', icon: Flame, desc: 'PNG & LPG gas cylinders', color: 'from-rose-500 to-orange-600' },
  { type: 'Broadband', path: '/recharge/broadband', icon: Wifi, desc: 'High-speed internet bills', color: 'from-indigo-500 to-purple-600' },
  { type: 'Loan', path: '/recharge/loan', icon: Landmark, desc: 'Financial EMI settlements', color: 'from-emerald-500 to-teal-600' },
];

export default function Recharge() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto space-y-8 md:space-y-12 py-4 md:py-6 relative z-10"
    >
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 glass-panel p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-cyan-500/5 to-transparent"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-5 h-5 text-[var(--color-accent)] cyan-glow" />
            <h1 className="text-2xl md:text-4xl font-black text-[var(--text-color)] tracking-tighter uppercase italic">Billing <span className="text-[var(--color-accent)] cyan-glow">Hub</span></h1>
          </div>
          <p className="text-[8px] md:text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.3em]">Multi-channel settlement gateway active</p>
        </div>
        <div className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-[var(--glass-button-bg)] border border-[var(--glass-border)] rounded-xl md:rounded-2xl">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="text-[8px] md:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Quantum Encrypted</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {rechargeTypes.map((item, idx) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.type}
              to={item.path}
            >
              <motion.div 
                whileHover={{ y: -5 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group p-6 md:p-8 glass-card border border-[var(--glass-border)] rounded-3xl md:rounded-[2.5rem] shadow-sm hover:border-[var(--color-accent)]/30 transition-all relative overflow-hidden hover:shadow-md cursor-pointer"
              >
                <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${item.color} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                
                <div className="flex justify-between items-start mb-6 md:mb-8">
                  <div className={`w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br ${item.color} rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg transition-all`}>
                    <Icon className="w-6 h-6 md:w-8 md:h-8 text-white" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text-color)] transition-all transform group-hover:translate-x-1" />
                </div>

                <div className="space-y-1 md:space-y-2">
                  <h3 className="text-lg md:text-xl font-black text-[var(--text-color)] uppercase tracking-tight italic group-hover:text-[var(--color-accent)] transition-colors">{item.type}</h3>
                  <p className="text-[8px] md:text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-widest group-hover:text-[var(--text-color)] transition-colors">{item.desc}</p>
                </div>

                <div className="mt-8 pt-6 border-t border-[var(--glass-border)] flex items-center justify-between">
                  <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">SLA: 99.9% Up</span>
                  <div className="flex -space-x-2">
                     <div className="w-5 h-5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-button-bg)] flex items-center justify-center text-[6px] font-bold text-[var(--text-muted)]">BB</div>
                     <div className="w-5 h-5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-button-bg)] flex items-center justify-center text-[6px] font-bold text-[var(--text-muted)]">NP</div>
                  </div>
                </div>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
