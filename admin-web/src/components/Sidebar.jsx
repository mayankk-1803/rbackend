import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Smartphone, 
  Wallet, 
  Bell, 
  Server,
  Zap,
  LogOut,
  FileText
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Tester', path: '/tester', icon: Smartphone },
  { name: 'Transactions', path: '/transactions', icon: Wallet },
  { name: 'Alerts', path: '/alerts', icon: Bell },
  { name: 'Providers', path: '/providers', icon: Server },
  { name: 'API Docs', path: '/api-docs', icon: FileText },
];

export const Sidebar = () => {
  const location = useLocation();

  return (
    <aside className="w-64 bg-white border-r border-[#E2E8F0] h-full flex flex-col z-40 relative">
      <div className="h-16 flex items-center px-6 gap-3 border-b border-[#E2E8F0]">
        <div className="w-8 h-8 bg-[#6D28D9] rounded flex items-center justify-center">
          <Zap className="w-5 h-5 text-white fill-current" />
        </div>
        <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">
          Dizipay
        </h1>
      </div>
      
      <div className="flex-1 py-6 flex flex-col">
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`
                  flex items-center px-6 py-3 transition-all duration-150 text-sm font-medium
                  ${isActive 
                    ? "bg-[#F3E8FF] text-[#6D28D9] border-l-2 border-[#6D28D9]" 
                    : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] border-l-2 border-transparent"
                  }
                `}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? "text-[#6D28D9]" : "text-[#94A3B8]"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 mt-auto pt-6 border-t border-[#E2E8F0]">
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/login';
            }}
            className="w-full flex items-center px-4 py-3 text-[#64748B] hover:bg-[#FEF2F2] hover:text-[#DC2626] rounded-md transition-all group"
          >
            <LogOut className="w-5 h-5 mr-3 text-[#94A3B8] group-hover:text-[#DC2626]" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="flex items-center gap-3 p-2">
          <div className="w-8 h-8 rounded bg-[#E2E8F0] flex items-center justify-center text-[#64748B] font-bold text-xs">
            AZ
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#0F172A] truncate">Admin Account</p>
            <p className="text-[10px] text-[#94A3B8] truncate">v1.2.0-stable</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
