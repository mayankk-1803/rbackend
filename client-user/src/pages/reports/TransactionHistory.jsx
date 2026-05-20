import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  AlertCircle, 
  FileText,
  Calendar,
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import api from '../../api';
import { formatAmount, safeArray } from '../../utils/helpers';
import { downloadFile } from '../../utils/downloadFile';
import { InvoiceModal } from '../../components/reports/InvoiceModal';
import { DisputeModal } from '../../components/reports/DisputeModal';
import toast from 'react-hot-toast';



const StatCard = ({ title, value, color, icon: Icon }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm relative overflow-hidden group"
  >
    <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-5 blur-3xl -mr-12 -mt-12 rounded-full`}></div>
    <div className="flex justify-between items-start">
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{value}</h3>
      </div>
      <div className={`p-3 rounded-2xl ${color.replace('bg-', 'bg-opacity-10 ')}`}>
        <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
  </motion.div>
);

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: '',
    type: '',
    search: '',
    startDate: '',
    endDate: ''
  });
  const [pagination, setPagination] = useState({ pages: 1 });
  const [isExporting, setIsExporting] = useState(false);
  
  // Modal states
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showDispute, setShowDispute] = useState(false);

  const fetchData = useCallback(async () => {

    setLoading(true);
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const [historyRes, summaryRes] = await Promise.all([
        api.get(`/reports/transactions?${queryParams}`),
        api.get('/reports/summary')
      ]);

      setTransactions(safeArray(historyRes.data.data));
      setPagination(historyRes.data.pagination);
      setSummary(summaryRes.data.data);
    } catch (err) {
      toast.error("Failed to fetch reports");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading("Preparing export...");
    try {
      await downloadFile(api, '/reports/export', `transactions_${Date.now()}.csv`, filters);
      toast.success("Export successful", { id: toastId });
    } catch (err) {
      toast.error("Export failed", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };


  const getStatusBadge = (status) => {
    const styles = {
      SUCCESS: "bg-emerald-50 text-emerald-600 border-emerald-100",
      FAILED: "bg-rose-50 text-rose-600 border-rose-100",
      PENDING: "bg-amber-50 text-amber-600 border-amber-100",
      REFUNDED: "bg-cyan-50 text-cyan-600 border-cyan-100"
    };
    return (
      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${styles[status] || styles.PENDING}`}>
        {status}
      </span>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto space-y-8 py-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Reports <span className="text-cyan-600">Wallet</span></h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Audit-grade financial telemetry</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-cyan-600 hover:text-cyan-600 transition-all shadow-sm disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} /> {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button 
            onClick={fetchData}
            className="p-3 bg-cyan-600 text-white rounded-2xl shadow-lg shadow-cyan-600/20 hover:scale-105 transition-all"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard title="Success Volume" value={`₹${formatAmount(summary.totalVolume)}`} color="bg-emerald-500" icon={CheckCircle2} />
        <StatCard title="Total Success" value={summary.totalSuccess || 0} color="bg-emerald-500" icon={ArrowUpRight} />
        <StatCard title="Failed/Refund" value={summary.totalFailed || 0} color="bg-rose-500" icon={XCircle} />
        <StatCard title="Closing Balance" value={`₹${formatAmount(summary.closingBalance)}`} color="bg-cyan-500" icon={FileText} />
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 p-6 rounded-[2.5rem] shadow-sm space-y-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search ID, Mobile, Reference..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-cyan-500 transition-all outline-none"
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value, page: 1})}
            />
          </div>
          <select 
            className="px-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none"
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value, page: 1})}
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
            <option value="PENDING">Pending</option>
            <option value="REFUNDED">Refunded</option>
          </select>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-2xl px-4">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input 
              type="date" 
              className="bg-transparent py-3 text-xs outline-none"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value, page: 1})}
            />
            <span className="text-slate-300">to</span>
            <input 
              type="date" 
              className="bg-transparent py-3 text-xs outline-none"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value, page: 1})}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">ID / Timestamp</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Operator / Mobile</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-6"><div className="h-4 bg-slate-100 rounded-full w-full"></div></td>
                  </tr>
                ))
              ) : transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <p className="text-xs font-black text-slate-900">#{tx.id}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{new Date(tx.createdAt).toLocaleString()}</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-white transition-colors">
                          <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{tx.operator}</p>
                          <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1">{tx.mobile}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{tx.type}</span>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-black text-slate-900 tracking-tighter">₹{formatAmount(tx.amount)}</p>
                    </td>
                    <td className="px-8 py-6">
                      {getStatusBadge(tx.status)}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => { setSelectedTxn(tx); setShowInvoice(true); }}
                          className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl text-slate-400 hover:text-cyan-600 transition-all"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => { setSelectedTxn(tx); setShowDispute(true); }}
                          className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl text-slate-400 hover:text-rose-600 transition-all"
                        >
                          <AlertCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    No transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modals */}
        <InvoiceModal 
          isOpen={showInvoice} 
          onClose={() => setShowInvoice(false)} 
          transaction={selectedTxn} 
        />
        <DisputeModal 
          isOpen={showDispute} 
          onClose={() => setShowDispute(false)} 
          transaction={selectedTxn} 
        />


        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
            <button 
              disabled={filters.page === 1}
              onClick={() => setFilters({...filters, page: filters.page - 1})}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Prev Trace
            </button>
            <div className="flex gap-2">
              {[...Array(pagination.pages)].map((_, i) => (
                <button 
                  key={i}
                  onClick={() => setFilters({...filters, page: i + 1})}
                  className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${filters.page === i + 1 ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'text-slate-400 hover:bg-white border border-transparent hover:border-slate-200'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button 
              disabled={filters.page === pagination.pages}
              onClick={() => setFilters({...filters, page: filters.page + 1})}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors"
            >
              Next Trace <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
