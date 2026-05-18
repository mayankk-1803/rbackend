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
  Code2,
  ChevronRight,
  X,
  ShieldAlert
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'RECHARGE', path: '/recharge', icon: Smartphone }, // Simple label for user management
  { name: 'Wallet', path: '/wallet', icon: Wallet },
  { name: 'Transactions', path: '/reports/transactions', icon: Smartphone },
  { name: 'Cashback Settings', path: '/settings/cashback', icon: Zap },
  { name: 'Complaints', path: '/reports/disputes', icon: ShieldAlert },
  { name: 'Operators', path: '/providers', icon: Server },
  { name: 'API Settings', path: '/api-docs', icon: Code2 },
];

export const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();

  const handleLogout = () => {
    if (import.meta.env.DEV) {
      console.log(" [Logout] Clearing session...");
    }
    localStorage.removeItem('dizipay_admin_token');
    localStorage.removeItem('dizipay_admin_data');
    window.location.href = '/admin/login';
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
        fixed xl:relative z-50 w-72 h-full bg-white/80 backdrop-blur-3xl border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out overflow-hidden
        ${isOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"}
      `}>
        {/* Decorative Glow */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-purple-600/10 to-transparent pointer-events-none opacity-50"></div>
        
        <div className="h-20 flex items-center px-8 gap-4 border-b border-slate-200 relative z-10">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.1)]">
            <Zap className="w-6 h-6 text-white fill-current" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">
              Dizipay <span className="text-purple-600 text-shadow-glow">Admin</span>
            </h1>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Admin Panel v1.2</p>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="xl:hidden ml-auto p-2 text-slate-400 hover:text-slate-900 transition-colors"
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
                      ? "bg-purple-50 text-purple-600 border border-purple-100 shadow-[0_0_20px_rgba(139,92,246,0.05)]" 
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 mr-4 transition-colors ${isActive ? "text-purple-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                  <span className="text-xs font-black uppercase tracking-widest">{item.name}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="admin-nav-indicator"
                      className="absolute left-0 w-1 h-6 bg-purple-500 rounded-r-full shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                    />
                  )}
                  <ChevronRight className={`ml-auto w-3 h-3 transition-all ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`} />
                </Link>
              );
            })}
          </nav>
  
          <div className="px-6 mt-8 pt-8 border-t border-slate-200">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-4 text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded-2xl transition-all group border border-transparent hover:border-rose-200"
            >
              <LogOut className="w-5 h-5 mr-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
              <span className="text-xs font-black uppercase tracking-widest">Logout System</span>
            </button>
          </div>
        </div>
  
        <div className="p-6 border-t border-slate-200 bg-slate-50 relative z-10">
          <div className="flex items-center gap-4 p-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 font-black text-xs shadow-inner">
              AD
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight truncate">System Manager</p>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.3)]"></div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">Encrypted Session</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
