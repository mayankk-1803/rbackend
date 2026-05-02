import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import toast from 'react-hot-toast';
import { Phone, Mail, Lock, Loader2, ArrowRight, Smartphone, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPhoneLogin, setIsPhoneLogin] = useState(true);
  const [timer, setTimer] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleSendOTP = async () => {
    if (phone.length < 10) return toast.error("Enter valid phone number", { className: 'hot-toast-cyber' });
    
    setLoading(true);
    try {
      const formatPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      await api.post('/auth/send-otp', { phone: formatPhone });
      setConfirmationResult(true);
      setTimer(60);
      toast.success("OTP sent successfully", { className: 'hot-toast-cyber hot-toast-success' });
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to send OTP", { className: 'hot-toast-cyber hot-toast-error' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndLogin = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 4) return toast.error("Enter 4-digit OTP", { className: 'hot-toast-cyber' });
    
    setLoading(true);
    try {
      const formatPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      const res = await api.post('/auth/verify-otp', { otpCode, phone: formatPhone });

      if (res.data.success) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        toast.success('Welcome back!', { className: 'hot-toast-cyber hot-toast-success' });
        window.location.href = '/';
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid OTP or Verification failed", { className: 'hot-toast-cyber hot-toast-error' });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if(!email || !password) return;
    
    setLoading(true);
    try {
      const { data } = await api.post(API_ROUTES.AUTH.LOGIN, { email, password });
      const { token, user } = data.data;
      
      if (user.role !== 'user') {
        toast.error('Unauthorized access', { className: 'hot-toast-cyber' });
        return;
      }
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      toast.success('Successfully logged in', { className: 'hot-toast-cyber hot-toast-success' });
      window.location.href = '/';
    } catch(err) {
      toast.error(err.response?.data?.message || 'Authentication failed', { className: 'hot-toast-cyber hot-toast-error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030014] flex flex-col justify-center items-center p-4 relative overflow-hidden font-['Inter']">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px]"></div>
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-40 left-1/4 w-[700px] h-[700px] bg-indigo-600/10 rounded-full blur-[150px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full relative z-10"
      >
        <div className="bg-white/[0.03] backdrop-blur-2xl p-8 border border-white/10 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.3)]">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-[#6D28D9]/20 to-[#8B5CF6]/20 border border-[#6D28D9]/30 mb-4">
              {isPhoneLogin ? <Smartphone className="w-6 h-6 text-[#A78BFA]" /> : <Mail className="w-6 h-6 text-[#A78BFA]" />}
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight italic">
              {isPhoneLogin ? 'OTP LOGIN' : 'WELCOME'}
            </h2>
            <p className="text-slate-400 text-sm mt-2">Access your Dizipay account securely</p>
          </div>

          <AnimatePresence mode="wait">
            {isPhoneLogin ? (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {!confirmationResult ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Phone Number</label>
                      <div className="flex gap-2">
                        <div className="flex-none w-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-sm font-bold text-slate-400">
                          +91
                        </div>
                        <div className="flex-1 relative">
                          <input
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-medium outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9] transition-all placeholder:text-slate-700"
                            placeholder="9876543210"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleSendOTP}
                      disabled={loading || phone.length < 10}
                      className="w-full py-4 bg-gradient-to-r from-[#6D28D9] to-[#8B5CF6] text-white rounded-2xl text-sm font-black tracking-widest shadow-lg shadow-[#6D28D9]/20 hover:shadow-[#6D28D9]/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
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
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Verification</label>
                        <button type="button" onClick={() => setConfirmationResult(null)} className="text-[10px] font-bold text-[#A78BFA] hover:text-white transition-colors">CHANGE</button>
                      </div>
                      <div className="relative">
                        <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <input
                          type="text"
                          value={otpCode}
                          onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-2xl font-black tracking-[0.5em] outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9] transition-all placeholder:text-slate-800"
                          placeholder="0000"
                          autoFocus
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading || otpCode.length < 4}
                      className="w-full py-4 bg-gradient-to-r from-[#6D28D9] to-[#8B5CF6] text-white rounded-2xl text-sm font-black tracking-widest shadow-lg shadow-[#6D28D9]/20 hover:shadow-[#6D28D9]/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'VERIFY & LOGIN'}
                    </button>
                    <div className="text-center">
                      {timer > 0 ? (
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          Resend in <span className="text-white">{timer}s</span>
                        </p>
                      ) : (
                        <button type="button" onClick={handleSendOTP} className="text-[10px] font-black text-[#A78BFA] hover:text-white transition-colors uppercase tracking-widest">RESEND OTP</button>
                      )}
                    </div>
                  </form>
                )}
              </motion.div>
            ) : (
              <motion.form
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
                onSubmit={handleEmailLogin}
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9] transition-all"
                      placeholder="name@example.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9] transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-[#6D28D9] to-[#8B5CF6] text-white rounded-2xl text-sm font-black tracking-widest shadow-lg shadow-[#6D28D9]/20 hover:shadow-[#6D28D9]/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'SIGN IN'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-8 flex flex-col items-center gap-6">
            <button 
              onClick={() => { setIsPhoneLogin(!isPhoneLogin); setConfirmationResult(null); }}
              className="text-[10px] font-black text-slate-500 hover:text-white transition-colors uppercase tracking-[0.2em] border-b border-white/10 pb-1"
            >
              {isPhoneLogin ? 'Login with Email instead' : 'Login with Phone OTP instead'}
            </button>
            
            <div className="text-sm font-medium">
              <span className="text-slate-500">Don't have an account? </span>
              <Link to="/register" className="text-[#A78BFA] hover:text-white transition-colors underline underline-offset-4">Sign Up</Link>
            </div>
          </div>
        </div>
        
        {/* Footer info */}
        <div className="mt-8 text-center">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em]">
            Powered by Dizipay Secure
          </p>
        </div>
      </motion.div>
    </div>
  );
}

