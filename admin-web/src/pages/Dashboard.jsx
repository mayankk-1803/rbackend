import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { Activity, Users, CreditCard, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { TransactionsPieChart } from '../components/TransactionsPieChart';
import { RevenueBarChart } from '../components/RevenueBarChart';

const StatCard = ({ title, value, icon: Icon, colorClass }) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center shadow-slate-200/50">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 ${colorClass}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <h3 className="text-sm font-medium text-slate-500">{title}</h3>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  </div>
);

export const Dashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTransactions: 0,
    totalRevenue: 0,
    pendingCount: 0,
    successRate: 0,
    fraudAlerts: 0,
  });
  const [chartData, setChartData] = useState({ success: 0, pending: 0, failed: 0, dailyRevenue: [] });
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [chartsError, setChartsError] = useState(false);
  const { useSocketEvent } = useSocket();

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/admin/dashboard');
      if (data && data.data) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCharts = async () => {
    try {
      setChartsLoading(true);
      setChartsError(false);
      const { data } = await api.get('/admin/charts');
      if (data) {
        setChartData({
          success: data.success || 0,
          pending: data.pending || 0,
          failed: data.failed || 0,
          dailyRevenue: data.dailyRevenue || []
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard charts:', error);
      setChartsError(true);
    } finally {
      setChartsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchCharts();
  }, []);

  useSocketEvent('recharge_success', (data) => {
    // Optionally display a toast, for now just refetch the stats
    fetchStats();
    fetchCharts();
  });

  useSocketEvent('recharge_failed', (data) => {
    fetchStats();
    fetchCharts();
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard Overview</h1>
        <p className="text-slate-500 mt-1">Real-time statistics and system health</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard 
          title="Total Users" 
          value={loading ? '...' : stats.totalUsers} 
          icon={Users} 
          colorClass="bg-blue-50 text-blue-600" 
        />
        <StatCard 
          title="Total Revenue (₹)" 
          value={loading ? '...' : `₹${stats.totalRevenue.toLocaleString()}`} 
          icon={CreditCard} 
          colorClass="bg-emerald-50 text-emerald-600" 
        />
        <StatCard 
          title="Total Transactions" 
          value={loading ? '...' : stats.totalTransactions} 
          icon={Activity} 
          colorClass="bg-purple-50 text-purple-600" 
        />
        <StatCard 
          title="Pending Recharges" 
          value={loading ? '...' : stats.pendingCount} 
          icon={RefreshCw} 
          colorClass="bg-amber-50 text-amber-600" 
        />
        <StatCard 
          title="Success Rate" 
          value={loading ? '...' : `${stats.successRate}%`} 
          icon={CheckCircle} 
          colorClass="bg-blue-50 text-blue-600" 
        />
        <StatCard 
          title="Fraud Alerts" 
          value={loading ? '...' : stats.fraudAlerts} 
          icon={AlertTriangle} 
          colorClass="bg-red-50 text-red-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {chartsLoading ? (
          <>
            <div className="bg-slate-100 rounded-2xl h-[400px] animate-pulse shadow-sm border border-slate-100"></div>
            <div className="bg-slate-100 rounded-2xl h-[400px] animate-pulse shadow-sm border border-slate-100"></div>
          </>
        ) : chartsError ? (
          <div className="col-span-1 lg:col-span-2 bg-red-50 text-red-600 font-medium p-6 rounded-2xl text-center shadow-sm border border-red-100">
            Failed to load analytics
          </div>
        ) : (
          <>
            <TransactionsPieChart {...chartData} />
            <RevenueBarChart dailyRevenue={chartData.dailyRevenue} />
          </>
        )}
      </div>
    </div>
  );
};
