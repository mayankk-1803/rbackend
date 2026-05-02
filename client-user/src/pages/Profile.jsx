import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { User, Settings, LogOut, ShieldCheck, HelpCircle, ChevronRight, Edit2, Camera } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import axios from 'axios';

export default function Profile() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || { name: 'User Account', phone: '+91 9876543210' });
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(user.name || '');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Logged out successfully');
    window.location.href = '/login';
  };

  const menuItems = [
    { icon: Settings, label: 'Account Settings', action: () => setIsEditing(true) },
    { icon: ShieldCheck, label: 'Security & Privacy', action: () => toast('Coming soon!', { icon: '🔒' }) },
    { icon: HelpCircle, label: 'Help & Support', action: () => toast('Coming soon!', { icon: '🎧' }) },
    { icon: LogOut, label: 'Log Out', textDanger: true, action: handleLogout }
  ];

  const handleNameSave = async () => {
    try {
      const res = await api.put('/user/update-profile', { name: newName });
      const updated = { ...user, ...res.data.data };
      setUser(updated);
      localStorage.setItem('user', JSON.stringify(updated));
      setIsEditing(false);
      toast.success("Name updated successfully");
    } catch(e) {
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
      localStorage.setItem('user', JSON.stringify(updated));
      toast.success("Profile image updated");
    } catch (e) {
      console.error(e);
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-4 md:space-y-8"
    >
      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-cyan-600/20 via-purple-600/20 to-blue-600/20 p-6 md:p-8 flex flex-col items-center border-b border-white/10 relative overflow-hidden">
          {/* Animated Background Orbs */}
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

          <div className="relative group mb-6">
            <div className="w-32 h-32 bg-slate-900 rounded-full flex items-center justify-center border-2 border-white/10 shadow-[0_0_30px_rgba(6,182,212,0.2)] overflow-hidden group-hover:shadow-[0_0_50px_rgba(6,182,212,0.4)] transition-all duration-500">
              {uploading ? (
                <div className="animate-spin h-8 w-8 border-3 border-cyan-400 border-t-transparent rounded-full"></div>
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
              className="absolute bottom-1 right-1 bg-gradient-to-br from-cyan-500 to-purple-600 p-2.5 rounded-full shadow-lg hover:scale-110 transition-transform border border-white/20"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
          </div>

          <div className="text-center space-y-2">
            {isEditing ? (
              <div className="flex items-center gap-3 bg-white/5 p-1 rounded-xl border border-white/10">
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  className="bg-transparent text-white px-4 py-2 outline-none w-32 md:w-48 font-bold text-sm md:text-base"
                  autoFocus
                />
                <button onClick={handleNameSave} className="bg-cyan-500 text-slate-900 text-[10px] font-black uppercase px-3 md:px-4 py-2 rounded-lg hover:bg-cyan-400 transition-all">Save</button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <h2 className="text-xl md:text-3xl font-black text-white tracking-tight drop-shadow-lg">{user.name || 'User Account'}</h2>
                <button onClick={() => { setIsEditing(true); setNewName(user.name || ''); }} className="text-slate-500 hover:text-cyan-400 transition-colors">
                  <Edit2 className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
            )}
            <p className="text-slate-400 font-mono tracking-widest text-[10px] md:text-xs uppercase">{user.phone}</p>
          </div>
        </div>

        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Account Navigator</h3>
            {menuItems.map((item, idx) => (
              <motion.button 
                key={idx} 
                whileHover={{ x: 10, backgroundColor: 'rgba(255,255,255,0.05)' }}
                onClick={item.action}
                className="w-full p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${item.textDanger ? 'bg-rose-500/10 text-rose-500' : 'bg-cyan-500/10 text-cyan-400'}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className={`font-bold text-sm ${item.textDanger ? 'text-rose-500' : 'text-slate-300 group-hover:text-white'}`}>{item.label}</span>
                </div>
                <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${item.textDanger ? 'text-rose-900' : 'text-slate-600'}`} />
              </motion.button>
            ))}
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Referral Program</h3>
            <div className="bg-gradient-to-br from-cyan-500/5 to-purple-500/5 border border-cyan-500/20 p-6 rounded-3xl relative overflow-hidden group">
              <div className="relative z-10 space-y-4">
                <div>
                  <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1">Your Earnings</p>
                  <h4 className="text-3xl font-black text-white">₹{user.cashbackBalance || '0.00'}</h4>
                </div>
                
                <div className="p-4 bg-black/20 rounded-2xl border border-white/5 space-y-3">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Referral Code</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-white tracking-widest">{user.referralCode || 'DIZIPAY50'}</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(user.referralCode || 'DIZIPAY50');
                        toast.success("Code copied!");
                      }}
                      className="px-4 py-2 bg-white/10 rounded-lg text-[10px] font-black uppercase hover:bg-white/20 transition-all"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Earn ₹50 for every friend who completes their first recharge of ₹100 or more.</p>
              </div>
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-cyan-400/5 rounded-full blur-3xl group-hover:bg-cyan-400/10 transition-all duration-700"></div>
            </div>

            <div className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h5 className="text-emerald-400 font-black text-xs uppercase tracking-widest">KYC Verified</h5>
                <p className="text-[10px] text-emerald-500/60 font-medium">Full account access enabled</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
