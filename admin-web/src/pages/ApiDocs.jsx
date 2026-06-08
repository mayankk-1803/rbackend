import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Book, 
  Key, 
  Activity, 
  Zap,
  ExternalLink,
  Search,
  ChevronRight,
  FileText,
  Download,
  Eye
} from 'lucide-react';
import ApiDocsContent from '../components/developer/ApiDocs';
import ApiKeyManager from '../components/developer/ApiKeyManager';
import ApiAnalytics from '../components/developer/ApiAnalytics';
import api from '../services/api';
import { toast } from 'react-hot-toast';

const TABS = [
  { id: 'docs', name: 'Documentation', icon: Book },
  { id: 'keys', name: 'API Credentials', icon: Key },
  { id: 'analytics', name: 'Analytics', icon: Activity }
];

const buildDocsHtml = (data) => {
  const { version, environment, baseUrl, postmanUrl, contact, authentication, groups } = data;
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return `
    <div style="padding: 20px; line-height: 1.6; color: #1e293b; background-color: #ffffff;">
      <!-- Cover Page -->
      <div style="height: 250mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; border: 2px solid #e2e8f0; padding: 40px; margin-bottom: 50px; background: linear-gradient(to bottom right, #f8fafc, #ffffff); border-radius: 12px; page-break-after: always;">
        <div style="font-size: 32px; font-weight: 800; color: #0f172a; margin-bottom: 20px; letter-spacing: -0.025em;">DiziPay API Documentation</div>
        <div style="width: 80px; height: 4px; background: #e11d48; margin-bottom: 40px; border-radius: 2px;"></div>
        <div style="font-size: 14px; font-weight: 600; color: #64748b; text-transform: uppercase; tracking: 0.1em; margin-bottom: 30px;">Platform Reference Portal</div>
        
        <div style="display: grid; grid-template-columns: 120px 1fr; gap: 15px; text-align: left; max-width: 320px; margin-top: 50px; font-size: 13px; color: #334155; border-top: 1px solid #e2e8f0; padding-top: 30px;">
          <div style="font-weight: 700; color: #64748b;">VERSION:</div>
          <div style="font-family: monospace; font-weight: 600;">v${version || '1.0.0'}</div>
          
          <div style="font-weight: 700; color: #64748b;">ENVIRONMENT:</div>
          <div style="font-weight: 700; color: #e11d48;">${environment || 'PRODUCTION'}</div>
          
          <div style="font-weight: 700; color: #64748b;">BASE URL:</div>
          <div style="font-family: monospace; font-size: 12px; word-break: break-all; font-weight: 600;">${baseUrl}</div>
          
          <div style="font-weight: 700; color: #64748b;">GENERATED:</div>
          <div style="font-weight: 600;">${today}</div>
        </div>
      </div>

      <!-- Authentication Section -->
      <div style="margin-bottom: 40px; page-break-after: always; padding-top: 10px;">
        <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 20px;">1. Authentication Methods</h1>
        <p style="font-size: 13px; color: #475569; margin-bottom: 25px;">To securely interact with the DiziPay recharge and billing gateways, clients must authenticate all HTTP requests using one of the following methods:</p>
        
        <div style="margin-bottom: 30px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
          <h2 style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 10px;">JWT Bearer Authorization</h2>
          <p style="font-size: 12px; color: #475569; margin-bottom: 12px;">Standard session authentication for administrative interfaces and client portals. Attach the JWT token inside the standard Authorization header:</p>
          <div style="font-family: monospace; font-size: 11px; background: #0f172a; color: #38bdf8; padding: 10px 15px; border-radius: 6px; overflow-x: auto;">
            ${authentication?.jwt?.sample || 'Authorization: Bearer <TOKEN>'}
          </div>
        </div>

        <div style="padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
          <h2 style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 10px;">API Keys Authentication</h2>
          <p style="font-size: 12px; color: #475569; margin-bottom: 12px;">For direct B2B telecom recharges, billing status checks, circles lookup, and automated client systems, clients must pass the client ID, API Key, and secret within the custom request headers:</p>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px; text-align: left;">
            <thead>
              <tr style="background: #e2e8f0; color: #334155;">
                <th style="padding: 8px; border: 1px solid #cbd5e1;">Header Key</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1;">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 700;">x-client-id</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; color: #475569;">The unique client identifier (prefixed with dp_)</td>
              </tr>
              <tr style="background: #ffffff;">
                <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 700;">x-api-key</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; color: #475569;">The API Key (prefixed with ak_live_)</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 700;">x-api-secret</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1; color: #475569;">The API secret token (prefixed with sec_live_)</td>
              </tr>
            </tbody>
          </table>
          <p style="font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 8px;">Sample Request Command:</p>
          <div style="font-family: monospace; font-size: 10px; background: #0f172a; color: #38bdf8; padding: 12px 15px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; word-break: break-all;">
            ${authentication?.apiKey?.sample || 'curl -H "x-client-id: ..." -H "x-api-key: ..." -H "x-api-secret: ..."' }
          </div>
        </div>
      </div>

      <!-- Available APIs Summary -->
      <div style="margin-bottom: 40px; page-break-after: always;">
        <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 20px;">2. Available API Endpoints</h1>
        <p style="font-size: 13px; color: #475569; margin-bottom: 20px;">A hierarchical summary of all DiziPay API modules accessible under your current administrative role:</p>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff;">
              <th style="padding: 10px; border: 1px solid #1e293b;">Module / Group</th>
              <th style="padding: 10px; border: 1px solid #1e293b; width: 80px;">Method</th>
              <th style="padding: 10px; border: 1px solid #1e293b;">API Endpoint Path</th>
              <th style="padding: 10px; border: 1px solid #1e293b;">Description</th>
            </tr>
          </thead>
          <tbody>
            ${groups.map(group => {
              return group.endpoints.map((ep, idx) => `
                <tr style="background: ${idx % 2 === 0 ? '#f8fafc' : '#ffffff'};">
                  ${idx === 0 ? `<td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 700; vertical-align: top; color: #0f172a;" rowspan="${group.endpoints.length}">${group.name}</td>` : ''}
                  <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: 700; color: ${ep.method === 'GET' ? '#10b981' : '#e11d48'};">${ep.method}</td>
                  <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 11px; word-break: break-all;">${ep.path}</td>
                  <td style="padding: 10px; border: 1px solid #e2e8f0; color: #475569; font-size: 11px;">${ep.description}</td>
                </tr>
              `).join('');
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Endpoint Details Section -->
      <div>
        <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 25px;">3. API Endpoint Reference Details</h1>
        
        ${groups.map(group => `
          <div style="margin-bottom: 35px; page-break-inside: avoid;">
            <h2 style="font-size: 16px; font-weight: 800; color: #0f172a; background: #e2e8f0; padding: 6px 12px; border-radius: 6px; margin-bottom: 20px;">
              Module: ${group.name}
            </h2>
            
            ${group.endpoints.map(ep => `
              <div style="margin-bottom: 30px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 25px; page-break-inside: avoid;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                  <span style="padding: 4px 8px; background: ${ep.method === 'GET' ? '#e6f4ea' : '#fce8e6'}; color: ${ep.method === 'GET' ? '#137333' : '#c5221f'}; border-radius: 4px; font-family: monospace; font-size: 11px; font-weight: 700;">
                    ${ep.method}
                  </span>
                  <span style="font-family: monospace; font-size: 13px; font-weight: 700; color: #1e293b;">
                    ${ep.path}
                  </span>
                </div>
                
                <p style="font-size: 12px; color: #475569; margin-bottom: 15px;">${ep.description}</p>
                
                ${ep.parameters && ep.parameters.length > 0 ? `
                  <div style="margin-bottom: 15px;">
                    <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px;">Request Parameters / Query</div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
                      <thead>
                        <tr style="background: #f1f5f9; color: #475569;">
                          <th style="padding: 6px; border: 1px solid #e2e8f0;">Name</th>
                          <th style="padding: 6px; border: 1px solid #e2e8f0; width: 60px;">Type</th>
                          <th style="padding: 6px; border: 1px solid #e2e8f0; width: 80px;">Required</th>
                          <th style="padding: 6px; border: 1px solid #e2e8f0;">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${ep.parameters.map(p => `
                          <tr>
                            <td style="padding: 6px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: 700;">${p.name}</td>
                            <td style="padding: 6px; border: 1px solid #e2e8f0; font-family: monospace; color: #64748b;">${p.type}</td>
                            <td style="padding: 6px; border: 1px solid #e2e8f0; font-weight: 600; color: ${p.required ? '#b91c1c' : '#64748b'};">${p.required ? 'Yes' : 'No'}</td>
                            <td style="padding: 6px; border: 1px solid #e2e8f0; color: #475569;">${p.description}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                ` : ''}

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
                  <div>
                    <div style="font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 5px;">Sample Request Payload</div>
                    <pre style="font-family: monospace; font-size: 10px; background: #0f172a; color: #38bdf8; padding: 10px; border-radius: 6px; margin: 0; max-height: 180px; overflow-y: auto;">${JSON.stringify(ep.sampleRequest || {}, null, 2)}</pre>
                  </div>
                  <div>
                    <div style="font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 5px;">Sample Success Response</div>
                    <pre style="font-family: monospace; font-size: 10px; background: #0f172a; color: #38bdf8; padding: 10px; border-radius: 6px; margin: 0; max-height: 180px; overflow-y: auto;">${JSON.stringify(ep.sampleResponse || {}, null, 2)}</pre>
                  </div>
                </div>
                
                ${ep.errorCodes && ep.errorCodes.length > 0 ? `
                  <div style="margin-top: 12px; font-size: 10px; color: #64748b;">
                    <span style="font-weight: 700; color: #475569;">Error Codes: </span>
                    ${ep.errorCodes.map(err => `<span style="font-family: monospace; font-weight: 600; color: #e11d48; margin-right: 10px;">${err.code} (${err.message})</span>`).join(', ')}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>

      <!-- Postman & Support Section -->
      <div style="margin-top: 50px; border-top: 1px solid #cbd5e1; padding-top: 30px; page-break-inside: avoid;">
        <h2 style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">Postman Sandbox Workspace</h2>
        <p style="font-size: 12px; color: #475569; margin-bottom: 25px;">
          An active interactive Postman sandbox collection is hosted for developers to run simulations. 
          Collection Link: <a href="${postmanUrl}" style="color: #e11d48; font-weight: 600; text-decoration: none;">${postmanUrl}</a>
        </p>

        <h2 style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">Developer Support & Contacts</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 12px; color: #475569;">
          <div>
            <strong>Developer Support Desk</strong><br/>
            Email: ${contact?.support || 'developer@dizipay.in'}<br/>
            Hours: 24/7 Platform Health Operations
          </div>
          <div>
            <strong>DiziPay Gateway Information</strong><br/>
            Hub: <a href="${contact?.info || 'https://irecharge.in/developer-hub'}" style="color: #e11d48; text-decoration: none;">${contact?.info || 'https://irecharge.in/developer-hub'}</a>
          </div>
        </div>
      </div>
    </div>
  `;
};

export const ApiDocs = () => {
  const [activeTab, setActiveTab] = useState('docs');
  const [searchQuery, setSearchQuery] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchMetadata = async () => {
    try {
      const response = await api.get('/admin/api-docs/metadata');
      if (response.data?.success) {
        setMetadata(response.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch API docs metadata:", err);
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  const handleDownload = async (download = false) => {
    try {
      toast.loading(download ? "Preparing download..." : "Opening PDF...", { id: "pdf-action" });
      const response = await api.get('/admin/api-docs/download', {
        params: { download: download ? "true" : "false" },
        responseType: 'blob'
      });
      toast.success(download ? "Download started!" : "PDF loaded!", { id: "pdf-action" });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      if (download) {
        link.setAttribute('download', metadata?.filename || 'IRECHARGE_API_DOCUMENTATION.pdf');
      } else {
        link.setAttribute('target', '_blank');
      }
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error("Failed to perform PDF action:", err);
      toast.error("Failed to load PDF file", { id: "pdf-action" });
    }
  };

  const handleExportPDF = async () => {
    if (exporting) return;
    setExporting(true);
    const toastId = toast.loading("Generating PDF...", { id: "pdf-export" });
    try {
      // 1. Fetch registry data from dynamic, RBAC-aware endpoint
      const res = await api.get('/admin/docs/registry');
      if (!res.data || !res.data.success) {
        throw new Error("Unable to fetch documentation registry");
      }

      // 2. Build print container obscured at viewport origin (0, 0) to avoid negative bounding rect issues
      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.left = '0';
      wrapper.style.top = '0';
      wrapper.style.width = '800px';
      wrapper.style.height = 'auto';
      wrapper.style.zIndex = '-9999';
      wrapper.style.pointerEvents = 'none';
      wrapper.style.overflow = 'hidden';

      const printContainer = document.createElement('div');
      printContainer.style.width = '100%';
      printContainer.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      printContainer.style.color = '#1e293b';
      printContainer.style.backgroundColor = '#ffffff';

      printContainer.innerHTML = buildDocsHtml(res.data);
      wrapper.appendChild(printContainer);
      document.body.appendChild(wrapper);

      // Allow browser to parse HTML, compute layouts, and perform paint cycles
      await new Promise(resolve => setTimeout(resolve, 250));

      // 3. Dynamic import html2pdf.js (lazy loaded)
      const html2pdf = (await import("html2pdf.js")).default;

      // 4. Configure options
      const opt = {
        margin: [15, 15, 15, 15],
        filename: 'Dizipay_API_Documentation.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          scrollY: 0,
          scrollX: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // 5. Generate and download PDF
      await html2pdf().set(opt).from(printContainer).save();
      document.body.removeChild(wrapper);

      toast.success("Documentation PDF downloaded successfully.", { id: "pdf-export" });
    } catch (err) {
      console.error("[PDF Export Error]:", err);
      toast.error("Unable to generate documentation PDF.", { id: "pdf-export" });
    } finally {
      setExporting(false);
    }
  };

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
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
             <button className="px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-primary)] rounded-xl text-xs font-semibold hover:bg-[var(--border-soft)] transition-all flex items-center justify-center gap-2 cursor-pointer">
                <ExternalLink className="w-4 h-4 text-[var(--color-primary)]" />
                Postman Collection
             </button>
             <button 
               onClick={handleExportPDF}
               disabled={exporting}
               className="px-4 py-2.5 bg-[var(--color-primary)] text-[var(--bg-primary)] hover:opacity-90 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 uppercase tracking-wider"
             >
                <Download className="w-4 h-4" />
                {exporting ? "Generating PDF..." : "DOWNLOAD PDF"}
             </button>
          </div>
        </div>
      </div>

      {/* API Docs PDF Metadata & Downloads */}
      {!loadingMeta && metadata && metadata.available && (
        <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-5 shadow-soft flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
              <FileText className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider truncate">
                {metadata.filename}
              </h3>
              <p className="text-[10px] text-[var(--text-secondary)] font-semibold mt-1 flex flex-wrap gap-x-2 gap-y-1">
                <span>VERSION: <span className="text-[var(--text-primary)] font-mono">v{metadata.version}</span></span>
                <span>•</span>
                <span>SIZE: <span className="text-[var(--text-primary)] font-mono">{(metadata.size / 1024).toFixed(1)} KB</span></span>
                <span>•</span>
                <span>LAST UPDATED: <span className="text-[var(--text-primary)] font-mono">{metadata.lastUpdated ? new Date(metadata.lastUpdated).toLocaleString('en-GB') : 'N/A'}</span></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end shrink-0">
            <button
              onClick={() => handleDownload(false)}
              className="px-3.5 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              <Eye className="w-4 h-4 text-[var(--color-primary)]" />
              View Inline
            </button>
            <button
              onClick={() => handleDownload(true)}
              className="px-3.5 py-2.5 bg-[var(--color-primary)] hover:opacity-90 text-[var(--bg-primary)] rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        </div>
      )}

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

