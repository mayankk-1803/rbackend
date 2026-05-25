import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Code2, 
  Key, 
  Activity, 
  Book, 
  ExternalLink, 
  Copy, 
  RefreshCw, 
  ShieldAlert, 
  Zap,
  ChevronRight,
  Search
} from 'lucide-react';
import ApiDocs from '../components/developer/ApiDocs';
import ApiKeyManager from '../components/developer/ApiKeyManager';
import ApiAnalytics from '../components/developer/ApiAnalytics';

const TABS = [
  { id: 'docs', name: 'Documentation', icon: Book },
  { id: 'keys', name: 'API Credentials', icon: Key },
  { id: 'analytics', name: 'Analytics', icon: Activity }
];

export default function DeveloperPortal() {
  const [activeTab, setActiveTab] = useState('docs');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen pb-20 relative z-10">
      {/* Header Section */}
      <div className="relative overflow-hidden glass-card border border-[var(--glass-border)] rounded-[2.5rem] p-8 mb-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/20">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Developer Hub v1.0</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-[var(--text-color)] uppercase tracking-tighter italic">
              Empower Your <span className="text-cyan-400 cyan-glow">Integration</span>
            </h1>
            <p className="text-[var(--text-secondary)] text-sm max-w-xl font-medium leading-relaxed">
              Access real-time recharge, wallet, and payment infrastructure. Our enterprise APIs are designed for high-throughput and absolute reliability.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
             <button className="px-6 py-3 bg-[var(--glass-button-bg)] backdrop-blur-xl border border-[var(--glass-border)] text-[var(--text-color)] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-[var(--glass-border-hover)] transition-all flex items-center gap-2 cursor-pointer">
                <ExternalLink className="w-4 h-4" />
                Postman Collection
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-[var(--glass-navbar-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-3xl p-4 sticky top-8">
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input 
                type="text" 
                placeholder="Search APIs..."
                className="w-full pl-11 pr-4 py-3 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-2xl text-xs font-bold text-[var(--text-color)] focus:outline-none focus:border-cyan-500 transition-all placeholder:text-[var(--text-muted)]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <nav className="space-y-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group cursor-pointer ${
                      isActive 
                        ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20' 
                        : 'text-[var(--text-secondary)] hover:bg-[var(--glass-button-bg)] hover:text-[var(--text-color)] hover:border-[var(--glass-border)] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-[var(--text-muted)] group-hover:text-cyan-400'}`} />
                      <span className="text-[11px] font-black uppercase tracking-widest">{tab.name}</span>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4 text-slate-950" />}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-9">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'docs' && <ApiDocs searchQuery={searchQuery} />}
              {activeTab === 'keys' && <ApiKeyManager />}
              {activeTab === 'analytics' && <ApiAnalytics />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
