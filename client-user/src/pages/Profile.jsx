import React, { useState, useRef } from 'react';
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-gradient-to-r from-[#6D28D9] via-[#4F46E5] to-[#3B82F6] pt-12 pb-24 px-6 shadow-md relative">
        <h1 className="text-white text-xl font-bold">My Profile</h1>
      </div>

      <div className="px-5 -mt-14 relative z-10 flex-1">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 flex flex-col items-center">
          <div className="relative mb-4">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-2xl shadow-inner overflow-hidden">
              {uploading ? (
                <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
              ) : user.profileImage ? (
                <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                (user.name || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 bg-indigo-600 text-white p-1.5 rounded-full shadow-md hover:bg-indigo-700 transition"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
          
          {isEditing ? (
            <div className="flex items-center gap-2 mb-2">
              <input 
                type="text" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
                className="border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-indigo-500"
                autoFocus
              />
              <button onClick={handleNameSave} className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded font-medium hover:bg-indigo-700">Save</button>
              <button onClick={() => setIsEditing(false)} className="bg-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded font-medium hover:bg-gray-300">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-gray-800">{user.name || 'User Account'}</h2>
              <button onClick={() => { setIsEditing(true); setNewName(user.name || ''); }} className="text-gray-400 hover:text-indigo-600">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
          
          <p className="text-sm text-gray-500 font-medium">{user.phone}</p>
          <div className="mt-4 px-4 py-1.5 bg-green-50 text-green-600 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> KYC Verified
          </div>
        </div>

        <div className="mt-6 space-y-2 mb-20">
          {menuItems.map((item, idx) => (
            <button 
              key={idx} 
              onClick={item.action}
              className="w-full bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${item.textDanger ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-500'}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className={`font-semibold text-sm ${item.textDanger ? 'text-red-500' : 'text-gray-700'}`}>{item.label}</span>
              </div>
              <ChevronRight className={`w-5 h-5 ${item.textDanger ? 'text-red-300' : 'text-gray-300'}`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
