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
  const navigate = useNavigate();

  useEffect(() => {
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
      toast.error(err?.safeMessage || 'Something went wrong. Please try again.');
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
      toast.error(err.safeMessage || "Verification failed");
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
      toast.error(err.safeMessage || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = (apiData) => {
    if (apiData?.token) {
      sessionStorage.setItem('dizipay_user_token', apiData.token);
      sessionStorage.setItem('dizipay_user_data', JSON.stringify(apiData.user));
      toast.success('Account created successfully!');
      window.location.href = '/dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-color)] flex flex-col justify-center items-center p-4 relative overflow-hidden font-['Inter'] transition-colors duration-300">
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
        <div className="glass-card p-8 rounded-[2.5rem] shadow-[var(--glass-shadow)] border border-[var(--glass-border)] bg-[var(--glass-card-bg)]">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
              <ShieldCheck className="w-6 h-6 text-cyan-400" />
            </div>
            <h2 className="text-3xl font-black text-[var(--text-color)] tracking-tight italic uppercase">GET STARTED</h2>
            <p className="text-[var(--text-secondary)] text-sm mt-2">Join the future of fintech</p>
          </div>

          {/* Auth Method Tabs */}
          <div className="flex p-1 bg-[var(--bg-secondary)]/60 rounded-2xl mb-8 border border-[var(--glass-border)]">
            <button
              onClick={() => { setAuthMethod('phone'); setConfirmationResult(null); }}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${
                authMethod === 'phone' ? 'bg-cyan-500/10 border border-cyan-500/20 text-[var(--color-accent)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              Phone OTP
            </button>
            <button
              onClick={() => setAuthMethod('email')}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${
                authMethod === 'email' ? 'bg-cyan-500/10 border border-cyan-500/20 text-[var(--color-accent)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
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
                      <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1">Full Name</label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-cyan-400 transition-colors" />
                        <input
                          type="text"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          className="w-full pl-10 pr-4 py-3.5 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all text-sm placeholder:text-[var(--text-muted)]"
                          placeholder="Your Name"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1">Phone Number</label>
                      <div className="flex gap-2">
                        <div className="flex-none w-16 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl flex items-center justify-center text-sm font-bold text-[var(--text-secondary)]">+91</div>
                        <div className="flex-1 relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                          <input
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="w-full pl-10 pr-4 py-3.5 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all text-sm placeholder:text-[var(--text-muted)]"
                            placeholder="98********"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1">Referral Code (Optional)</label>
                      <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                        <input
                          type="text"
                          value={referralCode}
                          onChange={e => setReferralCode(e.target.value.toUpperCase())}
                          className="w-full pl-10 pr-4 py-3.5 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all text-sm placeholder:text-[var(--text-muted)]"
                          placeholder="REF123"
                        />
                      </div>
                    </div>

                    <button
                      onClick={sendOTP}
                      disabled={loading || phone.length < 10 || !name}
                      className="w-full py-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-2xl text-sm font-black tracking-widest shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 group cursor-pointer"
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
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CREATE ACCOUNT'}
                    </button>
                    <div className="text-center">
                      {timer > 0 ? (
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Resend in {timer}s</p>
                      ) : (
                        <button type="button" onClick={sendOTP} className="text-[10px] font-black text-cyan-400 hover:text-cyan-300 uppercase tracking-widest cursor-pointer">RESEND OTP</button>
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
                    <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full pl-10 pr-4 py-3.5 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] text-sm outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all placeholder:text-[var(--text-muted)]" placeholder="Name" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3.5 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] text-sm outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all placeholder:text-[var(--text-muted)]" placeholder="Email" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3.5 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] text-sm outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all placeholder:text-[var(--text-muted)]" placeholder="Minimum 8 characters" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full pl-10 pr-4 py-3.5 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] text-sm outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all placeholder:text-[var(--text-muted)]" placeholder="Re-enter password" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1">Referral Code (Optional)</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input type="text" value={referralCode} onChange={e => setReferralCode(e.target.value.toUpperCase())} className="w-full pl-10 pr-4 py-3.5 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] text-sm outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all placeholder:text-[var(--text-muted)]" placeholder="REF123" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !name || !email || !password}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-2xl text-sm font-black tracking-widest shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
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
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            Already have an account? <Link to="/login" className="text-cyan-400 font-black hover:underline">LOGIN</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
