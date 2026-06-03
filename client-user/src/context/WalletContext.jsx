import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';
import socket from '../services/socket';

const WalletContext = createContext(null);

export const WalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState({
    balance: 0,
    cashbackBalance: 0,
    coinBalance: 0,
    totalCoins: 0,
    availableCoins: 0,
    earnedCoins: 0,
    redemptionBalance: 0
  });
  const [loading, setLoading] = useState(false);

  const fetchWallet = useCallback(async () => {
    const token = sessionStorage.getItem('dizipay_user_token');
    if (!token) return;

    setLoading(true);
    try {
      // Fetch from the standardized user wallet endpoint to get everything
      const res = await api.get('/user/wallet');
      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        setWallet({
          balance: Number(d.walletBalance) || 0,
          cashbackBalance: Number(d.cashbackBalance) || 0,
          coinBalance: Number(d.coinBalance) || 0,
          totalCoins: Number(d.totalCoins) || 0,
          availableCoins: Number(d.availableCoins) || 0,
          earnedCoins: Number(d.earnedCoins) || 0,
          redemptionBalance: Number(d.redemptionBalance) || 0
        });
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.error("[WalletContext] Fetch error:", err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem('dizipay_user_token');
    if (token) {
      fetchWallet();
    }

    const handleWalletUpdated = () => {
      fetchWallet();
    };

    const handleCoinsAwarded = (data) => {
      const newCoins = Number(data.newBalance) || 0;
      setWallet(prev => ({
        ...prev,
        coinBalance: newCoins,
        totalCoins: newCoins,
        availableCoins: newCoins,
        earnedCoins: newCoins
      }));
      // Perform a full fetch to sync everything else
      fetchWallet();
    };

    const handleFocus = () => {
      fetchWallet();
    };

    window.addEventListener('wallet-refresh', handleWalletUpdated);
    window.addEventListener('focus', handleFocus);

    socket.on('wallet_updated', handleWalletUpdated);
    socket.on('earned_coins_awarded', handleCoinsAwarded);
    socket.on('cashback_issued', handleWalletUpdated);
    socket.on('recharge_success', handleWalletUpdated);
    socket.on('transaction_updated', handleWalletUpdated);

    return () => {
      window.removeEventListener('wallet-refresh', handleWalletUpdated);
      window.removeEventListener('focus', handleFocus);
      socket.off('wallet_updated', handleWalletUpdated);
      socket.off('earned_coins_awarded', handleCoinsAwarded);
      socket.off('cashback_issued', handleWalletUpdated);
      socket.off('recharge_success', handleWalletUpdated);
      socket.off('transaction_updated', handleWalletUpdated);
    };
  }, [fetchWallet]);

  return (
    <WalletContext.Provider value={{ wallet, loading, fetchWallet, setWallet }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
