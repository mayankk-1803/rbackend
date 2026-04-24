import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ShieldCheck } from 'lucide-react';

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
      // Assuming same endpoint since roles are checked afterwards
      const { data } = await api.post('/auth/login', { email, password });
      
      const { token, user } = data.data;
      
      if (user.role !== 'admin') {
        toast.error('Unauthorized. Elevated privileges required.');
        return;
      }
      
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminUser', JSON.stringify(user));
      
      toast.success('Admin authenticated');
      navigate('/');
    } catch(err) {
      toast.error(err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white p-8 border border-[#E5E7EB] rounded-lg shadow-sm">
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="w-12 h-12 bg-[#0F172A] rounded-md flex items-center justify-center mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-[#0F172A]">Dizipay Admin System</h2>
          <p className="text-sm text-[#64748B] mt-1">Sign in with administrative privileges</p>
        </div>
        
        <form className="space-y-5" onSubmit={handleLogin}>
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">Administrator Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-[#0F172A] focus:border-[#0F172A] sm:text-sm"
              placeholder="Enter Email Address"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-[#0F172A] focus:border-[#0F172A] sm:text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#0F172A] hover:bg-black focus:outline-none disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? 'Authenticating...' : 'Secure Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
