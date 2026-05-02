import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, LayoutDashboard, Smartphone, History, Activity, User } from "lucide-react";
import { motion } from "framer-motion";

const BottomNav = () => {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/recharge", label: "Recharge", icon: Smartphone },
    { path: "/history", label: "History", icon: History },
    { path: "/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-4">
      <div className="bg-white/80 backdrop-blur-2xl border border-slate-200 rounded-3xl p-2 flex justify-between items-center shadow-[0_10px_40px_rgba(0,0,0,0.1)]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="relative flex-1 flex flex-col items-center justify-center py-2"
            >
              <item.icon
                className={`w-5 h-5 mb-1 transition-all ${
                  isActive ? "text-cyan-600 scale-110" : "text-slate-400"
                }`}
              />
              <span
                className={`text-[8px] font-black uppercase tracking-widest ${
                  isActive ? "text-cyan-600" : "text-slate-500"
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-active"
                  className="absolute inset-0 bg-cyan-500/10 rounded-2xl -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
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
