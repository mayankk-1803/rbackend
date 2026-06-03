import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Mail, Clock, ChevronDown, MessageSquare, AlertCircle, ArrowLeft, ShieldAlert, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const FAQs = [
  {
    question: "Recharge pending, what should I do?",
    answer: "Most pending recharges are resolved within 2-4 hours. Do not attempt another recharge for the same number until the status updates to either Success or Failed."
  },
  {
    question: "What is the refund timeline for failed recharges?",
    answer: "Instant to 24 hours depending on operator response. Once failed, the amount is automatically credited back to your wallet."
  },
  {
    question: "Recharge failed but amount deducted?",
    answer: "If the recharge fails but your wallet balance is deducted, our system automatically detects this and initiates a refund. It will reflect in your wallet shortly."
  },
  {
    question: "How do I redeem Earned Coins?",
    answer: "You can redeem your Earned Coins from the 'Earned Coins' section in your Profile. You need a minimum of 50 coins to redeem them for wallet balance."
  },
  {
    question: "Wallet balance is not updating?",
    answer: "Try refreshing the page or checking your transaction history. If an added amount does not reflect, ensure the payment was successful. Contact support if the issue persists."
  },
  {
    question: "Why is my recharge experiencing processing delays?",
    answer: "Processing delays are usually due to operator network congestion or bank server downtime. Please wait a few hours; the system will automatically retry or refund."
  }
];

export default function Support() {
  const [openIndex, setOpenIndex] = useState(null);
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState([]);
  const [loadingDisputes, setLoadingDisputes] = useState(true);

  const fetchDisputes = async () => {
    setLoadingDisputes(true);
    try {
      const res = await api.get('/user/disputes');
      if (res.data?.success) {
        setDisputes(res.data.data || []);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error("Failed to fetch disputes:", err);
    } finally {
      setLoadingDisputes(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, []);

  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6 md:space-y-8 relative z-10"
    >
      <div className="glass-card border border-[var(--glass-border)] rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--glass-border)] bg-[var(--glass-button-bg)] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-[var(--text-color)] uppercase tracking-tight flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-400 indigo-glow" /> Help & Support
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium tracking-wide">We are here to assist you</p>
          </div>
          <button onClick={() => navigate('/profile')} className="text-xs font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 flex items-center gap-1 cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-indigo-500/5 p-6 rounded-2xl border border-indigo-500/20 flex items-start gap-4">
              <div className="p-3 bg-[var(--glass-input-bg)] rounded-xl shadow-sm border border-indigo-500/20">
                <Mail className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-indigo-400/80 uppercase tracking-widest mb-1">Email Support</p>
                <a href="mailto:sales@dizipay.in" className="text-lg font-black text-indigo-300 hover:text-indigo-200 transition-colors">
                  sales@dizipay.in
                </a>
                <p className="text-xs text-indigo-400/70 mt-1">Average response time: 2-4 hours</p>
              </div>
            </div>

            <div className="bg-amber-500/5 p-6 rounded-2xl border border-amber-500/20 flex items-start gap-4">
              <div className="p-3 bg-[var(--glass-input-bg)] rounded-xl shadow-sm border border-amber-500/20">
                <Clock className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Operating Hours</p>
                <p className="text-lg font-black text-amber-400">9:00 AM - 6:00 PM</p>
                <p className="text-xs text-amber-400/70 mt-1">Monday to Saturday</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[var(--glass-border)]">
            <div className="flex items-center gap-2 mb-6">
              <MessageSquare className="w-5 h-5 text-[var(--text-muted)]" />
              <h3 className="text-sm font-black text-[var(--text-color)] uppercase tracking-tight">Frequently Asked Questions</h3>
            </div>
            
            <div className="space-y-3">
              {FAQs.map((faq, idx) => (
                <div key={idx} className="border border-[var(--glass-border)] rounded-2xl overflow-hidden bg-[var(--glass-card-bg)] shadow-sm hover:border-indigo-500/20 transition-colors">
                  <button 
                    onClick={() => toggleAccordion(idx)}
                    className="w-full px-6 py-4 flex items-center justify-between bg-transparent text-left focus:outline-none cursor-pointer"
                  >
                    <span className="text-sm font-bold text-[var(--text-color)] pr-4">{faq.question}</span>
                    <ChevronDown className={`w-5 h-5 text-[var(--text-muted)] transition-transform duration-300 shrink-0 ${openIndex === idx ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {openIndex === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="px-6 pb-5 pt-1 text-xs text-[var(--text-secondary)] leading-relaxed border-t border-[var(--glass-border)]">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>

          {/* My Disputes Section */}
          <div className="space-y-4 pt-6 border-t border-[var(--glass-border)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400 hover:scale-105 transition-transform animate-pulse" />
                <h3 className="text-sm font-black text-[var(--text-color)] uppercase tracking-tight">My Support Tickets & Disputes</h3>
              </div>
              <button 
                onClick={fetchDisputes}
                disabled={loadingDisputes}
                className="p-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-color)] flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                title="Refresh disputes list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDisputes ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {loadingDisputes ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-2">
                <RefreshCw className="w-6 h-6 text-[var(--text-muted)] animate-spin" />
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Loading tickets...</span>
              </div>
            ) : disputes.length === 0 ? (
              <div className="bg-[var(--glass-card-bg)] p-6 rounded-2xl border border-[var(--glass-border)] text-center space-y-2">
                <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">No active disputes</p>
                <p className="text-[10px] text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
                  You don't have any raised disputes. If you face any issues with a recharge, go to your 
                  <span 
                    onClick={() => navigate('/history')}
                    className="text-indigo-400 font-bold hover:underline mx-1 cursor-pointer"
                  >
                    Purchase History
                  </span> 
                  and click the "Raise Dispute" button next to the transaction.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {disputes.map((dispute) => {
                  let statusBg = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
                  if (dispute.status === 'UNDER_REVIEW') statusBg = 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
                  if (dispute.status === 'RESOLVED') statusBg = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
                  if (dispute.status === 'REJECTED') statusBg = 'bg-rose-500/10 text-rose-500 border-rose-500/20';

                  return (
                    <motion.div 
                      key={dispute.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[var(--glass-card-bg)] border border-[var(--glass-border)] rounded-2xl p-5 space-y-4 hover:border-indigo-500/20 transition-all hover:shadow-lg hover:shadow-indigo-500/5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] font-black text-[var(--text-color)] uppercase tracking-wider">
                            Case #{dispute.id}_DIS
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border ${statusBg}`}>
                            {dispute.status.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                          {new Date(dispute.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </div>

                      <div className="bg-[var(--glass-input-bg)] border border-[var(--glass-border)] px-4 py-3 rounded-xl flex flex-wrap gap-x-6 gap-y-1 text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">
                        <span>Operator: <span className="text-[var(--text-color)]">{dispute.transaction?.operator || 'N/A'}</span></span>
                        <span>Mobile: <span className="text-[var(--text-color)]">{dispute.transaction?.mobile || 'N/A'}</span></span>
                        <span>Amount: <span className="text-[var(--text-color)]">₹{dispute.transaction?.amount || 'N/A'}</span></span>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-wider">Your Complaint</p>
                        <p className="text-xs text-[var(--text-color)] bg-[var(--bg-secondary)]/10 p-3 rounded-xl italic leading-relaxed border border-[var(--glass-border)]">
                          "{dispute.description}"
                        </p>
                      </div>

                      {dispute.remarks && (
                        <div className="space-y-1.5 pt-1 border-t border-[var(--glass-border)]">
                          <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-wider">Resolution Remarks</p>
                          <div className={`p-3 rounded-xl text-xs leading-relaxed border ${
                            dispute.status === 'RESOLVED' 
                              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400/90' 
                              : 'bg-rose-500/5 border-rose-500/20 text-rose-400/90'
                          }`}>
                            {dispute.remarks}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-[var(--glass-card-bg)] p-6 rounded-2xl border border-[var(--glass-border)] flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-[var(--text-muted)] shrink-0 mt-1" />
            <div>
              <p className="text-xs font-black text-[var(--text-color)] uppercase mb-1">Need further assistance?</p>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                If your issue isn't covered in our FAQs, please don't hesitate to reach out to our support team via email at <a href="mailto:sales@dizipay.in" className="text-indigo-400 font-bold hover:underline">sales@dizipay.in</a>. We're committed to resolving your concerns promptly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
