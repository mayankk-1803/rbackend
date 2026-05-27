import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Server,
  Zap,
  LogOut,
  Code2,
  ChevronRight,
  X,
  ShieldAlert,
  ShoppingBag,
  Tag,
  ClipboardList,
  Users
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Transactions', path: '/reports/transactions', icon: ClipboardList },
  { name: 'Users', path: '/users', icon: Users },
  { name: 'Cashback Settings', path: '/settings/cashback', icon: Zap },
  { name: 'Complaints', path: '/reports/disputes', icon: ShieldAlert },
  { name: 'Operators', path: '/providers', icon: Server },
  { name: 'iMart Products', path: '/imart/products', icon: ShoppingBag },
  { name: 'iMart Categories', path: '/imart/categories', icon: Tag },
  { name: 'iMart Orders', path: '/imart/orders', icon: ClipboardList },
];

export const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();

  const [adminUser] = React.useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("dizipay_admin_data")) || {};
    } catch {
      return {};
    }
  });

  const handleLogout = () => {
    if (import.meta.env.DEV) {
      console.log(" [Logout] Clearing session...");
    }
    sessionStorage.removeItem('dizipay_admin_token');
    sessionStorage.removeItem('dizipay_admin_data');
    window.location.href = '/87564/admin/login';
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
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 xl:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`
        fixed xl:relative z-50 w-64 h-full bg-[var(--bg-secondary)] border-r border-[var(--border-soft)] flex flex-col transition-transform duration-300 ease-in-out overflow-hidden
        ${isOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"}
      `}>
        
        <div className="h-20 flex items-center px-6 gap-3.5 border-b border-[var(--border-soft)] relative z-10 bg-[var(--bg-secondary)]">
          <div className="w-9 h-9 bg-[var(--color-primary)] rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-[var(--bg-primary)] fill-current" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--text-primary)] tracking-tight uppercase">
              Dizipay <span className="text-[var(--color-primary)]">Admin</span>
            </h1>
            <p className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.15em] opacity-80">v1.2 Platform</p>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="xl:hidden ml-auto p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
        
        <div data-lenis-prevent className="flex-1 py-6 flex flex-col relative z-10 overflow-y-auto custom-scrollbar">
          <nav className="flex-1 space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  aria-current={isActive ? 'page' : undefined}
                  className={`
                    group relative flex items-center px-4 py-2.5 transition-all duration-150 rounded-xl cursor-pointer text-sm font-medium
                    ${isActive 
                      ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--border-soft)] shadow-sm" 
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-hover)] border border-transparent"
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 mr-3 transition-colors ${isActive ? "text-[var(--color-primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"}`} />
                  <span className="tracking-wide">{item.name}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="admin-nav-indicator"
                      className="absolute left-0 w-0.75 h-5 bg-[var(--color-primary)] rounded-r-full"
                    />
                  )}
                  <ChevronRight className={`ml-auto w-3.5 h-3.5 transition-all ${isActive ? 'opacity-80 translate-x-0' : 'opacity-0 -translate-x-1 group-hover:opacity-80 group-hover:translate-x-0'}`} />
                </Link>
              );
            })}
          </nav>
  
          <div className="px-4 mt-6 pt-6 border-t border-[var(--border-soft)]">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-all group border border-transparent hover:border-rose-500/20 cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-3 text-[var(--text-secondary)] group-hover:text-rose-500 transition-colors" />
              <span className="tracking-wide">Logout Session</span>
            </button>
          </div>
        </div>
  
        <div className="p-4 border-t border-[var(--border-soft)] bg-[var(--bg-tertiary)]/30 relative z-10">
          <div className="flex items-center gap-3 p-1">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-soft)] flex items-center justify-center text-[var(--text-primary)] font-semibold text-xs">
              {adminUser.name ? adminUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'AD'}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-[var(--text-primary)] uppercase tracking-tight truncate">
                {adminUser.role === 'SUPER_ADMIN' ? 'Super Admin' : (adminUser.role || 'System Manager')}
              </p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                <p className="text-[8px] font-medium text-[var(--text-secondary)] uppercase tracking-wider truncate">Encrypted Session</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
