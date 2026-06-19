import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { LogOut, LayoutDashboard, Smartphone, History, Activity, User, Zap, ShoppingBag, ShieldCheck, WalletCards, Headphones, ChevronRight, PanelLeftClose, PanelLeftOpen, Bell, Search, Coins } from "lucide-react";
import ThemeSelector from "./ThemeSelector";
import Logo from "./Logo";
import { useIsIOS } from "../utils/device";
import { useWallet } from "../context/WalletContext";
import { convertCashbackToCoins } from "../utils/rewardDisplayHelper";


const Navbar = ({ collapsed = false, setCollapsed = () => {} }) => {
  const location = useLocation();
  const isIOS = useIsIOS();
  const { wallet } = useWallet();

  const navItems = [
    { path: "/dashboard", label: "Home", icon: LayoutDashboard, hint: "Overview" },
    { path: "/recharge", label: "Services", icon: Smartphone, hint: "Recharge & bills" },
    { path: "/imart", label: "Marketplace", icon: ShoppingBag, hint: "iMart store" },
    { path: "/history", label: "History", icon: History, hint: "Activity log" },
    { path: "/reports/ledger", label: "Wallet", icon: WalletCards, hint: "Ledger & reports" },
    { path: "/profile", label: "Profile", icon: User, hint: "Account" },
  ];

  const secondaryItems = [
    { path: "/reports/transactions", label: "Transactions", icon: Activity },
    { path: "/profile/security", label: "Security", icon: ShieldCheck },
    { path: "/profile/support", label: "Support", icon: Headphones },
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
    <>
    <div className={`hidden md:block fixed left-5 top-5 bottom-5 ${collapsed ? "w-20" : "w-64"} z-50 ios-promote-layer transition-all duration-300`}>
      <nav className="h-full ui-sidebar rounded-2xl border border-[var(--glass-border)] shadow-[var(--glass-shadow)] ios-promote-layer flex flex-col overflow-hidden">
        <div className="p-5 border-b border-[var(--glass-border)]">
          <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2`}>
          <Link to="/dashboard" className="navbar-logo-container shrink-0 overflow-visible min-w-0 flex items-center gap-3">
            <Logo size="lg" collapsed={collapsed} />
            {!collapsed && <div className="min-w-0">
              <span className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Client portal</span>
            </div>}
          </Link>
          {!collapsed && (
            <button type="button" onClick={() => setCollapsed(true)} className="w-9 h-9 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-button-bg)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-color)]">
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
          {collapsed && (
            <button type="button" onClick={() => setCollapsed(false)} className="absolute -right-3 top-8 w-8 h-8 rounded-full border border-[var(--glass-border)] bg-[var(--card-bg)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-color)] shadow-lg">
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
          </div>
        </div>

        <div data-lenis-prevent className={`${collapsed ? "p-3" : "p-4"} space-y-2 flex-1 overflow-y-auto premium-scrollbar`}>
          {!collapsed && <p className="px-3 text-[10px] font-black uppercase text-[var(--text-muted)]">Workspace</p>}
            {navItems.map((item) => {
              const isActive = item.path === "/dashboard"
                ? location.pathname === item.path
                : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={`relative ${collapsed ? "px-2 justify-center" : "px-3"} py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-3 group ${
                    isActive ? "text-[var(--color-accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-color)]"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors ${isActive ? "bg-[var(--accent-soft)] border-[var(--color-accent)]/25" : "bg-[var(--glass-button-bg)] border-[var(--glass-border)]"}`}>
                    <item.icon className={`w-4 h-4 ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-color)]'}`} />
                  </div>
                  {!collapsed && <span className="flex-1 min-w-0">
                    <span className="block leading-tight">{item.label}</span>
                    <span className="block text-[10px] font-semibold text-[var(--text-muted)] mt-0.5">{item.hint}</span>
                  </span>}
                  {!collapsed && <ChevronRight className={`w-4 h-4 transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`} />}
                  {isActive && (
                    <Motion.div 
                      layoutId="nav-active"
                      className="absolute inset-0 bg-[var(--color-accent-glow)] border border-[var(--color-accent)]/20 rounded-xl -z-10"
                      transition={isIOS ? { duration: 0.18 } : window.innerWidth > 768 ? { type: "spring", bounce: 0.15, duration: 0.55 } : { duration: 0.2 }}
                    />
                  )}
                </Link>
              );
            })}

          <div className="pt-4 mt-3 border-t border-[var(--glass-border)] space-y-2">
            {!collapsed && <p className="px-3 text-[10px] font-black uppercase text-[var(--text-muted)]">Controls</p>}
            {secondaryItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} title={collapsed ? item.label : undefined} className={`${collapsed ? "px-2 justify-center" : "px-3"} py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-3 ${isActive ? "bg-[var(--color-accent-glow)] text-[var(--color-accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--glass-button-bg)] hover:text-[var(--text-color)]"}`}>
                  <item.icon className="w-4 h-4" />
                  {!collapsed && item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className={`${collapsed ? "p-3" : "p-4"} border-t border-[var(--glass-border)] space-y-3`}>
          {!collapsed && <Link to="/reports/ledger" className="block rounded-2xl p-4 bg-[var(--accent-soft)]/70 border border-[var(--color-accent)]/15">
            <p className="text-[10px] font-black uppercase text-[var(--text-muted)]">Wallet summary</p>
            <p className="mt-1 text-lg font-black text-[var(--text-color)]">₹{Number(wallet?.balance || 0).toFixed(2)}</p>
            <div className="mt-2 text-[10px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
              <span>Coins: {convertCashbackToCoins(wallet?.cashbackBalance)}</span>
            </div>
          </Link>}
          <div className={`flex items-center gap-2 ${collapsed ? "flex-col" : ""}`}>
            {!collapsed && <ThemeSelector position="top" align="left" />}
            <button
              onClick={handleLogout}
              title="Logout"
              className={`${collapsed ? "w-11 h-11 px-0" : "flex-1 px-4"} flex items-center justify-center gap-2 py-3 bg-transparent text-[#FF4D6D] rounded-xl text-xs font-black uppercase border border-[#FF4D6D]/25 hover:border-[#FF4D6D] transition-all duration-300 hover:bg-[#FF4D6D]/10 group cursor-pointer`}
            >
              <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              {!collapsed && "Logout"}
            </button>
          </div>
        </div>
      </nav>
    </div>
    </>
  );
};

export default Navbar;
