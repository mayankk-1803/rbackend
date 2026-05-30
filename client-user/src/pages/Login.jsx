import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { Loader2, ArrowRight, Smartphone, Mail, Lock, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import OTPInput from '../components/OTPInput';

export default function Login() {
  const [authMethod, setAuthMethod] = useState('phone'); // 'phone' or 'email'
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const reason = sessionStorage.getItem('dizipay_logout_reason');
    if (reason === 'inactivity') {
      toast.error("Session expired due to inactivity. Please login again.");
      sessionStorage.removeItem('dizipay_logout_reason');
    }

    // Check if already authenticated
    const token = sessionStorage.getItem('dizipay_user_token');
    const user = JSON.parse(sessionStorage.getItem('dizipay_user_data') || '{}');
    if (token && user.id) {
      navigate('/dashboard', { replace: true });
    }

    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer, navigate]);

  const handleSendOTP = async () => {
    if (phone.length < 10) return toast.error("Enter valid phone number");
    
    setLoading(true);
    try {
      const formatPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      await api.post('/auth/send-otp', { phone: formatPhone });
      setConfirmationResult(true);
      setTimer(60);
      toast.success("OTP sent successfully");
    } catch (err) {
      toast.error(err?.safeMessage || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndLogin = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) return toast.error("Enter 6-digit OTP");
    
    setLoading(true);
    try {
      const formatPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.log(`[AUTH][LOGIN_REQUEST] → Verifying OTP for: ${formatPhone}`);
      }
      const res = await api.post('/auth/verify-otp', { code: otpCode, phone: formatPhone });
      
      if (res.data?.success) {
        if (import.meta.env.DEV) {
          if (import.meta.env.DEV) console.log("[AUTH][OTP_VERIFIED] → Response success: true");
        }
        handleAuthSuccess(res.data.data);
      } else {
        if (import.meta.env.DEV) {
          if (import.meta.env.DEV) console.warn("[AUTH][OTP_FAILED] → Response success: false", res.data?.message);
        }
        throw new Error(res.data?.message || "Invalid OTP");
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.error("[AUTH][FRONTEND_STATE_FAILED] → Error during OTP verification:", err);
      }
      toast.error(err.safeMessage || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Email and password required");

    setLoading(true);
    try {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.log(`[AUTH][LOGIN_REQUEST] → Email login for: ${email}`);
      }
      const res = await api.post('/auth/login-email', { email, password });
      
      if (res.data?.success) {
        if (import.meta.env.DEV) {
          if (import.meta.env.DEV) console.log("[AUTH][PASSWORD_MATCH] → Response success: true");
        }
        handleAuthSuccess(res.data.data);
      } else {
        if (import.meta.env.DEV) {
          if (import.meta.env.DEV) console.warn("[AUTH][PASSWORD_MATCH_FAILED] → Response success: false", res.data?.message);
        }
        throw new Error(res.data?.message || "Invalid credentials");
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.error("[AUTH][FRONTEND_STATE_FAILED] → Error during email login:", err);
      }
      toast.error(err.safeMessage || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = (apiData) => {
    if (apiData?.token) {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.log("[AUTH][TOKEN_STORED] → Saving token to localStorage...");
      }
      sessionStorage.setItem('dizipay_user_token', apiData.token);
      sessionStorage.setItem('dizipay_user_data', JSON.stringify(apiData.user));
      localStorage.setItem('dizipay_last_activity', Date.now().toString());
      
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.log("[AUTH][AUTH_STATE_UPDATED] → User data stored:", apiData.user.id);
        if (import.meta.env.DEV) console.log("[AUTH][REDIRECT_SUCCESS] → Navigating to Home...");
      }
      
      window.location.href = '/dashboard';
    } else {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.error("[AUTH][TOKEN_MISSING] → apiData was received but token is missing!");
      }
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-color)] flex flex-col justify-center items-center p-4 relative overflow-hidden font-['Inter'] transition-colors duration-300">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[140px]"></div>
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full relative z-10"
      >
        <div className="glass-card p-8 rounded-[2.5rem] shadow-[var(--glass-shadow)] border border-[var(--glass-border)] bg-[var(--glass-card-bg)]">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
              <ShieldCheck className="w-6 h-6 text-cyan-400" />
            </div>
            <h2 className="text-3xl font-black text-[var(--text-color)] tracking-tight italic uppercase">
              SECURE LOGIN
            </h2>
            <p className="text-[var(--text-secondary)] text-sm mt-2">Access your Dizipay account</p>
          </div>

          {/* Auth Method Tabs */}
          <div className="flex p-1 bg-[var(--bg-secondary)]/60 rounded-2xl mb-8 border border-[var(--glass-border)]">
            <button
              onClick={() => { setAuthMethod('phone'); setConfirmationResult(null); }}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${
                authMethod === 'phone' ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-555 text-[var(--color-accent)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              Mobile OTP
            </button>
            <button
              onClick={() => setAuthMethod('email')}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${
                authMethod === 'email' ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-555 text-[var(--color-accent)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              Email Password
            </button>
          </div>

          <AnimatePresence mode="wait">
            {authMethod === 'phone' ? (
              <motion.div
                key="phone-auth"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {!confirmationResult ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1">Phone Number</label>
                      <div className="flex gap-2">
                        <div className="flex-none w-16 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl flex items-center justify-center text-sm font-bold text-[var(--text-secondary)]">
                          +91
                        </div>
                        <div className="flex-1 relative">
                          <input
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="w-full pl-4 pr-10 py-4 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all placeholder:text-[var(--text-muted)]"
                            placeholder="98********"
                          />
                          <Smartphone className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleSendOTP}
                      disabled={loading || phone.length < 10}
                      className="w-full py-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-2xl text-sm font-black tracking-widest shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <>
                          SEND OTP
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleVerifyAndLogin} className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">Verification</label>
                        <button type="button" onClick={() => setConfirmationResult(null)} className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer">CHANGE</button>
                      </div>
                      <OTPInput value={otpCode} onChange={setOtpCode} length={6} color="cyan" />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || otpCode.length < 6}
                      className="w-full py-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-2xl text-sm font-black tracking-widest shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'VERIFY & LOGIN'}
                    </button>
                    <div className="text-center">
                      {timer > 0 ? (
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Resend in {timer}s</p>
                      ) : (
                        <button type="button" onClick={handleSendOTP} className="text-[10px] font-black text-cyan-400 hover:text-cyan-300 uppercase tracking-widest cursor-pointer">RESEND OTP</button>
                      )}
                    </div>
                  </form>
                )}
              </motion.div>
            ) : (
              <motion.form
                key="email-auth"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleEmailLogin}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all placeholder:text-[var(--text-muted)]"
                      placeholder="name@example.com"
                    />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">Password</label>
                    <Link to="/forgot-password" className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer uppercase tracking-wider">Forgot Password?</Link>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all placeholder:text-[var(--text-muted)]"
                      placeholder="••••••••"
                    />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-2xl text-sm font-black tracking-widest shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      LOGIN ACCOUNT
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-8 pt-8 border-t border-[var(--glass-border)] text-center">
            <span className="text-[var(--text-secondary)] text-sm">New to Dizipay? </span>
            <Link to="/register" className="text-cyan-400 font-bold hover:underline underline-offset-4">Create Account</Link>
          </div>
        </div>
        
        <p className="mt-8 text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em]">
          Dizipay Security Infrastructure v2.0
        </p>
      </motion.div>
    </div>
  );
}
