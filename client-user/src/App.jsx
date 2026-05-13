  import React, { useState, useEffect, Suspense, lazy } from 'react';
  import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
  import { Toaster } from 'react-hot-toast';
  import Navbar from './components/Navbar';
  import BottomNav from './components/BottomNav';
  import ErrorBoundary from './components/ErrorBoundary';
  import { connectSocket, disconnectSocket } from './services/socket';

  // Lazy load pages for performance
  const Home = lazy(() => import('./pages/Home'));
  const Login = lazy(() => import('./pages/Login'));
  const Register = lazy(() => import('./pages/Register'));
  const History = lazy(() => import('./pages/History'));
  const Recharge = lazy(() => import('./pages/Recharge'));
  const MobilePrepaid = lazy(() => import('./pages/MobilePrepaid'));
  const MobilePostpaid = lazy(() => import('./pages/MobilePostpaid'));
  const DTHRecharge = lazy(() => import('./pages/DTHRecharge'));
  const ElectricityRecharge = lazy(() => import('./pages/ElectricityRecharge'));
  const WaterRecharge = lazy(() => import('./pages/WaterRecharge'));
  const GasRecharge = lazy(() => import('./pages/GasRecharge'));
  const BroadbandRecharge = lazy(() => import('./pages/BroadbandRecharge'));
  const LoanRecharge = lazy(() => import('./pages/LoanRecharge'));
  const Dashboard = lazy(() => import('./pages/Dashboard'));
  const Status = lazy(() => import('./pages/Status'));
  const Profile = lazy(() => import('./pages/Profile'));
  const EarnedCoins = lazy(() => import('./pages/EarnedCoins'));
  const Security = lazy(() => import('./pages/Security'));
  const Support = lazy(() => import('./pages/Support'));
  const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
  const DeveloperPortal = lazy(() => import('./pages/DeveloperPortal'));

  import { domAnimation, LazyMotion, motion, AnimatePresence } from 'framer-motion';

  const PageLoader = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Synchronizing...</p>
      </div>
    </div>
  );

  const PrivateRoute = ({ isAuth, children }) => {
    return isAuth ? children : <Navigate to="/login" />;
  };

  const Layout = ({ children }) => {
    const location = useLocation();

    const hideNavbarRoutes = ['/login', '/register'];
    const showNavbar = !hideNavbarRoutes.includes(location.pathname);

    return (
      <LazyMotion features={domAnimation}>
        {showNavbar && <Navbar />}
        <main className="max-w-7xl mx-auto px-4 py-6 pb-28 md:pb-6">
          <Suspense fallback={<PageLoader />}>
            {children}
          </Suspense>
        </main>
        <BottomNav />
      </LazyMotion>
    );
  };

  function App() {
    const [isAuth, setIsAuth] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      
      if (token && user.id) {
        setIsAuth(true);
        connectSocket(user.id);
      } else {
        setIsAuth(false);
        disconnectSocket();
      }
      setLoading(false);
    }, [isAuth]);

    if (loading) return null;
    return (
      <ErrorBoundary>
        <Router>
          <div className="min-h-screen bg-slate-50 text-slate-900 relative">
            {/* Subtle background glow elements for glassmorphism pop - Optimized for Mobile */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
              <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] hidden md:block"></div>
              <div className="absolute top-1/3 -right-20 w-80 h-80 bg-purple-500/5 rounded-full blur-[100px] hidden md:block"></div>
              <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-blue-600/5 rounded-full blur-[120px] hidden md:block"></div>
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
                <Route path="/recharge/mobile-prepaid" element={<PrivateRoute isAuth={isAuth}><MobilePrepaid /></PrivateRoute>} />
                <Route path="/recharge/mobile-postpaid" element={<PrivateRoute isAuth={isAuth}><MobilePostpaid /></PrivateRoute>} />
                <Route path="/recharge/dth" element={<PrivateRoute isAuth={isAuth}><DTHRecharge /></PrivateRoute>} />
                <Route path="/recharge/electricity" element={<PrivateRoute isAuth={isAuth}><ElectricityRecharge /></PrivateRoute>} />
                <Route path="/recharge/water" element={<PrivateRoute isAuth={isAuth}><WaterRecharge /></PrivateRoute>} />
                <Route path="/recharge/gas" element={<PrivateRoute isAuth={isAuth}><GasRecharge /></PrivateRoute>} />
                <Route path="/recharge/broadband" element={<PrivateRoute isAuth={isAuth}><BroadbandRecharge /></PrivateRoute>} />
                <Route path="/recharge/loan" element={<PrivateRoute isAuth={isAuth}><LoanRecharge /></PrivateRoute>} />

                <Route path="/status" element={<PrivateRoute isAuth={isAuth}><Status /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute isAuth={isAuth}><Profile /></PrivateRoute>} />
                <Route path="/profile/security" element={<PrivateRoute isAuth={isAuth}><Security /></PrivateRoute>} />
                <Route path="/profile/support" element={<PrivateRoute isAuth={isAuth}><Support /></PrivateRoute>} />
                <Route path="/earned-coins" element={<PrivateRoute isAuth={isAuth}><EarnedCoins /></PrivateRoute>} />
                <Route path="/payment-success" element={<PrivateRoute isAuth={isAuth}><PaymentSuccess /></PrivateRoute>} />
                <Route path="/developer" element={<PrivateRoute isAuth={isAuth}><DeveloperPortal /></PrivateRoute>} />

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