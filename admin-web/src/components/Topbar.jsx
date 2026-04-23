import React from 'react';
import { Search, Bell, User } from 'lucide-react';

export const Topbar = () => {
  return (
    <header className="h-16 border-b border-[#E2E8F0] bg-white flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex-1 flex items-center">
        <div className="relative max-w-md w-full hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <input 
            type="text" 
            placeholder="Search anything..." 
            className="w-full pl-10 pr-4 py-1.5 bg-[#F1F5F9] border-transparent focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10 focus:border-[#2563EB] rounded-md text-sm transition-all outline-none"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button className="p-2 hover:bg-[#F1F5F9] rounded-md transition-colors text-[#64748B] relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="h-8 w-px bg-[#E2E8F0] mx-1"></div>
        
        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-[#0F172A]">Admin User</p>
            <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-medium">System Manager</p>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#2563EB] flex items-center justify-center text-white cursor-pointer hover:bg-[#1D4ED8] transition-colors shadow-sm">
            <User className="w-5 h-5" />
          </div>
        </div>
      </div>
    </header>
  );
};
