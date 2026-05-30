import React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { LogOut, LayoutDashboard, Smartphone, History, Activity, User, Zap, ShoppingBag } from "lucide-react";
import ThemeSelector from "./ThemeSelector";
import { useIsIOS } from "../utils/device";

const Navbar = () => {
  const location = useLocation();
  const isIOS = useIsIOS();

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/recharge", label: "Recharge", icon: Smartphone },
    { path: "/imart", label: "IMART", icon: ShoppingBag },
    { path: "/history", label: "History", icon: History },
    { path: "/reports/ledger", label: "Reports", icon: Activity },
    { path: "/profile", label: "Profile", icon: User },
  ];

  const handleLogout = () => {
    sessionStorage.removeItem("dizipay_user_token");
    sessionStorage.removeItem("dizipay_user_data");
    sessionStorage.removeItem("dizipay_developer_token");
    localStorage.removeItem("dizipay_developer_token");
    sessionStorage.removeItem("developer_verified");
    localStorage.removeItem("developer_verified");
    sessionStorage.removeItem("developer_session");
    localStorage.removeItem("developer_session");
    sessionStorage.removeItem("developer_auth_cache");
    localStorage.removeItem("developer_auth_cache");
    localStorage.removeItem("dizipay_last_activity");
    for (let key in localStorage) {
      if (key.includes("developer")) {
        localStorage.removeItem(key);
      }
    }
    for (let key in sessionStorage) {
      if (key.includes("developer")) {
        sessionStorage.removeItem(key);
      }
    }
    window.location.href = "/";
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 mt-6 sticky top-6 z-50 ios-promote-layer">
      <nav className="glass-navbar rounded-2xl md:rounded-3xl border border-[var(--glass-border)] shadow-[var(--glass-shadow)] ios-promote-layer">
        <div className="px-6 h-20 flex justify-between items-center">
          
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 group cursor-pointer navbar-logo-container">
            <div className="w-8 h-8 bg-[var(--glass-button-bg)] rounded-lg flex items-center justify-center border border-[var(--glass-border)] group-hover:border-[var(--glass-border-hover)] transition-all duration-500">
              <Zap className="w-4 h-4 text-[var(--color-primary)] fill-[var(--color-primary-glow)]" />
            </div>
            <span className="text-xl font-black text-[var(--text-color)] tracking-tight font-sans lowercase navbar-logo-text">irecharge</span>
          </Link>

          {/* Links */}
          <div className="hidden md:flex gap-1 bg-[var(--bg-tertiary)]/50 p-1 rounded-2xl border border-[var(--glass-border)]">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                    isActive ? "text-[var(--color-accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-color)]"
                  }`}
                >
                  <item.icon className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--text-muted)]'}`} />
                  {item.label}
                  {isActive && (
                    <Motion.div 
                      layoutId="nav-active"
                      className="absolute inset-0 bg-[var(--color-accent-glow)] border border-[var(--color-accent)]/30 rounded-xl -z-10 shadow-[0_0_20px_var(--color-accent-glow)]"
                      transition={isIOS ? { duration: 0.18 } : window.innerWidth > 768 ? { type: "spring", bounce: 0.15, duration: 0.55 } : { duration: 0.2 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Actions: Theme and Logout */}
          <div className="flex items-center gap-4">
            <ThemeSelector />
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-transparent text-[#FF4D6D] hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-[#FF4D6D]/30 hover:border-[#FF4D6D] transition-all duration-300 shadow-[0_0_15px_rgba(255,77,109,0.05)] hover:shadow-[0_0_20px_rgba(255,77,109,0.25)] hover:bg-[#FF4D6D]/15 group cursor-pointer"
            >
              <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              Logout
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
