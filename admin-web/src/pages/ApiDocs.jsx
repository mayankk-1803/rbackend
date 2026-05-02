import React, { useState } from 'react';
import { Copy, CheckCircle2, Terminal, ChevronRight, Zap, Globe, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ApiDocs = () => {
  const [copiedKey, setCopiedKey] = useState(null);
  const [activeTab, setActiveTab] = useState('recharge');

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const endpoints = {
    recharge: {
      title: "Transaction API",
      method: "POST",
      url: "/recharge",
      desc: "Initiate a new recharge transaction. Returns a transaction ID instantly from the queue.",
      payload: {
        mobile: "9876543210",
        amount: 50,
        operator: "Jio"
      },
      response: {
        success: true,
        message: "Recharge submitted successfully",
        data: { transactionId: "txn_123456" }
      },
      curl: `curl -X POST http://localhost:5000/recharge \\
-H "Authorization: Bearer <your_token>" \\
-H "Content-Type: application/json" \\
-d '{"mobile":"9876543210","amount":50,"operator":"Jio"}'`
    },
    status: {
      title: "Status API",
      method: "GET",
      url: "/api/status/:id",
      desc: "Check the status of an existing transaction using the ID.",
      payload: null,
      response: {
        success: true,
        data: { id: "txn_123", status: "success", amount: 50 }
      },
      curl: `curl -X GET http://localhost:5000/api/status/txn_123456 \\
-H "Authorization: Bearer <your_token>"`
    },
    callback: {
      title: "Callback API",
      method: "POST",
      url: "/webhook/provider-callback",
      desc: "Webhook endpoint for receiving async status updates directly from operators.",
      payload: { txid: "txn_123", status: "SUCCESS", ref: "op_5544" },
      response: { success: true, message: "Acknowledged" },
      curl: `curl -X POST http://localhost:5000/webhook/provider-callback \\
-H "Content-Type: application/json" \\
-d '{"txid":"txn_123","status":"SUCCESS","ref":"op_5544"}'`
    },
    complaint: {
      title: "Complaint API",
      method: "POST",
      url: "/api/support/ticket",
      desc: "Raise a dispute over a failed or pending transaction.",
      payload: { transactionId: "txn_123", reason: "Amount deducted but recharge failed." },
      response: { success: true, ticketId: "tk_9988" },
      curl: `curl -X POST http://localhost:5000/api/support/ticket \\
-H "Authorization: Bearer <your_token>" \\
-d '{"transactionId":"txn_123","reason":"failed"}'`
    },
    operators: {
      title: "Operator List API",
      method: "GET",
      url: "/api/operators",
      desc: "Fetch all active supported telecom and DTH operators.",
      payload: null,
      response: { success: true, data: [{ code: "JIO", name: "Reliance Jio" }] },
      curl: `curl -X GET http://localhost:5000/api/operators`
    }
  };

  const currentEP = endpoints[activeTab];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-[calc(100vh-10rem)]"
    >
      <header className="mb-6 md:mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Developer <span className="text-purple-600 text-shadow-glow">Portal</span></h1>
          <p className="text-[8px] md:text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2">Core API integration telemetry and endpoint schemas</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl md:rounded-2xl">
          <ShieldCheck className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-600" />
          <span className="text-[8px] md:text-[9px] font-black text-emerald-600 uppercase tracking-widest">TLS 1.3 Active</span>
        </div>
      </header>

      <div className="flex flex-col xl:flex-row flex-1 overflow-hidden bg-white/70 border border-slate-200 rounded-2xl md:rounded-[2.5rem] shadow-xl backdrop-blur-2xl">
        {/* Sidebar Menu */}
        <div className="w-full xl:w-80 border-b xl:border-b-0 xl:border-r border-slate-200 bg-slate-50/50 flex flex-col pt-4 md:pt-8">
          <div className="px-6 md:px-8 mb-4 md:mb-6 text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Signature Cluster</div>
          <nav className="flex xl:flex-col overflow-x-auto xl:overflow-y-auto custom-scrollbar pb-4 xl:pb-0 px-4 space-x-2 xl:space-x-0 xl:space-y-2">
            {Object.keys(endpoints).map((key) => {
              const ep = endpoints[key];
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex-none xl:w-full text-left px-4 md:px-6 py-3 md:py-4 flex items-center gap-3 md:gap-4 text-[10px] md:text-xs font-black transition-all rounded-xl md:rounded-2xl relative group ${
                    isActive ? "bg-white text-purple-600 shadow-sm" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <span className={`text-[7px] md:text-[8px] px-2 py-0.5 md:py-1 rounded-lg font-black tracking-widest ${
                    ep.method === 'POST' ? 'bg-purple-100 text-purple-600 border border-purple-200' : 'bg-emerald-100 text-emerald-600 border border-emerald-200'
                  }`}>
                    {ep.method}
                  </span>
                  <span className="truncate uppercase tracking-wider whitespace-nowrap">{ep.title}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="doc-active"
                      className="absolute bottom-0 xl:bottom-auto xl:left-0 w-full xl:w-1 h-0.5 xl:h-6 bg-purple-500 rounded-t-full xl:rounded-r-full shadow-[0_0_10px_rgba(168,85,247,0.8)]"
                    />
                  )}
                  <ChevronRight className={`ml-auto w-3 h-3 transition-transform hidden xl:block ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`} />
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
          <div className="p-6 md:p-12 max-w-5xl mx-auto space-y-8 md:space-y-12">
            <div className="space-y-4 md:space-y-6">
              <div className="flex flex-wrap items-center gap-3 md:gap-4">
                <span className={`px-3 md:px-4 py-1 md:py-1.5 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black text-white shadow-md ${
                  currentEP.method === 'POST' ? 'bg-purple-600' : 'bg-emerald-600'
                }`}>
                  {currentEP.method}
                </span>
                <div className="flex items-center gap-2 bg-slate-50 px-4 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl border border-slate-200 shadow-inner">
                  <Terminal className="w-3 md:w-4 h-3 md:h-4 text-slate-400" />
                  <span className="font-mono text-purple-600 font-bold text-xs md:text-sm tracking-tight break-all">
                    {currentEP.url}
                  </span>
                </div>
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase italic">{currentEP.title}</h2>
              <p className="text-slate-500 text-xs md:text-sm leading-relaxed max-w-2xl font-medium">{currentEP.desc}</p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:gap-12">
              {/* Request Table Schema if Payload Exists */}
              {currentEP.payload && (
                <div className="space-y-4 md:space-y-6">
                  <h3 className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                    Payload Schema
                  </h3>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl md:rounded-[2rem] overflow-x-auto">
                    <table className="w-full text-left min-w-[500px]">
                      <thead className="bg-white/50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 md:px-8 py-4 md:py-5 text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">Field</th>
                          <th className="px-6 md:px-8 py-4 md:py-5 text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</th>
                          <th className="px-6 md:px-8 py-4 md:py-5 text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Requirement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {Object.keys(currentEP.payload).map((field, i) => (
                          <tr key={i} className="hover:bg-white transition-colors">
                            <td className="px-6 md:px-8 py-4 md:py-5 font-mono text-slate-900 font-black text-xs md:text-sm">{field}</td>
                            <td className="px-6 md:px-8 py-4 md:py-5 text-slate-500 text-[10px] md:text-xs font-bold uppercase">{typeof currentEP.payload[field]}</td>
                            <td className="px-6 md:px-8 py-4 md:py-5 text-right">
                              <span className="px-2 md:px-3 py-1 rounded-lg text-[7px] md:text-[8px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-100">Required</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* cURL Example */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                    <Terminal className="w-3 md:w-4 h-3 md:h-4" /> cURL Protocol
                  </h3>
                  <button 
                    onClick={() => handleCopy(currentEP.curl, 'curl')}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-all text-[8px] md:text-[9px] font-black uppercase tracking-widest"
                  >
                    {copiedKey === 'curl' ? <><CheckCircle2 className="w-3 h-3 text-emerald-600" /> Copied</> : <><Copy className="w-3 h-3" /> Copy Snippet</>}
                  </button>
                </div>
                <div className="bg-slate-900 rounded-xl md:rounded-[2rem] p-6 md:p-8 border border-slate-800 shadow-xl relative group">
                  <pre className="text-[10px] md:text-xs text-purple-400 font-mono leading-relaxed whitespace-pre-wrap">{currentEP.curl}</pre>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                {/* Left Column Data */}
                {currentEP.payload && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <h3 className="text-[8px] md:text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Request Model</h3>
                      <button 
                        onClick={() => handleCopy(JSON.stringify(currentEP.payload, null, 2), 'payload')}
                        className="text-slate-500 hover:text-slate-900 transition-colors"
                      >
                        {copiedKey === 'payload' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="bg-slate-50 rounded-xl md:rounded-[2rem] p-6 md:p-8 border border-slate-200">
                      <pre className="text-[10px] md:text-xs text-slate-600 font-mono leading-relaxed">{JSON.stringify(currentEP.payload, null, 2)}</pre>
                    </div>
                  </div>
                )}

                {/* Right Column Response */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Expected Response</h3>
                    <button 
                      onClick={() => handleCopy(JSON.stringify(currentEP.response, null, 2), 'response')}
                      className="text-slate-400 hover:text-slate-900 transition-colors"
                    >
                      {copiedKey === 'response' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="bg-slate-50 rounded-xl md:rounded-[2rem] p-6 md:p-8 border border-slate-200">
                    <pre className="text-[10px] md:text-xs text-emerald-600 font-mono leading-relaxed">{JSON.stringify(currentEP.response, null, 2)}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
