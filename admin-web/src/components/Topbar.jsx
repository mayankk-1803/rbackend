import React from 'react';
import { Search, Bell, User, Shield, Menu } from 'lucide-react';
import { motion } from 'framer-motion';
import ThemeSelector from './ThemeSelector';

export const Topbar = ({ toggleSidebar }) => {
  return (
    <header className="h-20 border-b border-[var(--border-soft)] bg-[var(--bg-primary)]/80 backdrop-blur-md flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <button 
          onClick={toggleSidebar}
          className="xl:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        <div className="relative w-full hidden md:block group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] group-focus-within:text-[var(--color-primary)] transition-colors" />
          <input 
            type="text" 
            placeholder="Search platform settings..." 
            className="w-full pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--admin-focus-ring)] rounded-xl text-xs text-[var(--text-primary)] transition-all outline-none placeholder:text-[var(--text-secondary)]"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-3 md:gap-4">
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-[var(--color-primary-glow)] border border-[var(--border-soft)] rounded-full">
          <Shield className="w-3.5 h-3.5 text-[var(--color-primary)]" />
          <span className="text-[9px] font-bold text-[var(--color-primary)] uppercase tracking-wider">Root Admin</span>
        </div>

        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="p-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]/50 border border-[var(--border-soft)] rounded-xl transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] relative group cursor-pointer"
        >
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full border border-[var(--bg-primary)]"></span>
        </motion.button>
        
        {/* Global Theme Selector */}
        <ThemeSelector />
        
        <div className="h-6 w-px bg-[var(--border-soft)] mx-1"></div>
        
        <div className="flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-[var(--text-primary)] tracking-tight">Admin User</p>
            <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-medium opacity-80">System Manager</p>
          </div>
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="w-9 h-9 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]/50 flex items-center justify-center text-[var(--text-primary)] cursor-pointer border border-[var(--border-soft)]"
          >
            <User className="w-4.5 h-4.5 text-[var(--text-secondary)]" />
          </motion.div>
        </div>
      </div>
    </header>
  );
};
