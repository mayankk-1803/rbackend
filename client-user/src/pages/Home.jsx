import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import { motion } from 'framer-motion';
import { Wallet, Smartphone, Tv, Zap, Droplets, Flame, Wifi, CreditCard, MoreHorizontal, ArrowUpRight } from 'lucide-react';
import { io } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import PaymentModal from '../components/PaymentModal';

export default function Home() {
  const [history, setHistory] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0, cashback: 0 });
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
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
      const res = await api.get('/api/wallet');
      setWallet({
        balance: res.data.balance || 0,
        cashback: res.data.cashbackBalance || 0
      });
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleAddMoney = async () => {
    if (!amount || Number(amount) <= 0) {
      return toast.error("Please enter a valid amount");
    }
    setShowAddMoney(false);
    setShowPayment(true);
  };

  const handlePaymentFlow = async () => {
    setLoading(true);
    try {
      console.log("[Wallet] Creating order for add money...");
      const res = await api.post('/api/payment/create-order', { 
        amount: Number(amount),
        upiId: 'demo@upi',
        intent: 'WALLET_TOPUP'
      });
      
      const paymentId = res.data.data._id;
      console.log("[Wallet] Order created:", paymentId);

      console.log("[Wallet] Confirming payment...");
      const confirmRes = await api.post('/api/payment/confirm', { paymentId });
      
      if (confirmRes.data.success) {
        console.log("[Wallet] Payment success, wallet updated");
        toast.success("Money added successfully!");
        fetchWallet();
      } else {
        throw new Error("Payment confirmation failed");
      }
    } catch (err) {
      console.error("[Wallet Error]:", err);
      toast.error(err.response?.data?.message || "Failed to add money");
    } finally {
      setLoading(false);
      setShowPayment(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchWallet();

    const socket = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000');

    const handleRechargeUpdate = (data) => {
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
    };

    socket.on('recharge_update', handleRechargeUpdate);
    socket.on('recharge_status', handleRechargeUpdate);

    socket.on('wallet_updated', () => {
      console.log('💰 Wallet updated event received. Refetching...');
      fetchWallet();
    });

    socket.on('payment_status', (data) => {
      console.log('💳 Payment status:', data);
      if (data.status === "SUCCESS") {
        fetchWallet();
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

      {/* Add Money Modal (Amount Entry) */}
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
                  Proceed
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        amount={amount}
        onPaymentSuccess={handlePaymentFlow}
        title="Add Money"
      />

      {/* Quick Services */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {services.map((service, idx) => (
          <Link key={idx} to={service.path}>
            <motion.div 
              whileHover={{ y: -4, shadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
              className="bg-white p-6 rounded-lg border border-[#E5E7EB] flex flex-col items-center gap-4 transition-all"
            >
              <div className="w-12 h-12 bg-[#F3E8FF] rounded-full flex items-center justify-center">
                <service.icon className="w-6 h-6 text-[#6D28D9]" />
              </div>
              <span className="text-sm font-medium text-[#0F172A]">{service.label}</span>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-sm">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex justify-between items-center">
          <h2 className="text-lg font-bold text-[#0F172A]">Recent Transactions</h2>
          <Link to="/history" className="text-sm font-medium text-[#6D28D9] hover:text-[#5B21B6] flex items-center gap-1">
            View All <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="divide-y divide-[#E5E7EB]">
          {history.length > 0 ? history.map((txn, idx) => (
            <div key={idx} className="px-6 py-4 flex justify-between items-center hover:bg-[#F8FAFC] transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  txn.type === 'recharge' ? 'bg-blue-50' : 'bg-green-50'
                }`}>
                  {txn.type === 'recharge' ? (
                    <Smartphone className={`w-5 h-5 ${txn.type === 'recharge' ? 'text-blue-600' : 'text-green-600'}`} />
                  ) : (
                    <Wallet className="w-5 h-5 text-green-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0F172A] capitalize">{txn.type} {txn.operator && `- ${txn.operator}`}</p>
                  <p className="text-xs text-[#64748B]">{new Date(txn.createdAt).toLocaleDateString()} • {txn.mobile || 'Wallet'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${txn.type === 'recharge' ? 'text-[#0F172A]' : 'text-green-600'}`}>
                  {txn.type === 'recharge' ? '-' : '+'}₹{txn.amount.toFixed(2)}
                </p>
                <p className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block ${
                  txn.status === 'success' ? 'bg-green-100 text-green-700' : 
                  txn.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                  'bg-red-100 text-red-700'
                }`}>
                  {txn.status}
                </p>
              </div>
            </div>
          )) : (
            <div className="px-6 py-12 text-center text-[#64748B]">
              No transactions found. Start recharging!
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
