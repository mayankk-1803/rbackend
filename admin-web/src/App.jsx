import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { Alerts } from './pages/Alerts';
import { Operators } from './pages/Operators';
import { ApiDocs } from './pages/ApiDocs';
import { Login } from './pages/Login';
import AdminTransactionHistory from './pages/reports/TransactionHistory';
import CommissionReport from './pages/reports/CommissionReport';
import DisputeManagement from './pages/reports/DisputeManagement';
import { CashbackSettings } from './pages/CashbackSettings';
import { Users } from './pages/users/Users';
import ErrorBoundary from './components/ErrorBoundary';

// iMart E-commerce Management Views
import { Categories } from './pages/imart/Categories';
import { Products } from './pages/imart/Products';
import { Orders } from './pages/imart/Orders';

const getDecodedToken = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded;
  } catch (e) {
    return null;
  }
};

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("dizipay_admin_token");
  
  let isAuthenticated = false;
  
  if (token) {
    const decoded = getDecodedToken(token);
    if (decoded) {
      const isExpired = decoded.exp && (decoded.exp * 1000 < Date.now());
      const hasAdminRole = decoded.role === 'ADMIN' || decoded.role === 'ROOT_ADMIN' || decoded.role === 'SYSTEM_MANAGER';
      const isTokenTypeAdmin = decoded.tokenType === 'ADMIN_PANEL';
      
      if (!isExpired && hasAdminRole && isTokenTypeAdmin) {
        isAuthenticated = true;
      }
    }
  }

  if (import.meta.env.DEV) {
    console.log(" [Auth Guard] Status Check:", isAuthenticated ? "AUTHENTICATED" : "REJECTED");
  }

  if (!isAuthenticated) {
    localStorage.removeItem("dizipay_admin_token");
    localStorage.removeItem("dizipay_admin_data");
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
          <Route path="settings/cashback" element={<CashbackSettings />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="users" element={<Users />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="providers" element={<Operators />} />
          <Route path="reports/transactions" element={<AdminTransactionHistory />} />
          <Route path="reports/commissions" element={<CommissionReport />} />
          <Route path="reports/disputes" element={<DisputeManagement />} />
          <Route path="api-docs" element={<ApiDocs />} />
          
          {/* iMart Management Protocol Routes */}
          <Route path="imart/products" element={<Products />} />
          <Route path="imart/categories" element={<Categories />} />
          <Route path="imart/orders" element={<Orders />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
