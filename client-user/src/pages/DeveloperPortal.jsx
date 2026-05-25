import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Code2, 
  Key, 
  Activity, 
  Book, 
  Copy, 
  RefreshCw, 
  ShieldAlert, 
  Zap,
  ChevronRight,
  Search,
  Lock,
  Eye,
  EyeOff,
  Terminal,
  UserCheck,
  Mail
} from 'lucide-react';
import ApiDocs from '../components/developer/ApiDocs';
import ApiKeyManager from '../components/developer/ApiKeyManager';
import ApiAnalytics from '../components/developer/ApiAnalytics';
import api from '../api';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'docs', name: 'Documentation', icon: Book },
  { id: 'keys', name: 'API Credentials', icon: Key },
  { id: 'analytics', name: 'Analytics', icon: Activity }
];

export default function DeveloperPortal() {
  const [activeTab, setActiveTab] = useState('docs');
  const [searchQuery, setSearchQuery] = useState('');
  const [isVerified, setIsVerified] = useState(
    !!sessionStorage.getItem('dizipay_developer_token')
  );
  
  // Modal states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const handleExpired = () => {
      setIsVerified(false);
      sessionStorage.removeItem('dizipay_developer_token');
      toast.error('Developer session expired or invalid. Please verify again.');
    };

    window.addEventListener('developer_session_expired', handleExpired);

    // Hardening: Verify token validity on load if initially marked as verified
    const verifyOnMount = async () => {
      const devToken = sessionStorage.getItem('dizipay_developer_token');
      const userToken = localStorage.getItem('dizipay_user_token');
      
      if (!devToken || !userToken) {
        setIsVerified(false);
        sessionStorage.removeItem('dizipay_developer_token');
        return;
      }
      
      try {
        await api.get('/developer/manifest');
      } catch (err) {
        if (err.response?.status === 403 || err.response?.status === 401) {
          setIsVerified(false);
          sessionStorage.removeItem('dizipay_developer_token');
          toast.error('Developer session expired or invalid. Please verify again.');
        }
      }
    };

    if (isVerified) {
      verifyOnMount();
    }

    return () => window.removeEventListener('developer_session_expired', handleExpired);
  }, [isVerified]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifying(true);
    setErrorMsg('');

    try {
      const payload = { email, password };

      const res = await api.post('/developer/verify-access', payload);
      
      if (res.data?.success && res.data?.devToken) {
        sessionStorage.setItem('dizipay_developer_token', res.data.devToken);
        setIsVerified(true);
        toast.success('Developer access verified!');
      } else {
        throw new Error(res.data?.message || 'Access denied');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Verification failed';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  if (!isVerified) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center z-50 p-4 developer-portal-main">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card max-w-md w-full border border-cyan-500/20 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden"
        >
          {/* Glowing Ambient light */}
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>

          <div className="relative z-10 space-y-6">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 flex items-center justify-center mb-2">
                <Terminal className="w-7 h-7 text-cyan-400" />
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">
                Developer <span className="text-cyan-400 cyan-glow">Authorization</span>
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                Verification required to access API documentation and developer tools.
              </p>
              <p className="text-[9px] text-slate-500 font-semibold tracking-wider uppercase">
                Authorized developer access only.
              </p>
            </div>

            {/* Input Form */}
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-4 w-4 h-4 text-slate-500" />
                  <input 
                    type="email" 
                    required
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.trim())}
                    className="w-full pl-11 pr-4 py-4 bg-slate-950/40 border border-white/5 rounded-2xl text-xs font-bold text-white focus:outline-none focus:border-cyan-500 transition-all placeholder:text-slate-600 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 w-4 h-4 text-slate-500" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-4 bg-slate-950/40 border border-white/5 rounded-2xl text-xs font-bold text-white focus:outline-none focus:border-cyan-500 transition-all placeholder:text-slate-600 font-mono"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 p-1 hover:bg-white/5 rounded-lg transition-all cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3">
                  <ShieldAlert className="w-4 h-4 text-rose-450 mt-0.5 shrink-0" />
                  <span className="text-[10px] font-bold text-rose-400 leading-normal">{errorMsg}</span>
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button 
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 py-4 bg-slate-950/60 border border-white/5 text-slate-400 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:text-white hover:border-white/10 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={verifying}
                  className="flex-1 py-4 bg-cyan-400 text-slate-950 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {verifying ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'Verify Access'
                  )}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 relative z-10 developer-portal-main">
      {/* Header Section */}
      <div className="relative overflow-hidden glass-card border border-[var(--glass-border)] rounded-[2.5rem] p-8 mb-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/20">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Developer Hub v1.0</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-[var(--text-color)] uppercase tracking-tighter italic">
              Empower Your <span className="text-cyan-400 cyan-glow">Integration</span>
            </h1>
            <p className="text-[var(--text-secondary)] text-sm max-w-xl font-medium leading-relaxed">
              Access real-time recharge, wallet, and payment infrastructure. Our enterprise APIs are designed for high-throughput and absolute reliability.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-[var(--glass-navbar-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-3xl p-4 sticky top-8">
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input 
                type="text" 
                placeholder="Search APIs..."
                className="w-full pl-11 pr-4 py-3 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-xs font-bold text-[var(--text-color)] focus:outline-none focus:border-cyan-500 transition-all placeholder:text-[var(--text-muted)]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <nav className="space-y-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group cursor-pointer ${
                      isActive 
                        ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20' 
                        : 'text-[var(--text-secondary)] hover:bg-[var(--glass-button-bg)] hover:text-[var(--text-color)] hover:border-[var(--glass-border)] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-[var(--text-muted)] group-hover:text-cyan-400'}`} />
                      <span className="text-[11px] font-black uppercase tracking-widest">{tab.name}</span>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4 text-slate-950" />}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-9">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'docs' && <ApiDocs searchQuery={searchQuery} isDeveloperVerified={isVerified} />}
              {activeTab === 'keys' && <ApiKeyManager isDeveloperVerified={isVerified} />}
              {activeTab === 'analytics' && <ApiAnalytics isDeveloperVerified={isVerified} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
