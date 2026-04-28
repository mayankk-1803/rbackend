import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Tester } from './pages/Tester';
import { Transactions } from './pages/Transactions';
import { Alerts } from './pages/Alerts';
import { Providers } from './pages/Providers';
import { ApiDocs } from './pages/ApiDocs';
import { Login } from './pages/Login';

const RequireAuthAdmin = ({ isAuth, children }) => {
  if (!isAuth) return <Navigate to="/login" replace />;
  const userStr = localStorage.getItem('user');
  if (!userStr) return <Navigate to="/login" replace />;
  const user = JSON.parse(userStr);
  if (user.role !== 'admin') return <Navigate to="/login" replace />;
  return children;
};

function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    setIsAuth(!!token);
    setLoading(false);
  }, []);

  if (loading) return null;

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
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuthAdmin isAuth={isAuth}><Layout /></RequireAuthAdmin>}>
          <Route index element={<Dashboard />} />
          <Route path="tester" element={<Tester />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="providers" element={<Providers />} />
          <Route path="api-docs" element={<ApiDocs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
