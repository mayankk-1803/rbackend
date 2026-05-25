import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Smartphone, History, Activity, User, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import { useIsIOS } from "../utils/device";

const BottomNav = () => {
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

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] ios-promote-layer">
      <div className="bg-[var(--glass-navbar-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-2xl p-1.5 flex justify-between items-stretch shadow-[var(--glass-shadow)] ios-promote-layer">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="relative flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 tap-highlight-none"
            >
              <item.icon
                className={`w-5 h-5 mb-1 transition-all duration-300 ${
                  isActive ? "text-[var(--color-accent)] filter drop-shadow-[0_0_8px_var(--color-accent-glow)]" : "text-[var(--text-muted)]"
                }`}
              />
              <span
                className={`text-[7px] font-black uppercase tracking-normal leading-none transition-colors duration-300 ${
                  isActive ? "text-[var(--color-accent)] cyan-glow" : "text-[var(--text-muted)]"
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-active"
                  className="absolute inset-0.5 bg-[var(--color-accent-glow)] border border-[var(--color-accent)]/20 rounded-xl -z-10 shadow-[0_0_15px_var(--color-accent-glow)] ios-promote-layer"
                  transition={isIOS ? { duration: 0.18 } : { type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
