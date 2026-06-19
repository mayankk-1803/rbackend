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
import CommissionDashboard from './pages/reports/CommissionDashboard';
import OperatorDashboard from './pages/reports/OperatorDashboard';
import FinancialDashboard from './pages/reports/FinancialDashboard';
import ProviderHealthDashboard from './pages/reports/ProviderHealthDashboard';
import { CashbackSettings } from './pages/CashbackSettings';
import { ControlCenter } from './pages/ControlCenter';
import { Users } from './pages/users/Users';
import { Wallet } from './pages/Wallet';
import ErrorBoundary from './components/ErrorBoundary';
import InactivityManager from './components/InactivityManager';
import MasterWalletDashboard from './pages/master-wallet/Dashboard';
import MasterWalletLedger from './pages/master-wallet/WalletLedger';
import PendingSettlements from './pages/master-wallet/PendingSettlements';
import UserWalletFunding from './pages/master-wallet/UserWalletFunding';
import AdminWalletFunding from './pages/master-wallet/AdminWalletFunding';

// Commission Suite Imports
import { SlabMaster } from './pages/commission/SlabMaster';
import { PackageMaster } from './pages/commission/PackageMaster';
import { RechargeCommissionSlab } from './pages/commission/RechargeCommissionSlab';
import { RangeCommissionSlab } from './pages/commission/RangeCommissionSlab';
import { ChannelSlabBulkSetting } from './pages/commission/ChannelSlabBulkSetting';
import { CommissionAuditLogs } from './pages/commission/CommissionAuditLogs';
import { CommissionSimulator } from './pages/commission/CommissionSimulator';
import { ShadowValidation } from './pages/commission/ShadowValidation';
import { CommissionIntelligence } from './pages/commission/CommissionIntelligence';

// iMart E-commerce Management Views
import { Categories } from './pages/imart/Categories';
import { Products } from './pages/imart/Products';
import { Orders } from './pages/imart/Orders';

// Operations Views
import { SectionMaster } from './pages/operations/SectionMaster';
import { RoutingMaster } from './pages/operations/RoutingMaster';
import { ProviderRoutingRules } from './pages/operations/ProviderRoutingRules';
import { OperatorMapping } from './pages/operations/OperatorMapping';
import { RouteSimulator } from './pages/operations/RouteSimulator';
import { RoutingAnalytics } from './pages/operations/RoutingAnalytics';
import { RoutingAuditLogs } from './pages/operations/RoutingAuditLogs';
import { EmergencyRoutingControl } from './pages/operations/EmergencyRoutingControl';
import { RoutingIntelligence } from './pages/operations/RoutingIntelligence';
import { AutonomousRoutingMonitor } from './pages/operations/AutonomousRoutingMonitor';

// Platform Views
import { FeatureFlags } from './pages/FeatureFlags';

// API Marketplace Views
import { ApiMarketplaceDashboard } from './pages/imart/ApiMarketplaceDashboard';
import { ApiProducts } from './pages/imart/ApiProducts';
import { ApiPlans } from './pages/imart/ApiPlans';
import { ApiBilling } from './pages/imart/ApiBilling';
import { ApiCustomers } from './pages/imart/ApiCustomers';
import { ApiWebhooks } from './pages/imart/ApiWebhooks';
import { ThreatAnalytics } from './pages/imart/ThreatAnalytics';

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
  const token = sessionStorage.getItem("dizipay_admin_token");
  
  let isAuthenticated = false;
  
  if (token) {
    const decoded = getDecodedToken(token);
    if (decoded) {
      const isExpired = decoded.exp && (decoded.exp * 1000 < Date.now());
      const hasAdminRole = decoded.role === 'ADMIN' || decoded.role === 'SUPER_ADMIN' || decoded.role === 'ROOT_ADMIN' || decoded.role === 'SYSTEM_MANAGER';
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
    sessionStorage.removeItem("dizipay_admin_token");
    sessionStorage.removeItem("dizipay_admin_data");
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Migrate from localStorage to sessionStorage if exists
    if (!sessionStorage.getItem("dizipay_admin_token")) {
      const oldToken = localStorage.getItem("dizipay_admin_token");
      const oldAdminData = localStorage.getItem("dizipay_admin_data");
      if (oldToken) {
        sessionStorage.setItem("dizipay_admin_token", oldToken);
      }
      if (oldAdminData) {
        sessionStorage.setItem("dizipay_admin_data", oldAdminData);
      }
      localStorage.removeItem("dizipay_admin_token");
      localStorage.removeItem("dizipay_admin_data");
    }

    // Initial mount check
    const token = sessionStorage.getItem("dizipay_admin_token");
    if (import.meta.env.DEV) {
      console.log(" [App Mount] Initial Token Check:", token ? "Authenticated" : "Not Authenticated");
    }
    setLoading(false);
  }, []);

  if (loading) return null;

  return (
    <ErrorBoundary>
      <InactivityManager />
      <Toaster 
        position="bottom-right" 
        style={{ zIndex: 9999 }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="settings/cashback" element={<CashbackSettings />} />
          <Route path="transactions" element={<Navigate to="/reports/transactions" replace />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="users" element={<Users />} />
          <Route path="master-wallet/dashboard" element={<MasterWalletDashboard />} />
          <Route path="master-wallet/ledger" element={<MasterWalletLedger />} />
          <Route path="master-wallet/pending" element={<PendingSettlements />} />
          <Route path="master-wallet/user-funding" element={<UserWalletFunding />} />
          <Route path="master-wallet/admin-funding" element={<AdminWalletFunding />} />
          <Route path="control-center" element={<ControlCenter />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="providers" element={<Operators />} />
          <Route path="reports/transactions" element={<AdminTransactionHistory />} />
          <Route path="reports/commissions" element={<CommissionDashboard />} />
          <Route path="reports/operator-dashboard" element={<OperatorDashboard />} />
          <Route path="reports/financial-dashboard" element={<FinancialDashboard />} />
          <Route path="reports/provider-health" element={<ProviderHealthDashboard />} />
          <Route path="reports/disputes" element={<DisputeManagement />} />
          <Route path="api-docs" element={<ApiDocs />} />
          
          {/* Commission Suite Routes */}
          <Route path="commission/slabs" element={<SlabMaster />} />
          <Route path="commission/packages" element={<PackageMaster />} />
          <Route path="commission/recharge-slabs" element={<RechargeCommissionSlab />} />
          <Route path="commission/range-slabs" element={<RangeCommissionSlab />} />
          <Route path="commission/bulk" element={<ChannelSlabBulkSetting />} />
          <Route path="commission/audit-logs" element={<CommissionAuditLogs />} />
          <Route path="commission/simulator" element={<CommissionSimulator />} />
          <Route path="commission/shadow-validation" element={<ShadowValidation />} />
          <Route path="commission/intelligence" element={<CommissionIntelligence />} />
          
          {/* iMart Management Protocol Routes */}
          <Route path="imart/products" element={<Products />} />
          <Route path="imart/categories" element={<Categories />} />
          <Route path="imart/orders" element={<Orders />} />

          {/* API Marketplace Suite Routes */}
          <Route path="api-marketplace/dashboard" element={<ApiMarketplaceDashboard />} />
          <Route path="api-marketplace/products" element={<ApiProducts />} />
          <Route path="api-marketplace/plans" element={<ApiPlans />} />
          <Route path="api-marketplace/billing" element={<ApiBilling />} />
          <Route path="api-marketplace/customers" element={<ApiCustomers />} />
          <Route path="api-marketplace/webhooks" element={<ApiWebhooks />} />
          <Route path="api-marketplace/threats" element={<ThreatAnalytics />} />

          {/* Operations Suite Routes */}
          <Route path="operations/sections" element={<SectionMaster />} />
          <Route path="operations/routing" element={<RoutingMaster />} />
          <Route path="operations/provider-rules" element={<ProviderRoutingRules />} />
          <Route path="operations/operators" element={<OperatorMapping />} />
          <Route path="operations/simulator" element={<RouteSimulator />} />
          <Route path="operations/analytics" element={<RoutingAnalytics />} />
          <Route path="operations/audit-logs" element={<RoutingAuditLogs />} />
          <Route path="operations/emergency" element={<EmergencyRoutingControl />} />
          <Route path="operations/routing-intelligence" element={<RoutingIntelligence />} />
          <Route path="operations/autonomous-routing" element={<AutonomousRoutingMonitor />} />

          {/* Platform Suite Routes */}
          <Route path="platform/feature-flags" element={<FeatureFlags />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
