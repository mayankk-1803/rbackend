import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { TransactionsPieChart } from '../components/TransactionsPieChart';
import { RevenueBarChart } from '../components/RevenueBarChart';
import { Card, CardContent } from '../components/ui/Card';

const StatCard = ({ title, value }) => (
  <Card className="p-4 bg-white border-[#E2E8F0]">
    <h3 className="text-xs text-[#64748B] uppercase font-bold tracking-wider mb-1">{title}</h3>
    <p className="text-xl font-bold text-[#0F172A]">{value}</p>
  </Card>
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
    } finally {
      setChartsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchCharts();
  }, []);

  useSocketEvent('recharge_success', () => {
    fetchStats();
    fetchCharts();
  });

  useSocketEvent('recharge_failed', () => {
    fetchStats();
    fetchCharts();
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Real-time system health and transaction metrics</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Users" value={loading ? '...' : stats.totalUsers} />
        <StatCard title="Revenue" value={loading ? '...' : `₹${stats.totalRevenue.toLocaleString()}`} />
        <StatCard title="Total Transactions" value={loading ? '...' : stats.totalTransactions} />
        <StatCard title="Pending" value={loading ? '...' : stats.pendingCount} />
        <StatCard title="Success Rate" value={loading ? '...' : `${stats.successRate}%`} />
        <StatCard title="Fraud Alerts" value={loading ? '...' : stats.fraudAlerts} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="p-5">
          <h3 className="text-xs text-[#64748B] font-bold uppercase tracking-wider mb-6">Transaction Distribution</h3>
          {chartsLoading ? (
            <div className="h-64 bg-[#F8FAFC] animate-pulse rounded-md" />
          ) : (
            <div className="h-64 flex items-center justify-center">
              <TransactionsPieChart {...chartData} />
            </div>
          )}
        </Card>
        
        <Card className="p-5">
          <h3 className="text-xs text-[#64748B] font-bold uppercase tracking-wider mb-6">Revenue Trend</h3>
          {chartsLoading ? (
            <div className="h-64 bg-[#F8FAFC] animate-pulse rounded-md" />
          ) : (
            <div className="h-64 flex items-center justify-center">
              <RevenueBarChart dailyRevenue={chartData.dailyRevenue} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
