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
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
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
        <div className="min-h-screen bg-[#F1F5F9]">
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
      </Router>
    </ErrorBoundary>
  );
}

export default App;