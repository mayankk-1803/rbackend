import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Tester } from './pages/Tester';
import { Transactions } from './pages/Transactions';
import { Alerts } from './pages/Alerts';
import { Operators } from './pages/Operators';
import { ApiDocs } from './pages/ApiDocs';
import { Login } from './pages/Login';
import { Wallet } from './pages/Wallet';
import AdminTransactionHistory from './pages/reports/TransactionHistory';
import CommissionReport from './pages/reports/CommissionReport';
import DisputeManagement from './pages/reports/DisputeManagement';
import { CashbackSettings } from './pages/CashbackSettings';
import ErrorBoundary from './components/ErrorBoundary';



const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("dizipay_admin_token");
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
    const token = localStorage.getItem("dizipay_admin_token");
    if (import.meta.env.DEV) {
      console.log(" [App Mount] Initial Token Check:", token ? "Authenticated" : "Not Authenticated");
    }
    setLoading(false);
  }, []);

  if (loading) return null;

  return (
    <ErrorBoundary>
      <Toaster 
        position="bottom-right" 
        style={{ zIndex: 9999 }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="recharge" element={<Tester />} />
          <Route path="settings/cashback" element={<CashbackSettings />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="providers" element={<Operators />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="reports/transactions" element={<AdminTransactionHistory />} />
          <Route path="reports/commissions" element={<CommissionReport />} />
          <Route path="reports/disputes" element={<DisputeManagement />} />
          <Route path="api-docs" element={<ApiDocs />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
