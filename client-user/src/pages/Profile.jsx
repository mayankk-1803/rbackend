import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { User, Settings, LogOut, ShieldCheck, HelpCircle, ChevronRight, Edit2, Camera, Code2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import axios from 'axios';
import socket from '../services/socket';

export default function Profile() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('dizipay_user_data')) || { name: 'User Account', phone: '+91 9876543210' });
  const [wallet, setWallet] = useState({ coinBalance: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(user.name || '');
  const [uploading, setUploading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    const fetchWallet = () => {
      api.get("/wallet")
        .then(res => setWallet(res.data.wallet))
        .catch(err => {
          if (import.meta.env.DEV) {
            console.error(err);
          }
        });
    };
    fetchWallet();

    const handleCoinsAwarded = (data) => {
      setWallet(prev => {
        if (!prev) return { coinBalance: data.newBalance };
        return { ...prev, coinBalance: data.newBalance };
      });
    };

    const handleWalletUpdate = () => {
      fetchWallet();
    };
    
    socket.on('earned_coins_awarded', handleCoinsAwarded);
    socket.on('wallet_updated', handleWalletUpdate);

    return () => {
      socket.off('earned_coins_awarded', handleCoinsAwarded);
      socket.off('wallet_updated', handleWalletUpdate);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('dizipay_user_token');
    localStorage.removeItem('dizipay_user_data');
    toast.success('Logged out successfully');
    window.location.href = '/login';
  };

  const menuItems = [
    { icon: Settings, label: 'Account Settings', action: () => setIsEditing(true) },
    { icon: Code2, label: 'Developer Portal', action: () => navigate('/developer') },
    { icon: ShieldCheck, label: 'Security & Privacy', action: () => navigate('/profile/security') },
    { icon: HelpCircle, label: 'Help & Support', action: () => navigate('/profile/support') },
    { icon: LogOut, label: 'Log Out', textDanger: true, action: handleLogout }
  ];

  const handleNameSave = async () => {
    try {
      const res = await api.put('/user/update-profile', { name: newName });
      const updated = { ...user, ...res.data.data };
      setUser(updated);
      localStorage.setItem('dizipay_user_data', JSON.stringify(updated));
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
      localStorage.setItem('dizipay_user_data', JSON.stringify(updated));
      toast.success("Profile image updated");
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error(e);
      }
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
      <div className="bg-white/70 backdrop-blur-2xl border border-slate-200 rounded-2xl md:rounded-3xl overflow-hidden shadow-xl">
        <div className="bg-gradient-to-r from-cyan-50 via-purple-50 to-blue-50 p-6 md:p-8 flex flex-col items-center border-b border-slate-100 relative overflow-hidden">
          {/* Animated Background Orbs */}
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>

          <div className="relative group mb-6">
            <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center border-2 border-slate-200 shadow-sm overflow-hidden group-hover:shadow-md transition-all duration-500">
              {uploading ? (
                <div className="animate-spin h-8 w-8 border-3 border-cyan-500 border-t-transparent rounded-full"></div>
              ) : user.profileImage ? (
                <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-600 to-purple-600">
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
              <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-slate-200">
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  className="bg-transparent text-slate-900 px-4 py-2 outline-none w-32 md:w-48 font-bold text-sm md:text-base"
                  autoFocus
                />
                <button onClick={handleNameSave} className="bg-cyan-600 text-white text-[10px] font-black uppercase px-3 md:px-4 py-2 rounded-lg hover:bg-cyan-500 transition-all">Save</button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight">{user.name || 'User Account'}</h2>
                <button onClick={() => { setIsEditing(true); setNewName(user.name || ''); }} className="text-slate-400 hover:text-cyan-600 transition-colors">
                  <Edit2 className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
            )}
            <p className="text-slate-500 font-mono tracking-widest text-[10px] md:text-xs uppercase">{user.phone}</p>
          </div>
        </div>

        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Account Navigator</h3>
            {menuItems.map((item, idx) => (
              <motion.button 
                key={idx} 
                whileHover={{ x: 10, backgroundColor: 'rgba(255,255,255,1)' }}
                onClick={item.action}
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between transition-all group hover:shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${item.textDanger ? 'bg-rose-50 text-rose-600' : 'bg-cyan-50 text-cyan-600'}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className={`font-bold text-sm ${item.textDanger ? 'text-rose-600' : 'text-slate-500 group-hover:text-slate-900'}`}>{item.label}</span>
                </div>
                <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${item.textDanger ? 'text-rose-200' : 'text-slate-300'}`} />
              </motion.button>
            ))}
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Earned Coins</h3>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 p-6 rounded-3xl relative overflow-hidden group">
              <div className="relative z-10 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Your Coins</p>
                    <h4 className="text-3xl font-black text-slate-900">{wallet.coinBalance || 0}</h4>
                  </div>
                  <button 
                    onClick={() => navigate('/earned-coins')}
                    className="px-4 py-2 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all"
                  >
                    Manage
                  </button>
                </div>
                
                <div className="p-4 bg-white/50 rounded-2xl border border-amber-100/50 space-y-3">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Referral Code</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-slate-900 tracking-widest">{user.referralCode || 'DIZIPAY50'}</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(user.referralCode || 'DIZIPAY50');
                        toast.success("Code copied!");
                      }}
                      className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase hover:bg-amber-200 transition-all"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Earn 1-2 coins on successful recharges. 50 Coins = ₹1 Wallet Balance.</p>
              </div>
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-amber-400/5 rounded-full blur-3xl group-hover:bg-amber-400/10 transition-all duration-700"></div>
            </div>

            <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h5 className="text-emerald-600 font-black text-xs uppercase tracking-widest">KYC Verified</h5>
                <p className="text-[10px] text-emerald-600/60 font-medium">Full account access enabled</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
