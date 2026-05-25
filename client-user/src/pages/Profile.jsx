import React, { useState, useRef } from 'react';
import { motion as Motion } from 'framer-motion';
import { User, Settings, LogOut, ShieldCheck, HelpCircle, ChevronRight, Edit2, Camera, Code2, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import socket from '../services/socket';
import { useWallet } from '../context/WalletContext';

export default function Profile() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('dizipay_user_data')) || { name: 'User Account', phone: '+91 9876543210' });
  const { wallet } = useWallet();
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(user.name || '');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('dizipay_user_token');
    localStorage.removeItem('dizipay_user_data');
    sessionStorage.removeItem('dizipay_developer_token');
    localStorage.removeItem('dizipay_developer_token');
    sessionStorage.removeItem('developer_verified');
    localStorage.removeItem('developer_verified');
    sessionStorage.removeItem('developer_session');
    localStorage.removeItem('developer_session');
    sessionStorage.removeItem('developer_auth_cache');
    localStorage.removeItem('developer_auth_cache');
    for (let key in localStorage) {
      if (key.includes('developer')) {
        localStorage.removeItem(key);
      }
    }
    for (let key in sessionStorage) {
      if (key.includes('developer')) {
        sessionStorage.removeItem(key);
      }
    }
    toast.success('Logged out successfully');
    window.location.href = '/login';
  };

  const menuItems = [
    { icon: Settings, label: 'Account Settings', action: () => setIsEditing(true) },
    { icon: Code2, label: 'Developer Portal', action: () => navigate('/developer') },
    { icon: ShoppingBag, label: 'iMart Orders', action: () => navigate('/imart/wishlist') },
    { icon: ShieldCheck, label: 'Security & Privacy', action: () => navigate('/profile/security') },
    { icon: HelpCircle, label: 'Help & Support', action: () => navigate('/profile/support') },
    { icon: LogOut, label: 'Log Out', textDanger: true, action: handleLogout, mobileLogout: true }
  ];

  const handleNameSave = async () => {
    try {
      const res = await api.put('/user/update-profile', { name: newName });
      const updated = { ...user, ...res.data.data };
      setUser(updated);
      localStorage.setItem('dizipay_user_data', JSON.stringify(updated));
      setIsEditing(false);
      toast.success("Name updated successfully");
    } catch {
      toast.error("Failed to update name");
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('profileImage', file);

      const res = await api.put('/user/update-profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const updated = { ...user, ...res.data.data };
      setUser(updated);
      localStorage.setItem('dizipay_user_data', JSON.stringify(updated));
      toast.success("Profile image updated");
    } catch (e) {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.error(e);
      }
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  };



  return (
    <Motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-4 md:space-y-8 relative z-10 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:pb-0"
    >
      <div className="glass-card border border-[var(--glass-border)] rounded-2xl md:rounded-3xl overflow-hidden shadow-xl">
        <div className="bg-gradient-to-r from-[var(--bg-tertiary)]/20 via-[var(--bg-secondary)]/40 to-[var(--bg-tertiary)]/20 p-6 md:p-8 flex flex-col items-center border-b border-[var(--glass-border)] relative overflow-hidden">
          {/* Animated Background Orbs */}
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>

          <div className="relative group mb-6">
            <div className="w-32 h-32 bg-[var(--bg-secondary)]/60 rounded-full flex items-center justify-center border-2 border-[var(--glass-border)] shadow-sm overflow-hidden group-hover:shadow-md transition-all duration-500">
              {uploading ? (
                <div className="animate-spin h-8 w-8 border-3 border-cyan-500 border-t-transparent rounded-full"></div>
              ) : user.profileImage ? (
                <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-purple-400">
                  {(user.name || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-1 right-1 bg-gradient-to-br from-cyan-500 to-purple-600 p-2.5 rounded-full shadow-lg hover:scale-110 transition-all border border-white/20 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
          </div>

          <div className="text-center space-y-2">
            {isEditing ? (
              <div className="flex items-center gap-3 bg-[var(--bg-secondary)]/60 p-1.5 rounded-xl border border-[var(--glass-border)]">
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  className="bg-transparent text-[var(--text-color)] px-4 py-2 outline-none w-32 md:w-48 font-bold text-sm md:text-base"
                  autoFocus
                />
                <button onClick={handleNameSave} className="bg-cyan-50 hover:bg-cyan-400 text-slate-950 text-[10px] font-black uppercase px-3 md:px-4 py-2 rounded-lg transition-all cursor-pointer">Save</button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <h2 className="text-xl md:text-3xl font-black text-[var(--text-color)] tracking-tight">{user.name || 'User Account'}</h2>
                <button onClick={() => { setIsEditing(true); setNewName(user.name || ''); }} className="text-[var(--text-secondary)] hover:text-cyan-400 transition-colors cursor-pointer">
                  <Edit2 className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
            )}
            <p className="text-[var(--text-secondary)] font-mono tracking-widest text-[10px] md:text-xs uppercase">{user.phone}</p>
          </div>
        </div>

        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-4">Account Navigator</h3>
            {menuItems.map((item, idx) => (
              <Motion.button 
                key={idx} 
                whileHover={{ x: 6, backgroundColor: 'var(--glass-button-bg)' }}
                onClick={item.action}
                className={`w-full min-h-14 p-4 rounded-2xl border flex items-center justify-between transition-all group hover:shadow-sm cursor-pointer ${
                  item.mobileLogout
                    ? 'bg-rose-500/10 border-rose-500/20 hover:border-rose-400/50 active:scale-[0.99] md:bg-[var(--glass-card-bg)] md:border-[var(--glass-border)] md:hover:border-[var(--color-accent)]/20'
                    : 'bg-[var(--glass-card-bg)] border-[var(--glass-border)] hover:border-[var(--color-accent)]/20'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${item.textDanger ? 'bg-rose-500/10 text-rose-400 border border-rose-500/10' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/10'}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className={`font-bold text-sm ${item.textDanger ? 'text-rose-400' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-color)]'}`}>{item.label}</span>
                </div>
                <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${item.textDanger ? 'text-rose-300' : 'text-slate-500'}`} />
              </Motion.button>
            ))}
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-4">Earned Coins</h3>
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-6 rounded-3xl relative overflow-hidden group">
              <div className="relative z-10 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Your Coins</p>
                    <h4 className="text-3xl font-black text-[var(--text-color)]">{wallet.coinBalance || 0}</h4>
                  </div>
                  <button 
                    onClick={() => navigate('/earned-coins')}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    Manage
                  </button>
                </div>
                
                <div className="p-4 bg-[var(--bg-secondary)]/40 rounded-2xl border border-amber-500/10 space-y-3">
                  <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-tighter">Referral Code</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-[var(--text-color)] tracking-widest">{user.referralCode || 'DIZIPAY50'}</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(user.referralCode || 'DIZIPAY50');
                        toast.success("Code copied!");
                      }}
                      className="px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-[10px] font-black uppercase hover:bg-amber-500/20 transition-all cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                
                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed font-medium">Earn 1-2 coins on successful recharges. 50 Coins = ₹1 Wallet Balance.</p>
              </div>
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-all duration-700"></div>
            </div>

            <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h5 className="text-emerald-400 font-black text-xs uppercase tracking-widest">KYC Verified</h5>
                <p className="text-[10px] text-emerald-400/60 font-medium">Full account access enabled</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Motion.div>
  );
}
