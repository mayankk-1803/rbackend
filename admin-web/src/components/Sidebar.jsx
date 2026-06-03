import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { 
  LayoutDashboard, 
  Server,
  Zap,
  LogOut,
  Code2,
  ChevronRight,
  ChevronDown,
  Percent,
  X,
  ShieldAlert,
  ShoppingBag,
  Tag,
  ClipboardList,
  Users,
  Shuffle,
  Lock
} from 'lucide-react';

const navItemsBefore = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Transactions', path: '/reports/transactions', icon: ClipboardList },
  { name: 'Users', path: '/users', icon: Users },
  { name: 'Control Center', path: '/control-center', icon: Server },
];

const navItemsAfter = [
  { name: 'Complaints', path: '/reports/disputes', icon: ShieldAlert },
  { name: 'Operators', path: '/providers', icon: Server },
  { name: 'iMart Products', path: '/imart/products', icon: ShoppingBag },
  { name: 'iMart Categories', path: '/imart/categories', icon: Tag },
  { name: 'iMart Orders', path: '/imart/orders', icon: ClipboardList },
];

export const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const [commissionOpen, setCommissionOpen] = React.useState(() => {
    return location.pathname.startsWith('/commission');
  });
  const [operationsOpen, setOperationsOpen] = React.useState(() => {
    return location.pathname.startsWith('/operations');
  });
  const [marketplaceOpen, setMarketplaceOpen] = React.useState(() => {
    return location.pathname.startsWith('/api-marketplace');
  });
  const [platformIntelOpen, setPlatformIntelOpen] = React.useState(() => {
    return location.pathname.startsWith('/platform-intelligence');
  });

  const [adminUser] = React.useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("dizipay_admin_data")) || {};
    } catch {
      return {};
    }
  });

  const [dbFlags, setDbFlags] = React.useState({});

  React.useEffect(() => {
    const fetchFlags = async () => {
      try {
        const response = await api.get('/admin/enterprise/telemetry');
        if (response.data?.success) {
          setDbFlags(response.data.data.dbFeatureFlags || {});
        }
      } catch (err) {
        // fail silently
      }
    };
    if (adminUser?.role) {
      fetchFlags();
    }
  }, [adminUser?.role]);

  const handleLogout = () => {
    if (import.meta.env.DEV) {
      console.log(" [Logout] Clearing session...");
    }
    sessionStorage.removeItem('dizipay_admin_token');
    sessionStorage.removeItem('dizipay_admin_data');
    localStorage.removeItem('dizipay_admin_last_activity');
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
            {navItemsBefore.map((item) => {
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

            {/* Collapsible Commission Menu */}
            <div className="space-y-1">
              <button
                onClick={() => setCommissionOpen(!commissionOpen)}
                className={`
                  w-full group relative flex items-center px-4 py-2.5 transition-all duration-150 rounded-xl cursor-pointer text-sm font-medium text-left border border-transparent
                  ${location.pathname.startsWith('/commission')
                    ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--border-soft)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-hover)]"
                  }
                `}
              >
                <Percent className={`w-4 h-4 mr-3 transition-colors ${location.pathname.startsWith('/commission') ? "text-[var(--color-primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"}`} />
                <span className="tracking-wide flex-1">Commission</span>
                {commissionOpen ? (
                  <ChevronDown className="w-4 h-4 ml-auto text-[var(--text-secondary)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 ml-auto text-[var(--text-secondary)]" />
                )}
              </button>

              <AnimatePresence>
                {commissionOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden pl-7 space-y-1"
                  >
                    {[
                      { name: 'Slab Master', path: '/commission/slabs' },
                      { name: 'Package Master', path: '/commission/packages' },
                      { name: 'Recharge Commission Slab', path: '/commission/recharge-slabs' },
                      { name: 'Range Commission Slab', path: '/commission/range-slabs' },
                      { name: 'Channel Slab Bulk Setting', path: '/commission/bulk' },
                      { name: 'Commission Audit Logs', path: '/commission/audit-logs' },
                      { name: 'Commission Simulator', path: '/commission/simulator' },
                      { name: 'Shadow Validation', path: '/commission/shadow-validation' },
                      { 
                        name: 'Commission Intelligence', 
                        path: '/commission/intelligence', 
                        isLocked: dbFlags['COMMISSION_INTELLIGENCE_ENABLED']?.value !== true 
                      }
                    ].map((sub) => {
                      if (sub.isLocked) {
                        return (
                          <div
                            key={sub.name}
                            onClick={() => toast.error("Enterprise Commission Optimizer is locked. Pending production activation.")}
                            className="flex items-center justify-between px-4 py-1.5 text-xs rounded-lg transition-colors font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-hover)] cursor-pointer opacity-60 hover:opacity-100"
                          >
                            <span>{sub.name}</span>
                            <Lock className="w-3 h-3 text-[var(--text-secondary)] opacity-50" />
                          </div>
                        );
                      }
                      const isSubActive = location.pathname === sub.path;
                      return (
                        <Link
                          key={sub.name}
                          to={sub.path}
                          className={`
                            block px-4 py-1.5 text-xs rounded-lg transition-colors font-medium
                            ${isSubActive
                              ? "text-[var(--color-primary)] font-semibold bg-[var(--color-primary-glow)] border border-[var(--border-soft)] shadow-xs"
                              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-hover)]"
                            }
                          `}
                        >
                          {sub.name}
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Collapsible Operations Menu */}
            <div className="space-y-1">
              <button
                onClick={() => setOperationsOpen(!operationsOpen)}
                className={`
                  w-full group relative flex items-center px-4 py-2.5 transition-all duration-150 rounded-xl cursor-pointer text-sm font-medium text-left border border-transparent
                  ${location.pathname.startsWith('/operations')
                    ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--border-soft)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-hover)]"
                  }
                `}
              >
                <Shuffle className={`w-4 h-4 mr-3 transition-colors ${location.pathname.startsWith('/operations') ? "text-[var(--color-primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"}`} />
                <span className="tracking-wide flex-1">Operations</span>
                {operationsOpen ? (
                  <ChevronDown className="w-4 h-4 ml-auto text-[var(--text-secondary)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 ml-auto text-[var(--text-secondary)]" />
                )}
              </button>

              <AnimatePresence>
                {operationsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden pl-7 space-y-1"
                  >
                    {[
                      { name: 'Section Master', path: '/operations/sections' },
                      { name: 'Routing Master', path: '/operations/routing' },
                      { name: 'Provider Routing Rules', path: '/operations/provider-rules' },
                      { name: 'Operator Mapping', path: '/operations/operators' },
                      { name: 'Route Simulator', path: '/operations/simulator' },
                      { name: 'Routing Analytics', path: '/operations/analytics' },
                      { name: 'Routing Audit Logs', path: '/operations/audit-logs' },
                      { name: 'Routing Intelligence', path: '/operations/routing-intelligence' },
                      { name: 'Autonomous Routing Monitor', path: '/operations/autonomous-routing', isSuperAdminOnly: true },
                      { name: 'Emergency Routing Control', path: '/operations/emergency' }
                    ].map((sub) => {
                      if (sub.isSuperAdminOnly && adminUser.role !== 'SUPER_ADMIN') {
                        return null;
                      }
                      if (sub.name === 'Emergency Routing Control' && adminUser.role !== 'SUPER_ADMIN') {
                        return null;
                      }
                      if (sub.isLocked) {
                        return (
                          <div
                            key={sub.name}
                            onClick={() => toast.error(`Enterprise ${sub.name} is locked. Pending production activation.`)}
                            className="flex items-center justify-between px-4 py-1.5 text-xs rounded-lg transition-colors font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-hover)] cursor-pointer opacity-60 hover:opacity-100"
                          >
                            <span>{sub.name}</span>
                            <Lock className="w-3 h-3 text-[var(--text-secondary)] opacity-50" />
                          </div>
                        );
                      }
                      const isSubActive = location.pathname === sub.path;
                      return (
                        <Link
                          key={sub.name}
                          to={sub.path}
                          className={`
                            block px-4 py-1.5 text-xs rounded-lg transition-colors font-medium
                            ${isSubActive
                              ? "text-[var(--color-primary)] font-semibold bg-[var(--color-primary-glow)] border border-[var(--border-soft)] shadow-xs"
                              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-hover)]"
                            }
                          `}
                        >
                          {sub.name}
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Collapsible API Marketplace Menu */}
            <div className="space-y-1">
              <button
                onClick={() => setMarketplaceOpen(!marketplaceOpen)}
                className={`
                  w-full group relative flex items-center px-4 py-2.5 transition-all duration-150 rounded-xl cursor-pointer text-sm font-medium text-left border border-transparent
                  ${location.pathname.startsWith('/api-marketplace')
                    ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--border-soft)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-hover)]"
                  }
                `}
              >
                <ShoppingBag className={`w-4 h-4 mr-3 transition-colors ${location.pathname.startsWith('/api-marketplace') ? "text-[var(--color-primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"}`} />
                <span className="tracking-wide flex-1">API Marketplace</span>
                {marketplaceOpen ? (
                  <ChevronDown className="w-4 h-4 ml-auto text-[var(--text-secondary)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 ml-auto text-[var(--text-secondary)]" />
                )}
              </button>

              <AnimatePresence>
                {marketplaceOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden pl-7 space-y-1"
                  >
                    {[
                      { name: 'Dashboard', path: '/api-marketplace/dashboard' },
                      { name: 'Products', path: '/api-marketplace/products' },
                      { name: 'Plans', path: '/api-marketplace/plans' },
                      { name: 'Billing', path: '/api-marketplace/billing' },
                      { name: 'Customers', path: '/api-marketplace/customers' },
                      { name: 'Webhooks', path: '/api-marketplace/webhooks' },
                      { name: 'Threat Analytics', path: '/api-marketplace/threats' },
                      { name: 'Documentation', path: '/api-docs' }
                    ].map((sub) => {
                      const isSubActive = location.pathname === sub.path;
                      return (
                        <Link
                          key={sub.name}
                          to={sub.path}
                          className={`
                            block px-4 py-1.5 text-xs rounded-lg transition-colors font-medium
                            ${isSubActive
                              ? "text-[var(--color-primary)] font-semibold bg-[var(--color-primary-glow)] border border-[var(--border-soft)] shadow-xs"
                              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-hover)]"
                            }
                          `}
                        >
                          {sub.name}
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Collapsible Platform Intelligence Menu */}
            {adminUser.role === 'SUPER_ADMIN' && (
              <div className="space-y-1">
                <button
                  onClick={() => setPlatformIntelOpen(!platformIntelOpen)}
                  className={`
                    w-full group relative flex items-center px-4 py-2.5 transition-all duration-150 rounded-xl cursor-pointer text-sm font-medium text-left border border-transparent
                    ${location.pathname.startsWith('/platform')
                      ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--border-soft)] shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-hover)]"
                    }
                  `}
                >
                  <Zap className={`w-4 h-4 mr-3 transition-colors ${location.pathname.startsWith('/platform') ? "text-[var(--color-primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"}`} />
                  <span className="tracking-wide flex-1">Platform Intelligence</span>
                  {platformIntelOpen ? (
                    <ChevronDown className="w-4 h-4 ml-auto text-[var(--text-secondary)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 ml-auto text-[var(--text-secondary)]" />
                  )}
                </button>

                <AnimatePresence>
                  {platformIntelOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden pl-7 space-y-1"
                    >
                      {[
                        { name: 'Feature Flags', path: '/platform/feature-flags' }
                      ].map((sub) => {
                        const isSubActive = location.pathname === sub.path;
                        return (
                          <Link
                            key={sub.name}
                            to={sub.path}
                            className={`
                              block px-4 py-1.5 text-xs rounded-lg transition-colors font-medium
                              ${isSubActive
                                ? "text-[var(--color-primary)] font-semibold bg-[var(--color-primary-glow)] border border-[var(--border-soft)] shadow-xs"
                                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-hover)]"
                              }
                            `}
                          >
                            {sub.name}
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {navItemsAfter.map((item) => {
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
