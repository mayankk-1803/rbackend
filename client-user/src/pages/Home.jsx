import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import { motion } from 'framer-motion';
import { Wallet, Smartphone, Tv, Zap, Droplets, Flame, Wifi, CreditCard, MoreHorizontal, ArrowUpRight } from 'lucide-react';
import { io } from 'socket.io-client';
import { toast } from 'react-hot-toast';

export default function Home() {
  const [history, setHistory] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0, cashback: 0 });
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await api.get(API_ROUTES.USER.TRANSACTIONS);
      setHistory((res.data.data || []).slice(0, 5));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await api.get(API_ROUTES.USER.WALLET);
      setWallet({
        balance: res.data.data.walletBalance,
        cashback: res.data.data.cashbackBalance
      });
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleAddMoney = async () => {
    if (!amount || Number(amount) <= 0) {
      return toast.error("Please enter a valid amount");
    }

    setLoading(true);
    try {
      await api.post(API_ROUTES.USER.TOP_UP, { 
        amount: Number(amount) 
      });
      
      toast.success("Money added successfully 💰");
      setShowAddMoney(false);
      setAmount("");
      fetchWallet();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add money");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchWallet();

    const socket = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000');

    socket.on('recharge_update', (data) => {
      console.log('📡 Live update:', data);
      setHistory((prev) => 
        prev.map((txn) => 
          txn._id === data.txnId 
            ? { ...txn, status: data.status.toLowerCase(), ...data.transaction } 
            : txn
        )
      );

      if (data.status === "success") {
        toast.success("Recharge Successful 🎉");
      } else if (data.status === "failed") {
        toast.error(`Recharge Failed: ${data.reason || 'Unknown error'} ❌`);
      }
    });

    socket.on('wallet_update', (data) => {
      console.log('💰 Wallet update:', data);
      // Only update if it's for the current user
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (data.userId === currentUser.id || data.userId === currentUser._id) {
        setWallet({
          balance: data.walletBalance,
          cashback: data.cashbackBalance
        });
        toast.success("Wallet Updated! 💰");
      }
    });

    const interval = setInterval(() => {
      fetchTransactions();
      fetchWallet();
    }, 5000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [fetchTransactions, fetchWallet]);

  const services = [
    { icon: Smartphone, label: 'Mobile Prepaid', path: '/recharge' },
    { icon: Tv, label: 'DTH Recharge', path: '/recharge' },
    { icon: Zap, label: 'Electricity', path: '/recharge' },
    { icon: Droplets, label: 'Water Bill', path: '/recharge' },
    { icon: Flame, label: 'Gas cylinder', path: '/recharge' },
    { icon: Wifi, label: 'Broadband', path: '/recharge' },
    { icon: CreditCard, label: 'Loan EMI', path: '/recharge' },
    { icon: MoreHorizontal, label: 'More Services', path: '/recharge' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Welcome Header */}
      <div className="bg-[#F8FAFC] rounded-lg p-8 border border-[#E5E7EB] flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Welcome back, {user.email?.split('@')[0] || 'User'}</h1>
          <p className="text-[#64748B] mt-1 text-sm">Here's what's happening with your account today.</p>
        </div>
        <div className="hidden sm:block">
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="flex bg-white rounded-md border border-[#E5E7EB] p-4 shadow-sm items-center gap-4 min-w-[240px] justify-between cursor-default"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#F3E8FF] rounded flex items-center justify-center">
                <Wallet className="w-5 h-5 text-[#6D28D9]" />
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase font-bold tracking-wider">Wallet Balance</p>
                <p className="text-xl font-bold text-[#0F172A]">₹{wallet.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                {wallet.cashback > 0 && (
                  <p className="text-[10px] text-green-600 font-bold uppercase mt-0.5">
                    + ₹{wallet.cashback.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Cashback
                  </p>
                )}
              </div>
            </div>
            <button 
              onClick={() => setShowAddMoney(true)}
              className="text-white bg-[#6D28D9] hover:bg-[#5B21B6] px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:ring-2 focus:ring-[#6D28D9]"
            >
              Add
            </button>
          </motion.div>
        </div>
      </div>

      {/* Add Money Modal */}
      {showAddMoney && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl border border-[#E5E7EB]"
          >
            <h2 className="text-xl font-bold text-[#0F172A] mb-2">Add Money to Wallet</h2>
            <p className="text-[#64748B] text-sm mb-6">Enter the amount you want to add to your Dizipay wallet.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">Amount (₹)</label>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)} 
                  className="w-full border border-[#E5E7EB] p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6D28D9] text-lg font-semibold"
                />
              </div>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {[100, 500, 1000].map(val => (
                  <button
                    key={val}
                    onClick={() => setAmount(val.toString())}
                    className="py-2 border border-[#E5E7EB] rounded-md text-sm font-medium text-[#64748B] hover:border-[#6D28D9] hover:text-[#6D28D9] transition-colors"
                  >
                    +₹{val}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowAddMoney(false)}
                  className="flex-1 px-4 py-2.5 border border-[#E5E7EB] rounded-md text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddMoney}
                  disabled={loading}
                  className="flex-1 bg-[#6D28D9] text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-[#5B21B6] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  ) : 'Add Money'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Services Grid */}
      <section>
        <h2 className="text-lg font-semibold text-[#0F172A] mb-4">Recharge & Pay Bills</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {services.map((s, idx) => (
            <Link 
              key={idx} 
              to={s.path} 
              className="bg-white border border-[#E5E7EB] rounded-md p-5 flex flex-col items-center justify-center gap-3 hover:border-[#6D28D9] hover:shadow-sm transition group"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#64748B] group-hover:text-[#6D28D9] group-hover:bg-[#F3E8FF] transition-colors">
                <s.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-[#0F172A]">{s.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Transactions */}
      <section className="bg-white border border-[#E5E7EB] rounded-md overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-[#E5E7EB]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Recent Transactions</h2>
          <Link to="/history" className="text-sm font-medium text-[#6D28D9] hover:text-[#5B21B6] flex items-center gap-1">
            View all <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
        
        {history.length === 0 ? (
          <div className="p-8 text-center text-[#64748B] text-sm">No recent transactions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap group">
              <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[#64748B] text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3">Service</th>
                  <th className="px-6 py-3">Target Number</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3 text-right">Status</th>
                  <th className="px-6 py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {history.map(t => {
                  const status = t.status?.toLowerCase();
                  return (
                    <tr key={t._id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-[#F1F5F9] flex items-center justify-center text-[#64748B]">
                            <Smartphone className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-[#0F172A]">Mobile Recharge</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[#0F172A] font-medium">{t.mobile}</td>
                      <td className="px-6 py-4 font-semibold text-[#0F172A]">₹{t.amount}</td>
                      <td className="px-6 py-4 text-right">
                        {status === "pending" ? (
                          <span className="flex items-center justify-end gap-2 text-yellow-600 font-semibold text-xs">
                            <span className="animate-spin h-3 w-3 border-2 border-yellow-500 border-t-transparent rounded-full"></span>
                            PROCESSING...
                          </span>
                        ) : (
                          <span className={
                            status === "success" 
                              ? "text-green-600 bg-green-100 px-2 py-1 rounded text-xs font-semibold uppercase" 
                              : "text-red-600 bg-red-100 px-2 py-1 rounded text-xs font-semibold uppercase"
                          }>
                            {status?.toUpperCase() || 'UNKNOWN'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-[#64748B]">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </motion.div>
  );
}
