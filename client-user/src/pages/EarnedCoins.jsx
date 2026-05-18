import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import toast from 'react-hot-toast';
import { Coins, ArrowRight, Loader, Info, History, Zap, Sparkles, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import socket from '../services/socket';

export default function EarnedCoins() {
  const [wallet, setWallet] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const navigate = useNavigate();

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const [walletRes, historyRes] = await Promise.all([
        api.get('/user/wallet'),
        api.get(`/user/wallet/coins-history?page=${page}&limit=10`)
      ]);
      
      setWallet(walletRes.data.data);
      if (historyRes.data.success) {
        setHistory(historyRes.data.data);
        setPagination(historyRes.data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const handleWalletUpdate = () => fetchData(pagination.page);
    socket.on('wallet_updated', handleWalletUpdate);
    return () => socket.off('wallet_updated', handleWalletUpdate);
  }, [fetchData]);

  const handleRedeem = async () => {
    if (!wallet || wallet.coinBalance < 100) {
      toast.error("Minimum 100 coins required to redeem");
      return;
    }
    setRedeeming(true);
    const redeemToast = toast.loading('Synchronizing with Wallet...');
    try {
      const { data } = await api.post('/user/wallet/redeem-coins');
      if (data.success) {
        toast.success(data.message, { id: redeemToast });
        fetchData(1);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Redemption failed', { id: redeemToast });
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto space-y-8 py-6"
    >
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-cyan-600 transition-all shadow-sm">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Reward <span className="text-amber-500">Inventory</span></h1>
          <p className="text-slate-500 text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em]">Authorized Coin Repository</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-5">
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm relative overflow-hidden group"
          >
            <div className="relative z-10">
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-6 border border-amber-100">
                <Zap className="w-8 h-8 text-amber-500 fill-amber-500" />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Available Balance</p>
              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-5xl font-black text-slate-900 tracking-tighter">{wallet?.coinBalance || 0}</span>
                <span className="text-xs font-black text-amber-500 uppercase tracking-widest">Coins</span>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 mb-6 border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Redemption Rate</span>
                  <span className="text-xs font-black text-slate-900">100 : 1</span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((wallet?.coinBalance || 0) / 100 * 100, 100)}%` }}
                    className="h-full bg-amber-500 rounded-full"
                  />
                </div>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-3">Minimum 100 coins required for conversion</p>
              </div>

              <button
                onClick={handleRedeem}
                disabled={redeeming || (wallet?.coinBalance < 100)}
                className="w-full bg-slate-900 text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl hover:shadow-2xl transition-all disabled:opacity-20 relative group overflow-hidden"
              >
                <span className="relative z-10">{redeeming ? "Syncing..." : "Redeem Now"}</span>
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-amber-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
            </div>
          </motion.div>
        </div>

        <div className="md:col-span-7">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm h-full flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <History className="w-5 h-5 text-amber-500" />
              <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Transaction Log</h2>
            </div>

            <div className="flex-1 p-4 overflow-y-auto max-h-[500px] no-scrollbar">
              {loading && history.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <Loader className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accessing Ledger...</p>
                </div>
              ) : history.length > 0 ? (
                <div className="space-y-3">
                  {history.map((tx, idx) => (
                    <motion.div 
                      key={tx.id || idx}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="px-6 py-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center group hover:border-amber-200 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${tx.type === 'EARNED' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{tx.description}</p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{new Date(tx.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-black tracking-tighter ${tx.type === 'EARNED' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.type === 'EARNED' ? '+' : '-'}{tx.amount}
                        </p>
                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Coins</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center bg-slate-50/30 rounded-3xl border border-dashed border-slate-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No spectral coin trails found</p>
                </div>
              )}
            </div>

            {pagination.pages > 1 && (
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <button 
                  disabled={pagination.page === 1}
                  onClick={() => fetchData(pagination.page - 1)}
                  className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors"
                >
                  Previous
                </button>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Page {pagination.page} / {pagination.pages}</span>
                <button 
                  disabled={pagination.page === pagination.pages}
                  onClick={() => fetchData(pagination.page + 1)}
                  className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
