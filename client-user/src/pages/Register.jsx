import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import toast from 'react-hot-toast';
import { Phone, User, Mail, Tag, MessageSquare, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Register() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const sendOTP = async () => {
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
      const res = await api.post('/auth/verify-otp', { 
        otpCode, 
        phone: formatPhone,
        name,
        email,
        referralCode 
      });

      if (res.data.success) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        toast.success(res.data.isNewUser ? 'Account created successfully' : 'Welcome back!', { className: 'hot-toast-cyber hot-toast-success' });
        window.location.href = '/';
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Invalid OTP or Verification failed", { className: 'hot-toast-cyber hot-toast-error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 relative overflow-hidden font-['Inter']">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[140px]"></div>
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-40 left-1/4 w-[700px] h-[700px] bg-indigo-500/5 rounded-full blur-[150px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full relative z-10"
      >
        <div className="bg-white/70 backdrop-blur-2xl p-8 border border-slate-200 rounded-[2.5rem] shadow-xl">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-2xl bg-cyan-50 border border-cyan-100 mb-4">
              <ShieldCheck className="w-6 h-6 text-cyan-600" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight italic">GET STARTED</h2>
            <p className="text-slate-500 text-sm mt-2">Experience lightning fast fintech solutions</p>
          </div>
          
          <AnimatePresence mode="wait">
            {!confirmationResult ? (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Phone Number</label>
                  <div className="flex gap-2">
                    <div className="flex-none w-16 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-sm font-bold text-slate-400">
                      +91
                    </div>
                    <div className="flex-1 relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-medium outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all placeholder:text-slate-200 text-sm"
                        placeholder="9876543210"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Full Name</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-cyan-600 transition-colors" />
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all placeholder:text-slate-200 text-sm"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Email (Optional)</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-cyan-600 transition-colors" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all placeholder:text-slate-200 text-sm"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Referral Code</label>
                  <div className="relative group">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-cyan-600 transition-colors" />
                    <input
                      type="text"
                      value={referralCode}
                      onChange={e => setReferralCode(e.target.value.toUpperCase())}
                      className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all placeholder:text-slate-200 text-sm"
                      placeholder="REF123"
                    />
                  </div>
                </div>

                <button
                  onClick={sendOTP}
                  disabled={loading || phone.length < 10}
                  className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl text-sm font-black tracking-widest shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      SEND OTP
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifyAndLogin}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Verification</label>
                    <button type="button" onClick={() => setConfirmationResult(null)} className="text-[10px] font-bold text-cyan-600 hover:text-cyan-700 transition-colors">CHANGE</button>
                  </div>
                  <div className="relative">
                    <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-2xl font-black tracking-[0.5em] outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all placeholder:text-slate-200"
                      placeholder="0000"
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length < 4}
                  className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl text-sm font-black tracking-widest shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'VERIFY & CONTINUE'}
                </button>

                <div className="text-center">
                  {timer > 0 ? (
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Resend in <span className="text-slate-900">{timer}s</span>
                    </p>
                  ) : (
                    <button type="button" onClick={sendOTP} className="text-[10px] font-black text-cyan-600 hover:text-cyan-700 transition-colors uppercase tracking-widest">RESEND OTP</button>
                  )}
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200 text-center text-[10px] uppercase tracking-widest text-slate-400">
          <p>
            By continuing, you agree to our <span className="text-slate-900 font-bold underline cursor-pointer">Terms</span> and <span className="text-slate-900 font-bold underline cursor-pointer">Privacy</span>
          </p>
          <div className="mt-4">
            Already have an account? <Link to="/login" className="text-cyan-600 font-black hover:text-cyan-700 transition-colors">LOGIN</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

