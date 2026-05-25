import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, Smartphone, Tv, Zap, Droplets, Flame, Wifi, 
  CreditCard, MoreHorizontal, ArrowUpRight, X, Plus, 
  History as HistoryIcon, ShieldAlert, Cpu, CheckCircle2,
  TrendingUp, Activity, Shield, RefreshCw, Key
} from 'lucide-react';
import socket from '../services/socket';
import { toast } from 'react-hot-toast';
import PaymentModal from '../components/PaymentModal';
import { formatAmount, safeArray, safeValue } from '../utils/helpers';
import gsap from 'gsap';
import { isIOSDevice } from '../utils/device';

// Animated Counter component using GSAP
const AnimatedCounter = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);

  useEffect(() => {
    if (isIOSDevice()) {
      setDisplayValue(value || 0);
      prevValueRef.current = value || 0;
      return undefined;
    }

    const obj = { val: prevValueRef.current };
    gsap.to(obj, {
      val: value || 0,
      duration: 1.2,
      ease: "power2.out",
      onUpdate: () => {
        setDisplayValue(obj.val);
      }
    });
    prevValueRef.current = value || 0;
  }, [value]);

  return <span>{displayValue.toFixed(2)}</span>;
};

// character-by-character text reveal animation
const GsapTextReveal = ({ text, className }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      const chars = containerRef.current.querySelectorAll('.reveal-char');
      gsap.fromTo(chars, 
        { opacity: 0, y: 12, rotateX: -30 }, 
        { opacity: 1, y: 0, rotateX: 0, stagger: 0.015, duration: 0.5, ease: "power2.out" }
      );
    }
  }, [text]);

  return (
    <span ref={containerRef} className={`${className} inline-flex flex-wrap`}>
      {text.split("").map((char, i) => (
        <span 
          key={i} 
          className="reveal-char inline-block" 
          style={{ whiteSpace: char === ' ' ? 'pre' : 'normal' }}
        >
          {char}
        </span>
      ))}
    </span>
  );
};

// Service Card component with glowing circle border, hover elevation, and no color labels
const ServiceCard = memo(({ service }) => {
  const cardRef = useRef(null);
  const name = service.label.toLowerCase();
  
  let glowColor = "rgba(0, 217, 255, 0.4)"; // Default Cyan
  let hoverIconColor = "text-[#00D9FF]";
  
  if (name.includes("electricity")) {
    glowColor = "rgba(245, 158, 11, 0.4)"; // Amber
    hoverIconColor = "text-amber-400";
  } else if (name.includes("gas") || name.includes("cylinder")) {
    glowColor = "rgba(239, 68, 68, 0.4)"; // Rose
    hoverIconColor = "text-rose-400";
  } else if (name.includes("water") || name.includes("droplets")) {
    glowColor = "rgba(59, 130, 246, 0.4)"; // Blue
    hoverIconColor = "text-blue-400";
  } else if (name.includes("broadband") || name.includes("wifi")) {
    glowColor = "rgba(123, 97, 255, 0.4)"; // Purple
    hoverIconColor = "text-[#7B61FF]";
  } else if (name.includes("loan") || name.includes("emi")) {
    glowColor = "rgba(16, 185, 129, 0.4)"; // Emerald
    hoverIconColor = "text-emerald-400";
  }

  const handleMouseEnter = () => {
    if (isIOSDevice()) return;
    gsap.to(cardRef.current, {
      y: -8,
      scale: 1.03,
      borderColor: glowColor,
      boxShadow: `0 10px 30px -10px ${glowColor}`,
      duration: 0.3,
      ease: "power2.out"
    });
  };

  const handleMouseLeave = () => {
    if (isIOSDevice()) return;
    gsap.to(cardRef.current, {
      y: 0,
      scale: 1,
      borderColor: "var(--glass-border)",
      boxShadow: "none",
      duration: 0.3,
      ease: "power2.out"
    });
  };

  return (
    <Link to={service.path} className="gpu-accelerated tap-highlight-none service-card-item">
      <div 
        ref={cardRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="glass-card p-5 md:p-6 rounded-2xl border border-[var(--glass-border)] flex flex-col items-center gap-3 transition-all duration-300 group cursor-pointer relative overflow-hidden h-full"
      >
        {/* Glow backdrop grid */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-white/[0.03] pointer-events-none"></div>

        {/* Circular glowing borders wrapper */}
        <div className="w-14 h-14 rounded-full border border-[var(--glass-border)] flex items-center justify-center relative overflow-hidden bg-[var(--bg-tertiary)]/60 shadow-inner group-hover:border-[var(--glass-border-hover)] transition-all duration-300">
          <div className="absolute inset-0 bg-radial-gradient from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <service.icon className={`w-5 h-5 text-[var(--text-muted)] transition-all duration-300 ${hoverIconColor} group-hover:scale-110`} />
        </div>

        <div className="text-center space-y-1">
          <span className="text-[9px] md:text-[10px] font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-color)] uppercase tracking-wider block transition-colors duration-300">{service.label}</span>
          {service.subtitle && <span className="text-[6px] md:text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-tighter block">{service.subtitle}</span>}
        </div>
      </div>
    </Link>
  );
});

// Dynamic Transaction row with custom icons, provider info, and neon status badge
const TransactionItem = memo(({ txn, idx }) => {
  const rowRef = useRef(null);

  useEffect(() => {
    const isIOS = isIOSDevice();
    gsap.fromTo(rowRef.current, 
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, delay: isIOS ? 0 : idx * 0.04, duration: isIOS ? 0.2 : 0.5, ease: "power2.out" }
    );
  }, [idx]);

  const isRecharge = txn.type === 'RECHARGE';
  const isDebit = txn.direction === 'DEBIT';

  return (
    <div 
      ref={rowRef}
      className="px-5 py-4 flex justify-between items-center bg-[var(--bg-tertiary)]/20 border border-[var(--glass-border)] rounded-2xl hover:border-[var(--color-accent)]/20 hover:bg-[var(--bg-tertiary)]/40 transition-all duration-300 group gpu-accelerated"
    >
      <div className="flex items-center gap-4">
        {/* Glowing Circle Icon for Row */}
        <div className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all duration-300 ${
          isRecharge 
            ? 'bg-[var(--color-accent-glow)] text-[var(--color-accent)] border-[var(--color-accent)]/10 group-hover:bg-[var(--color-accent-glow)] group-hover:border-[var(--color-accent)]/30' 
            : 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30'
        }`}>
          {isRecharge ? <Smartphone className="w-4.5 h-4.5" /> : <Wallet className="w-4.5 h-4.5" />}
        </div>
        <div>
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide group-hover:text-[var(--color-accent)] transition-colors duration-300">
            {safeValue(txn.type)} <span className="text-[var(--text-muted)] mx-1.5">|</span> {txn.operator || 'Wallet'}
          </p>
          <p className="text-[8px] text-[var(--text-muted)] font-bold uppercase tracking-tight mt-0.5">
            {new Date(txn?.createdAt || Date.now()).toLocaleDateString()} • {safeValue(txn.mobile, 'Internal Transfer')}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-black tracking-tighter ${isDebit ? 'text-[var(--text-color)]' : 'text-emerald-400 emerald-glow'}`}>
          {isDebit ? '-' : '+'}₹{formatAmount(txn.amount)}
        </p>
        <span className={`text-[7px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md mt-1 inline-block border transition-colors duration-300 ${
          txn.status === 'SUCCESS' ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/15' : 
          txn.status === 'PENDING' ? 'bg-amber-500/5 text-amber-400 border-amber-500/15' : 
          'bg-rose-500/5 text-rose-400 border-rose-500/15'
        }`}>
          {safeValue(txn.status)}
        </span>
      </div>
    </div>
  );
});

// Interactive scan modal
const QRModal = memo(({ qrCode, amount, onClose }) => {
  return (
    <div className="fixed inset-0 bg-[var(--glass-bg)] backdrop-blur-md flex items-center justify-center z-[200] p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-modal p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-6 border border-[var(--glass-border)]"
      >
        <h3 className="text-lg font-black text-[var(--text-color)] uppercase italic tracking-tighter">Scan to <span className="text-[var(--color-accent)] cyan-glow">Pay</span></h3>
        <div className="bg-white p-4 rounded-2xl flex items-center justify-center">
          <img src={qrCode} alt="Payment QR" className="w-full aspect-square object-contain rounded-xl" />
        </div>
        <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wide">
          Scan using any UPI app to transfer ₹{formatAmount(amount)}
        </p>
        <button 
          onClick={onClose}
          className="w-full glass-button text-[var(--text-color)] py-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer"
        >
          Close Preview
        </button>
      </motion.div>
    </div>
  );
});

export default function Home() {
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrPreview, setQrPreview] = useState(null);
  
  // Real statistical computations on actual database records
  const [stats, setStats] = useState({
    totalSpent: 0,
    totalReceived: 0,
    successRate: 100,
    cashbackEarned: 0,
    totalCount: 0
  });

  const user = JSON.parse(localStorage.getItem('dizipay_user_data') || '{}');

  const welcomeRef = useRef(null);
  const shieldRef = useRef(null);
  const balanceCardRef = useRef(null);
  const serviceGridRef = useRef(null);
  const leftPanelColRef = useRef(null);
  const rightPanelColRef = useRef(null);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await api.get(API_ROUTES.USER.TRANSACTIONS);
      const txns = safeArray(res.data.data);
      setAllTransactions(txns);
      setRecentTransactions(txns.slice(0, 5));

      // Calculate statistics dynamically from actual database records
      const successTxns = txns.filter(t => t.status === 'SUCCESS');
      const spent = successTxns.filter(t => t.direction === 'DEBIT').reduce((acc, t) => acc + Number(t.amount || 0), 0);
      const received = successTxns.filter(t => t.direction === 'CREDIT').reduce((acc, t) => acc + Number(t.amount || 0), 0);
      const rate = txns.length > 0 ? (successTxns.length / txns.length) * 100 : 100;
      
      setStats({
        totalSpent: spent,
        totalReceived: received,
        successRate: rate,
        cashbackEarned: user.cashbackBalance || 0,
        totalCount: txns.length
      });

    } catch (err) {}
  }, [user.cashbackBalance]);

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
        setShowAddMoney(false);
        window.location.href = paymentUrl;
      } else if (qrImage) {
        setShowAddMoney(false);
        setQrPreview(qrImage);
      } else {
        toast.error("Payment could not be completed.");
      }

    } catch (err) {
      toast.error(err.safeMessage || "Payment could not be completed.");
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
      fetchTransactions();
    };

    socket.on('recharge_update', handleRechargeUpdate);
    socket.on('recharge_queued', handleRechargeUpdate);
    socket.on('recharge_processing', handleRechargeUpdate);
    socket.on('refund_completed', handleRechargeUpdate);
    socket.on('wallet_updated', () => {
      fetchWallet();
      fetchTransactions();
    });

    return () => {
      socket.off('recharge_update', handleRechargeUpdate);
      socket.off('recharge_queued', handleRechargeUpdate);
      socket.off('recharge_processing', handleRechargeUpdate);
      socket.off('refund_completed', handleRechargeUpdate);
      socket.off('wallet_updated');
    };
  }, [fetchTransactions, fetchWallet]);

  // Entrance reveals and continuous floating system
  useEffect(() => {
    const isIOS = isIOSDevice();
    // 1. Service Cards stagger
    if (serviceGridRef.current) {
      gsap.fromTo(serviceGridRef.current.querySelectorAll('.service-card-item'), 
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: isIOS ? 0.01 : 0.03, duration: isIOS ? 0.28 : 0.6, ease: "power2.out" }
      );
    }

    // 2. Welcome block animation
    gsap.fromTo(welcomeRef.current, 
      { opacity: 0, x: -30 }, 
      { opacity: 1, x: 0, duration: isIOS ? 0.3 : 0.8, ease: "power3.out" }
    );

    // 3. Balance Card animation
    gsap.fromTo(balanceCardRef.current, 
      { opacity: 0, x: 30 }, 
      { opacity: 1, x: 0, duration: isIOS ? 0.3 : 0.8, ease: "power3.out" }
    );

    // 4. Security Shield float rotation loop
    if (shieldRef.current && !isIOS) {
      gsap.to(shieldRef.current.querySelectorAll('.orbit-ring'), {
        rotation: 360,
        transformOrigin: "50% 50%",
        repeat: -1,
        duration: 12,
        ease: "none",
        stagger: 2
      });

      gsap.to(shieldRef.current, {
        y: -10,
        repeat: -1,
        yoyo: true,
        duration: 4,
        ease: "sine.inOut"
      });
    }

  }, []);

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

  // Dynamically map last 7 transactions into a path for the premium line graph
  const getGraphPoints = () => {
    if (allTransactions.length === 0) return { line: "M 0 80 Q 50 80, 100 80", area: "M 0 80 Q 50 80, 100 80 L 100 100 L 0 100 Z" };
    
    const chronological = [...allTransactions].slice(0, 7).reverse();
    const maxAmount = Math.max(...chronological.map(t => Number(t.amount || 0)), 100);
    
    const coordinates = chronological.map((t, i) => {
      const x = chronological.length > 1 ? (i / (chronological.length - 1)) * 100 : 50;
      const y = 90 - (Number(t.amount || 0) / maxAmount) * 70;
      return { x, y };
    });

    if (coordinates.length === 1) {
      return {
        line: `M 0 50 L 100 50`,
        area: `M 0 50 L 100 50 L 100 100 L 0 100 Z`
      };
    }

    const linePath = `M ${coordinates[0].x} ${coordinates[0].y} ` + coordinates.slice(1).map(c => `L ${c.x} ${c.y}`).join(" ");
    const areaPath = `${linePath} L 100 100 L 0 100 Z`;

    return { line: linePath, area: areaPath };
  };

  const graphPaths = getGraphPoints();

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-8 md:space-y-10 py-4 md:py-6 ios-scroll relative z-10 font-sans text-[var(--text-color)]"
    >
      {/* Hero / Wallet Segment */}
      <div className="flex flex-col lg:flex-row gap-8 relative z-10">
        
        {/* Left Welcome Segment */}
        <div ref={welcomeRef} className="flex-1 glass-card rounded-3xl p-8 md:p-10 border border-[var(--glass-border)] shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[300px]">
          
          {/* Subtle grid backdrop */}
          <div className="absolute inset-0 neural-grid opacity-10 pointer-events-none"></div>

          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--color-accent-glow)] border border-[var(--color-accent)]/20 rounded-full shadow-[0_0_15px_var(--color-accent-glow)]">
              <Cpu className="w-3.5 h-3.5 text-[#00D9FF] animate-pulse" />
              <span className="text-[8px] font-black text-[#00D9FF] uppercase tracking-[0.2em] cyan-glow">Secure node authorized</span>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl md:text-5xl font-black text-[var(--text-color)] tracking-tight uppercase italic leading-[1.05]">
                <GsapTextReveal text="DIGITAL WALLET" className="text-[var(--text-color)]" />
              </h1>
              <p className="text-[var(--text-secondary)] text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em]">
                irecharge Mission Control • <span className="text-[var(--text-color)]">Operator {user.name || 'Admin'}</span>
              </p>
            </div>
          </div>

          <div className="pt-8 border-t border-[var(--glass-border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#00FFA3] animate-pulse shadow-[0_0_8px_#00FFA3]"></div>
              <div>
                <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Network latency</p>
                <p className="text-sm font-black text-[var(--text-color)] mt-0.5">12 ms</p>
              </div>
            </div>
            <div>
              <span className="text-[8px] font-black text-[var(--color-accent)] uppercase tracking-[0.2em] border border-[var(--color-accent)]/20 bg-[var(--color-accent-glow)] px-3 py-1.5 rounded-full cyan-glow">
                System Active
              </span>
            </div>
          </div>
        </div>

        {/* Right Shield & Balance Container */}
        <div ref={balanceCardRef} className="lg:w-[480px] flex flex-col md:flex-row gap-6">
          
          {/* Security Shield Illustration */}
          <div ref={shieldRef} className="flex-1 md:w-36 bg-[var(--glass-card-bg)] border border-[var(--glass-border)] rounded-3xl p-6 flex flex-col items-center justify-center relative overflow-hidden min-h-[220px]">
            <div className="absolute inset-0 bg-radial-gradient from-[var(--color-primary-glow)] to-transparent pointer-events-none opacity-40"></div>
            
            {/* Animated SVG Shield */}
            <svg className="w-24 h-24 overflow-visible relative z-10" viewBox="0 0 100 100">
              <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              {/* Outer Orbit */}
              <circle className="orbit-ring stroke-[var(--color-primary)] opacity-30" cx="50" cy="50" r="42" fill="none" strokeWidth="1" strokeDasharray="5,15" />
              {/* Inner Orbit */}
              <circle className="orbit-ring stroke-[var(--color-accent)] opacity-40" cx="50" cy="50" r="34" fill="none" strokeWidth="1.5" strokeDasharray="30,10" />
              {/* Center Core Shield */}
              <path d="M50 15 L25 25 V45 C25 65 50 82 50 82 C50 82 75 65 75 45 V25 L50 15 Z" fill="var(--color-primary-glow)" stroke="var(--color-primary)" strokeWidth="2" filter="url(#glow)" className="opacity-80" />
              <path d="M50 22 L32 30 V45 C32 60 50 74 50 74 C50 74 68 60 68 45 V30 L50 22 Z" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="4,4" />
            </svg>
            <span className="text-[8px] font-black text-[var(--text-secondary)] tracking-widest mt-4">SHIELD ACTIVE</span>
          </div>

          {/* Premium Wallet Balance Card */}
          <div className="flex-1 md:w-64 bg-gradient-to-br from-[var(--color-primary-glow)] via-[var(--glass-card-bg)] to-[var(--color-accent-glow)] border border-[var(--glass-border)] rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[220px]">
            {/* Moving Gradient Wave effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--color-accent-glow)] to-transparent -translate-x-full animate-wave pointer-events-none opacity-20"></div>

            <div className="flex justify-between items-start relative z-10">
              <div className="w-12 h-12 bg-[var(--bg-tertiary)]/60 rounded-xl flex items-center justify-center border border-[var(--glass-border)]">
                <Wallet className="w-6 h-6 text-[var(--color-accent)]" />
              </div>
              <button 
                onClick={() => setShowAddMoney(true)}
                className="w-10 h-10 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/80 text-white rounded-lg flex items-center justify-center shadow-lg shadow-[var(--color-accent)]/25 active:scale-90 hover:scale-105 transition-all duration-300 cursor-pointer"
              >
                <Plus className="w-5 h-5 stroke-[3]" />
              </button>
            </div>

            <div className="mt-8 relative z-10">
              <p className="text-[8px] text-[var(--text-secondary)] uppercase font-black tracking-widest mb-1">AVAILABLE BALANCE</p>
              <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-[var(--text-color)] flex items-baseline gap-1">
                <span className="text-xl text-[var(--color-accent)] font-bold">₹</span>
                <span className="cyan-glow font-mono">
                  <AnimatedCounter value={wallet?.balance} />
                </span>
              </h2>
            </div>
          </div>

        </div>
      </div>

      {/* Services Grid */}
      <div className="space-y-6 relative z-10">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.4em]">
            <GsapTextReveal text="TERMINAL SERVICES" className="text-[var(--text-secondary)]" />
          </h3>
          <span className="h-[1px] flex-1 bg-[var(--glass-border)] mx-6 hidden md:block"></span>
        </div>
        <div ref={serviceGridRef} className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {services.map((service, idx) => (
            <ServiceCard key={idx} service={service} />
          ))}
        </div>
      </div>

      {/* Bottom Main Content Panel Splits */}
      <div className="grid lg:grid-cols-12 gap-8 relative z-10">
        
        {/* Left Side: Ledger History and Monthly Graph */}
        <div ref={leftPanelColRef} className="lg:col-span-8 space-y-8">
          
          {/* Live Transactions Panel */}
          <div className="glass-card border border-[var(--glass-border)] rounded-3xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--bg-tertiary)]/20">
              <h2 className="text-[10px] font-black text-[var(--text-color)] uppercase tracking-widest flex items-center gap-3">
                <HistoryIcon className="w-4 h-4 text-[var(--color-accent)] animate-pulse" />
                <GsapTextReveal text="LEDGER SIGNALS" className="text-[var(--text-color)]" />
              </h2>
              <Link to="/reports/transactions" className="text-[9px] font-black text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 uppercase tracking-widest flex items-center gap-2 transition-colors duration-300">
                View Ledger <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="p-4 space-y-3">
              {recentTransactions.length > 0 ? recentTransactions.map((txn, idx) => (
                <TransactionItem key={txn.id || idx} txn={txn} idx={idx} />
              )) : (
                <div className="py-16 text-center bg-[var(--bg-tertiary)]/10 rounded-2xl border border-[var(--glass-border)] border-dashed">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">No activity found</p>
                </div>
              )}
            </div>
          </div>

          {/* Monthly Overview Panel */}
          <div className="glass-card border border-[var(--glass-border)] rounded-3xl p-6 md:p-8 space-y-6">
            <div className="flex justify-between items-center border-b border-[var(--glass-border)] pb-4">
              <h3 className="text-[10px] font-black text-[var(--text-color)] uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--color-primary)]" />
                <GsapTextReveal text="MONTHLY TELEMETRY" className="text-[var(--text-color)]" />
              </h3>
              <span className="text-[7px] px-2.5 py-1 bg-[var(--color-primary-glow)] text-[var(--color-primary)] font-black border border-[var(--color-primary)]/20 rounded-lg uppercase tracking-wider">
                REALTIME SOURCE
              </span>
            </div>

            {/* Dynamic Metric Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[var(--bg-tertiary)]/20 p-4 rounded-2xl border border-[var(--glass-border)]">
                <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Total Spent</p>
                <p className="text-lg font-black text-[var(--text-color)] font-mono mt-1">₹{formatAmount(stats.totalSpent)}</p>
              </div>
              <div className="bg-[var(--bg-tertiary)]/20 p-4 rounded-2xl border border-[var(--glass-border)]">
                <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Total Received</p>
                <p className="text-lg font-black text-[#00FFA3] font-mono mt-1">₹{formatAmount(stats.totalReceived)}</p>
              </div>
              <div className="bg-[var(--bg-tertiary)]/20 p-4 rounded-2xl border border-[var(--glass-border)]">
                <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Success Rate</p>
                <p className="text-lg font-black text-[var(--color-accent)] font-mono mt-1">{stats.successRate.toFixed(1)}%</p>
              </div>
              <div className="bg-[var(--bg-tertiary)]/20 p-4 rounded-2xl border border-[var(--glass-border)]">
                <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Transactions</p>
                <p className="text-lg font-black text-[var(--text-secondary)] font-mono mt-1">{stats.totalCount}</p>
              </div>
            </div>

            {/* Glowing Chart Visual */}
            <div className="bg-[var(--bg-tertiary)]/45 p-6 rounded-2xl border border-[var(--glass-border)] relative overflow-hidden">
              <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none"></div>
              <div className="h-40 w-full relative flex items-end">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={graphPaths.area} fill="url(#chartGrad)" />
                  <path d={graphPaths.line} fill="none" stroke="url(#cyanGrad)" strokeWidth="2.5" />
                </svg>
              </div>
              <div className="flex justify-between mt-3 text-[8px] font-black text-[var(--text-muted)] uppercase tracking-wider">
                <span>Signal Start</span>
                <span>Active Cycle</span>
                <span>Signal End</span>
              </div>
            </div>

          </div>

        </div>

        {/* Right Side: System Status Panel */}
        <div ref={rightPanelColRef} className="lg:col-span-4 space-y-6">
          
          <div className="glass-card border border-[var(--glass-border)] rounded-3xl p-6 md:p-8 space-y-6">
            <div className="border-b border-[var(--glass-border)] pb-4 flex justify-between items-center">
              <h3 className="text-[10px] font-black text-[var(--text-color)] uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#00FFA3] animate-pulse" />
                <GsapTextReveal text="SYSTEM MONITOR" className="text-[var(--text-color)]" />
              </h3>
              <div className="w-2.5 h-2.5 bg-[#00FFA3] rounded-full animate-ping"></div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-[var(--bg-tertiary)]/20 border border-[var(--glass-border)] rounded-2xl flex items-center justify-between hover:border-emerald-500/20 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#00FFA3] rounded-full animate-pulse shadow-[0_0_10px_#00FFA3]"></div>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">API Gateway</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-[#00FFA3]">99.98%</p>
                  <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase">LATENCY 12ms</p>
                </div>
              </div>

              <div className="p-4 bg-[var(--bg-tertiary)]/20 border border-[var(--glass-border)] rounded-2xl flex items-center justify-between hover:border-emerald-500/20 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#00FFA3] rounded-full animate-pulse shadow-[0_0_10px_#00FFA3]"></div>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Payment Engine</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-[#00FFA3]">100%</p>
                  <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase">QUEUE SUCCESS</p>
                </div>
              </div>

              <div className="p-4 bg-[var(--bg-tertiary)]/20 border border-[var(--glass-border)] rounded-2xl flex items-center justify-between hover:border-emerald-500/20 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#00FFA3] rounded-full animate-pulse shadow-[0_0_10px_#00FFA3]"></div>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Database Sync</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-[var(--text-secondary)]">Atomic</p>
                  <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase">LEDGER SECURED</p>
                </div>
              </div>

              <div className="p-4 bg-[var(--bg-tertiary)]/20 border border-[var(--glass-border)] rounded-2xl flex items-center justify-between hover:border-[var(--color-primary)]/20 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-pulse shadow-[0_0_10px_var(--color-primary-glow)]"></div>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Smart Router</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-[var(--color-primary)]">Active</p>
                  <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase">4 CHANNELS</p>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Add Money Modal */}
      <AnimatePresence mode="wait">
        {showAddMoney && (
          <div className="fixed inset-0 bg-[var(--glass-bg)] backdrop-blur-md flex items-center justify-center z-50 p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-modal p-8 md:p-10 w-full max-w-lg shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative border border-[var(--glass-border)] rounded-3xl"
            >
              <div className="absolute top-0 right-0 p-6">
                <button onClick={() => setShowAddMoney(false)} className="text-[var(--text-muted)] hover:text-[var(--text-color)] transition-colors cursor-pointer">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <h2 className="text-2xl font-black text-[var(--text-color)] uppercase italic tracking-tighter">Add <span className="text-[var(--color-accent)] cyan-glow">Money</span></h2>
                <div className="space-y-4">
                  <div className="relative">
                    <input 
                      type="number" 
                      placeholder="0.00" 
                      value={amount} 
                      onChange={(e) => setAmount(e.target.value)} 
                      className="w-full glass-input p-5 text-[var(--text-color)] text-2xl font-black tracking-tighter outline-none focus:border-[var(--color-accent)] transition-all bg-[var(--glass-input-bg)]"
                    />
                    <span className="absolute right-5 top-1/2 transform -translate-y-1/2 text-[var(--text-muted)] font-bold uppercase text-xs">INR</span>
                  </div>
                  
                  <button 
                    onClick={handleAddMoney}
                    disabled={loading || !amount}
                    className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/80 text-white py-4.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-[var(--color-accent)]/25 tap-highlight-none active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all duration-300 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[var(--bg-primary)] border-t-transparent rounded-full animate-spin"></div>
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

      {/* QR Code Preview Modal */}
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
