import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Book, 
  Key, 
  Activity, 
  Zap,
  ExternalLink,
  Search,
  ChevronRight
} from 'lucide-react';
import ApiDocsContent from '../components/developer/ApiDocs';
import ApiKeyManager from '../components/developer/ApiKeyManager';
import ApiAnalytics from '../components/developer/ApiAnalytics';

const TABS = [
  { id: 'docs', name: 'Documentation', icon: Book },
  { id: 'keys', name: 'API Credentials', icon: Key },
  { id: 'analytics', name: 'Analytics', icon: Activity }
];

export const ApiDocs = () => {
  const [activeTab, setActiveTab] = useState('docs');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-[var(--card-bg)] rounded-xl p-6 border border-[var(--border-soft)] shadow-soft">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--color-primary-glow)] text-[var(--color-primary)] rounded-full border border-[var(--color-primary)]/10">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Developer Hub v1.0</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Developer Portal
            </h1>
            <p className="text-[var(--text-secondary)] text-sm max-w-xl font-medium leading-relaxed">
              Access real-time recharge, wallet, and payment infrastructure. Our enterprise APIs are designed for high-throughput and absolute reliability.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
             <button className="px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-primary)] rounded-xl text-xs font-semibold hover:bg-[var(--border-soft)] transition-all flex items-center gap-2 cursor-pointer">
                <ExternalLink className="w-4 h-4 text-[var(--color-primary)]" />
                Postman Collection
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-4 sticky top-0 shadow-soft">
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input 
                type="text" 
                placeholder="Search APIs..."
                className="w-full pl-10 pr-4 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] focus:border-[var(--color-primary)] rounded-xl text-xs font-semibold text-[var(--text-primary)] outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <nav className="space-y-1.5">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group cursor-pointer ${
                      isActive 
                        ? 'bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--border-soft)] font-bold' 
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--color-primary)]'}`} />
                      <span className="text-xs font-bold uppercase tracking-wider">{tab.name}</span>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4 text-[var(--color-primary)]" />}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-9 h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === 'docs' && <ApiDocsContent searchQuery={searchQuery} />}
              {activeTab === 'keys' && <ApiKeyManager />}
              {activeTab === 'analytics' && <ApiAnalytics />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
