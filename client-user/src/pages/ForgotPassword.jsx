import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { Loader2, ArrowRight, Smartphone, Lock, KeyRound, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AuthLeftPanel from '../components/AuthLeftPanel';

export default function ForgotPassword() {
  const [step, setStep] = useState(1); // 1: Request Reset, 2: Reset Password
  const [identity, setIdentity] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Password Validation Checks
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSpecial = /[@$!%*?&]/.test(newPassword);
  const isPasswordStrong = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (!identity.trim()) return toast.error("Email or mobile number is required");

    setLoading(true);
    try {
      let payload = { identity: identity.trim() };
      // Check if phone or email, format phone if needed
      const isEmail = identity.includes("@");
      if (!isEmail) {
        const cleanedPhone = identity.replace(/\D/g, '');
        payload.identity = cleanedPhone.startsWith('91') ? `+${cleanedPhone}` : `+91${cleanedPhone}`;
      }

      const res = await api.post('/auth/forgot-password', payload);
      if (res.data?.success) {
        toast.success("Reset code sent to your email");
        setTimer(60);
        setStep(2);
      } else {
        throw new Error(res.data?.message || "Verification failed");
      }
    } catch (err) {
      toast.error(err?.safeMessage || "Failed to send reset code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!code || code.length !== 6) return toast.error("Enter valid 6-digit OTP code");
    if (!isPasswordStrong) return toast.error("Please ensure password satisfies all strength rules");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match");

    setLoading(true);
    try {
      let formattedIdentity = identity.trim();
      const isEmail = formattedIdentity.includes("@");
      if (!isEmail) {
        const cleanedPhone = formattedIdentity.replace(/\D/g, '');
        formattedIdentity = cleanedPhone.startsWith('91') ? `+${cleanedPhone}` : `+91${cleanedPhone}`;
      }

      const res = await api.post('/auth/reset-password', {
        identity: formattedIdentity,
        code,
        newPassword,
        confirmPassword
      });

      if (res.data?.success) {
        toast.success("Password updated successfully");
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 1500);
      } else {
        throw new Error(res.data?.message || "Reset failed");
      }
    } catch (err) {
      toast.error(err?.safeMessage || "Invalid OTP code or password reset failed.");
    } finally {
      setLoading(false);
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
            <div className="text-left mb-8">
              <h2 className="text-3xl font-black text-[var(--text-color)] tracking-tight lowercase navbar-logo-text leading-tight">
                irecharge
              </h2>
              <p className="text-[var(--text-secondary)] text-xs font-semibold mt-2 leading-relaxed">
                Reset access securely.
              </p>
            </div>

            {/* Auth Mode Forms */}
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.form
                  key="step1-recovery"
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 15 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleRequestReset}
                  className="space-y-6"
                >
                  {/* Identity Input with Floating Label */}
                  <div className="relative">
                    <input
                      id="identity"
                      type="text"
                      value={identity}
                      onChange={e => setIdentity(e.target.value)}
                      className="peer w-full pl-12 pr-4 pt-6 pb-2.5 h-[58px] md:h-16 bg-[#FFFFFF] dark:bg-[#161629] border border-[#E5E7EB] dark:border-[#2A2A45] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:border-[var(--color-primary)] transition-all placeholder-transparent text-sm"
                      placeholder=" "
                    />
                    <label
                      htmlFor="identity"
                      className="absolute left-12 top-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider transition-all transform-none pointer-events-none peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-semibold peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-[var(--color-primary)] peer-focus:uppercase peer-focus:tracking-wider"
                    >
                      Email or Mobile Number
                    </label>
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading || !identity}
                    className="w-full h-14 bg-gradient-to-r from-[#A78BFA] to-[#8B5CF6] dark:from-[#7C3AED] dark:to-[#5B21B6] hover:shadow-[0_0_24px_rgba(139,92,246,0.35)] dark:hover:shadow-[0_0_24px_rgba(124,58,237,0.45)] text-white rounded-2xl text-xs font-black tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 group cursor-pointer shadow-lg"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <>
                        SEND RESET CODE
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </motion.button>
                </motion.form>
              ) : (
                <motion.form
                  key="step2-recovery"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleResetPassword}
                  className="space-y-6"
                >
                  {/* Reset Code Input with Floating Label */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">Reset Code / OTP</label>
                      <button type="button" onClick={() => setStep(1)} className="text-[10px] font-black text-[var(--color-primary)] hover:opacity-80 cursor-pointer uppercase tracking-wider">Change ID</button>
                    </div>
                    <div className="relative">
                      <input
                        id="code"
                        type="text"
                        maxLength={6}
                        value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                        className="peer w-full pl-12 pr-4 pt-6 pb-2.5 h-[58px] md:h-16 bg-[#FFFFFF] dark:bg-[#161629] border border-[#E5E7EB] dark:border-[#2A2A45] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:border-[var(--color-primary)] transition-all placeholder-transparent text-sm"
                        placeholder=" "
                      />
                      <label
                        htmlFor="code"
                        className="absolute left-12 top-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider transition-all transform-none pointer-events-none peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-semibold peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-[var(--color-primary)] peer-focus:uppercase peer-focus:tracking-wider"
                      >
                        6-digit reset code
                      </label>
                      <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                    </div>
                  </div>

                  {/* New Password Input with Floating Label */}
                  <div className="relative">
                    <input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="peer w-full pl-12 pr-4 pt-6 pb-2.5 h-[58px] md:h-16 bg-[#FFFFFF] dark:bg-[#161629] border border-[#E5E7EB] dark:border-[#2A2A45] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-[var(--color-primary-glow)] focus:border-[var(--color-primary)] transition-all placeholder-transparent text-sm"
                      placeholder=" "
                    />
                    <label
                      htmlFor="newPassword"
                      className="absolute left-12 top-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider transition-all transform-none pointer-events-none peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-semibold peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:text-[var(--color-primary)] peer-focus:uppercase peer-focus:tracking-wider"
                    >
                      New Password
                    </label>
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                  </div>

                  {/* Password Strength Requirements */}
                  <div className="p-4 rounded-2xl bg-[#F8F7FC] dark:bg-[#161629] border border-[#E5E7EB] dark:border-[#2A2A45] space-y-2 text-[10px] font-semibold text-[var(--text-secondary)]">
                    <p className="text-[9px] font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-2">Password Requirements</p>
                    
                    <div className="flex items-center gap-2">
                      {hasMinLength ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                      <span className={hasMinLength ? "text-emerald-400" : ""}>At least 8 characters long</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasUppercase && hasLowercase ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                      <span className={hasUppercase && hasLowercase ? "text-emerald-400" : ""}>Contains uppercase and lowercase letters</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasNumber ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                      <span className={hasNumber ? "text-emerald-400" : ""}>Contains at least one number</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasSpecial ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                      <span className={hasSpecial ? "text-emerald-400" : ""}>Contains at least one special character (@$!%*?&)</span>
                    </div>
                  </div>

                  {/* Confirm Password Input with Floating Label */}
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

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading || code.length < 6 || !isPasswordStrong || newPassword !== confirmPassword}
                    className="w-full h-14 bg-gradient-to-r from-[#A78BFA] to-[#8B5CF6] dark:from-[#7C3AED] dark:to-[#5B21B6] hover:shadow-[0_0_24px_rgba(139,92,246,0.35)] dark:hover:shadow-[0_0_24px_rgba(124,58,237,0.45)] text-white rounded-2xl text-xs font-black tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'UPDATE & RESET PASSWORD'}
                  </motion.button>

                  <div className="text-center">
                    {timer > 0 ? (
                      <p className="text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-widest">Resend Code in {timer}s</p>
                    ) : (
                      <button type="button" onClick={handleRequestReset} className="text-[10px] font-black text-[var(--color-primary)] hover:opacity-80 uppercase tracking-widest cursor-pointer">RESEND CODE</button>
                    )}
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Navigation Switch */}
            <div className="mt-8 pt-6 border-t border-[var(--glass-border)] text-center">
              <span className="text-[var(--text-secondary)] text-xs font-medium">Remember your details? </span>
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
