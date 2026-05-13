import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Smartphone, FileText, CheckCircle, Clock, Lock, ArrowLeft, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Security() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user')) || { phone: '+91 XXXXX XXXXX' };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6 md:space-y-8"
    >
      <div className="bg-white/70 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-600" /> Security & Privacy
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-medium tracking-wide">Manage your account protection</p>
          </div>
          <button onClick={() => navigate('/profile')} className="text-xs font-black text-cyan-600 uppercase tracking-widest hover:text-cyan-700 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-start gap-4">
              <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                <Smartphone className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Registered Mobile</p>
                <p className="text-lg font-black text-slate-900">{user.phone}</p>
                <p className="text-xs text-slate-500 mt-1">Primary method for OTP verification</p>
              </div>
            </div>

            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex items-start gap-4">
              <div className="p-3 bg-white rounded-xl shadow-sm border border-emerald-100">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-emerald-600/70 uppercase tracking-widest mb-1">Verification Status</p>
                <p className="text-lg font-black text-emerald-600">KYC Verified</p>
                <p className="text-xs text-emerald-600/80 mt-1">Full wallet access enabled</p>
              </div>
            </div>
          </div>

          <div className="bg-cyan-50/50 border border-cyan-100 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-cyan-100 rounded-xl">
                <Clock className="w-6 h-6 text-cyan-600" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Current Active Secure Session</p>
                <p className="text-xs text-slate-500 mt-1">You are currently logged in securely</p>
              </div>
            </div>
            <div className="px-4 py-2 bg-white border border-cyan-200 rounded-xl shadow-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Active</span>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Security Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors flex gap-4">
                <Key className="w-5 h-5 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs font-black text-slate-900 uppercase mb-1">JWT Session Security</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed">Your session is protected by industry-standard JSON Web Tokens with automatic expiry for enhanced security.</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors flex gap-4">
                <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs font-black text-slate-900 uppercase mb-1">Secure Recharge Protection</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed">All transactions are processed through an encrypted gateway ensuring your financial data remains private.</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors flex gap-4 md:col-span-2">
                <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs font-black text-slate-900 uppercase mb-1">Data Privacy Notice</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed">We employ strict data minimization principles. Your personal information is never shared with unauthorized third parties and is used solely for service provision.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
