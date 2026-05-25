import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, Download, Smartphone, CheckCircle2, ShieldCheck, Clock, AlertCircle } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { formatAmount } from '../../utils/helpers';
import toast from 'react-hot-toast';

// A4 Optimized Template for PDF Export (Remains light for printer friendliness)
const PrintableInvoice = React.forwardRef(({ transaction, snapshot, displayDate, displayAmount, displayRef, displayOperator, displayMobile, customer }, ref) => (
  <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
    <div 
      ref={ref} 
      style={{ 
        width: '210mm', 
        minHeight: '297mm', 
        padding: '20mm', 
        backgroundColor: '#ffffff',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '48px', height: '48px', backgroundColor: '#06b6d4', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Smartphone style={{ color: '#ffffff', width: '28px', height: '28px' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: '#0f172a' }}>DIZIPAY <span style={{ color: '#0891b2' }}>WALLET</span></h1>
            <p style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>Transaction Receipt</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ padding: '6px 16px', borderRadius: '20px', backgroundColor: transaction.status === 'SUCCESS' ? '#f0fdf4' : '#fff1f2', border: `1px solid ${transaction.status === 'SUCCESS' ? '#dcfce7' : '#ffe4e6'}`, display: 'inline-block' }}>
            <span style={{ fontSize: '12px', fontWeight: '900', color: transaction.status === 'SUCCESS' ? '#16a34a' : '#e11d48' }}>{transaction.status}</span>
          </div>
          <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', marginTop: '12px' }}>DATE: {new Date(displayDate).toLocaleString()}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '40px' }}>
        <div>
          <h3 style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>Issued To</h3>
          <p style={{ fontSize: '14px', fontWeight: '900', margin: 0 }}>{customer.name || 'Customer'}</p>
          <p style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', marginTop: '4px' }}>REF ID: #{transaction.id}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h3 style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>Payment Mode</h3>
          <p style={{ fontSize: '14px', fontWeight: '900', margin: 0 }}>Dizipay Wallet</p>
          <p style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', marginTop: '4px' }}>Balance Adjustment</p>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '30px 0', marginBottom: '40px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>
              <th style={{ textAlign: 'left', paddingBottom: '20px' }}>Item Description</th>
              <th style={{ textAlign: 'center', paddingBottom: '20px' }}>Mobile Number</th>
              <th style={{ textAlign: 'right', paddingBottom: '20px' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '24px 0' }}>
                <p style={{ fontSize: '14px', fontWeight: '900', margin: 0 }}>{displayOperator} RECHARGE</p>
                <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginTop: '4px' }}>TYPE: {transaction.type}</p>
              </td>
              <td style={{ textAlign: 'center', padding: '24px 0' }}>
                <p style={{ fontSize: '14px', fontWeight: '900', color: '#475569' }}>{displayMobile}</p>
              </td>
              <td style={{ textAlign: 'right', padding: '24px 0' }}>
                <p style={{ fontSize: '16px', fontWeight: '900' }}>₹{formatAmount(displayAmount)}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '60px' }}>
        <div style={{ width: '240px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '800', color: '#94a3b8', marginBottom: '12px' }}>
            <span>RECHARGE AMOUNT</span>
            <span style={{ color: '#0f172a' }}>₹{formatAmount(displayAmount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '800', color: '#10b981', marginBottom: '12px' }}>
            <span>CASHBACK EARNED</span>
            <span>+₹{formatAmount(transaction.cashback || 0)}</span>
          </div>
          <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '900', color: '#0f172a' }}>FINAL ADJUSTMENT</span>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#0891b2' }}>₹{formatAmount(displayAmount)}</span>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
            <ShieldCheck style={{ width: '14px', height: '14px', color: '#06b6d4' }} /> Certified Digital Transaction
          </div>
          <p style={{ fontSize: '9px', color: '#94a3b8', margin: 0, fontWeight: '700', lineHeight: '1.5' }}>
            This receipt is an electronic record under IT Act, 2000. It is valid without a physical signature. Verified by Dizipay Compliance Engine.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '10px', fontWeight: '900', color: '#0f172a', marginBottom: '4px' }}>PROVIDER REFERENCE</p>
          <p style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace', wordBreak: 'break-all' }}>{displayRef}</p>
        </div>
      </div>
    </div>
  </div>
));

export const InvoiceModal = ({ isOpen, onClose, transaction }) => {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const printRef = useRef();

  if (!transaction) return null;

  const snapshot = transaction.invoiceSnapshot || {};
  const customer = snapshot.customer || transaction.user || {};
  const displayOperator = snapshot.operator || transaction.operator;
  const displayMobile = snapshot.mobile || transaction.mobile;
  const displayAmount = snapshot.amount || transaction.amount;
  const displayRef = snapshot.providerRef || transaction.providerRef || 'PENDING';
  const displayDate = snapshot.timestamp || transaction.createdAt;

  const handleDownload = async () => {
    try {
      setIsGenerating(true);
      const toastId = toast.loading("Preparing PDF download...");

      if (!printRef.current) {
        toast.error("Template not ready", { id: toastId });
        return;
      }

      const element = printRef.current;
      const opt = {
        margin: 0,
        filename: `dizipay-invoice-${transaction.id}.pdf`,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          scrollY: 0,
          windowWidth: 794 // Fixed A4 width for consistent rendering
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      await html2pdf().set(opt).from(element).save();
      toast.success("Receipt downloaded", { id: toastId });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("PDF ERROR:", error);
      }
      toast.error("Failed to generate PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Hidden Print Template */}
          <PrintableInvoice 
            ref={printRef}
            transaction={transaction}
            snapshot={snapshot}
            displayDate={displayDate}
            displayAmount={displayAmount}
            displayRef={displayRef}
            displayOperator={displayOperator}
            displayMobile={displayMobile}
            customer={customer}
          />

          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative w-full max-w-2xl glass-modal shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[90vh] border border-white/10 rounded-[2rem]"
            >
              {/* Header Actions - STICKY */}
              <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-slate-950/40 sticky top-0 z-10 backdrop-blur-md">
                <div className="flex gap-2">
                  <button 
                    onClick={handleDownload}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-102 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    <Download className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} /> 
                    {isGenerating ? 'Processing...' : 'Download PDF'}
                  </button>
                  <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-200 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-102 transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4" /> Print
                  </button>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-slate-900/50 rounded-full transition-colors text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal View Content */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950/20">
                <div className="glass-card p-8 md:p-10 rounded-2xl border border-white/5 shadow-2xl relative overflow-hidden">
                  {/* Branding */}
                  <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-10">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-950 rounded-xl flex items-center justify-center border border-white/5 shadow-inner">
                        <Smartphone className="w-6 h-6 text-cyan-400 cyan-glow" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black tracking-tight uppercase italic text-white">Dizipay <span className="text-cyan-400 cyan-glow">Wallet</span></h2>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Digital Payment</p>
                      </div>
                    </div>
                    <div className="md:text-right">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${
                        transaction.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' : 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                      }`}>
                        {transaction.status === 'SUCCESS' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {transaction.status}
                      </span>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-2 tracking-widest">
                        {new Date(displayDate).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                    <div>
                      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Customer</h4>
                      <p className="text-sm font-black text-white">{customer.name || 'Account Holder'}</p>
                      <p className="text-xs text-slate-500 font-bold mt-0.5">Ref: #{transaction.id}</p>
                    </div>
                    <div className="md:text-right">
                      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Service</h4>
                      <p className="text-sm font-black text-white uppercase tracking-tight">{displayOperator}</p>
                      <p className="text-xs text-slate-500 font-bold mt-0.5">{displayMobile}</p>
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="bg-slate-950/40 rounded-2xl p-6 border border-white/5 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recharge Amount</span>
                      <span className="text-lg font-black text-white">₹{formatAmount(displayAmount)}</span>
                    </div>
                    {transaction.cashback > 0 && (
                      <div className="flex justify-between items-center text-emerald-400">
                        <span className="text-[10px] font-black uppercase tracking-widest">Cashback Earned</span>
                        <span className="text-sm font-black emerald-glow">+₹{formatAmount(transaction.cashback)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-4 border-t border-white/5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operator Ref</span>
                      <span className="text-[10px] font-mono font-bold text-slate-400 truncate max-w-[150px]">{displayRef}</span>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" /> AES-256 Encrypted Receipt
                    </div>
                    <p className="text-[8px] text-slate-500 font-medium">© 2026 DIZIPAY FINTECH CORP</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
