import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Tester } from './pages/Tester';
import { Transactions } from './pages/Transactions';
import { Alerts } from './pages/Alerts';
import { Providers } from './pages/Providers';
import { ApiDocs } from './pages/ApiDocs';
import { Login } from './pages/Login';
import { Wallet } from './pages/Wallet';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  if (import.meta.env.DEV) {
    console.log(" [Auth Guard] Token Check:", token ? "Exists" : "MISSING");
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial mount check
    const token = localStorage.getItem("token");
    if (import.meta.env.DEV) {
      console.log(" [App Mount] Initial Token Check:", token ? "Authenticated" : "Not Authenticated");
    }
    setLoading(false);
  }, []);

  if (loading) return null;

  return (
    <>
      <Toaster 
        position="bottom-right" 
        toastOptions={{ 
          style: { 
            background: "rgba(255, 255, 255, 0.9)", 
            backdropFilter: "blur(8px)",
            color: "#0F172A", 
            fontSize: "13px", 
            fontWeight: "600",
            borderRadius: "12px",
            border: "1px solid rgba(226, 232, 240, 1)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)"
          } 
        }} 
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="tester" element={<Tester />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="providers" element={<Providers />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="api-docs" element={<ApiDocs />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
