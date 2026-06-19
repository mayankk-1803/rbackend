import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Users, ClipboardList, Wallet, ShoppingBag, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { formatAmount } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({
    users: [],
    transactions: [],
    wallets: [],
    orders: []
  });
  
  const searchInputRef = useRef(null);
  const navigate = useNavigate();

  // 1. Listen for global keyboard shortcut (Ctrl + K or Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 2. Focus input upon opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      document.body.style.overflow = 'hidden';
    } else {
      setQuery('');
      setResults({ users: [], transactions: [], wallets: [], orders: [] });
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  // 3. Search API Call with debouncing
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ users: [], transactions: [], wallets: [], orders: [] });
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get('/admin/analytics/search', { params: { query } });
        if (res.data?.success) {
          setResults(res.data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleNavigate = (path) => {
    setIsOpen(false);
    navigate(path);
  };

  const hasResults = 
    results.users.length > 0 || 
    results.transactions.length > 0 || 
    results.wallets.length > 0 || 
    results.orders.length > 0;

  return (
    <>
      {/* Topbar Trigger Indicator */}
      <button 
        onClick={() => setIsOpen(true)}
        className="hidden lg:flex items-center gap-2 px-3.5 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]/50 border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer mr-2"
      >
        <Search className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        <span>Search platform...</span>
        <kbd className="px-1.5 py-0.5 text-[9px] font-black bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded text-[var(--text-muted)] uppercase ml-2 tracking-wider">
          Ctrl + K
        </kbd>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              className="relative w-full max-w-2xl bg-[var(--card-bg)] border border-[var(--border-soft)] shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[70vh]"
            >
              {/* Input Header */}
              <div className="flex items-center border-b border-[var(--border-soft)] px-4 py-3 bg-[var(--bg-secondary)]/30">
                <Search className="w-5 h-5 text-[var(--text-secondary)] mr-3" />
                <input 
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  type="text" 
                  placeholder="Search Users, Transactions, Wallets, or Orders..." 
                  className="flex-1 bg-transparent border-0 outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
                />
                {loading && (
                  <RefreshCw className="w-4 h-4 text-[var(--color-primary)] animate-spin mr-3" />
                )}
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-[var(--bg-secondary)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Results Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar text-xs font-semibold">
                {!query && (
                  <div className="text-center py-12 text-[var(--text-secondary)]">
                    <Terminal className="w-6 h-6 mx-auto mb-2 text-[var(--text-secondary)] opacity-50" />
                    <p className="font-bold">Search Workbench</p>
                    <p className="text-[10px] mt-0.5">Type phone, email, public reference ID, or names to search.</p>
                  </div>
                )}

                {query && !loading && !hasResults && (
                  <div className="text-center py-12 text-[var(--text-secondary)]">
                    <p className="font-bold">No results found for "{query}"</p>
                    <p className="text-[10px] mt-0.5">Verify parameters or search filters.</p>
                  </div>
                )}

                {/* Users List */}
                {results.users.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Users
                    </h4>
                    <div className="divide-y divide-[var(--border-soft)]">
                      {results.users.map((u) => (
                        <div 
                          key={u.id}
                          onClick={() => handleNavigate('/users')}
                          className="py-2.5 px-3 flex justify-between items-center rounded-xl hover:bg-[var(--bg-secondary)]/40 transition-colors cursor-pointer"
                        >
                          <div>
                            <p className="text-xs font-bold text-[var(--text-primary)]">{u.name || 'Unnamed'}</p>
                            <p className="text-[10px] text-[var(--text-secondary)] font-medium">{u.email || u.phone}</p>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 bg-[var(--color-primary-glow)] border border-[var(--border-soft)] text-[var(--color-primary)] uppercase tracking-wide rounded-md">
                            {u.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transactions List */}
                {results.transactions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5" /> Transactions
                    </h4>
                    <div className="divide-y divide-[var(--border-soft)]">
                      {results.transactions.map((tx) => (
                        <div 
                          key={tx.id}
                          onClick={() => handleNavigate('/reports/transactions')}
                          className="py-2.5 px-3 flex justify-between items-center rounded-xl hover:bg-[var(--bg-secondary)]/40 transition-colors cursor-pointer"
                        >
                          <div>
                            <p className="text-xs font-bold text-[var(--text-primary)]">{tx.publicRef || `#${tx.id}`}</p>
                            <p className="text-[10px] text-[var(--text-secondary)] font-medium">To: {tx.mobile} | Op: {tx.operator}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-extrabold text-[var(--text-primary)]">₹{formatAmount(tx.amount)}</p>
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${
                              tx.status === "SUCCESS" ? "text-emerald-500" :
                              tx.status === "FAILED" ? "text-rose-500" : "text-amber-500"
                            }`}>{tx.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Wallets List */}
                {results.wallets.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5" /> Wallets
                    </h4>
                    <div className="divide-y divide-[var(--border-soft)]">
                      {results.wallets.map((w) => (
                        <div 
                          key={w.id}
                          onClick={() => handleNavigate('/wallet')}
                          className="py-2.5 px-3 flex justify-between items-center rounded-xl hover:bg-[var(--bg-secondary)]/40 transition-colors cursor-pointer"
                        >
                          <div>
                            <p className="text-xs font-bold text-[var(--text-primary)]">{w.user?.name || 'User Wallet'}</p>
                            <p className="text-[10px] text-[var(--text-secondary)] font-medium">{w.user?.phone}</p>
                          </div>
                          <div className="text-right leading-none">
                            <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-0.5">Balance</span>
                            <span className="text-xs font-extrabold text-emerald-500">₹{formatAmount(w.balance)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Orders List */}
                {results.orders.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5" /> Orders
                    </h4>
                    <div className="divide-y divide-[var(--border-soft)]">
                      {results.orders.map((o) => (
                        <div 
                          key={o.id}
                          onClick={() => handleNavigate('/imart/orders')}
                          className="py-2.5 px-3 flex justify-between items-center rounded-xl hover:bg-[var(--bg-secondary)]/40 transition-colors cursor-pointer"
                        >
                          <div>
                            <p className="text-xs font-bold text-[var(--text-primary)]">{o.invoiceId || `#ORD-${o.id}`}</p>
                            <p className="text-[10px] text-[var(--text-secondary)] font-medium">By: {o.user?.name || 'Customer'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-extrabold text-[var(--text-primary)]">₹{formatAmount(o.totalAmount)}</p>
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${
                              o.status === "DELIVERED" ? "text-emerald-500" : "text-amber-500"
                            }`}>{o.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
