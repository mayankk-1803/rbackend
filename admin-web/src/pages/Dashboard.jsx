import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { TransactionsPieChart } from '../components/TransactionsPieChart';
import { RevenueBarChart } from '../components/RevenueBarChart';

const StatCard = ({ title, value }) => (
  <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm">
    <h3 className="text-xs text-gray-500 uppercase font-medium tracking-wider mb-1">{title}</h3>
    <p className="text-xl font-semibold text-gray-900">{value}</p>
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
    <div className="p-6 bg-[#F9FAFB] min-h-screen font-sans text-[#111827]">
      <header className="mb-8">
        <h1 className="text-xl font-semibold">Dashboard Overview</h1>
        <p className="text-sm text-gray-500 mt-1">System-wide performance metrics</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard 
          title="Total Users" 
          value={loading ? '...' : stats.totalUsers} 
        />
        <StatCard 
          title="Total Revenue" 
          value={loading ? '...' : `₹${stats.totalRevenue.toLocaleString()}`} 
        />
        <StatCard 
          title="Total Transactions" 
          value={loading ? '...' : stats.totalTransactions} 
        />
        <StatCard 
          title="Pending" 
          value={loading ? '...' : stats.pendingCount} 
        />
        <StatCard 
          title="Success Rate" 
          value={loading ? '...' : `${stats.successRate}%`} 
        />
        <StatCard 
          title="Fraud Alerts" 
          value={loading ? '...' : stats.fraudAlerts} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm">
          <h3 className="text-xs text-gray-500 uppercase font-medium mb-4">Transaction Distribution</h3>
          {chartsLoading ? (
            <div className="h-64 bg-gray-50 animate-pulse rounded-md" />
          ) : (
            <TransactionsPieChart {...chartData} />
          )}
        </div>
        
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm">
          <h3 className="text-xs text-gray-500 uppercase font-medium mb-4">Revenue Trend</h3>
          {chartsLoading ? (
            <div className="h-64 bg-gray-50 animate-pulse rounded-md" />
          ) : (
            <RevenueBarChart dailyRevenue={chartData.dailyRevenue} />
          )}
        </div>
      </div>
    </div>
  );
};
