import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ShieldCheck, Mail, Lock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if(!email || !password) return;
    
    setLoading(true);
    try {
      const res = await api.post('/auth/login-email', { email, password }, {
        headers: { 'x-admin-request': 'true' }
      });
      
      console.log("LOGIN RESPONSE:", res.data);
      
      if (res.data.success && res.data.token) {
        const { token, user } = res.data;

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        console.log("TOKEN SAVED:", localStorage.getItem("token"));

        toast.success('Admin authenticated', {
          className: 'hot-toast-cyber'
        });
        
        window.location.href = "/admin/";
      } else {
        throw new Error(res.data.message || "Admin authentication failed");
      }
    } catch(err) {
      toast.error(err.response?.data?.message || 'Authentication failed', {
        className: 'hot-toast-cyber'
      });
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full relative z-10"
      >
        <div className="bg-white/[0.03] backdrop-blur-2xl p-8 border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.3)]">
          <div className="flex flex-col items-center justify-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-tr from-cyan-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20 transform rotate-3 hover:rotate-0 transition-transform duration-300">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Dizipay Admin</h2>
            <p className="text-sm text-slate-400 mt-2 text-center">Secure access to administrative tools</p>
          </div>
          
          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Administrator Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all"
                  placeholder="admin@dizipay.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full relative group overflow-hidden py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-bold tracking-wide shadow-xl shadow-purple-900/20 hover:shadow-cyan-500/20 transition-all active:scale-[0.98] disabled:opacity-50 mt-4"
            >
              <div className="absolute inset-0 bg-white/10 group-hover:translate-x-full transition-transform duration-500"></div>
              <div className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Secure Sign In'
                )}
              </div>
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-medium">
              Enterprise Grade Security
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

