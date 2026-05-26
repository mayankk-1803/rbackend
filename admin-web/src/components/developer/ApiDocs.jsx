import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
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
import api from '../../services/api';
import toast from 'react-hot-toast';

const LANGUAGES = [
  { id: 'curl', name: 'cURL', icon: Terminal },
  { id: 'javascript', name: 'Axios', icon: Code2 },
  { id: 'php', name: 'PHP', icon: FileCode },
  { id: 'python', name: 'Python', icon: Braces }
];

const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-[var(--bg-secondary)] rounded-xl ${className}`}></div>
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
      console.error("[Manifest Fetch Error]:", err);
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
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="space-y-6">
         <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-6 space-y-6">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <div className="pt-8 space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
         </div>
      </div>
      <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl h-[550px] animate-pulse"></div>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center p-20 text-center gap-6 bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl shadow-soft">
      <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center">
        <AlertCircle className="w-5 h-5 text-rose-500" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-[var(--text-primary)]">Something went wrong</h3>
        <p className="text-xs text-[var(--text-secondary)] max-w-xs">{error}</p>
      </div>
      <button 
        onClick={fetchManifest}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-[var(--bg-primary)] rounded-xl text-xs font-bold hover:opacity-90 transition-all cursor-pointer border border-[var(--border-soft)]"
      >
        <RefreshCw className="w-4 h-4" />
        Retry Loading
      </button>
    </div>
  );

  if (!selectedEndpoint) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Left Column: API Details */}
      <div className="space-y-6">
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-6 shadow-soft">
           <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                   selectedEndpoint.method === 'GET' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--color-primary)]/10'
                 }`}>
                   {selectedEndpoint.method}
                 </span>
                 <code className="text-xs font-mono font-bold text-[var(--text-secondary)] tracking-tight break-all">{selectedEndpoint.path}</code>
              </div>
              
              <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">{selectedEndpoint.name}</h2>
              <p className="text-[var(--text-secondary)] text-xs font-medium leading-relaxed">
                {selectedEndpoint.description}
              </p>
           </div>

           <div className="mt-8 space-y-6">
              {/* Request Parameters */}
              {selectedEndpoint.body && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                    <Braces className="w-4 h-4 text-[var(--color-primary)]" />
                    Request Body
                  </h3>
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-soft)] overflow-x-auto">
                    <pre className="text-xs font-mono text-[var(--text-primary)]">
                      {JSON.stringify(selectedEndpoint.body, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Response Schema */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[var(--color-primary)]" />
                  Success Response
                </h3>
                <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-soft)] overflow-x-auto">
                   <pre className="text-xs font-mono text-[var(--text-primary)]">
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
              className={`p-4 rounded-xl text-left transition-all border cursor-pointer ${
                selectedEndpoint.id === ep.id 
                  ? 'bg-[var(--color-primary-glow)] border-[var(--color-primary)]/30 shadow-sm' 
                  : 'bg-[var(--card-bg)] border-[var(--border-soft)] hover:border-[var(--color-primary)]/20'
              }`}
            >
               <span className={`text-[9px] font-bold uppercase tracking-wider mb-1 block ${
                 selectedEndpoint.id === ep.id ? 'text-[var(--color-primary)]' : 'text-[var(--text-secondary)]'
               }`}>
                 {ep.method}
               </span>
               <h4 className={`text-xs font-bold tracking-tight ${
                 selectedEndpoint.id === ep.id ? 'text-[var(--color-primary)]' : 'text-[var(--text-primary)]'
               }`}>
                 {ep.name}
               </h4>
            </button>
          ))}
        </div>
      </div>

      {/* Right Column: Code Generator */}
      <div className="sticky top-6 self-start">
        <div className="bg-[#111D16] rounded-xl shadow-soft overflow-hidden border border-white/5">
           {/* Tab Header */}
           <div className="flex items-center gap-1 p-3 bg-black/20 border-b border-white/5">
              {LANGUAGES.map((lang) => {
                const Icon = lang.icon;
                return (
                  <button
                    key={lang.id}
                    onClick={() => setSelectedLang(lang.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      selectedLang === lang.id 
                        ? 'bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--color-primary)]/20' 
                        : 'text-slate-400 hover:text-slate-200'
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
                className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              
              <SyntaxHighlighter 
                language={selectedLang === 'curl' ? 'bash' : selectedLang} 
                style={atomDark}
                customStyle={{
                  backgroundColor: 'transparent',
                  padding: '1.5rem',
                  fontSize: '11px',
                  lineHeight: '1.6',
                  fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',
                  margin: 0
                }}
              >
                {generateCode(selectedEndpoint, selectedLang)}
              </SyntaxHighlighter>
           </div>
           
           {/* Footer */}
           <div className="px-5 py-3 bg-black/25 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <Shield className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                 <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Secure HTTPS integration</span>
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                 <span className="text-[9px] font-bold text-emerald-500/80 uppercase tracking-wider">Gateway active</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
