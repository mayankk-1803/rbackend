import React from 'react';
import { Search, Bell, User, Shield, Menu } from 'lucide-react';
import { motion } from 'framer-motion';

export const Topbar = ({ toggleSidebar }) => {
  return (
    <header className="h-20 border-b border-slate-200 bg-white/50 backdrop-blur-2xl flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="xl:hidden p-2 text-slate-500 hover:text-slate-900 transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        <div className="relative max-w-md w-full hidden md:block group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-purple-600 transition-colors" />
          <input 
            type="text" 
            placeholder="Global search protocol..." 
            className="w-full pl-12 pr-6 py-2.5 bg-slate-100 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500/30 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-900 transition-all outline-none placeholder:text-slate-400"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-3 md:gap-6">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-purple-500/5 border border-purple-500/20 rounded-full">
          <Shield className="w-3 h-3 text-purple-400" />
          <span className="text-[8px] font-black text-purple-400 uppercase tracking-[0.2em]">Root Admin Access</span>
        </div>

        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-2.5 md:p-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all text-slate-500 relative group"
        >
          <Bell className="w-5 h-5 group-hover:text-slate-900 transition-colors" />
          <span className="absolute top-2.5 right-2.5 md:top-3 md:right-3 w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.3)] border border-white"></span>
        </motion.button>
        
        <div className="h-6 md:h-8 w-px bg-slate-200 mx-1 md:mx-2"></div>
        
        <div className="flex items-center gap-2 md:gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-tighter">Admin User</p>
            <p className="text-[7px] md:text-[8px] text-slate-400 uppercase tracking-widest font-black">System Manager</p>
          </div>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white cursor-pointer shadow-[0_0_20px_rgba(139,92,246,0.3)] border border-white/10"
          >
            <User className="w-4 h-4 md:w-5 md:h-5" />
          </motion.div>
        </div>
      </div>
    </header>
  );
};
