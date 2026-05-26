import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { TransactionsPieChart } from '../components/TransactionsPieChart';
import { RevenueBarChart } from '../components/RevenueBarChart';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

const StatCard = ({ title, value, index }) => (
  <motion.div 
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05, duration: 0.3 }}
    whileHover={{ y: -1 }}
    className="p-5 bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl shadow-soft hover:shadow-medium hover:border-[var(--color-primary)]/30 transition-all relative overflow-hidden"
  >
    <h3 className="text-[10px] text-[var(--text-secondary)] uppercase font-semibold tracking-wider mb-1 relative z-10">{title}</h3>
    <p className="text-[34px] font-bold text-[var(--text-primary)] tracking-tight relative z-10 leading-tight">
      {value}
    </p>
  </motion.div>
);

export const Dashboard = () => {
  const { resolvedTheme } = useTheme();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTransactions: 0,
    totalRevenue: 0,
    pendingCount: 0,
    successRate: 0,
    fraudAlerts: 0,
    totalCoinsIssued: 0,
    totalCoinsRedeemed: 0,
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
      if (data && data.success) {
        setChartData({
          success: data.successCount || 0,
          pending: data.pendingCount || 0,
          failed: data.failedCount || 0,
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

  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">Dashboard Overview</h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium">Real-time system health and transaction metrics</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <StatCard index={0} title="Total Users" value={loading ? '...' : stats.totalUsers.toLocaleString()} />
        <StatCard index={1} title="Revenue" value={loading ? '...' : `₹${stats.totalRevenue.toLocaleString()}`} />
        <StatCard index={2} title="Total Transactions" value={loading ? '...' : stats.totalTransactions.toLocaleString()} />
        <StatCard index={3} title="Success Rate" value={loading ? '...' : `${stats.successRate}%`} />
        <StatCard index={4} title="Cashback Distributed" value={loading ? '...' : `₹${(stats.totalCashback || 0).toLocaleString()}`} />
        <StatCard index={5} title="Total Added" value={loading ? '...' : `₹${(stats.totalAdded || 0).toLocaleString()}`} />
        <StatCard index={6} title="Pending" value={loading ? '...' : stats.pendingCount} />
        <StatCard index={7} title="Fraud Alerts" value={loading ? '...' : stats.fraudAlerts} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 mt-6">
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="p-5 md:p-6 bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl shadow-soft"
        >
          <h3 className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider mb-5">Transaction Distribution</h3>
          {chartsLoading ? (
            <div className="h-48 md:h-64 bg-[var(--bg-secondary)] animate-pulse rounded-xl" />
          ) : (
            <div className="h-48 md:h-64 w-full">
              <TransactionsPieChart {...chartData} isDark={isDark} />
            </div>
          )}
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="p-5 md:p-6 bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl shadow-soft"
        >
          <h3 className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider mb-5">Revenue Trend</h3>
          {chartsLoading ? (
            <div className="h-48 md:h-64 bg-[var(--bg-secondary)] animate-pulse rounded-xl" />
          ) : (
            <div className="h-48 md:h-64 w-full">
              <RevenueBarChart dailyRevenue={chartData.dailyRevenue} isDark={isDark} />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
