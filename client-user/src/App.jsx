import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { Zap, LogOut } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import Home from './pages/Home';
import Recharge from './pages/Recharge';
import Status from './pages/Status';
import History from './pages/History';
import Login from './pages/Login';
import Register from './pages/Register';
import MobileRecharge from './pages/MobileRecharge';
import DTHRecharge from './pages/DTHRecharge';
import ElectricityRecharge from './pages/ElectricityRecharge';
import WaterRecharge from './pages/WaterRecharge';
import GasRecharge from './pages/GasRecharge';
import BroadbandRecharge from './pages/BroadbandRecharge';
import LoanRecharge from './pages/LoanRecharge';

const RequireAuth = ({ children }) => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  if (!token || !userStr) return <Navigate to="/login" replace />;
  const user = JSON.parse(userStr);
  if (user.role !== 'user') return <Navigate to="/login" replace />;
  return children;
};

const Topbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/recharge', label: 'Recharge' },
    { path: '/history', label: 'History' },
    { path: '/status', label: 'Check Status' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  return (
    <nav className="bg-white border-b border-[#E5E7EB] sticky top-0 z-50">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center gap-2 mr-8">
              <div className="w-8 h-8 bg-[#6D28D9] rounded flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-lg text-[#0F172A]">Dizipay</span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-[#6D28D9] text-[#0F172A]'
                        : 'border-transparent text-[#64748B] hover:border-[#E5E7EB] hover:text-[#0F172A]'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center hidden sm:flex">
            <button
              onClick={handleLogout}
              className="text-[#64748B] hover:text-[#DC2626] flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

const AppLayout = ({ children }) => (
  <div className="min-h-screen bg-[#F8FAFC] font-sans text-[#0F172A]">
    <Topbar />
    <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {children}
    </main>
  </div>
);

export default function App() {
  const token = localStorage.getItem('token');

  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#0F172A",
            color: "#FFFFFF",
            fontSize: "13px",
            fontWeight: "500",
            borderRadius: "6px"
          }
        }}
      />
      <Routes>
        {!token ? (
          <>
            <Route path="/" element={<Register />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            {/* Redirect all other paths to register if not logged in */}
            <Route path="*" element={<Navigate to="/register" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<RequireAuth><AppLayout><Home /></AppLayout></RequireAuth>} />
            <Route path="/recharge" element={<RequireAuth><AppLayout><Recharge /></AppLayout></RequireAuth>} />
            <Route path="/recharge/mobile" element={<RequireAuth><AppLayout><MobileRecharge /></AppLayout></RequireAuth>} />
            <Route path="/recharge/dth" element={<RequireAuth><AppLayout><DTHRecharge /></AppLayout></RequireAuth>} />
            <Route path="/recharge/electricity" element={<RequireAuth><AppLayout><ElectricityRecharge /></AppLayout></RequireAuth>} />
            <Route path="/recharge/water" element={<RequireAuth><AppLayout><WaterRecharge /></AppLayout></RequireAuth>} />
            <Route path="/recharge/gas" element={<RequireAuth><AppLayout><GasRecharge /></AppLayout></RequireAuth>} />
            <Route path="/recharge/broadband" element={<RequireAuth><AppLayout><BroadbandRecharge /></AppLayout></RequireAuth>} />
            <Route path="/recharge/loan" element={<RequireAuth><AppLayout><LoanRecharge /></AppLayout></RequireAuth>} />
            <Route path="/status" element={<RequireAuth><AppLayout><Status /></AppLayout></RequireAuth>} />
            <Route path="/history" element={<RequireAuth><AppLayout><History /></AppLayout></RequireAuth>} />
            {/* Redirect to dashboard for any unknown path when logged in */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}
