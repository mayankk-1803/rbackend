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
    <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-lg md:backdrop-blur-2xl border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
        
        {/* Logo */}
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-500">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">Dizipay <span className="text-cyan-600">Vault</span></span>
        </div>

        {/* Links */}
        <div className="hidden md:flex gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                  isActive ? "text-cyan-600" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <item.icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-600' : 'text-slate-400'}`} />
                {item.label}
                {isActive && (
                  <motion.div 
                    layoutId="nav-active"
                    className="absolute inset-0 bg-cyan-500/10 border border-cyan-500/20 rounded-xl -z-10"
                    transition={window.innerWidth > 768 ? { type: "spring", bounce: 0.2, duration: 0.6 } : { duration: 0.2 }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-200 transition-all group"
        >
          <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;