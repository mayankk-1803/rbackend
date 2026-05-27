import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Smartphone, FileText, CheckCircle, Clock, Lock, ArrowLeft, Key, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';

export default function Security() {
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem('dizipay_user_data')) || { phone: '+91 XXXXX XXXXX' };

  // Password fields state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Visibility states
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return toast.error("All fields are required");
    }

    if (newPassword.length < 8) {
      return toast.error("New password must be at least 8 characters long");
    }

    if (newPassword !== confirmPassword) {
      return toast.error("Passwords do not match");
    }

    setLoading(true);
    try {
      const res = await api.put('/user/change-password', {
        currentPassword,
        newPassword
      });

      if (res.data?.success) {
        toast.success("Password changed successfully");
        
        // Update local storage user data to clear mustChangePassword
        const updatedUser = { ...user, mustChangePassword: false };
        sessionStorage.setItem('dizipay_user_data', JSON.stringify(updatedUser));
        
        // Clear fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');

        // Redirect to dashboard
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      }
    } catch (err) {
      toast.error(err.safeMessage || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6 md:space-y-8 relative z-10"
    >
      <div className="glass-card border border-[var(--glass-border)] rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-[var(--text-color)] uppercase tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-[var(--color-primary)] cyan-glow" /> Security & Privacy
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium tracking-wide">Manage your account protection</p>
          </div>
          {/* Prevent back navigation if user MUST change password */}
          {!user.mustChangePassword && (
            <button onClick={() => navigate('/profile')} className="text-xs font-black text-[var(--color-primary)] uppercase tracking-widest hover:text-[var(--color-primary)]/80 flex items-center gap-1 cursor-pointer">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
        </div>

        <div className="p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[var(--bg-secondary)]/40 p-6 rounded-2xl border border-[var(--glass-border)] flex items-start gap-4">
              <div className="p-3 bg-[var(--bg-secondary)]/60 rounded-xl shadow-sm border border-[var(--glass-border)]">
                <Smartphone className="w-6 h-6 text-[var(--text-secondary)]" />
              </div>
              <div>
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Registered Mobile</p>
                <p className="text-lg font-black text-[var(--text-color)]">{user.phone}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Primary method for OTP verification</p>
              </div>
            </div>

            <div className="bg-emerald-500/5 p-6 rounded-2xl border border-emerald-500/20 flex items-start gap-4">
              <div className="p-3 bg-[var(--bg-secondary)]/60 rounded-xl shadow-sm border border-emerald-500/20">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-emerald-400/70 uppercase tracking-widest mb-1">Verification Status</p>
                <p className="text-lg font-black text-emerald-400 emerald-glow">KYC Verified</p>
                <p className="text-xs text-emerald-400/80 mt-1">Full wallet access enabled</p>
              </div>
            </div>
          </div>

          <div className="bg-cyan-500/5 border border-cyan-500/20 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[var(--bg-secondary)]/60 border border-cyan-500/20 rounded-xl">
                <Clock className="w-6 h-6 text-[var(--color-primary)] cyan-glow" />
              </div>
              <div>
                <p className="text-sm font-black text-[var(--text-color)] uppercase tracking-tight">Current Active Secure Session</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">You are currently logged in securely</p>
              </div>
            </div>
            <div className="px-4 py-2 bg-[var(--bg-secondary)]/60 border border-cyan-500/20 rounded-xl shadow-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-[var(--text-color)]/80 uppercase tracking-widest">Active</span>
            </div>
          </div>

          {/* Premium Change Password Section */}
          <div className="space-y-4 pt-6 border-t border-[var(--glass-border)]">
            <h3 className="text-sm font-black text-[var(--text-color)] uppercase tracking-tight flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" /> Update Account Credentials
            </h3>
            
            <form onSubmit={handlePasswordChange} className="max-w-xl space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest ml-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full pl-10 pr-10 py-3 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all placeholder:text-[var(--text-muted)] text-sm"
                  />
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest ml-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 8 characters)"
                    className="w-full pl-10 pr-10 py-3 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all placeholder:text-[var(--text-muted)] text-sm"
                  />
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest ml-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    className="w-full pl-10 pr-10 py-3 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-[var(--text-color)] font-medium outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-400 transition-all placeholder:text-[var(--text-muted)] text-sm"
                  />
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-color)] cursor-pointer"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                className="py-3 px-6 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-555 hover:shadow-cyan-500/15 text-white rounded-2xl text-xs font-black tracking-widest shadow-lg shadow-cyan-500/10 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer uppercase"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save New Password"}
              </button>
            </form>
          </div>

          <div className="space-y-4 pt-6 border-t border-[var(--glass-border)]">
            <h3 className="text-sm font-black text-[var(--text-color)] uppercase tracking-tight">Security Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-[var(--glass-border)] hover:border-[var(--glass-border-hover)] bg-[var(--bg-secondary)]/20 transition-colors flex gap-4">
                <Key className="w-5 h-5 text-[var(--color-primary)] cyan-glow shrink-0" />
                <div>
                  <p className="text-xs font-black text-[var(--text-color)] uppercase mb-1">JWT Session Security</p>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">Your session is protected by industry-standard JSON Web Tokens with automatic expiry for enhanced security.</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-[var(--glass-border)] hover:border-[var(--glass-border-hover)] bg-[var(--bg-secondary)]/20 transition-colors flex gap-4">
                <Lock className="w-5 h-5 text-[var(--color-primary)] cyan-glow shrink-0" />
                <div>
                  <p className="text-xs font-black text-[var(--text-color)] uppercase mb-1">Secure Recharge Protection</p>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">All transactions are processed through an encrypted gateway ensuring your financial data remains private.</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-[var(--glass-border)] hover:border-[var(--glass-border-hover)] bg-[var(--bg-secondary)]/20 transition-colors flex gap-4 md:col-span-2">
                <FileText className="w-5 h-5 text-[var(--color-primary)] cyan-glow shrink-0" />
                <div>
                  <p className="text-xs font-black text-[var(--text-color)] uppercase mb-1">Data Privacy Notice</p>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">We employ strict data minimization principles. Your personal information is never shared with unauthorized third parties and is used solely for service provision.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
