import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Mail, Clock, ChevronDown, MessageSquare, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
