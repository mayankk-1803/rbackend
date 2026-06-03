import React from 'react';
import { motion } from 'framer-motion';

export default function ComingSoon({ serviceName }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-4 md:space-y-8 min-h-[60vh] flex items-center justify-center relative z-10"
    >
      <div className="w-full max-w-lg glass-card border border-white/5 rounded-2xl md:rounded-3xl shadow-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-purple-500/10 rounded-full blur-[60px]"></div>
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-[60px]"></div>
        </div>
        
        <div className="p-8 md:p-12 text-center relative z-10 space-y-6">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20
            }}
            className="w-20 h-20 md:w-24 md:h-24 mx-auto bg-slate-950/60 rounded-2xl md:rounded-3xl flex items-center justify-center border border-white/10 shadow-sm"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
          </motion.div>
          
          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              {serviceName}
            </h2>
            <div className="inline-block px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full">
              <span className="text-xs font-black text-purple-400 uppercase tracking-widest">Coming Soon</span>
            </div>
          </div>
          
          <p className="text-sm text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
            We're building a premium, lightning-fast experience for {serviceName}. 
            Stay tuned for our next cyber-fast update!
          </p>
          
          <div className="pt-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => window.history.back()}
              className="px-8 py-3 bg-purple-500 hover:bg-purple-400 text-white font-black rounded-xl transition-all text-xs uppercase tracking-widest shadow-lg shadow-purple-600/10 cursor-pointer"
            >
              Go Back
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
