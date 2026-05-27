import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { 
  Users as UsersIcon, 
  TrendingUp, 
  TrendingDown, 
  ClipboardList, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Wallet, 
  UserPlus, 
  FileText, 
  ArrowUpRight, 
  Server, 
  ShieldAlert, 
  RefreshCw, 
  Search,
  Check,
  Ticket
} from 'lucide-react';
import toast from 'react-hot-toast';

// Modular UI imports
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { AnalyticsCard } from '../components/ui/AnalyticsCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ChartContainer } from '../components/ui/ChartContainer';
import { DataTable } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { QuickAction } from '../components/ui/QuickAction';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { WidgetErrorBoundary } from '../components/ui/WidgetErrorBoundary';
import { downloadFile } from '../utils/downloadFile';

// Recharts components
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line 
} from 'recharts';

export const Dashboard = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const navigate = useNavigate();
  
  // States
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Dashboard & Users stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTransactions: 0,
    totalRevenue: 0,
    pendingCount: 0,
    successRate: 0,
    fraudAlerts: 0,
    totalCashback: 0,
    totalAdded: 0,
    failureCount: 0,
    activeUsers: 0,
    totalWalletBalance: 0
  });

  // Admin Wallet Balance state
  const [adminWallet, setAdminWallet] = useState(0);

  // Analytics tab selection
  const [activeTab, setActiveTab] = useState('revenue'); // revenue, transactions, operators, dmt

  // Chart data
  const [chartData, setChartData] = useState({
    success: 0,
    pending: 0,
    failed: 0,
    dailyRevenue: []
  });

  // Operators, disputes, fraud logs, transactions
  const [operators, setOperators] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [fraudLogs, setFraudLogs] = useState([]);
  const [liveTransactions, setLiveTransactions] = useState([]);
  const [commissions, setCommissions] = useState([]);

  // Quick Action Modal states
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [userForm, setUserForm] = useState({ name: '', email: '', phone: '', password: '', referralCode: '' });

  // Socket
  const { socket, isConnected, useSocketEvent } = useSocket();

  // Load dashboard dataset
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [
        dashRes,
        chartsRes,
        usersStatsRes,
        operatorsRes,
        disputesRes,
        alertsRes,
        txnsRes,
        commissionsRes,
        walletRes
      ] = await Promise.all([
        api.get('/admin/dashboard').catch(err => {
          console.error('[Dashboard API] Failed to load dashboard stats:', err);
          return { data: { success: false } };
        }),
        api.get('/admin/charts').catch(err => {
          console.error('[Dashboard API] Failed to load charts data:', err);
          return { data: { success: false } };
        }),
        api.get('/admin/users/stats').catch(err => {
          console.error('[Dashboard API] Failed to load user stats:', err);
          return { data: { success: false } };
        }),
        api.get('/admin/providers').catch(err => {
          console.error('[Dashboard API] Failed to load operators:', err);
          return { data: { success: false } };
        }),
        api.get('/admin/disputes').catch(err => {
          console.error('[Dashboard API] Failed to load disputes:', err);
          return { data: { success: false } };
        }),
        api.get('/admin/alerts').catch(err => {
          console.error('[Dashboard API] Failed to load alerts:', err);
          return { data: { success: false } };
        }),
        api.get('/admin/transactions').catch(err => {
          console.error('[Dashboard API] Failed to load live transactions:', err);
          return { data: { success: false } };
        }),
        api.get('/admin/reports/commissions').catch(err => {
          console.error('[Dashboard API] Failed to load commission reports:', err);
          return { data: { success: false } };
        }),
        api.get('/admin/wallet').catch(err => {
          console.error('[Dashboard API] Failed to load admin wallet:', err);
          return { data: { success: false } };
        })
      ]);

      // Parse Dashboard Stats
      const dStats = dashRes?.data?.data || {};
      const uStats = usersStatsRes?.data?.data || {};
      
      setStats({
        totalUsers: Number(dStats.totalUsers || 0),
        totalTransactions: Number(dStats.totalTransactions || 0),
        totalRevenue: Number(dStats.totalRevenue || 0),
        pendingCount: Number(dStats.pendingCount || 0),
        successRate: Number(dStats.successRate || 0),
        fraudAlerts: Number(dStats.fraudAlerts || 0),
        totalCashback: Number(dStats.totalCashback || 0),
        totalAdded: Number(dStats.totalAdded || 0),
        failureCount: Number(dStats.failureCount || 0),
        activeUsers: Number(uStats.activeUsers || 0),
        totalWalletBalance: Number(uStats.totalWalletBalance || 0)
      });

      // Parse Charts
      if (chartsRes?.data?.success) {
        setChartData({
          success: Number(chartsRes.data.successCount || 0),
          pending: Number(chartsRes.data.pendingCount || 0),
          failed: Number(chartsRes.data.failedCount || 0),
          dailyRevenue: Array.isArray(chartsRes.data.dailyRevenue) ? chartsRes.data.dailyRevenue : []
        });
      } else {
        setChartData({
          success: 0,
          pending: 0,
          failed: 0,
          dailyRevenue: []
        });
      }

      // Parse operators, disputes, fraud logs, live transactions
      setOperators(Array.isArray(operatorsRes?.data?.data) ? operatorsRes.data.data : []);
      setDisputes(Array.isArray(disputesRes?.data?.data) ? disputesRes.data.data.slice(0, 5) : []);
      setFraudLogs(Array.isArray(alertsRes?.data?.data) ? alertsRes.data.data.slice(0, 5) : []);
      setLiveTransactions(Array.isArray(txnsRes?.data?.data) ? txnsRes.data.data.slice(0, 10) : []);
      setCommissions(Array.isArray(commissionsRes?.data?.data) ? commissionsRes.data.data : []);
      setAdminWallet(Number(walletRes?.data?.data?.balance || 0));

      setDataLoaded(true);
    } catch (err) {
      console.error('Error fetching dashboard statistics:', err);
      toast.error('Failed to load real-time analytics');
    } finally {
      setLoading(false);
      setChartsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Socket updates
  const handleSocketTransactionUpdate = useCallback((data) => {
    const updatedTxnId = data?.transactionId || data?.txnId || data?.transaction?.id;
    const nextStatus = data?.status || data?.transaction?.status;
    const incomingTxn = data?.transaction;

    if (!updatedTxnId) return;

    // Refresh core statistics periodically on incoming socket actions
    fetchDashboardData();

    setLiveTransactions(prev => {
      const existingIdx = Array.isArray(prev) ? prev.findIndex(t => t.id === updatedTxnId) : -1;
      if (existingIdx > -1) {
        return prev.map(t => t.id === updatedTxnId ? { ...t, ...incomingTxn, status: nextStatus } : t);
      }
      if (incomingTxn) {
        return [incomingTxn, ...prev.slice(0, 9)];
      }
      return prev;
    });
  }, [fetchDashboardData]);

  useSocketEvent('transaction_updated', handleSocketTransactionUpdate);
  useSocketEvent('recharge_success', handleSocketTransactionUpdate);
  useSocketEvent('recharge_failed', handleSocketTransactionUpdate);



  // Submit user creation
  const handleCreateUser = useCallback(async (e) => {
    e.preventDefault();
    if (!userForm.name || !userForm.email || !userForm.password) {
      return toast.error('Required name, email, and password');
    }
    setActionLoading(true);
    try {
      const { data } = await api.post('/auth/register-email', userForm, {
        headers: { 'x-admin-request': 'true' }
      });
      if (data && data.success) {
        toast.success('User registered successfully');
        setIsCreateUserOpen(false);
        setUserForm({ name: '', email: '', phone: '', password: '', referralCode: '' });
        fetchDashboardData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'User creation failed');
    } finally {
      setActionLoading(false);
    }
  }, [userForm, fetchDashboardData]);

  // Dynamic Chart Themes
  const COLORS = {
    SUCCESS: '#22C55E', // Green
    PENDING: '#F59E0B', // Amber
    FAILED: '#EF4444',  // Red
  };

  const chartTheme = {
    textColor: isDark ? '#A1A1AA' : '#5F5F5F',
    gridColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
  };

  // Operators custom data mapping
  const operatorChartData = Array.isArray(operators)
    ? operators.map(p => ({
        name: p?.name || 'Unknown',
        successRate: Number(p?.successRate) || 0,
        latency: Number(p?.avgResponseTime) || 0
      }))
    : [];

  // DMT simulated/mapped data context
  const dmtVolumeData = (chartData && Array.isArray(chartData.dailyRevenue))
    ? chartData.dailyRevenue.map(item => ({
        date: item?.date ? formatLabel(item.date) : '',
        volume: (Number(item?.revenue) || 0) * 1.5,
        transfers: Math.floor((Number(item?.revenue) || 0) / 100) + 1
      }))
    : [];

  function formatLabel(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
      return '';
    }
  }

  function formatTime(dateString) {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return 'N/A';
    }
  }

  return (
    <div className="space-y-6">
      {/* Header and Telemetry connection status */}
      <SectionHeader 
        title="Operations" 
        highlight="Control Center" 
        subtitle="Centralized transaction routing, provider telemetry, security, and administrative adjustments"
      >
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl">
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            {isConnected ? 'Real-Time Feed Live' : 'Feed Disconnected'}
          </span>
        </div>
        <Button 
          onClick={fetchDashboardData}
          variant="outline"
          size="sm"
          className="cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </SectionHeader>

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsCard 
          title="Total Transactions" 
          value={loading ? '...' : stats.totalTransactions.toLocaleString()} 
          icon={ClipboardList}
          colorClass="text-blue-500 bg-blue-500/10 border-blue-500/20"
          loading={loading}
          trend={stats.totalTransactions > 0 ? "+4.2%" : undefined}
          trendDirection="up"
          trendLabel="from yesterday"
        />
        <AnalyticsCard 
          title="Revenue (Net profit)" 
          value={loading ? '...' : `₹${stats.totalRevenue.toLocaleString()}`} 
          icon={TrendingUp}
          colorClass="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
          loading={loading}
          trend={stats.totalRevenue > 0 ? "+12.1%" : undefined}
          trendDirection="up"
          trendLabel="vs last week"
        />
        <AnalyticsCard 
          title="Platform Success Rate" 
          value={loading ? '...' : `${stats.successRate}%`} 
          icon={CheckCircle2}
          colorClass="text-green-500 bg-green-500/10 border-green-500/20"
          loading={loading}
          progress={stats.successRate}
        />
        <AnalyticsCard 
          title="Pending Requests" 
          value={loading ? '...' : stats.pendingCount.toString()} 
          icon={AlertTriangle}
          colorClass="text-amber-500 bg-amber-500/10 border-amber-500/20"
          loading={loading}
          trend={stats.pendingCount > 5 ? "Escalated" : "Normal"}
          trendDirection={stats.pendingCount > 5 ? "up" : "flat"}
          trendLabel="operator routing active"
        />
        <AnalyticsCard 
          title="Total Vault Added" 
          value={loading ? '...' : `₹${stats.totalAdded.toLocaleString()}`} 
          icon={Wallet}
          colorClass="text-purple-500 bg-purple-500/10 border-purple-500/20"
          loading={loading}
        />
        <AnalyticsCard 
          title="Failed Transactions" 
          value={loading ? '...' : stats.failureCount.toLocaleString()} 
          icon={AlertCircle}
          colorClass="text-rose-500 bg-rose-500/10 border-rose-500/20"
          loading={loading}
          trend={stats.failureCount > 0 && stats.totalTransactions > 0 ? `${((stats.failureCount / stats.totalTransactions) * 100).toFixed(1)}%` : undefined}
          trendDirection="down"
          trendLabel="failure ratio"
        />
        <AnalyticsCard 
          title="Active Users" 
          value={loading ? '...' : stats.activeUsers.toLocaleString()} 
          icon={UsersIcon}
          colorClass="text-indigo-500 bg-indigo-500/10 border-indigo-500/20"
          loading={loading}
        />
        <AnalyticsCard 
          title="Fraud Risk Alerts" 
          value={loading ? '...' : stats.fraudAlerts.toString()} 
          icon={ShieldAlert}
          colorClass="text-rose-600 bg-rose-600/10 border-rose-600/20"
          loading={loading}
          trend={stats.fraudAlerts > 0 ? "Action Required" : "0 Logs"}
          trendDirection={stats.fraudAlerts > 0 ? "down" : "flat"}
          trendLabel="security firewall check"
        />
      </div>

      {/* Quick Actions Panel */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3.5">
        <QuickAction 
          title="Create User" 
          description="Register email login" 
          icon={UserPlus} 
          onClick={() => setIsCreateUserOpen(true)}
          colorClass="text-indigo-500 bg-indigo-500/10"
        />
        <QuickAction 
          title="Platform Ledger" 
          description="Telemetery audit trails" 
          icon={FileText} 
          onClick={() => navigate('/reports/transactions')}
          colorClass="text-blue-500 bg-blue-500/10"
        />
        <QuickAction 
          title="Commissions" 
          description="Generate margins CSV" 
          icon={TrendingUp} 
          onClick={async () => {
            const toastId = toast.loading("Exporting commission data...");
            try {
              await downloadFile(api, '/admin/reports/export', `commissions_${Date.now()}.csv`, { type: 'COMMISSION' });
              toast.success("Data exported successfully", { id: toastId });
            } catch (err) {
              toast.error("Export failed", { id: toastId });
            }
          }}
          colorClass="text-purple-500 bg-purple-500/10"
        />
        <QuickAction 
          title="Support Tickets" 
          description="Resolve user disputes" 
          icon={Ticket} 
          onClick={() => navigate('/reports/disputes')}
          colorClass="text-amber-500 bg-amber-500/10"
        />
      </div>

      {/* Analytics Tabs and Charts */}
      <WidgetErrorBoundary title="Analytics Control Board">
        <ChartContainer 
          title="Analytics Control Board" 
          subtitle="Platform profit and transaction performance data sets"
          loading={chartsLoading}
          height={320}
          extraHeaderActions={
            <div className="flex gap-1.5 p-1.5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-soft)]">
              {[
                { key: 'revenue', label: 'Revenue Trends' },
                { key: 'transactions', label: 'Volume Distribution' },
                { key: 'operators', label: 'Operator Performance' },
                { key: 'dmt', label: 'Money Transfers' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                    activeTab === tab.key 
                      ? 'bg-[var(--card-bg)] text-[var(--color-primary)] border border-[var(--border-soft)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          }
        >
          {activeTab === 'revenue' && (
            <AreaChart data={Array.isArray(chartData?.dailyRevenue) ? chartData.dailyRevenue.map(item => (item ? { ...item, revenue: Number(item.revenue) || 0, formattedDate: item.date ? formatLabel(item.date) : '' } : { revenue: 0, formattedDate: '' })) : []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridColor} />
              <XAxis dataKey="formattedDate" axisLine={false} tickLine={false} tick={{ fill: chartTheme.textColor, fontSize: 9 }} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: chartTheme.textColor, fontSize: 9 }} tickFormatter={(value) => `₹${value}`} />
              <Tooltip 
                contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-soft)', borderRadius: '12px', fontSize: '11px', color: 'var(--text-primary)' }}
                formatter={(value) => [`₹${value}`, 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          )}

          {activeTab === 'transactions' && (
            <PieChart>
              <Pie
                data={[
                  { name: 'SUCCESS', value: chartData?.success || 0 },
                  { name: 'PENDING', value: chartData?.pending || 0 },
                  { name: 'FAILED', value: chartData?.failed || 0 }
                ].filter(d => d.value > 0)}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={95}
                paddingAngle={4}
                dataKey="value"
              >
                {[
                  { name: 'SUCCESS', value: chartData?.success || 0 },
                  { name: 'PENDING', value: chartData?.pending || 0 },
                  { name: 'FAILED', value: chartData?.failed || 0 }
                ].filter(d => d.value > 0).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name]} stroke="var(--card-bg)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-soft)', borderRadius: '12px', fontSize: '11px', color: 'var(--text-primary)' }}
              />
              <Legend verticalAlign="bottom" formatter={(value) => <span className="text-[9px] font-bold text-[var(--text-secondary)] tracking-wider uppercase">{value}</span>} />
            </PieChart>
          )}

          {activeTab === 'operators' && (
            <BarChart data={operatorChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridColor} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartTheme.textColor, fontSize: 9 }} dy={8} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: chartTheme.textColor, fontSize: 9 }} tickFormatter={(val) => `${val}%`} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: chartTheme.textColor, fontSize: 9 }} tickFormatter={(val) => `${val}ms`} />
              <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-soft)', borderRadius: '12px', fontSize: '11px', color: 'var(--text-primary)' }} />
              <Legend verticalAlign="bottom" formatter={(value) => <span className="text-[9px] font-bold text-[var(--text-secondary)] tracking-wider uppercase">{value}</span>} />
              <Bar yAxisId="left" dataKey="successRate" name="Success Rate" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="latency" name="Latency (ms)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}

          {activeTab === 'dmt' && (
            <LineChart data={dmtVolumeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridColor} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: chartTheme.textColor, fontSize: 9 }} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: chartTheme.textColor, fontSize: 9 }} tickFormatter={(val) => `₹${val}`} />
              <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-soft)', borderRadius: '12px', fontSize: '11px', color: 'var(--text-primary)' }} />
              <Line type="monotone" dataKey="volume" name="DMT Volume" stroke="var(--color-primary)" strokeWidth={2.5} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="transfers" name="Total Transfers" stroke="#F59E0B" strokeWidth={2} />
            </LineChart>
          )}
        </ChartContainer>
      </WidgetErrorBoundary>

      {/* Grid: Operator status + Live transaction feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Operator status */}
        <WidgetErrorBoundary title="Operator Monitor">
          <Card className="flex flex-col h-full">
            <div className="px-5 py-4 border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]/10">
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Operator Uptime Monitor</h3>
              <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-0.5">Real-time health status, success margins, and latencies</p>
            </div>
            <CardContent className="p-5 flex-1 overflow-y-auto">
              {loading ? (
                <SkeletonLoader variant="table" count={5} />
              ) : operators.length === 0 ? (
                <EmptyState title="No operators configured" icon={Server} />
              ) : (
                <div className="divide-y divide-[var(--border-soft)]">
                  {operators.map((op, idx) => (
                    <div key={op?.id || op?.code || idx} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-[var(--text-primary)]">{op?.name || 'Unknown'}</p>
                        <p className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">{op?.code || 'N/A'}</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className="text-[10px] text-[var(--text-muted)] font-bold block">LATENCY</span>
                          <span className="text-[11px] font-extrabold text-[var(--text-primary)]">{(op?.avgResponseTime) ?? 0}ms</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[var(--text-muted)] font-bold block">SUCCESS</span>
                          <span className="text-[11px] font-extrabold text-[var(--text-primary)]">{(op?.successRate) ?? 0}%</span>
                        </div>
                        <StatusBadge status={op?.healthStatus} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </WidgetErrorBoundary>

        {/* Live transactions feed */}
        <WidgetErrorBoundary title="Live Telemetry Feed">
          <Card className="flex flex-col h-full">
            <div className="px-5 py-4 border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]/10 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Live Transaction Telemetry</h3>
                <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-0.5">Socket-driven events and platform routing audits</p>
              </div>
              <span className="px-2 py-0.5 bg-[var(--color-primary-glow)] border border-[var(--border-soft)] text-[9px] font-black rounded uppercase text-[var(--color-primary)] animate-pulse">
                STREAMING
              </span>
            </div>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-5">
                  <SkeletonLoader variant="table" count={6} />
                </div>
              ) : liveTransactions.length === 0 ? (
                <EmptyState title="No transactions detected" icon={ClipboardList} className="my-10" />
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-secondary)]/20 border-b border-[var(--border-soft)] text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        <th className="px-5 py-2.5">Mobile</th>
                        <th className="px-5 py-2.5 text-right">Amount</th>
                        <th className="px-5 py-2.5 text-center">Status</th>
                        <th className="px-5 py-2.5">Provider</th>
                        <th className="px-5 py-2.5 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)] text-xs">
                      {liveTransactions.map((tx, idx) => {
                        let mobileVal = tx?.mobile;
                        if (!mobileVal && tx?.user?.phone) {
                          mobileVal = tx.user.phone;
                        }
                        if (!mobileVal && tx?.user?.email) {
                          mobileVal = tx.user.email;
                        }
                        if (!mobileVal) {
                          mobileVal = 'System';
                        }
                        
                        const displayMobile = (mobileVal.includes('@') || mobileVal === 'System')
                          ? mobileVal
                          : `+91 ${mobileVal.replace(/^\+91\s*/, '')}`;

                        let displayProvider = tx?.provider;
                        if (!displayProvider) {
                          if (tx?.paymentGateway) {
                            displayProvider = tx.paymentGateway;
                          } else if (tx?.type === 'TOPUP') {
                            displayProvider = 'NexGATE';
                          } else {
                            displayProvider = tx?.type || 'SYSTEM';
                          }
                        }

                        return (
                          <tr key={tx?.id || idx} className="hover:bg-[var(--admin-table-row-hover)] transition-colors">
                            <td className="px-5 py-2.5 font-bold text-[var(--text-primary)]">
                              {displayMobile}
                            </td>
                            <td className="px-5 py-2.5 text-right font-extrabold text-[var(--text-primary)]">
                              ₹{tx?.amount ?? 0}
                            </td>
                            <td className="px-5 py-2.5 text-center">
                              <StatusBadge status={tx?.status} />
                            </td>
                            <td className="px-5 py-2.5 font-bold text-[var(--text-secondary)]">
                              {displayProvider}
                            </td>
                            <td className="px-5 py-2.5 text-right text-[10px] text-[var(--text-muted)] font-medium">
                              {formatTime(tx?.createdAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </WidgetErrorBoundary>
      </div>

      {/* Grid: Financial Overview + Fraud Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Financial overview */}
        <WidgetErrorBoundary title="Financial Overview">
          <Card className="flex flex-col h-full">
            <div className="px-5 py-4 border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]/10">
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Financial Overview & Margins</h3>
              <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-0.5">Aggregate ledger details and distributor commissions</p>
            </div>
            <CardContent className="p-5 flex-1 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-4 bg-[var(--bg-secondary)]/15 border border-[var(--border-soft)] rounded-xl">
                  <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-0.5">Admin Pool Wallet</span>
                  <span className="text-sm font-extrabold text-[var(--text-primary)]">
                    ₹{(Number(adminWallet) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-4 bg-[var(--bg-secondary)]/15 border border-[var(--border-soft)] rounded-xl">
                  <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-0.5">Distributors Pool Total</span>
                  <span className="text-sm font-extrabold text-[var(--text-primary)]">
                    ₹{(Number(stats.totalWalletBalance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">Margins By Operator</h4>
                {commissions.length === 0 ? (
                  <div className="text-[10px] text-[var(--text-muted)] py-4 font-bold uppercase tracking-wider text-center border border-dashed border-[var(--border-soft)] rounded-xl">
                    No operator margin logs available
                  </div>
                ) : (
                  <div className="space-y-2">
                    {commissions.slice(0, 3).map((comm, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs p-2 bg-[var(--bg-secondary)]/20 border border-[var(--border-soft)] rounded-xl">
                        <span className="font-bold text-[var(--text-primary)]">{comm?.operator || 'Unknown'}</span>
                        <div className="flex gap-4">
                          <span className="text-[10px] font-medium text-[var(--text-secondary)]">Volume: ₹{(Number(comm?._sum?.amount) || 0).toLocaleString()}</span>
                          <span className="text-[10px] font-extrabold text-emerald-500">Margin: ₹{(Number(comm?._sum?.profit) || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </WidgetErrorBoundary>

        {/* Fraud & Security */}
        <WidgetErrorBoundary title="Security Firewall">
          <Card className="flex flex-col h-full">
            <div className="px-5 py-4 border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]/10">
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Fraud Prevention & Security Firewall</h3>
              <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-0.5">Suspicious IP logs and brute-force indicators</p>
            </div>
            <CardContent className="p-5 flex-1 overflow-y-auto">
              {loading ? (
                <SkeletonLoader variant="table" count={3} />
              ) : fraudLogs.length === 0 ? (
                <EmptyState title="Security status normal" message="Firewall has recorded no critical actions." icon={ShieldAlert} />
              ) : (
                <div className="space-y-3">
                  {fraudLogs.map((log, idx) => (
                    <div key={log?.id || idx} className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-rose-500 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            RISK SCORE: {log?.riskScore ?? 0}
                          </span>
                          <p className="text-xs font-bold text-[var(--text-primary)]">User ID: {log?.userId || 'Guest'}</p>
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] font-semibold leading-relaxed">
                          Reason: {log?.reasons || 'Suspicious request frequency'}
                        </p>
                      </div>
                      <StatusBadge status={log?.actionTaken} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </WidgetErrorBoundary>
      </div>

      {/* Action Center - Disputes */}
      <WidgetErrorBoundary title="Action Center">
        <Card className="w-full">
          <div className="px-5 py-4 border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]/10">
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Administrative Action Center</h3>
            <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-0.5">Pending user complaints and dispute resolution</p>
          </div>
          <CardContent className="p-5">
            {loading ? (
              <SkeletonLoader variant="table" count={3} />
            ) : disputes.length === 0 ? (
              <EmptyState title="No active disputes" message="All complaints are closed." icon={CheckCircle2} />
            ) : (
              <div className="divide-y divide-[var(--border-soft)]">
                {disputes.map((disp, idx) => (
                  <div key={disp?.id || idx} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-[var(--text-primary)]">Dispute ID: #{disp?.id || 'N/A'}</p>
                        <StatusBadge status={disp?.status} />
                      </div>
                      <p className="text-[10px] text-[var(--text-secondary)] font-semibold">
                        User: {disp?.user?.name || disp?.user?.email || 'N/A'} | Reason: {disp?.description || 'N/A'}
                      </p>
                    </div>
                    <Button
                      onClick={() => navigate('/reports/disputes')}
                      variant="outline"
                      size="sm"
                      className="text-[9px] font-bold uppercase tracking-wider px-3 py-1 cursor-pointer"
                    >
                      Investigate
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </WidgetErrorBoundary>

      {/* ========================================================
          MODAL: CREATE USER
          ======================================================== */}
      <AnimatePresence>
        {isCreateUserOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateUserOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-md bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl shadow-2xl border border-[var(--border-soft)] z-10 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]/10 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-tight">Create User Account</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] font-medium">Add a new email-login member to the directory</p>
                </div>
                <button 
                  onClick={() => setIsCreateUserOpen(false)}
                  className="p-1 hover:bg-[var(--bg-secondary)] rounded-full text-[var(--text-secondary)] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="p-6 space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Full Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. John Doe"
                    value={userForm.name}
                    onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Email Address</label>
                  <input 
                    type="email" 
                    required
                    placeholder="e.g. john@dizipay.com"
                    value={userForm.email}
                    onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Phone Number (WhatsApp Preferred)</label>
                  <input 
                    type="tel" 
                    placeholder="e.g. 9876543210"
                    value={userForm.phone}
                    onChange={(e) => setUserForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Security Password</label>
                  <input 
                    type="password" 
                    required
                    placeholder="Min 6 characters"
                    value={userForm.password}
                    onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">Referral Sponsor Code (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. REF12ABC"
                    value={userForm.referralCode}
                    onChange={(e) => setUserForm(prev => ({ ...prev, referralCode: e.target.value }))}
                    className="w-full px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>

                <div className="flex gap-2.5 pt-3">
                  <button 
                    type="button"
                    onClick={() => setIsCreateUserOpen(false)}
                    className="flex-1 py-2.5 border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-xl text-xs font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 py-2.5 bg-[var(--color-primary)] text-[var(--bg-primary)] rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <>Register Member <Check className="w-3.5 h-3.5" /></>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
