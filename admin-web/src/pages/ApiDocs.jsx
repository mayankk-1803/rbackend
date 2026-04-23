import React, { useState } from 'react';
import { Copy, CheckCircle2, Terminal } from 'lucide-react';

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
        data: { _id: "txn_123", status: "success", amount: 50 }
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
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">API Documentation</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Integration guidelines for developer APIs</p>
      </header>

      <div className="flex flex-1 overflow-hidden bg-white border border-[#E5E7EB] rounded-md shadow-sm">
        {/* Left Sidebar Menu */}
        <div className="w-64 border-r border-[#E5E7EB] bg-[#F8FAFC] flex flex-col pt-4">
          <div className="px-4 mb-2 text-xs font-bold text-[#64748B] uppercase tracking-wider">Endpoints</div>
          <nav className="flex-1 space-y-1">
            {Object.keys(endpoints).map((key) => {
              const ep = endpoints[key];
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm font-medium transition-colors border-l-2 ${
                    isActive ? "bg-[#F3E8FF] border-[#6D28D9] text-[#0F172A]" : "border-transparent text-[#64748B] hover:bg-[#F8FAFC]"
                  }`}
                >
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    ep.method === 'POST' ? 'bg-[#F3E8FF] text-[#6D28D9]' : 'bg-[#DCFCE7] text-[#15803D]'
                  }`}>
                    {ep.method}
                  </span>
                  <span className="truncate">{ep.title}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 overflow-y-auto w-full">
          <div className="p-8 max-w-4xl">
            <div className="mb-8 border-b border-[#E5E7EB] pb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2 py-1 rounded text-xs font-bold text-white ${
                  currentEP.method === 'POST' ? 'bg-[#6D28D9]' : 'bg-[#16A34A]'
                }`}>
                  {currentEP.method}
                </span>
                <span className="font-mono bg-[#F8FAFC] px-3 py-1 rounded text-[#0F172A] font-bold border border-[#E5E7EB] shadow-sm text-sm tracking-wide">
                  {currentEP.url}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-[#0F172A] mt-4">{currentEP.title}</h2>
              <p className="text-[#64748B] text-sm mt-3 leading-relaxed">{currentEP.desc}</p>
            </div>

            <div className="space-y-8">
              {/* Request Table Schema if Payload Exists */}
              {currentEP.payload && (
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] mb-3">Request Parameters</h3>
                  <div className="border border-[#E5E7EB] rounded-md overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                        <tr>
                          <th className="px-4 py-2 font-semibold text-[#64748B]">Field</th>
                          <th className="px-4 py-2 font-semibold text-[#64748B]">Type</th>
                          <th className="px-4 py-2 font-semibold text-[#64748B]">Required</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {Object.keys(currentEP.payload).map((field, i) => (
                          <tr key={i} className="hover:bg-[#F8FAFC]">
                            <td className="px-4 py-2 font-mono text-[#0F172A] font-bold">{field}</td>
                            <td className="px-4 py-2 text-[#64748B]">{typeof currentEP.payload[field]}</td>
                            <td className="px-4 py-2">
                              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-[#FEF2F2] text-[#DC2626]">Yes</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* cURL Example */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-[#64748B]" /> cURL Example
                  </h3>
                  <button 
                    onClick={() => handleCopy(currentEP.curl, 'curl')}
                    className="text-[#64748B] hover:text-[#0F172A] transition p-1"
                  >
                    {copiedKey === 'curl' ? <CheckCircle2 className="w-4 h-4 text-[#16A34A]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="bg-[#0F172A] rounded-md p-4 overflow-x-auto shadow-sm">
                  <pre className="text-xs text-[#E2E8F0] font-mono leading-relaxed">{currentEP.curl}</pre>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 border-t border-[#E5E7EB] pt-8">
                {/* Left Column Data */}
                <div className="space-y-6">
                  {currentEP.payload && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-[#0F172A]">Request JSON</h3>
                        <button 
                          onClick={() => handleCopy(JSON.stringify(currentEP.payload, null, 2), 'payload')}
                          className="text-[#64748B]"
                        >
                          {copiedKey === 'payload' ? <CheckCircle2 className="w-4 h-4 text-[#16A34A]" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="bg-[#0F172A] rounded-md p-4 overflow-x-auto shadow-sm">
                        <pre className="text-xs text-[#E2E8F0] font-mono leading-relaxed">{JSON.stringify(currentEP.payload, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column Response */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-[#0F172A]">Response JSON</h3>
                    <button 
                      onClick={() => handleCopy(JSON.stringify(currentEP.response, null, 2), 'response')}
                      className="text-[#64748B]"
                    >
                      {copiedKey === 'response' ? <CheckCircle2 className="w-4 h-4 text-[#16A34A]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="bg-[#0F172A] rounded-md p-4 overflow-x-auto h-full min-h-[200px] shadow-sm">
                    <pre className="text-xs text-[#E2E8F0] font-mono leading-relaxed">{JSON.stringify(currentEP.response, null, 2)}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
