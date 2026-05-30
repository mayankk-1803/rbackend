import React, { useState, useEffect, useRef } from "react";
import {
  MoreVertical,
  Edit2,
  Play,
  FileText,
  AlertOctagon,
  Activity,
  Sliders
} from "lucide-react";

export const ProviderActionsMenu = ({
  provider,
  onAction
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleAction = (action) => {
    setIsOpen(false);
    onAction(action, provider);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer border border-transparent hover:border-[var(--border-soft)]"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-52 origin-top-right rounded-xl border border-[var(--border-soft)] bg-[var(--card-bg)] shadow-lg ring-1 ring-black/5 z-50 overflow-hidden backdrop-blur-xl bg-opacity-95">
          <div className="py-1">
            <button
              onClick={() => handleAction("edit")}
              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all flex items-center gap-2"
            >
              <Edit2 className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              Edit Provider
            </button>
            
            <button
              onClick={() => handleAction("test")}
              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 text-emerald-500" />
              Test API
            </button>
            
            <button
              onClick={() => handleAction("logs")}
              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all flex items-center gap-2"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-500" />
              View Logs
            </button>
            
            <button
              onClick={() => handleAction("maintenance")}
              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all flex items-center gap-2"
            >
              <AlertOctagon className={`w-3.5 h-3.5 ${provider.maintenanceMode ? "text-emerald-500" : "text-amber-500"}`} />
              {provider.maintenanceMode ? "Disable Maintenance" : "Enable Maintenance"}
            </button>
            
            <button
              onClick={() => handleAction("diagnostics")}
              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all flex items-center gap-2"
            >
              <Activity className="w-3.5 h-3.5 text-purple-500" />
              Diagnostics
            </button>
            
            <button
              onClick={() => handleAction("rules")}
              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all flex items-center gap-2 border-t border-[var(--border-soft)]"
            >
              <Sliders className="w-3.5 h-3.5 text-pink-500" />
              Routing Rules
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderActionsMenu;
