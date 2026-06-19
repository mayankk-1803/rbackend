import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { Phone, User, Mail, Tag, Loader2, ArrowRight, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import OTPInput from '../components/OTPInput';
import AuthLeftPanel from '../components/AuthLeftPanel';
import Logo from '../components/Logo';

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
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#FFFFFF] dark:bg-[#111122] text-[var(--text-color)] font-['Inter'] transition-colors duration-500 overflow-x-hidden">
      {/* Left Experience Panel */}
      <div className="w-full md:w-1/2 lg:w-[60%] shrink-0">
        <AuthLeftPanel />
      </div>

      {/* Right Authentication Area */}
      <div className="w-full md:w-1/2 lg:w-[40%] flex items-center justify-center p-6 sm:p-12 lg:p-16 relative bg-[#F8F7FC] dark:bg-[#0B0B16] min-h-screen shrink-0 transition-colors duration-500">
        
        {/* Background Ambient Glow */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[20%] -right-32 w-[350px] h-[350px] bg-[var(--color-primary-glow)] rounded-full blur-[100px]" />
          <div className="absolute bottom-[20%] -left-32 w-[300px] h-[300px] bg-[var(--color-accent-glow)] rounded-full blur-[90px]" />
        </div>

        {/* Form Container Wrapper */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="max-w-[480px] w-full relative z-10"
        >
          <div className="glass-card p-8 sm:p-10 rounded-[32px] shadow-[var(--shadow-card)] border border-[#E5E7EB] dark:border-[#2A2A45] bg-[var(--glass-card-bg)] backdrop-blur-xl">
            
            {/* Heading Zone */}
            <div className="text-left mb-8 shrink-0 overflow-visible">
              <Logo size="lg" className="mb-2" />
              <p className="text-[var(--text-secondary)] text-xs font-semibold mt-2 leading-relaxed">
                Start earning reward coins and seamless payments.
              </p>
            </div>

            {/* Custom Animated Switcher Pill */}
            <div className="relative flex p-1 bg-[#F8F7FC] dark:bg-[#161629] rounded-2xl mb-8 border border-[#E5E7EB] dark:border-[#2A2A45] overflow-hidden">
              <motion.div
                className="absolute top-1 bottom-1 rounded-xl bg-[var(--color-primary-glow)] border border-[var(--color-accent)]/20 shadow-sm z-0"
                animate={{
                  left: authMethod === 'phone' ? '4px' : 'calc(50% + 2px)',
                  right: authMethod === 'phone' ? 'calc(50% + 2px)' : '4px',
                }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
              />
              
              <button
                type="button"
                onClick={() => { setAuthMethod('phone'); setConfirmationResult(null); }}
                className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors duration-300 cursor-pointer ${
                  authMethod === 'phone' ? 'text-[var(--color-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                Mobile OTP
              </button>
              <button
                type="button"
                onClick={() => setAuthMethod('email')}
                className={`relative z-10 flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors duration-300 cursor-pointer ${
                  authMethod === 'email' ? 'text-[var(--color-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                Email Password
              </button>
            </div>

            {/* Auth Mode Forms */}
            <AnimatePresence mode="wait">
              {authMethod === 'phone' ? (
                <motion.div
                  key="phone-register-area"
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {!confirmationResult ? (
                    <div className="space-y-5">
                      {/* Name Input with Floating Label */}
                      <div className="relative">
                        <input
                          id="name"
                          type="text"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          className="peer w-full pl-12 pr-4 pt-6 pb-2.5 h-[58px] md:h-16 bg-[#FFFFFF] dark:bg-[#161629] border border-[#E5E7EB] dark:border-[#2A2A45] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:border-[var(--color-primary)] transition-all placeholder-transparent text-sm"
                          placeholder=" "
                        />
                        <label
                          htmlFor="name"
                          className="absolute left-12 top-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider transition-all transform-none pointer-events-none peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-semibold peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-[var(--color-primary)] peer-focus:uppercase peer-focus:tracking-wider"
                        >
                          Full Name
                        </label>
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                      </div>

                      {/* Phone Input with Prefix and Floating Label */}
                      <div className="flex gap-3">
                        <div className="flex-none w-16 h-[58px] md:h-16 bg-[#FFFFFF] dark:bg-[#161629] border border-[#E5E7EB] dark:border-[#2A2A45] rounded-2xl flex items-center justify-center text-sm font-black text-[var(--text-secondary)]">
                          +91
                        </div>
                        <div className="flex-1 relative">
                          <input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="peer w-full pl-12 pr-4 pt-6 pb-2.5 h-[58px] md:h-16 bg-[#FFFFFF] dark:bg-[#161629] border border-[#E5E7EB] dark:border-[#2A2A45] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:border-[var(--color-primary)] transition-all placeholder-transparent text-sm"
                            placeholder=" "
                          />
                          <label
                            htmlFor="phone"
                            className="absolute left-12 top-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider transition-all transform-none pointer-events-none peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-semibold peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-[var(--color-primary)] peer-focus:uppercase peer-focus:tracking-wider"
                          >
                            Phone Number
                          </label>
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                        </div>
                      </div>

                      {/* Referral Code (Optional) Input with Floating Label */}
                      <div className="relative">
                        <input
                          id="referral"
                          type="text"
                          value={referralCode}
                          onChange={e => setReferralCode(e.target.value.toUpperCase())}
                          className="peer w-full pl-12 pr-4 pt-6 pb-2.5 h-[58px] md:h-16 bg-[#FFFFFF] dark:bg-[#161629] border border-[#E5E7EB] dark:border-[#2A2A45] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:border-[var(--color-primary)] transition-all placeholder-transparent text-sm"
                          placeholder=" "
                        />
                        <label
                          htmlFor="referral"
                          className="absolute left-12 top-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider transition-all transform-none pointer-events-none peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-semibold peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-[var(--color-primary)] peer-focus:uppercase peer-focus:tracking-wider"
                        >
                          Referral Code (Optional)
                        </label>
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                      </div>

                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={sendOTP}
                        disabled={loading || phone.length < 10 || !name}
                        className="w-full h-14 bg-gradient-to-r from-[#A78BFA] to-[#8B5CF6] dark:from-[#7C3AED] dark:to-[#5B21B6] hover:shadow-[0_0_24px_rgba(139,92,246,0.35)] dark:hover:shadow-[0_0_24px_rgba(124,58,237,0.45)] text-white rounded-2xl text-xs font-black tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 group cursor-pointer shadow-lg"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                          <>
                            SEND OTP
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </motion.button>
                    </div>
                  ) : (
                    <form onSubmit={handleVerifyAndRegister} className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">Verification Code</label>
                          <button type="button" onClick={() => setConfirmationResult(null)} className="text-[10px] font-black text-[var(--color-primary)] hover:opacity-80 cursor-pointer uppercase tracking-wider">Change</button>
                        </div>
                        <OTPInput value={otpCode} onChange={setOtpCode} length={6} color="purple" />
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={loading || otpCode.length < 6}
                        className="w-full h-14 bg-gradient-to-r from-[#A78BFA] to-[#8B5CF6] dark:from-[#7C3AED] dark:to-[#5B21B6] hover:shadow-[0_0_24px_rgba(139,92,246,0.35)] dark:hover:shadow-[0_0_24px_rgba(124,58,237,0.45)] text-white rounded-2xl text-xs font-black tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CREATE ACCOUNT'}
                      </motion.button>
                      <div className="text-center">
                        {timer > 0 ? (
                          <p className="text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-widest">Resend in {timer}s</p>
                        ) : (
                          <button type="button" onClick={sendOTP} className="text-[10px] font-black text-[var(--color-primary)] hover:opacity-80 uppercase tracking-widest cursor-pointer">RESEND OTP</button>
                        )}
                      </div>
                    </form>
                  )}
                </motion.div>
              ) : (
                <motion.form
                  key="email-register-area"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleEmailRegister}
                  className="space-y-4"
                >
                  {/* Name Field */}
                  <div className="relative">
                    <input
                      id="name-email"
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="peer w-full pl-12 pr-4 pt-6 pb-2.5 h-[58px] md:h-16 bg-[#FFFFFF] dark:bg-[#161629] border border-[#E5E7EB] dark:border-[#2A2A45] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:border-[var(--color-primary)] transition-all placeholder-transparent text-sm"
                      placeholder=" "
                    />
                    <label
                      htmlFor="name-email"
                      className="absolute left-12 top-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider transition-all transform-none pointer-events-none peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-semibold peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-[var(--color-primary)] peer-focus:uppercase peer-focus:tracking-wider"
                    >
                      Full Name
                    </label>
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                  </div>

                  {/* Email Field */}
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="peer w-full pl-12 pr-4 pt-6 pb-2.5 h-[58px] md:h-16 bg-[#FFFFFF] dark:bg-[#161629] border border-[#E5E7EB] dark:border-[#2A2A45] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:border-[var(--color-primary)] transition-all placeholder-transparent text-sm"
                      placeholder=" "
                    />
                    <label
                      htmlFor="email"
                      className="absolute left-12 top-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider transition-all transform-none pointer-events-none peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-semibold peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-[var(--color-primary)] peer-focus:uppercase peer-focus:tracking-wider"
                    >
                      Email Address
                    </label>
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                  </div>

                  {/* Password Field */}
                  <div className="relative">
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="peer w-full pl-12 pr-4 pt-6 pb-2.5 h-[58px] md:h-16 bg-[#FFFFFF] dark:bg-[#161629] border border-[#E5E7EB] dark:border-[#2A2A45] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:border-[var(--color-primary)] transition-all placeholder-transparent text-sm"
                      placeholder=" "
                    />
                    <label
                      htmlFor="password"
                      className="absolute left-12 top-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider transition-all transform-none pointer-events-none peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-semibold peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-[var(--color-primary)] peer-focus:uppercase peer-focus:tracking-wider"
                    >
                      Password
                    </label>
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                  </div>

                  {/* Confirm Password Field */}
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="peer w-full pl-12 pr-4 pt-6 pb-2.5 h-[58px] md:h-16 bg-[#FFFFFF] dark:bg-[#161629] border border-[#E5E7EB] dark:border-[#2A2A45] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:border-[var(--color-primary)] transition-all placeholder-transparent text-sm"
                      placeholder=" "
                    />
                    <label
                      htmlFor="confirmPassword"
                      className="absolute left-12 top-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider transition-all transform-none pointer-events-none peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-semibold peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-[var(--color-primary)] peer-focus:uppercase peer-focus:tracking-wider"
                    >
                      Confirm Password
                    </label>
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                  </div>

                  {/* Referral Code Field (Email mode) */}
                  <div className="relative">
                    <input
                      id="referral-email"
                      type="text"
                      value={referralCode}
                      onChange={e => setReferralCode(e.target.value.toUpperCase())}
                      className="peer w-full pl-12 pr-4 pt-6 pb-2.5 h-[58px] md:h-16 bg-[#FFFFFF] dark:bg-[#161629] border border-[#E5E7EB] dark:border-[#2A2A45] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:border-[var(--color-primary)] transition-all placeholder-transparent text-sm"
                      placeholder=" "
                    />
                    <label
                      htmlFor="referral-email"
                      className="absolute left-12 top-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider transition-all transform-none pointer-events-none peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-semibold peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-[var(--color-primary)] peer-focus:uppercase peer-focus:tracking-wider"
                    >
                      Referral Code (Optional)
                    </label>
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading || !name || !email || !password || password !== confirmPassword}
                    className="w-full h-14 bg-gradient-to-r from-[#A78BFA] to-[#8B5CF6] dark:from-[#7C3AED] dark:to-[#5B21B6] hover:shadow-[0_0_24px_rgba(139,92,246,0.35)] dark:hover:shadow-[0_0_24px_rgba(124,58,237,0.45)] text-white rounded-2xl text-xs font-black tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <>
                        REGISTER ACCOUNT
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Navigation Switch */}
            <div className="mt-8 pt-6 border-t border-[var(--glass-border)] text-center">
              <span className="text-[var(--text-secondary)] text-xs font-medium">Already have an account? </span>
              <Link to="/login" className="text-[var(--color-primary)] text-xs font-black hover:underline underline-offset-4 tracking-wide">
                Log In
              </Link>
            </div>

            {/* Trust Zone */}
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-3 pt-6 border-t border-[var(--glass-border)]/50 text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-500 font-bold text-xs select-none">✓</span>
                <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest leading-none">Enterprise-grade Security</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-500 font-bold text-xs select-none">✓</span>
                <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest leading-none">Encrypted Sessions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-500 font-bold text-xs select-none">✓</span>
                <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest leading-none">Protected Transactions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-500 font-bold text-xs select-none">✓</span>
                <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest leading-none">Secure Authentication</span>
              </div>
            </div>

          </div>
        </motion.div>
      </div>
    </div>
  );
}
