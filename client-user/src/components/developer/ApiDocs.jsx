import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import js from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import atomDark from 'react-syntax-highlighter/dist/esm/styles/prism/atom-dark';

SyntaxHighlighter.registerLanguage('javascript', js);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('php', php);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('json', json);

import { 
  Copy, 
  Check, 
  ChevronRight, 
  Globe, 
  Shield, 
  Zap, 
  Code2,
  Terminal,
  FileCode,
  Braces,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';

const LANGUAGES = [
  { id: 'curl', name: 'cURL', icon: Terminal },
  { id: 'javascript', name: 'Axios', icon: Code2 },
  { id: 'php', name: 'PHP', icon: FileCode },
  { id: 'python', name: 'Python', icon: Braces }
];

const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-slate-200 rounded-2xl ${className}`}></div>
);

const generateCode = (endpoint, lang) => {
  if (!endpoint) return '';
  const { method, path, headers, body, query, params } = endpoint;
  const baseUrl = "https://rchserver.irecharge.in/api";
  let url = `${baseUrl}${path}`;
  
  if (params) {
    params.forEach(p => {
      url = url.replace(`{${p.name}}`, `[${p.name.toUpperCase()}]`);
    });
  }

  if (query) {
    const q = query.map(p => `${p.name}=value`).join('&');
    url += `?${q}`;
  }

  switch (lang) {
    case 'curl':
      return `curl -X ${method} "${url}" \\
  -H "x-client-id: YOUR_CLIENT_ID" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "x-api-secret: YOUR_API_SECRET" \\
  ${method === 'POST' ? `-H "Content-Type: application/json" \\
  -d '${JSON.stringify(body || {}, null, 2)}'` : ''}`;

    case 'javascript':
      return `import axios from 'axios';

const response = await axios({
  method: '${method}',
  url: '${url}',
  headers: {
    'x-client-id': 'YOUR_CLIENT_ID',
    'x-api-key': 'YOUR_API_KEY',
    'x-api-secret': 'YOUR_API_SECRET'
  },
  ${method === 'POST' ? `data: ${JSON.stringify(body || {}, null, 2)}` : ''}
});

console.log(response.data);`;

    case 'php':
      return `<?php
$client = new \\GuzzleHttp\\Client();

$response = $client->request('${method}', '${url}', [
  'headers' => [
    'x-client-id' => 'YOUR_CLIENT_ID',
    'x-api-key' => 'YOUR_API_KEY',
    'x-api-secret' => 'YOUR_API_SECRET'
  ],
  ${method === 'POST' ? `'json' => ${JSON.stringify(body || {}, null, 2)}` : ''}
]);

echo $response->getBody();`;

    case 'python':
      return `import requests

url = "${url}"
headers = {
    "x-client-id": "YOUR_CLIENT_ID",
    "x-api-key": "YOUR_API_KEY",
    "x-api-secret": "YOUR_API_SECRET"
}

response = requests.request("${method}", url, headers=headers${method === 'POST' ? `, json=${JSON.stringify(body || {}, null, 2)}` : ''})

print(response.json())`;

    default:
      return '';
  }
};

export default function ApiDocs({ searchQuery }) {
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [selectedLang, setSelectedLang] = useState('curl');
  const [copied, setCopied] = useState(false);

  const fetchManifest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/developer/manifest');
      const data = res.data?.payload || res.data?.data;
      if (data) {
        setManifest(data);
        if (data.endpoints && data.endpoints.length > 0) {
          setSelectedEndpoint(data.endpoints[0]);
        }
      } else {
        throw new Error("No documentation data received");
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("[Manifest Fetch Error]:", err);
      }
      setError("Failed to load API documentation. Please try again.");
      toast.error("Documentation fetch failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManifest();
  }, []);

  const filteredEndpoints = useMemo(() => {
    if (!manifest || !manifest.endpoints) return [];
    return manifest.endpoints.filter(e => 
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.path.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, manifest]);

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      <div className="space-y-8">
         <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 space-y-6">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <div className="pt-10 space-y-6">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
         </div>
      </div>
      <div className="bg-slate-900 rounded-[2.5rem] h-[600px] animate-pulse"></div>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center p-20 text-center gap-6 bg-white border border-slate-200 rounded-[2.5rem]">
      <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-rose-500" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Oops! Something went wrong</h3>
        <p className="text-sm text-slate-500 max-w-xs">{error}</p>
      </div>
      <button 
        onClick={fetchManifest}
        className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
      >
        <RefreshCw className="w-4 h-4" />
        Retry Loading
      </button>
    </div>
  );

  if (!selectedEndpoint) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* Left Column: API Details */}
      <div className="space-y-8">
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50">
           <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                   selectedEndpoint.method === 'GET' ? 'bg-emerald-50 text-emerald-600' : 'bg-cyan-50 text-cyan-600'
                 }`}>
                   {selectedEndpoint.method}
                 </span>
                 <code className="text-sm font-black text-slate-400 tracking-tight">{selectedEndpoint.path}</code>
              </div>
              
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">{selectedEndpoint.name}</h2>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                {selectedEndpoint.description}
              </p>
           </div>

           <div className="mt-10 space-y-8">
              {/* Request Parameters */}
              {selectedEndpoint.body && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <Braces className="w-4 h-4 text-cyan-500" />
                    Request Body
                  </h3>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 overflow-x-auto">
                    <pre className="text-[11px] font-bold text-slate-600">
                      {JSON.stringify(selectedEndpoint.body, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Response Schema */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-500" />
                  Success Response
                </h3>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 overflow-x-auto">
                   <pre className="text-[11px] font-bold text-slate-600">
                      {JSON.stringify(selectedEndpoint.responses.success.body, null, 2)}
                    </pre>
                </div>
              </div>
           </div>
        </div>

        {/* Endpoint List for Quick Switch */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredEndpoints.map((ep) => (
            <button
              key={ep.id}
              onClick={() => setSelectedEndpoint(ep)}
              className={`p-5 rounded-3xl text-left transition-all border ${
                selectedEndpoint.id === ep.id 
                  ? 'bg-slate-900 border-slate-900 shadow-lg shadow-slate-900/20' 
                  : 'bg-white border-slate-200 hover:border-cyan-500/50'
              }`}
            >
               <span className={`text-[8px] font-black uppercase tracking-widest mb-2 block ${
                 selectedEndpoint.id === ep.id ? 'text-cyan-400' : 'text-slate-400'
               }`}>
                 {ep.method}
               </span>
               <h4 className={`text-xs font-black uppercase tracking-tighter ${
                 selectedEndpoint.id === ep.id ? 'text-white' : 'text-slate-900'
               }`}>
                 {ep.name}
               </h4>
            </button>
          ))}
        </div>
      </div>

      {/* Right Column: Code Generator */}
      <div className="sticky top-8 self-start">
        <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10">
           {/* Tab Header */}
           <div className="flex items-center gap-1 p-4 bg-white/5 border-b border-white/10">
              {LANGUAGES.map((lang) => {
                const Icon = lang.icon;
                return (
                  <button
                    key={lang.id}
                    onClick={() => setSelectedLang(lang.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                      selectedLang === lang.id 
                        ? 'bg-white/10 text-white shadow-xl border border-white/10' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {lang.name}
                  </button>
                );
              })}
           </div>

           {/* Code Content */}
           <div className="relative group">
              <button 
                onClick={() => copyCode(generateCode(selectedEndpoint, selectedLang))}
                className="absolute top-6 right-6 p-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10 z-20"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              
              {SyntaxHighlighter ? (
                <SyntaxHighlighter 
                  language={selectedLang === 'curl' ? 'bash' : selectedLang} 
                  style={atomDark}
                  customStyle={{
                    backgroundColor: 'transparent',
                    padding: '2.5rem',
                    fontSize: '12px',
                    lineHeight: '1.8',
                    fontFamily: 'JetBrains Mono, monospace',
                    margin: 0
                  }}
                >
                  {generateCode(selectedEndpoint, selectedLang)}
                </SyntaxHighlighter>
              ) : (
                <pre className="p-10 text-white font-mono text-xs overflow-auto">
                  {generateCode(selectedEndpoint, selectedLang)}
                </pre>
              )}
           </div>
           
           {/* Footer */}
           <div className="p-6 bg-white/5 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <Shield className="w-3.5 h-3.5 text-cyan-400" />
                 <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">End-to-End Secure Request</span>
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                 <span className="text-[8px] font-black text-emerald-500/70 uppercase tracking-[0.2em]">Server Live</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
