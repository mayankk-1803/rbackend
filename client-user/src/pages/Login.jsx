import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if(!email || !password) return;
    
    setLoading(true);
    try {
      const { data } = await api.post(API_ROUTES.AUTH.LOGIN, { email, password });
      
      const { token, user } = data.data;
      
      if (user.role !== 'user') {
        toast.error('Unauthorized access. This area is for users only.');
        return;
      }
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      toast.success('Successfully logged in');
      window.location.href = '/';
    } catch(err) {
      toast.error(err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white p-8 border border-[#E5E7EB] rounded-lg shadow-sm">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-[#0F172A]">Welcome Back</h2>
          <p className="text-sm text-[#64748B] mt-1">Sign in to your account to continue</p>
        </div>
        
        <form className="space-y-5" onSubmit={handleLogin}>
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-[#6D28D9] focus:border-[#6D28D9] sm:text-sm"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-[#6D28D9] focus:border-[#6D28D9] sm:text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#6D28D9] hover:bg-[#5B21B6] focus:outline-none disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-[#64748B]">Don't have an account? </span>
          <Link to="/register" className="font-medium text-[#6D28D9] hover:text-[#5B21B6]">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
