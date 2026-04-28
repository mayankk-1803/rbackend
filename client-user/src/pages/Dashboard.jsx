import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Clock, ShieldCheck } from 'lucide-react';
import api from '../api';
import { formatAmount, safeArray, safeValue } from '../utils/helpers';

export default function Dashboard() {
  const [wallet, setWallet] = useState(null); // ✅ Standardized state
  const [stats, setStats] = useState({
    totalSpent: 0,
    totalAdded: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);

  const fetchWallet = async () => {
    try {
      const res = await api.get("/wallet");
      setWallet(res.data.wallet);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
    try {
      const txnRes = await api.get('/user/transactions');
      const transactions = safeArray(txnRes.data.data);
      
      const spent = transactions
        .filter(t => t.direction === 'DEBIT' && t.status === 'SUCCESS')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);
      
      const added = transactions
        .filter(t => t.direction === 'CREDIT' && t.type === 'TOPUP' && t.status === 'SUCCESS')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);

      setStats({
        totalSpent: spent,
        totalAdded: added,
        recentActivity: transactions.slice(0, 5)
      });
    } catch (err) {
      console.error("Dashboard stats error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet(); // ✅ Fetch once
    fetchStats();
  }, []);

  const handleReferral = () => {
    const code = "REF" + Math.floor(Math.random() * 10000);
    const link = `${window.location.origin}/register?ref=${code}`;
    navigator.clipboard.writeText(link);
    alert("Referral link copied!");
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-white p-6 rounded-lg border border-[#E5E7EB] shadow-sm"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">+12%</span>
      </div>
      <h3 className="text-sm font-medium text-[#64748B] mb-1">{title}</h3>
      <p className="text-2xl font-bold text-[#0F172A]">₹{(Number(value) || 0).toFixed(2)}</p>
      {subtitle && <p className="text-xs text-[#64748B] mt-2">{subtitle}</p>}
    </motion.div>
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Account Overview</h1>
          <p className="text-[#64748B] text-sm">Real-time insights into your spending and rewards.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F0FDF4] text-[#166534] rounded-full border border-[#BBF7D0]">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Verified Account</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Current Balance" 
          value={wallet?.balance} 
          icon={Wallet} 
          color="bg-blue-50 text-blue-600"
          subtitle="Available for instant recharge"
        />
        <StatCard 
          title="Total Spending" 
          value={stats.totalSpent} 
          icon={TrendingDown} 
          color="bg-orange-50 text-orange-600"
          subtitle="Total spent this month"
        />
        <StatCard 
          title="Money Added" 
          value={stats.totalAdded} 
          icon={TrendingUp} 
          color="bg-green-50 text-green-600"
          subtitle="Funds added to wallet"
        />
        <StatCard 
          title="Cashback Earned" 
          value={wallet?.cashbackBalance} 
          icon={ArrowUpRight} 
          color="bg-purple-50 text-purple-600"
          subtitle="Lifetime rewards earned"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-sm">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex justify-between items-center">
              <h2 className="text-lg font-bold text-[#0F172A]">Recent Activity</h2>
              <Clock className="w-4 h-4 text-[#64748B]" />
            </div>
            <div className="divide-y divide-[#E5E7EB]">
              {loading ? (
                <div className="p-6 text-center text-[#64748B]">Loading activity...</div>
              ) : safeArray(stats.recentActivity).length > 0 ? stats.recentActivity.map((txn, idx) => (
                <div key={idx} className="px-6 py-4 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${txn.direction === 'DEBIT' ? 'bg-red-50' : 'bg-green-50'}`}>
                      {txn.direction === 'DEBIT' ? (
                        <ArrowDownLeft className="w-4 h-4 text-red-600" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#0F172A] capitalize">{safeValue(txn.type)} {txn.operator && `- ${txn.operator}`}</p>
                      <p className="text-xs text-[#64748B]">{new Date(txn?.createdAt || Date.now()).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${txn.direction === 'DEBIT' ? 'text-red-600' : 'text-green-600'}`}>
                      {txn.direction === 'DEBIT' ? '-' : '+'}₹{(Number(txn.amount) || 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-[#64748B] font-bold uppercase">{safeValue(txn.status)}</p>
                  </div>
                </div>
              )) : (
                <div className="p-12 text-center text-[#64748B]">No recent activity found.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#0F172A] text-white p-6 rounded-lg shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-lg font-bold mb-2">Refer & Earn</h3>
              <p className="text-blue-200 text-sm mb-4">Invite your friends and earn up to ₹50 cashback on their first recharge.</p>
              <button 
                onClick={handleReferral}
                className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-md text-sm font-bold transition-colors"
              >
                Get Referral Link
              </button>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl"></div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-[#E5E7EB] shadow-sm">
            <h3 className="text-sm font-bold text-[#0F172A] mb-4">Spending Analysis</h3>
            <div className="space-y-4">
              {[
                { label: 'Mobile Recharge', percent: 65, color: 'bg-blue-600' },
                { label: 'DTH & Bills', percent: 25, color: 'bg-purple-600' },
                { label: 'Other', percent: 10, color: 'bg-gray-400' },
              ].map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-[#64748B]">{item.label}</span>
                    <span className="text-[#0F172A]">{item.percent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${item.color}`} 
                      style={{ width: `${item.percent}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
