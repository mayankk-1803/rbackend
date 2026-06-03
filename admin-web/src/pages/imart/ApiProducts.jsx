import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { 
  ShoppingBag, 
  RefreshCw, 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  Cpu 
} from 'lucide-react';

export const ApiProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await api.get('/admin/api-marketplace/products');
      if (response.data?.success) {
        setProducts(response.data.data || []);
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">API Products Catalog</h1>
          <p className="text-sm text-[var(--text-secondary)] font-medium">Manage published Fintech integration channels, webhook callbacks, and route configurations.</p>
        </div>
        <button
          onClick={fetchProducts}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all disabled:opacity-50 cursor-pointer h-fit w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh State
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 h-48 shimmer-element"></div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3">
          <ShieldAlert className="w-8 h-8 text-rose-500" />
          <h3 className="font-bold text-sm text-[var(--text-primary)]">Unable to load data.</h3>
          <p className="text-xs text-[var(--text-secondary)]">Please check your connection and try refreshing.</p>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <ShoppingBag className="w-8 h-8 text-[var(--text-secondary)] opacity-50" />
          <h4 className="font-bold text-sm text-[var(--text-primary)]">No records found.</h4>
          <p className="text-xs text-[var(--text-secondary)] max-w-xs">No active API marketplace products have been registered in the database catalog.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {products.map((p) => (
            <div key={p.id} className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-[var(--color-primary-glow)] transition-all shadow-xs">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <span className="inline-flex items-center px-2 py-0.5 bg-[var(--color-primary-glow)] text-[var(--color-primary)] text-[9px] font-bold rounded-lg border border-[var(--border-soft)] font-mono">
                    {p.code}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-extrabold border ${
                    p.isActive 
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                  }`}>
                    {p.isActive ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                    {p.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-[var(--text-primary)] tracking-wide">{p.name}</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3">{p.description}</p>
              </div>

              <div className="border-t border-[var(--border-soft)] pt-3 flex items-center justify-between text-[10px] text-[var(--text-secondary)] font-medium">
                <span className="flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-[var(--color-primary)]" /> DB_SYNC_ONLINE
                </span>
                <span>Created: {new Date(p.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
