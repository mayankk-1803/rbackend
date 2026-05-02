import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Smartphone, 
  Wallet, 
  Bell, 
  Server,
  Zap,
  LogOut,
  FileText,
  ChevronRight,
  X
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Tester', path: '/tester', icon: Smartphone },
  { name: 'Transactions', path: '/transactions', icon: Wallet },
  { name: 'Alerts', path: '/alerts', icon: Bell },
  { name: 'Providers', path: '/providers', icon: Server },
  { name: 'API Docs', path: '/api-docs', icon: FileText },
];

export const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 xl:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`
        fixed xl:relative z-50 w-72 h-full bg-[#030014]/80 backdrop-blur-3xl border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out overflow-hidden
        ${isOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"}
      `}>
        {/* Decorative Glow */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-purple-600/10 to-transparent pointer-events-none opacity-50"></div>
        
        <div className="h-20 flex items-center px-8 gap-4 border-b border-white/5 relative z-10">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.3)]">
            <Zap className="w-6 h-6 text-white fill-current" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tighter uppercase italic">
              Dizipay <span className="text-purple-400 text-shadow-glow">Admin</span>
            </h1>
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">Core Console v1.2</p>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="xl:hidden ml-auto p-2 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 py-8 flex flex-col relative z-10 custom-scrollbar overflow-y-auto">
          <nav className="flex-1 space-y-2 px-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`
                    group relative flex items-center px-4 py-3.5 transition-all duration-300 rounded-2xl
                    ${isActive 
                      ? "bg-white/5 text-purple-400 border border-white/10 shadow-[0_0_20px_rgba(139,92,246,0.05)]" 
                      : "text-slate-500 hover:text-white hover:bg-white/[0.02]"
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 mr-4 transition-colors ${isActive ? "text-purple-400" : "text-slate-600 group-hover:text-slate-300"}`} />
                  <span className="text-xs font-black uppercase tracking-widest">{item.name}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="admin-nav-indicator"
                      className="absolute left-0 w-1 h-6 bg-purple-500 rounded-r-full shadow-[0_0_10px_rgba(168,85,247,0.8)]"
                    />
                  )}
                  <ChevronRight className={`ml-auto w-3 h-3 transition-all ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`} />
                </Link>
              );
            })}
          </nav>
  
          <div className="px-6 mt-8 pt-8 border-t border-white/5">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-4 text-slate-500 hover:bg-rose-500/10 hover:text-rose-500 rounded-2xl transition-all group border border-transparent hover:border-rose-500/20"
            >
              <LogOut className="w-5 h-5 mr-4 text-slate-600 group-hover:text-rose-500 transition-colors" />
              <span className="text-xs font-black uppercase tracking-widest">Logout System</span>
            </button>
          </div>
        </div>
  
        <div className="p-6 border-t border-white/5 bg-white/[0.02] relative z-10">
          <div className="flex items-center gap-4 p-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/5 flex items-center justify-center text-slate-400 font-black text-xs shadow-inner">
              AD
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-white uppercase tracking-tight truncate">System Manager</p>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]"></div>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest truncate">Encrypted Session</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
