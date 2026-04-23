import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { API_ROUTES } from '../api/routes';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function LoanRecharge() {
  const [number, setNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('HDFC Bank');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRecharge = async (e) => {
    e.preventDefault();
    if(!number || !amount) return;

    const loadingToast = toast.loading('Processing Loan EMI payment...');
    setLoading(true);
    try {
      const { data } = await api.post(API_ROUTES.RECHARGE.CREATE, {
        mobile: number,
        amount: Number(amount),
        operator,
        type: 'loan'
      });
      toast.success(data.message || 'Payment initiated', { id: loadingToast });
      navigate('/history');
    } catch(err) {
      toast.error(err.response?.data?.message || 'Payment failed', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-[#E5E7EB] bg-[#F8FAFC]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Loan EMI Payment</h2>
          <p className="text-sm text-[#64748B] mt-1">Pay your loan EMI instantly</p>
        </div>

        <form onSubmit={handleRecharge} className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">Loan Account Number</label>
              <input
                type="text"
                required
                value={number}
                onChange={e => setNumber(e.target.value)}
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-[#6D28D9] focus:border-[#6D28D9] sm:text-sm"
                placeholder="Enter loan account number"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1">Bank / Lender</label>
                <select
                  value={operator}
                  onChange={e => setOperator(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E7EB] bg-white rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-[#6D28D9] focus:border-[#6D28D9] sm:text-sm text-[#0F172A]"
                >
                  <option value="HDFC Bank">HDFC Bank</option>
                  <option value="ICICI Bank">ICICI Bank</option>
                  <option value="SBI">State Bank of India</option>
                  <option value="Axis Bank">Axis Bank</option>
                  <option value="Kotak Bank">Kotak Bank</option>
                  <option value="Bajaj Finserv">Bajaj Finserv</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1">Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-[#6D28D9] focus:border-[#6D28D9] sm:text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-md p-4 text-sm text-[#64748B]">
            Ensure the details are correct. The amount will be deducted from your wallet balance instantly.
          </div>

          <div className="flex justify-end border-t border-[#E5E7EB] pt-6 mt-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              disabled={loading || !number || !amount}
              type="submit"
              className="px-6 py-2 bg-[#6D28D9] text-white font-medium rounded-md hover:bg-[#5B21B6] disabled:bg-[#94A3B8] disabled:cursor-not-allowed transition-colors text-sm shadow-sm"
            >
              {loading ? 'Processing...' : 'Pay EMI'}
            </motion.button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}