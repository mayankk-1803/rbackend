import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { Phone, User, Mail, Tag, Loader2, ArrowRight, ShieldCheck, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import OTPInput from '../components/OTPInput';

export default function Register() {
  const [authMethod, setAuthMethod] = useState('phone'); // 'phone' or 'email'
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    if (phone.length < 10) return toast.error("Enter valid phone number");
    setLoading(true);
    try {
      const formatPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      await api.post('/auth/send-otp', { phone: formatPhone });
      setConfirmationResult(true);
      setTimer(60);
      toast.success("OTP sent successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) return toast.error("Enter 6-digit OTP");
    setLoading(true);
    try {
      const formatPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      const res = await api.post('/auth/verify-otp', { 
        code: otpCode, 
        phone: formatPhone,
        name,
        email,
        referralCode 
      });
      handleAuthSuccess(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return toast.error("Please fill all required fields");
    if (password !== confirmPassword) return toast.error("Passwords do not match");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");

    setLoading(true);
    try {
      const res = await api.post('/auth/register-email', {
        name,
        email,
        password,
        phone: phone ? `+91${phone}` : null,
        referralCode
      });
      handleAuthSuccess(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = (apiData) => {
    if (apiData?.token) {
      localStorage.setItem('token', apiData.token);
      localStorage.setItem('user', JSON.stringify(apiData.user));
      toast.success('Account created successfully!');
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 relative overflow-hidden font-['Inter']">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[140px]"></div>
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px]"></div>
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
            <h2 className="text-3xl font-black text-slate-900 tracking-tight italic uppercase">GET STARTED</h2>
            <p className="text-slate-500 text-sm mt-2">Join the future of fintech</p>
          </div>

          {/* Auth Method Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
            <button
              onClick={() => { setAuthMethod('phone'); setConfirmationResult(null); }}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                authMethod === 'phone' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              Phone OTP
            </button>
            <button
              onClick={() => setAuthMethod('email')}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                authMethod === 'email' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              Email Password
            </button>
          </div>
          
          <AnimatePresence mode="wait">
            {authMethod === 'phone' ? (
              <motion.div
                key="phone-reg"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-5"
              >
                {!confirmationResult ? (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Full Name</label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-cyan-600 transition-colors" />
                        <input
                          type="text"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all text-sm"
                          placeholder="Your Name"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Phone Number</label>
                      <div className="flex gap-2">
                        <div className="flex-none w-16 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-sm font-bold text-slate-400">+91</div>
                        <div className="flex-1 relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                          <input
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-medium outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all text-sm"
                            placeholder="98********"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Referral Code (Optional)</label>
                      <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                          type="text"
                          value={referralCode}
                          onChange={e => setReferralCode(e.target.value.toUpperCase())}
                          className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all text-sm"
                          placeholder="REF123"
                        />
                      </div>
                    </div>

                    <button
                      onClick={sendOTP}
                      disabled={loading || phone.length < 10 || !name}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl text-sm font-black tracking-widest hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <>SEND OTP <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                      )}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleVerifyAndRegister} className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Verification</label>
                        <button type="button" onClick={() => setConfirmationResult(null)} className="text-[10px] font-bold text-cyan-600">CHANGE</button>
                      </div>
                      <OTPInput value={otpCode} onChange={setOtpCode} length={6} color="cyan" />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || otpCode.length < 6}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl text-sm font-black tracking-widest hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CREATE ACCOUNT'}
                    </button>
                    <div className="text-center">
                      {timer > 0 ? (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resend in {timer}s</p>
                      ) : (
                        <button type="button" onClick={sendOTP} className="text-[10px] font-black text-cyan-600 uppercase tracking-widest">RESEND OTP</button>
                      )}
                    </div>
                  </form>
                )}
              </motion.div>
            ) : (
              <motion.form
                key="email-reg"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleEmailRegister}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all" placeholder="Name" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all" placeholder="Email" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all" placeholder="Minimum 8 characters" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all" placeholder="Re-enter password" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Referral Code (Optional)</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input type="text" value={referralCode} onChange={e => setReferralCode(e.target.value.toUpperCase())} className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all" placeholder="REF123" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !name || !email || !password}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl text-sm font-black tracking-widest hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>REGISTER ACCOUNT <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Already have an account? <Link to="/login" className="text-cyan-600 font-black hover:underline">LOGIN</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
