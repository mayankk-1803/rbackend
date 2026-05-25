import React from 'react';
import { Search, Bell, User, Shield, Menu } from 'lucide-react';
import { motion } from 'framer-motion';
import ThemeSelector from './ThemeSelector';

export const Topbar = ({ toggleSidebar }) => {
  return (
    <header className="h-20 border-b border-[var(--glass-border)] bg-[var(--glass-navbar-bg)] backdrop-blur-2xl flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="xl:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-colors cursor-pointer"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        <div className="relative max-w-md w-full hidden md:block group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] group-focus-within:text-[var(--color-primary)] transition-colors" />
          <input 
            type="text" 
            placeholder="Global search protocol..." 
            className="w-full pl-12 pr-6 py-2.5 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] focus:bg-[var(--glass-input-bg)] focus:ring-4 focus:ring-[var(--color-primary-glow)] focus:border-[var(--color-primary)] rounded-2xl text-[10px] font-black uppercase tracking-widest text-[var(--text-color)] transition-all outline-none placeholder:text-[var(--text-secondary)]"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-3 md:gap-6">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-[var(--color-primary-glow)] border border-[var(--color-primary)]/20 rounded-full">
          <Shield className="w-3 h-3 text-[var(--color-primary)]" />
          <span className="text-[8px] font-black text-[var(--color-primary)] uppercase tracking-[0.2em]">Root Admin Access</span>
        </div>

        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-2.5 md:p-3 bg-[var(--glass-button-bg)] hover:bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-xl transition-all text-[var(--text-secondary)] relative group cursor-pointer"
        >
          <Bell className="w-5 h-5 group-hover:text-[var(--text-color)] transition-colors" />
          <span className="absolute top-2.5 right-2.5 md:top-3 md:right-3 w-2 h-2 bg-[var(--color-accent)] rounded-full shadow-[0_0_8px_var(--color-accent-glow)] border border-[var(--glass-bg)]"></span>
        </motion.button>
        
        {/* Global Theme Selector */}
        <ThemeSelector />
        
        <div className="h-6 md:h-8 w-px bg-[var(--glass-border)] mx-1 md:mx-2"></div>
        
        <div className="flex items-center gap-2 md:gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] md:text-xs font-black text-[var(--text-color)] uppercase tracking-tighter">Admin User</p>
            <p className="text-[7px] md:text-[8px] text-[var(--text-secondary)] uppercase tracking-widest font-black">System Manager</p>
          </div>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center text-white cursor-pointer shadow-[0_0_20px_var(--color-primary-glow)] border border-[var(--glass-border)]"
          >
            <User className="w-4 h-4 md:w-5 md:h-5" />
          </motion.div>
        </div>
      </div>
    </header>
  );
};
