import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ShieldCheck, Mail, Lock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const reason = sessionStorage.getItem('dizipay_admin_logout_reason');
    if (reason === 'inactivity') {
      toast.error("Session expired due to inactivity. Please login again.");
      sessionStorage.removeItem('dizipay_admin_logout_reason');
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if(!email || !password) return;
    
    setLoading(true);
    try {
      console.log(`[AUTH][LOGIN_REQUEST] → Admin email login for: ${email}`);
      const res = await api.post('/auth/login-email', { email, password }, {
        headers: { 'x-admin-request': 'true' }
      });
      
      console.log("[AUTH][LOGIN_RESPONSE] → Received:", res.data);
      
      const success = res.data?.success;
      const apiData = res.data?.data || res.data; // Bridge for both formats

      if (success && apiData?.token) {
        console.log("[AUTH][JWT_GENERATED] → Token exists in response.");
        
        sessionStorage.setItem('dizipay_admin_token', apiData.token);
        sessionStorage.setItem('dizipay_admin_data', JSON.stringify(apiData.user));
        localStorage.setItem('dizipay_admin_last_activity', Date.now().toString());
        
        console.log("[AUTH][TOKEN_STORED] → Admin token saved.");
        console.log("[AUTH][REDIRECT_SUCCESS] → Redirecting to Admin Dashboard...");

        toast.success('Admin authenticated');
        
        navigate("/", { replace: true });
      } else {
        console.error("[AUTH][LOGIN_FAILED] → Response success was false or token missing.");
        throw new Error(res.data?.message || "Admin authentication failed");
      }
    } catch(err) {
      console.error("[AUTH][FRONTEND_STATE_FAILED] → Fatal error during admin login:", err);
      toast.error(err.response?.data?.message || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-color)] flex flex-col justify-center items-center p-4 relative overflow-hidden font-['Inter'] transition-colors duration-200">
      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-md w-full relative z-10"
      >
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] p-8 md:p-10 rounded-2xl shadow-soft">
          <div className="flex flex-col items-center justify-center mb-8">
            <div className="w-12 h-12 bg-[var(--color-primary-glow)] rounded-xl flex items-center justify-center mb-4 border border-[var(--border-soft)]">
              <ShieldCheck className="w-6 h-6 text-[var(--color-primary)]" />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Dizipay Admin</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1.5 text-center">Secure access to enterprise admin console</p>
          </div>
          
          <form className="space-y-5" onSubmit={handleLogin}>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Administrator Email</label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] group-focus-within:text-[var(--color-primary)] transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-focus-ring)] focus:border-[var(--color-primary)] transition-all"
                  placeholder="admin@dizipay.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Password</label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] group-focus-within:text-[var(--color-primary)] transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-focus-ring)] focus:border-[var(--color-primary)] transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[var(--color-primary)] text-[var(--bg-primary)] font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 mt-4 cursor-pointer"
            >
              <div className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Secure Sign In'
                )}
              </div>
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[var(--border-soft)] text-center">
            <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-widest font-medium opacity-80">
              Enterprise Grade security
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
