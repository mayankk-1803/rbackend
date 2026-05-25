import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import toast from 'react-hot-toast';
import { Coins, ArrowRight, Loader, Info, History, Zap, Sparkles, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import socket from '../services/socket';
import { useWallet } from '../context/WalletContext';

export default function EarnedCoins() {
  const { wallet, fetchWallet } = useWallet();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const navigate = useNavigate();

  const fetchHistory = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const historyRes = await api.get(`/user/wallet/coins-history?page=${page}&limit=10`);
      if (historyRes.data.success) {
        setHistory(historyRes.data.data);
        setPagination(historyRes.data.pagination);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchWallet();
    const handleWalletUpdate = () => fetchHistory(pagination.page);
    socket.on('wallet_updated', handleWalletUpdate);
    socket.on('earned_coins_awarded', handleWalletUpdate);
    return () => {
      socket.off('wallet_updated', handleWalletUpdate);
      socket.off('earned_coins_awarded', handleWalletUpdate);
    };
  }, [fetchHistory, fetchWallet, pagination.page]);

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
        toast.success("Coins redeemed successfully", { id: redeemToast });
        await fetchWallet();
        fetchHistory(1);
      }
    } catch (err) {
      toast.error(err.safeMessage || 'Redemption failed', { id: redeemToast });
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto space-y-8 py-6 relative z-10"
    >
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-3 bg-[var(--glass-button-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-secondary)] hover:text-amber-400 transition-all shadow-sm cursor-pointer">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-[var(--text-color)] tracking-tighter uppercase italic">Reward <span className="text-amber-400 amber-glow">Inventory</span></h1>
          <p className="text-[var(--text-secondary)] text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em]">Authorized Coin Repository</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-5">
          <motion.div 
            whileHover={{ y: -5 }}
            className="glass-card border border-[var(--glass-border)] rounded-[2.5rem] p-8 shadow-sm relative overflow-hidden group"
          >
            <div className="relative z-10">
              <div className="w-16 h-16 bg-[var(--bg-primary)] rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20">
                <Zap className="w-8 h-8 text-amber-400 fill-amber-400/20" />
              </div>
              <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2">Available Balance</p>
              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-5xl font-black text-[var(--text-color)] tracking-tighter">{wallet?.coinBalance || 0}</span>
                <span className="text-xs font-black text-amber-400 uppercase tracking-widest">Coins</span>
              </div>

              <div className="bg-[var(--glass-button-bg)] rounded-2xl p-6 mb-6 border border-[var(--glass-border)]">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Redemption Rate</span>
                  <span className="text-xs font-black text-[var(--text-color)]">100 : 1</span>
                </div>
                <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((wallet?.coinBalance || 0) / 100 * 100, 100)}%` }}
                    className="h-full bg-amber-400 rounded-full"
                  />
                </div>
                <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-tighter mt-3">Minimum 100 coins required for conversion</p>
              </div>

              <button
                onClick={handleRedeem}
                disabled={redeeming || (wallet?.coinBalance < 100)}
                className="w-full bg-amber-400 text-slate-950 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl hover:bg-amber-300 disabled:opacity-20 transition-all cursor-pointer"
              >
                {redeeming ? "Syncing..." : "Redeem Now"}
              </button>
            </div>
          </motion.div>
        </div>

        <div className="md:col-span-7">
          <div className="glass-card border border-[var(--glass-border)] rounded-[2.5rem] overflow-hidden shadow-sm h-full flex flex-col">
            <div className="px-8 py-6 border-b border-[var(--glass-border)] flex items-center gap-3 bg-[var(--bg-tertiary)]">
              <History className="w-5 h-5 text-amber-400" />
              <h2 className="text-[10px] font-black text-[var(--text-color)] uppercase tracking-widest">Transaction Log</h2>
            </div>

            <div className="flex-1 p-4 overflow-y-auto max-h-[500px] no-scrollbar">
              {loading && history.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <Loader className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
                  <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Accessing Ledger...</p>
                </div>
              ) : history.length > 0 ? (
                <div className="space-y-3">
                  {history.map((tx, idx) => (
                    <motion.div 
                      key={tx.id || idx}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="px-6 py-4 bg-[var(--glass-button-bg)] border border-[var(--glass-border)] rounded-2xl flex justify-between items-center group hover:border-amber-500/20 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${tx.type === 'EARNED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-[var(--text-color)] uppercase tracking-tight">{tx.description}</p>
                          <p className="text-[8px] text-[var(--text-secondary)] font-bold uppercase tracking-tighter mt-1">{new Date(tx.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-black tracking-tighter ${tx.type === 'EARNED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {tx.type === 'EARNED' ? '+' : '-'}{tx.amount}
                        </p>
                        <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Coins</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center bg-[var(--bg-tertiary)] rounded-3xl border border-dashed border-[var(--glass-border)]">
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">No coin trails found</p>
                </div>
              )}
            </div>

            {pagination.pages > 1 && (
              <div className="p-6 border-t border-[var(--glass-border)] bg-[var(--bg-tertiary)] flex justify-between items-center">
                <button 
                  disabled={pagination.page === 1}
                  onClick={() => fetchData(pagination.page - 1)}
                  className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-color)] disabled:opacity-20 transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Page {pagination.page} / {pagination.pages}</span>
                <button 
                  disabled={pagination.page === pagination.pages}
                  onClick={() => fetchData(pagination.page + 1)}
                  className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-color)] disabled:opacity-20 transition-colors cursor-pointer"
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
