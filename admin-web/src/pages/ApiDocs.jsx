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
      <div className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/20">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Developer Hub v1.0</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter italic">
              Developer <span className="text-purple-400 text-shadow-glow">Portal</span>
            </h1>
            <p className="text-slate-400 text-sm max-w-xl font-medium leading-relaxed">
              Access real-time recharge, wallet, and payment infrastructure. Our enterprise APIs are designed for high-throughput and absolute reliability.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
             <button className="px-6 py-3 bg-white/5 backdrop-blur-xl border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Postman Collection
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white/70 backdrop-blur-xl border border-slate-200 rounded-[2rem] p-4 sticky top-0">
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search APIs..."
                className="w-full pl-11 pr-4 py-3 bg-slate-100 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-purple-500/20 transition-all"
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
                    className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${
                      isActive 
                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-purple-400' : 'group-hover:text-purple-500'}`} />
                      <span className="text-[11px] font-black uppercase tracking-widest">{tab.name}</span>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4 text-purple-400" />}
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
