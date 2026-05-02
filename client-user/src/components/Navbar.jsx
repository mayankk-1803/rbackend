import React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, Home, LayoutDashboard, Smartphone, History, Activity, User } from "lucide-react";

const Navbar = () => {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/recharge", label: "Recharge", icon: Smartphone },
    { path: "/history", label: "History", icon: History },
    { path: "/status", label: "Status", icon: Activity },
    { path: "/profile", label: "Profile", icon: User },
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  return (
    <nav className="sticky top-0 z-50 bg-[#030014]/50 backdrop-blur-2xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
        
        {/* Logo */}
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.3)] group-hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-all duration-500">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-black text-white tracking-tighter uppercase italic">Dizipay <span className="text-cyan-400">Vault</span></span>
        </div>

        {/* Links */}
        <div className="hidden md:flex gap-1 bg-white/5 p-1.5 rounded-2xl border border-white/5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                  isActive ? "text-cyan-400" : "text-slate-500 hover:text-white"
                }`}
              >
                <item.icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-600'}`} />
                {item.label}
                {isActive && (
                  <motion.div 
                    layoutId="nav-active"
                    className="absolute inset-0 bg-cyan-500/10 border border-cyan-500/20 rounded-xl -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-500/20 transition-all group"
        >
          <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;