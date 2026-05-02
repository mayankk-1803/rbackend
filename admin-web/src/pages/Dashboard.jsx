import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { TransactionsPieChart } from '../components/TransactionsPieChart';
import { RevenueBarChart } from '../components/RevenueBarChart';
import { motion } from 'framer-motion';

const StatCard = ({ title, value, index }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1, duration: 0.4 }}
    whileHover={{ scale: 1.03, y: -2 }}
    className="p-6 bg-white/70 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
  >
    <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
    <h3 className="text-xs text-slate-500 uppercase font-black tracking-widest mb-2 relative z-10">{title}</h3>
    <p className="text-3xl font-black text-slate-900 tracking-tight relative z-10">
      {typeof value === 'string' && value.includes('₹') ? (
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-cyan-600">{value}</span>
      ) : (
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-purple-600">{value}</span>
      )}
    </p>
  </motion.div>
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-slate-500 mt-1 font-medium">Real-time system health and transaction metrics</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <StatCard index={0} title="Total Users" value={loading ? '...' : stats.totalUsers} />
        <StatCard index={1} title="Revenue" value={loading ? '...' : `₹${stats.totalRevenue.toLocaleString()}`} />
        <StatCard index={2} title="Total Transactions" value={loading ? '...' : stats.totalTransactions} />
        <StatCard index={3} title="Pending" value={loading ? '...' : stats.pendingCount} />
        <StatCard index={4} title="Success Rate" value={loading ? '...' : `${stats.successRate}%`} />
        <StatCard index={5} title="Fraud Alerts" value={loading ? '...' : stats.fraudAlerts} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="p-4 md:p-6 bg-white/70 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-sm"
        >
          <h3 className="text-[10px] md:text-xs text-slate-500 font-black uppercase tracking-widest mb-6">Transaction Distribution</h3>
          {chartsLoading ? (
            <div className="h-48 md:h-64 bg-slate-100 animate-pulse rounded-xl" />
          ) : (
            <div className="h-48 md:h-64 w-full">
              <TransactionsPieChart {...chartData} isDark={false} />
            </div>
          )}
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="p-4 md:p-6 bg-white/70 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-sm"
        >
          <h3 className="text-[10px] md:text-xs text-slate-500 font-black uppercase tracking-widest mb-6">Revenue Trend</h3>
          {chartsLoading ? (
            <div className="h-48 md:h-64 bg-slate-100 animate-pulse rounded-xl" />
          ) : (
            <div className="h-48 md:h-64 w-full">
              <RevenueBarChart dailyRevenue={chartData.dailyRevenue} isDark={false} />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
