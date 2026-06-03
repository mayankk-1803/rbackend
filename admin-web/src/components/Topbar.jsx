import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Bell, User, Shield, Menu, CheckCircle2, AlertTriangle, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import ThemeSelector from './ThemeSelector';
import axios from 'axios';

export const Topbar = ({ toggleSidebar }) => {
  const [adminWallet, setAdminWallet] = useState(0);
  const [apiHealth, setApiHealth] = useState('HEALTHY'); // HEALTHY, DEGRADED, DOWN
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [adminUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("dizipay_admin_data")) || {};
    } catch {
      return {};
    }
  });

  // Fetch admin wallet balance
  const fetchWallet = async () => {
    try {
      const { data } = await api.get('/admin/wallet');
      if (data && data.success) {
        setAdminWallet(data?.data?.balance || 0);
      }
    } catch (err) {
      console.warn('[Topbar] Failed to fetch admin wallet:', err.message);
    }
  };

  // Check API health status
  const checkHealth = async () => {
    try {
      const socketURL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
      const healthURL = `${socketURL.replace(/\/$/, '')}/health`;
      const { data } = await axios.get(healthURL, { timeout: 5000 });
      if (data && data.status) {
        setApiHealth(data.status);
      } else {
        setApiHealth('DEGRADED');
      }
    } catch (err) {
      setApiHealth('DOWN');
    }
  };

  useEffect(() => {
    fetchWallet();
    checkHealth();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchWallet();
      checkHealth();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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
      
      <div className="flex items-center gap-3 md:gap-4 relative">
        {/* Wallet Balance Summary */}
        <Link to="/wallet" className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl hover:bg-[var(--accent-hover)] transition-all cursor-pointer">
          <Wallet className="w-4 h-4 text-[var(--color-primary)]" />
          <div className="text-left leading-none">
            <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Admin Vault</span>
            <span className="text-[11px] font-extrabold text-[var(--text-primary)]">
              ₹{Number(adminWallet).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </Link>

        {/* API Health Status */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl">
          {apiHealth === 'HEALTHY' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          )}
          <span className="text-[9px] font-bold uppercase tracking-wider hidden md:inline">
            API: {apiHealth}
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary-glow)] border border-[var(--border-soft)] rounded-xl">
          <Shield className="w-3.5 h-3.5 text-[var(--color-primary)]" />
          <span className="text-[9px] font-bold text-[var(--color-primary)] uppercase tracking-wider">
            {adminUser.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Root Admin'}
          </span>
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="p-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]/50 border border-[var(--border-soft)] rounded-xl transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] relative group cursor-pointer"
          >
            <Bell className="w-4.5 h-4.5" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full border border-[var(--bg-primary)]"></span>
          </motion.button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 mt-2.5 w-64 bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl shadow-medium z-50 p-4 space-y-3"
              >
                <div className="flex justify-between items-center border-b border-[var(--border-soft)] pb-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">Platform Alerts</h4>
                  <span className="text-[8px] bg-[var(--color-primary-glow)] text-[var(--color-primary)] px-1.5 py-0.5 rounded font-black">NEW</span>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] font-medium space-y-2 leading-relaxed">
                  <div className="p-2 bg-[var(--bg-secondary)]/40 rounded-lg border border-[var(--border-soft)]">
                    <p className="font-bold text-[var(--text-primary)]">System Diagnostics</p>
                    <p className="mt-0.5">Database connectivity and Redis cache connections are normal.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Global Theme Selector */}
        <ThemeSelector />
        
        <div className="h-6 w-px bg-[var(--border-soft)] mx-1"></div>
        
        {/* Profile Dropdown */}
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-[var(--text-primary)] tracking-tight">
                {adminUser.name || (adminUser.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin User')}
              </p>
              <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-medium opacity-80">
                {adminUser.role === 'SUPER_ADMIN' ? 'Super Admin' : 'System Manager'}
              </p>
            </div>
            <motion.button 
              whileHover={{ scale: 1.02 }}
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowNotifications(false);
              }}
              className="w-9 h-9 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]/50 flex items-center justify-center text-[var(--text-primary)] cursor-pointer border border-[var(--border-soft)]"
            >
              <User className="w-4.5 h-4.5 text-[var(--text-secondary)]" />
            </motion.button>
          </div>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 mt-2.5 w-48 bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl shadow-medium z-50 py-1"
              >
                <div className="px-4 py-2.5 border-b border-[var(--border-soft)]">
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {adminUser.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin Account'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    sessionStorage.removeItem('dizipay_admin_token');
                    sessionStorage.removeItem('dizipay_admin_data');
                    localStorage.removeItem('dizipay_admin_last_activity');
                    window.location.href = '/87564/admin/login';
                  }}
                  className="w-full text-left px-4 py-2.5 text-[10px] font-bold text-rose-500 hover:bg-rose-500/10 transition-colors uppercase tracking-wider"
                >
                  Logout Session
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
