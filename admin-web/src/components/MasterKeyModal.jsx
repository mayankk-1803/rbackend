import React, { useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import { Shield, X, Key, Loader, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const MasterKeyModal = ({ isOpen, onClose, onSuccess }) => {
  const [masterKey, setMasterKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!masterKey.trim()) {
      return toast.error("Please enter the Master Key");
    }

    setLoading(true);
    try {
      const response = await api.post("/admin/security/master-key/verify", { masterKey });
      if (response.data?.success && response.data?.masterKeySession) {
        const token = response.data.masterKeySession;
        
        // Store in window (in-memory only)
        window.masterKeySession = token;
        // Parse expiry from JWT payload to set local expiry timer (10 mins)
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          window.masterKeySessionExpiry = payload.exp * 1000;
        } catch (e) {
          window.masterKeySessionExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes fallback
        }

        toast.success("Master Key session established (10 minutes)");
        setMasterKey("");
        onSuccess(token);
        onClose();
      } else {
        toast.error("Validation failed");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to verify Master Key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="relative w-full max-w-md bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-soft)] shadow-2xl p-6 z-10 overflow-hidden"
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-[var(--border-soft)]">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                    Elevated Permission Required
                  </h3>
                  <p className="text-[10px] text-[var(--text-secondary)] font-medium">
                    This action requires Master Key verification.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-[var(--bg-secondary)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Warning Message */}
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-[10px] font-semibold flex gap-2">
              <span>⚠️</span>
              <span>
                Generating a Master Key session grants temporary authorization for 10 minutes. 
                Too many failed attempts will temporarily lock your credentials.
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="space-y-1.5 relative">
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  System Master Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    required
                    placeholder="Enter Master Key"
                    value={masterKey}
                    onChange={(e) => setMasterKey(e.target.value)}
                    disabled={loading}
                    className="w-full pl-9.5 pr-10 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--color-primary)] transition-all"
                  />
                  <div className="absolute left-3 top-3.5 text-[var(--text-secondary)]">
                    <Key className="w-4 h-4" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-2.5 border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] rounded-xl text-xs font-bold uppercase transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Authorize"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default MasterKeyModal;
