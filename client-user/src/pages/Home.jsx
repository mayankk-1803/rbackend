import React, { useState, useEffect, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Smartphone, Tv, Zap, Droplets, Flame, Wifi, CreditCard, MoreHorizontal, ArrowUpRight, X, Plus, History as HistoryIcon } from 'lucide-react';
import socket from '../services/socket';
import { toast } from 'react-hot-toast';
import PaymentModal from '../components/PaymentModal';
import { formatAmount, safeArray, safeValue } from '../utils/helpers';

// Memoized components for zero-lag rendering
const ServiceCard = memo(({ service }) => (
  <Link to={service.path} className="gpu-accelerated tap-highlight-none">
    <motion.div 
      whileTap={{ scale: 0.96 }}
      className="bg-white/90 p-4 md:p-8 rounded-2xl md:rounded-[2rem] border border-slate-200 flex flex-col items-center gap-2 md:gap-3 transition-all shadow-sm group hover:border-cyan-500/30"
    >
      <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-50 rounded-xl md:rounded-2xl flex items-center justify-center border border-slate-100 group-hover:border-cyan-500/20">
        <service.icon className="w-5 h-5 md:w-7 md:h-7 text-slate-400 group-hover:text-cyan-600 transition-all" />
      </div>
      <div className="text-center">
        <span className="text-[8px] md:text-[10px] font-black text-slate-500 group-hover:text-slate-900 uppercase tracking-widest block">{service.label}</span>
        {service.subtitle && <span className="text-[6px] md:text-[7px] font-bold text-slate-400 uppercase tracking-tighter block mt-0.5">{service.subtitle}</span>}
      </div>
    </motion.div>
  </Link>
));

const TransactionItem = memo(({ txn, idx }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: idx * 0.02, ease: "easeOut" }}
    className="px-6 py-4 flex justify-between items-center bg-white border border-slate-100 rounded-2xl hover:border-slate-200 transition-all group gpu-accelerated"
  >
    <div className="flex items-center gap-5">
      <div className={`p-3 rounded-xl ${txn.type === 'RECHARGE' ? 'bg-cyan-100 text-cyan-600' : 'bg-emerald-100 text-emerald-600'}`}>
        {txn.type === 'RECHARGE' ? <Smartphone className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
      </div>
      <div>
        <p className="text-sm font-black text-slate-900 uppercase tracking-tight group-hover:text-cyan-600">
          {safeValue(txn.type)} <span className="text-slate-300 mx-2">|</span> {txn.operator || 'Wallet'}
        </p>
        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{new Date(txn?.createdAt || Date.now()).toLocaleDateString()} • {safeValue(txn.mobile, 'Wallet')}</p>
      </div>
    </div>
    <div className="text-right">
      <p className={`text-lg font-black tracking-tighter ${txn.direction === 'DEBIT' ? 'text-slate-900' : 'text-emerald-600'}`}>
        {txn.direction === 'DEBIT' ? '-' : '+'}₹{formatAmount(txn.amount)}
      </p>
      <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-lg mt-1 inline-block ${
        txn.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
        txn.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 
        'bg-rose-50 text-rose-600 border border-rose-100'
      }`}>
        {safeValue(txn.status)}
      </span>
    </div>
  </motion.div>
));

const QRModal = memo(({ qrCode, amount, onClose }) => {
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    // Small delay to ensure modal animation completes before heavy image render
    const timer = setTimeout(() => setImgLoaded(true), 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[200] p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center space-y-6 gpu-accelerated"
      >
        <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Scan to <span className="text-cyan-600">Pay</span></h3>
        <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 min-h-[200px] flex items-center justify-center">
          {imgLoaded ? (
            <img 
              src={qrCode} 
              alt="Payment QR" 
              className="w-full aspect-square object-contain rounded-2xl animate-in fade-in duration-300" 
            />
          ) : (
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">
          Scan this QR using any UPI app to complete the payment of ₹{formatAmount(amount)}
        </p>
        <button 
          onClick={onClose}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest tap-highlight-none active:scale-95 transition-all"
        >
          Close Preview
        </button>
      </motion.div>
    </div>
  );
});

export default function Home() {
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrPreview, setQrPreview] = useState(null);
  const user = JSON.parse(localStorage.getItem('dizipay_user_data') || '{}');

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await api.get(API_ROUTES.USER.TRANSACTIONS);
      setRecentTransactions(safeArray(res.data.data).slice(0, 5));
    } catch (err) {}
  }, []);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await api.get('/wallet');
      if (res.data && res.data.wallet) {
        setWallet(res.data.wallet);
      }
    } catch (err) {}
  }, []);

  const handleAddMoney = async () => {
    if (!amount || Number(amount) <= 0) {
      return toast.error("Please enter a valid amount");
    }
    // Initiate payment flow directly
    await handlePaymentFlow();
  };

  const handlePaymentFlow = async () => {
    setLoading(true);
    try {
      const res = await api.post('/payment/create-order', { 
        amount: Number(amount),
        upiId: 'demo@upi',
        intent: 'TOPUP'
      }, {
        headers: {
          "x-idempotency-key": crypto.randomUUID()
        }
      });
      
      if (!res?.data?.success) throw new Error(res?.data?.message || "Gateway failed");

      const paymentData = res.data.data || res.data.payload || res.data;
      const paymentUrl = paymentData?.paymentUrl || paymentData?.payment_url || paymentData?.gatewayUrl;
      const qrImage = paymentData?.qrImage || paymentData?.qr_image;

      if (paymentUrl) {
        toast.success("Redirecting...");
        setShowAddMoney(false); // Close modal on success
        window.location.href = paymentUrl;
      } else if (qrImage) {
        setShowAddMoney(false); // Close modal to show QR
        setQrPreview(qrImage);
      } else {
        toast.error("Gateway unavailable");
      }

    } catch (err) {
      if (err.response?.data?.gatewayError === "IP_MISMATCH") {
        toast.error("Server IP not whitelisted.");
        return;
      }
      toast.error("Failed to initiate payment");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchWallet();

    const handleRechargeUpdate = (data) => {
      setRecentTransactions((prev) => 
        safeArray(prev).map((txn) => 
          txn.id === data.txnId 
            ? { ...txn, status: (data.status || "").toLowerCase(), ...data.transaction } 
            : txn
        )
      );
    };

    socket.on('recharge_update', handleRechargeUpdate);
    socket.on('wallet_updated', () => {
      fetchWallet();
      fetchTransactions();
    });

    return () => {
      socket.off('recharge_update', handleRechargeUpdate);
      socket.off('wallet_updated');
    };
  }, [fetchTransactions, fetchWallet]);

  const services = [
    { icon: Smartphone, label: 'Mobile Recharge', subtitle: 'PREPAID & POSTPAID SERVICES', path: '/recharge' },
    { icon: Tv, label: 'DTH Recharge', path: '/recharge/dth' },
    { icon: Zap, label: 'Electricity', path: '/recharge/electricity' },
    { icon: Droplets, label: 'Water Bill', path: '/recharge/water' },
    { icon: Flame, label: 'Gas cylinder', path: '/recharge/gas' },
    { icon: Wifi, label: 'Broadband', path: '/recharge/broadband' },
    { icon: CreditCard, label: 'Loan EMI', path: '/recharge/loan' },
    { icon: MoreHorizontal, label: 'More Services', path: '/recharge' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-10 py-4 ios-scroll"
    >
      <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
        <div className="flex-1 bg-white rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 border border-slate-200 shadow-sm relative overflow-hidden gpu-accelerated">
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full">
              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.4)]"></div>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Authorized Access</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase italic">
              Digital <span className="text-cyan-600">Wallet</span>
            </h1>
            <p className="text-slate-400 text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em]">{user.name || 'Spectral User'}</p>
          </div>
        </div>

        <motion.div 
          className="lg:w-[400px] bg-white rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-200 relative overflow-hidden flex flex-col justify-between gpu-accelerated"
        >
          <div className="relative z-10 flex justify-between items-start">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
              <Wallet className="w-8 h-8 text-cyan-600" />
            </div>
            <button 
              onClick={() => setShowAddMoney(true)}
              className="w-10 h-10 bg-cyan-600 text-white rounded-xl flex items-center justify-center shadow-lg tap-highlight-none active:scale-90 transition-all"
            >
              <Plus className="w-6 h-6 stroke-[3]" />
            </button>
          </div>

          <div className="relative z-10 mt-8">
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Total Credits</p>
            <h2 className="text-4xl font-black tracking-tighter text-slate-900">₹{formatAmount(wallet?.balance)}</h2>
          </div>
        </motion.div>
      </div>

      <div className="space-y-6">
        <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] ml-2">Terminal Services</h3>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3 md:gap-6">
          {services.map((service, idx) => (
            <ServiceCard key={idx} service={service} />
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl md:rounded-[2.5rem] overflow-hidden shadow-sm gpu-accelerated">
        <div className="px-6 md:px-8 py-5 md:py-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
            <HistoryIcon className="w-4 h-4 text-cyan-600" />
            Signal History
          </h2>
          <Link to="/history" className="text-[9px] font-black text-cyan-600 uppercase tracking-widest flex items-center gap-2">
            View All <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="p-4 space-y-3">
          {recentTransactions.length > 0 ? recentTransactions.map((txn, idx) => (
            <TransactionItem key={txn.id || idx} txn={txn} idx={idx} />
          )) : (
            <div className="py-20 text-center bg-slate-50 rounded-3xl border border-slate-200 border-dashed">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No spectral traces</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals are unmounted fully on close */}
      <AnimatePresence mode="wait">
        {showAddMoney && (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white border border-slate-200 rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl relative gpu-accelerated"
            >
              <div className="absolute top-0 right-0 p-8">
                <button onClick={() => setShowAddMoney(false)} className="text-slate-400 hover:text-slate-900 tap-highlight-none">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-8">
                <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Add <span className="text-cyan-600">Money</span></h2>
                <div className="space-y-6">
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 p-6 rounded-2xl text-slate-900 text-3xl font-black tracking-tighter outline-none focus:border-cyan-500 transition-all"
                  />
                  <button 
                    onClick={handleAddMoney}
                    disabled={loading || !amount}
                    className="w-full bg-cyan-400 text-slate-900 py-6 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] shadow-lg tap-highlight-none active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </>
                    ) : (
                      "Add Money"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PaymentModal removed as per optimized flow */}

      <AnimatePresence>
        {qrPreview && (
          <QRModal 
            qrCode={qrPreview} 
            amount={amount} 
            onClose={() => setQrPreview(null)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
