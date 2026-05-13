import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api';
import toast from 'react-hot-toast';
import { Coins, ArrowRight, Loader, Info, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import socket from '../services/socket';

export default function EarnedCoins() {
  const [wallet, setWallet] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const navigate = useNavigate();

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const [walletRes, historyRes] = await Promise.all([
        api.get('/wallet'),
        api.get(`/wallet/coins-history?page=${page}&limit=${pagination.limit}`)
      ]);
      if (walletRes.data.success) setWallet(walletRes.data.wallet);
      if (historyRes.data.success) {
        setHistory(historyRes.data.data);
        setPagination(historyRes.data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      toast.error("Failed to load Earned Coins data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleCoinsAwarded = (data) => {
      setWallet(prev => {
        if (!prev) return { coinBalance: data.newBalance };
        return { ...prev, coinBalance: data.newBalance };
      });
      if (pagination.page === 1) {
        fetchData(1);
      }
    };

    const handleWalletUpdate = () => {
      fetchData(pagination.page);
    };
    
    socket.on('earned_coins_awarded', handleCoinsAwarded);
    socket.on('wallet_updated', handleWalletUpdate);

    return () => {
      socket.off('earned_coins_awarded', handleCoinsAwarded);
      socket.off('wallet_updated', handleWalletUpdate);
    };
  }, []);

  const handleRedeem = async () => {
    if (!wallet || wallet.coinBalance < 50) return;
    setRedeeming(true);
    const redeemToast = toast.loading('Redeeming Coins...');
    try {
      const { data } = await api.post('/wallet/redeem-coins');
      if (data.success) {
        toast.success(data.message, { id: redeemToast });
        fetchData(pagination.page); // Refresh data
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Redemption failed', { id: redeemToast });
    } finally {
      setRedeeming(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchData(newPage);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6 md:space-y-8"
    >
      {/* Header Card */}
      <div className="bg-white/70 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Earned Coins</h2>
            <p className="text-xs text-slate-400 mt-1 font-medium tracking-wide">Redeem coins for real wallet balance</p>
          </div>
          <button onClick={() => navigate('/profile')} className="text-xs font-black text-cyan-600 uppercase tracking-widest hover:text-cyan-700">Back</button>
        </div>
        
        <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-100">
              <Coins className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-500 uppercase tracking-widest mb-1">Available Balance</p>
              {loading && !wallet ? (
                <div className="h-8 w-24 bg-slate-200 animate-pulse rounded-lg"></div>
              ) : (
                <p className="text-4xl font-black text-slate-900">{wallet?.coinBalance || 0}</p>
              )}
            </div>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 w-full md:w-auto">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase">
                <Info className="w-4 h-4" /> Exchange Rate
              </div>
              <div className="text-sm font-black text-slate-900">50 Coins = ₹1</div>
            </div>
            <button
              onClick={handleRedeem}
              disabled={loading || redeeming || (wallet?.coinBalance < 50)}
              className="w-full px-6 py-3 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 disabled:opacity-30 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              {redeeming ? <Loader className="w-4 h-4 animate-spin" /> : 'Redeem Now'}
            </button>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="bg-white/70 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Transaction History</h3>
        </div>
        
        <div className="divide-y divide-slate-100">
          {loading && history.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center gap-3">
              <Loader className="w-6 h-6 text-slate-300 animate-spin" />
              <p className="text-slate-400 text-sm font-medium tracking-wide">Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                <History className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-slate-500 font-bold tracking-tight">No coin transactions yet</p>
              <p className="text-xs text-slate-400 mt-1">Your earned and redeemed coins will appear here.</p>
            </div>
          ) : (
            history.map((tx) => (
              <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div>
                  <p className="text-sm font-bold text-slate-900">{tx.description}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString()}</p>
                </div>
                <div className={`text-sm font-black ${tx.type === 'EARNED' ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {tx.type === 'EARNED' ? '+' : '-'}{tx.amount}
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
            <button 
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1 || loading}
              className="px-4 py-2 text-xs font-black text-slate-600 uppercase tracking-widest disabled:opacity-30 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Previous
            </button>
            <span className="text-xs font-bold text-slate-500">Page {pagination.page} of {pagination.pages}</span>
            <button 
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages || loading}
              className="px-4 py-2 text-xs font-black text-slate-600 uppercase tracking-widest disabled:opacity-30 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
