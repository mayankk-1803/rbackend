import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPhoneLogin, setIsPhoneLogin] = useState(true);
  const [timer, setTimer] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleSendOTP = async () => {
    if (phone.length < 10) return toast.error("Enter valid phone number");
    
    setLoading(true);
    try {
      const formatPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      await api.post('/auth/send-otp', { phone: formatPhone });
      setConfirmationResult(true);
      setTimer(60);
      toast.success("OTP sent successfully");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndLogin = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 4) return toast.error("Enter 4-digit OTP");
    
    setLoading(true);
    try {
      const formatPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      const res = await api.post('/auth/verify-otp', { otpCode, phone: formatPhone });

      if (res.data.success) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        toast.success('Welcome back!');
        window.location.href = '/';
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid OTP or Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if(!email || !password) return;
    
    setLoading(true);
    try {
      const { data } = await api.post(API_ROUTES.AUTH.LOGIN, { email, password });
      const { token, user } = data.data;
      
      if (user.role !== 'user') {
        toast.error('Unauthorized access');
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
      <div className="max-w-md w-full bg-white p-8 border border-[#E5E7EB] rounded-2xl shadow-sm">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-[#0F172A]">{isPhoneLogin ? 'Login with OTP' : 'Welcome Back'}</h2>
          <p className="text-sm text-[#64748B] mt-1">Sign in to your account to continue</p>
        </div>

        {isPhoneLogin ? (
          <div className="space-y-5">
            {!confirmationResult ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Phone Number</label>
                  <div className="flex gap-2">
                    <div className="flex-none w-16 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center text-sm font-medium text-slate-500">
                      +91
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="flex-1 px-4 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#6D28D9]/10 focus:border-[#6D28D9] transition-all"
                      placeholder="9876543210"
                    />
                  </div>
                </div>
                <button
                  onClick={handleSendOTP}
                  disabled={loading || phone.length < 10}
                  className="w-full py-3 bg-[#6D28D9] text-white rounded-lg text-sm font-bold shadow-lg shadow-[#6D28D9]/20 hover:bg-[#5B21B6] transition-all disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send OTP'}
                </button>
              </>
            ) : (
              <form onSubmit={handleVerifyAndLogin} className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider">Verification Code</label>
                    <button type="button" onClick={() => setConfirmationResult(null)} className="text-[10px] font-bold text-[#6D28D9] hover:underline">Change Number</button>
                  </div>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full px-4 py-3 bg-slate-50 border border-[#E2E8F0] rounded-xl text-center text-2xl font-bold tracking-[0.5em] outline-none focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9] transition-all"
                    placeholder="0000"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || otpCode.length < 4}
                  className="w-full py-3 bg-[#6D28D9] text-white rounded-lg text-sm font-bold shadow-lg shadow-[#6D28D9]/20 hover:bg-[#5B21B6] transition-all disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify & Login'}
                </button>
                <div className="text-center">
                  {timer > 0 ? (
                    <p className="text-xs text-[#64748B]">Resend code in <span className="font-bold text-[#0F172A]">{timer}s</span></p>
                  ) : (
                    <button type="button" onClick={handleSendOTP} className="text-xs font-bold text-[#6D28D9] hover:underline">Resend OTP</button>
                  )}
                </div>
              </form>
            )}
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleEmailLogin}>
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
              className="w-full py-2 bg-[#6D28D9] text-white rounded-md text-sm font-medium hover:bg-[#5B21B6] transition-colors disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        )}

        <div className="mt-6 flex flex-col items-center gap-4">
          <button 
            onClick={() => { setIsPhoneLogin(!isPhoneLogin); setConfirmationResult(null); }}
            className="text-xs font-bold text-[#64748B] hover:text-[#6D28D9] transition-colors"
          >
            {isPhoneLogin ? 'Login with Email instead' : 'Login with Phone OTP instead'}
          </button>
          
          <div className="text-sm">
            <span className="text-[#64748B]">Don't have an account? </span>
            <Link to="/register" className="font-medium text-[#6D28D9] hover:text-[#5B21B6]">Sign Up</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
