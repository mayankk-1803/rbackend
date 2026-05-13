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
      className="max-w-4xl mx-auto space-y-6 md:space-y-8"
    >
      <div className="bg-white/70 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-600" /> Help & Support
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-medium tracking-wide">We are here to assist you</p>
          </div>
          <button onClick={() => navigate('/profile')} className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 flex items-start gap-4">
              <div className="p-3 bg-white rounded-xl shadow-sm border border-indigo-100">
                <Mail className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Email Support</p>
                <a href="mailto:sales@dizipay.in" className="text-lg font-black text-indigo-900 hover:text-indigo-700 transition-colors">
                  sales@dizipay.in
                </a>
                <p className="text-xs text-indigo-600/80 mt-1">Average response time: 2-4 hours</p>
              </div>
            </div>

            <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100 flex items-start gap-4">
              <div className="p-3 bg-white rounded-xl shadow-sm border border-amber-100">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Operating Hours</p>
                <p className="text-lg font-black text-amber-900">9:00 AM - 6:00 PM</p>
                <p className="text-xs text-amber-700/80 mt-1">Monday to Saturday</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-6">
              <MessageSquare className="w-5 h-5 text-slate-400" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Frequently Asked Questions</h3>
            </div>
            
            <div className="space-y-3">
              {FAQs.map((faq, idx) => (
                <div key={idx} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm hover:border-indigo-200 transition-colors">
                  <button 
                    onClick={() => toggleAccordion(idx)}
                    className="w-full px-6 py-4 flex items-center justify-between bg-white text-left focus:outline-none"
                  >
                    <span className="text-sm font-bold text-slate-800 pr-4">{faq.question}</span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 shrink-0 ${openIndex === idx ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {openIndex === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="px-6 pb-5 pt-1 text-xs text-slate-500 leading-relaxed border-t border-slate-50/50">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-slate-400 shrink-0 mt-1" />
            <div>
              <p className="text-xs font-black text-slate-700 uppercase mb-1">Need further assistance?</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                If your issue isn't covered in our FAQs, please don't hesitate to reach out to our support team via email at <a href="mailto:sales@dizipay.in" className="text-indigo-600 font-bold hover:underline">sales@dizipay.in</a>. We're committed to resolving your concerns promptly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
