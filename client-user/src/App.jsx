import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import History from './pages/History';
import Recharge from './pages/Recharge';
import MobileRecharge from './pages/MobileRecharge';
import DTHRecharge from './pages/DTHRecharge';
import ElectricityRecharge from './pages/ElectricityRecharge';
import WaterRecharge from './pages/WaterRecharge';
import GasRecharge from './pages/GasRecharge';
import BroadbandRecharge from './pages/BroadbandRecharge';
import LoanRecharge from './pages/LoanRecharge';
import Dashboard from './pages/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';
import Status from './pages/Status';
import Profile from './pages/Profile';
import BottomNav from './components/BottomNav';

const PrivateRoute = ({ isAuth, children }) => {
  return isAuth ? children : <Navigate to="/login" />;
};

const Layout = ({ children }) => {
  const location = useLocation();

  const hideNavbarRoutes = ['/login', '/register'];
  const showNavbar = !hideNavbarRoutes.includes(location.pathname);

  return (
    <>
      {showNavbar && <Navbar />}
      <main className="max-w-7xl mx-auto px-4 py-6 pb-28 md:pb-6">
        {children}
      </main>
      <BottomNav />
    </>
  );
};

function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuth(!!token);
    setLoading(false);
  }, []);

  if (loading) return null;
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-slate-50 text-slate-900 relative">
          {/* Subtle background glow elements for glassmorphism pop */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px]"></div>
            <div className="absolute top-1/3 -right-20 w-80 h-80 bg-purple-500/5 rounded-full blur-[100px]"></div>
            <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-blue-600/5 rounded-full blur-[120px]"></div>
          </div>
          <div className="relative z-10">
          <Toaster position="top-right" />

          <Layout>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              <Route path="/" element={<PrivateRoute isAuth={isAuth}><Home /></PrivateRoute>} />
              <Route path="/dashboard" element={<PrivateRoute isAuth={isAuth}><Dashboard /></PrivateRoute>} />
              <Route path="/history" element={<PrivateRoute isAuth={isAuth}><History /></PrivateRoute>} />
              <Route path="/recharge" element={<PrivateRoute isAuth={isAuth}><Recharge /></PrivateRoute>} />

              <Route path="/recharge/mobile" element={<PrivateRoute isAuth={isAuth}><MobileRecharge /></PrivateRoute>} />
              <Route path="/recharge/dth" element={<PrivateRoute isAuth={isAuth}><DTHRecharge /></PrivateRoute>} />
              <Route path="/recharge/electricity" element={<PrivateRoute isAuth={isAuth}><ElectricityRecharge /></PrivateRoute>} />
              <Route path="/recharge/water" element={<PrivateRoute isAuth={isAuth}><WaterRecharge /></PrivateRoute>} />
              <Route path="/recharge/gas" element={<PrivateRoute isAuth={isAuth}><GasRecharge /></PrivateRoute>} />
              <Route path="/recharge/broadband" element={<PrivateRoute isAuth={isAuth}><BroadbandRecharge /></PrivateRoute>} />
              <Route path="/recharge/loan" element={<PrivateRoute isAuth={isAuth}><LoanRecharge /></PrivateRoute>} />

              <Route path="/status" element={<PrivateRoute isAuth={isAuth}><Status /></PrivateRoute>} />
              <Route path="/profile" element={<PrivateRoute isAuth={isAuth}><Profile /></PrivateRoute>} />

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
          </div>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;