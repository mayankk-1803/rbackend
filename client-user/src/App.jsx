import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import ErrorBoundary from './components/ErrorBoundary';
import RewardPopup from './components/RewardPopup';
import { connectSocket, disconnectSocket } from './services/socket';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { useIsIOS } from './utils/device';
import InactivityManager from './components/InactivityManager';

  // Lazy load pages for performance
  const HomePage = lazy(() => import('./pages/HomePage'));
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
  const TransactionHistory = lazy(() => import('./pages/reports/TransactionHistory'));
  const WalletLedger = lazy(() => import('./pages/reports/WalletLedger'));
  
  // iMart E-commerce Lazy Pages
  const Catalog = lazy(() => import('./pages/imart/Catalog'));
  const Wishlist = lazy(() => import('./pages/imart/Wishlist'));
  const ProductDetails = lazy(() => import('./pages/imart/ProductDetails'));

  import { domAnimation, LazyMotion, motion, AnimatePresence } from 'framer-motion';

  const PageLoader = () => (
    <div className="flex items-center justify-center min-h-[60vh] relative z-10">
      <div className="flex flex-col items-center gap-6 p-8 rounded-3xl bg-slate-950/40 border border-white/5 backdrop-blur-md shadow-2xl">
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
          <div className="w-4 h-4 bg-purple-500 rounded-full absolute animate-pulse"></div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.25em] cyan-glow">DiziPay Vault</p>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] animate-pulse">Synchronizing ledger...</p>
        </div>
      </div>
    </div>
  );

  const PrivateRoute = ({ isAuth, children }) => {
    const location = useLocation();
    if (!isAuth) return <Navigate to="/login" />;

    try {
      const user = JSON.parse(sessionStorage.getItem("dizipay_user_data") || "{}");
      if (user?.mustChangePassword && location.pathname !== '/profile/security') {
        return <Navigate to="/profile/security" replace />;
      }
    } catch (e) {
      console.error(e);
    }

    return children;
  };

  const PublicRoute = ({ isAuth, children }) => {
    return isAuth ? <Navigate to="/dashboard" replace /> : children;
  };

  const Layout = ({ children }) => {
    const location = useLocation();

    // Do not show the app's internal navbar/bottomnav on public pages
    const hideNavbarRoutes = ['/', '/login', '/register'];
    const showNavbar = !hideNavbarRoutes.includes(location.pathname);

    let mustChangePassword = false;
    try {
      const user = JSON.parse(sessionStorage.getItem("dizipay_user_data") || "{}");
      mustChangePassword = !!user?.mustChangePassword;
    } catch {}

    return (
      <LazyMotion features={domAnimation}>
        {showNavbar && <Navbar />}
        <main className={showNavbar ? "max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 py-5 md:py-6 pb-24 md:pb-6" : ""}>
          {mustChangePassword && showNavbar && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center gap-3 text-xs font-bold uppercase tracking-wider shadow-sm shadow-amber-500/5"
            >
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
              <span>Please change your temporary password for security. Sensitive operations are currently blocked.</span>
            </motion.div>
          )}
          <Suspense fallback={<PageLoader />}>
            {children}
          </Suspense>
        </main>
        {showNavbar && <BottomNav />}
      </LazyMotion>
    );
  };

  function App() {
    const [isAuth, setIsAuth] = useState(false);
    const [loading, setLoading] = useState(true);
    const isIOS = useIsIOS();

    useEffect(() => {
      gsap.registerPlugin(ScrollTrigger);
      if (isIOS) {
        ScrollTrigger.config({ ignoreMobileResize: true });
        return undefined;
      }

      const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });

      lenis.on('scroll', ScrollTrigger.update);

      const updateLenis = (time) => {
        lenis.raf(time * 1000);
      };

      gsap.ticker.add(updateLenis);
      gsap.ticker.lagSmoothing(0);

      return () => {
        lenis.destroy();
        gsap.ticker.remove(updateLenis);
      };
    }, [isIOS]);

    useEffect(() => {
      // Migrate from localStorage to sessionStorage if exists
      if (!sessionStorage.getItem("dizipay_user_token")) {
        const oldToken = localStorage.getItem("dizipay_user_token");
        const oldUserData = localStorage.getItem("dizipay_user_data");
        if (oldToken) {
          sessionStorage.setItem("dizipay_user_token", oldToken);
        }
        if (oldUserData) {
          sessionStorage.setItem("dizipay_user_data", oldUserData);
        }
        localStorage.removeItem("dizipay_user_token");
        localStorage.removeItem("dizipay_user_data");
      }

      const token = sessionStorage.getItem("dizipay_user_token");
      const user = JSON.parse(sessionStorage.getItem("dizipay_user_data") || "{}");
      
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
            <div className={`client-shell min-h-screen bg-[var(--bg-color)] text-[var(--text-color)] relative overflow-hidden selection:bg-cyan-500/30 selection:text-white transition-colors duration-300 ${isIOS ? 'ios-runtime' : ''}`}>
              {/* Ambient Nebula Light System */}
              <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 dashboard-ambient-layer">
                <div className="ambient-blob absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-cyan-600/8 rounded-full blur-[150px] animate-blob-left"></div>
                <div className="ambient-blob absolute top-[20%] -right-[10%] w-[50%] h-[50%] bg-purple-600/8 rounded-full blur-[130px] animate-blob-right"></div>
                <div className="ambient-blob absolute -bottom-[10%] left-[20%] w-[60%] h-[60%] bg-blue-600/6 rounded-full blur-[160px] animate-blob-bottom"></div>
                <div className="absolute inset-0 neural-grid opacity-30"></div>
              </div>
              <div className="relative z-10">
              <Toaster position="top-right" />
              <InactivityManager />
              {isAuth && <RewardPopup />}

              <Layout>
                <WalletProvider>
                  <Routes>
                    <Route path="/login" element={<PublicRoute isAuth={isAuth}><Login /></PublicRoute>} />
                    <Route path="/register" element={<PublicRoute isAuth={isAuth}><Register /></PublicRoute>} />

                    <Route path="/" element={<PublicRoute isAuth={isAuth}><HomePage /></PublicRoute>} />
                    <Route path="/dashboard" element={<PrivateRoute isAuth={isAuth}><Home /></PrivateRoute>} />
                    <Route path="/history" element={<PrivateRoute isAuth={isAuth}><History /></PrivateRoute>} />
                    <Route path="/reports/transactions" element={<PrivateRoute isAuth={isAuth}><TransactionHistory /></PrivateRoute>} />
                    <Route path="/reports/ledger" element={<PrivateRoute isAuth={isAuth}><WalletLedger /></PrivateRoute>} />
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


                    {/* iMart Marketplace Routes */}
                    <Route path="/imart" element={<PrivateRoute isAuth={isAuth}><Catalog /></PrivateRoute>} />
                    <Route path="/imart/wishlist" element={<PrivateRoute isAuth={isAuth}><Wishlist /></PrivateRoute>} />
                    <Route path="/imart/product/:slug" element={<PrivateRoute isAuth={isAuth}><ProductDetails /></PrivateRoute>} />

                    <Route path="/admin/*" element={<Navigate to="/" replace />} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </WalletProvider>
              </Layout>
              </div>
            </div>
          </Router>
        </ErrorBoundary>
    );
  }

export default App;
