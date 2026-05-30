import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { Loader2, ArrowRight, Smartphone, Mail, Lock, ShieldCheck, KeyRound, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
              <KeyRound className="w-6 h-6 text-cyan-400" />
            </div>
            <h2 className="text-3xl font-black text-[var(--text-color)] tracking-tight italic uppercase">
              RESET PASSWORD
            </h2>
            <p className="text-[var(--text-secondary)] text-sm mt-2">Secure recovery wizard</p>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form
                key="step1-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleRequestReset}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1">Email or Phone Number</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={identity}
                      onChange={e => setIdentity(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all placeholder:text-[var(--text-muted)]"
                      placeholder="name@example.com or 98********"
                    />
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !identity}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-2xl text-sm font-black tracking-widest shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 group cursor-pointer"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      SEND RESET CODE
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="step2-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleResetPassword}
                className="space-y-6"
              >
                {/* OTP Reset Code */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">Reset Code / OTP</label>
                    <button type="button" onClick={() => setStep(1)} className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer">CHANGE ID</button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-12 pr-4 py-4 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all placeholder:text-[var(--text-muted)]"
                      placeholder="6-digit reset code"
                    />
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1">New Password</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all placeholder:text-[var(--text-muted)]"
                      placeholder="••••••••"
                    />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  </div>
                </div>

                {/* Password Strength Requirements */}
                <div className="p-4 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] space-y-2 text-[11px] font-semibold text-[var(--text-secondary)]">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-2">Password Requirements</p>
                  
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

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-1">Confirm Password</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all placeholder:text-[var(--text-muted)]"
                      placeholder="••••••••"
                    />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || code.length < 6 || !isPasswordStrong || newPassword !== confirmPassword}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-2xl text-sm font-black tracking-widest shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'UPDATE & RESET PASSWORD'}
                </button>

                <div className="text-center">
                  {timer > 0 ? (
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Resend Code in {timer}s</p>
                  ) : (
                    <button type="button" onClick={handleRequestReset} className="text-[10px] font-black text-cyan-400 hover:text-cyan-300 uppercase tracking-widest cursor-pointer">RESEND CODE</button>
                  )}
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-8 pt-8 border-t border-[var(--glass-border)] text-center">
            <span className="text-[var(--text-secondary)] text-sm">Remember your details? </span>
            <Link to="/login" className="text-cyan-400 font-bold hover:underline underline-offset-4">Log In</Link>
          </div>
        </div>

        <p className="mt-8 text-center text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em]">
          Dizipay Security Infrastructure v2.0
        </p>
      </motion.div>
    </div>
  );
}
