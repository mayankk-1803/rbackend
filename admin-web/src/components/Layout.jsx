import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { AnimatePresence, motion } from 'framer-motion';
import MasterKeyModal from './MasterKeyModal';

export const Layout = () => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMasterKeyModalOpen, setIsMasterKeyModalOpen] = useState(false);
  const pendingRequestsRef = useRef([]);

  // Close sidebar on route change on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  // Global Master Key challenge listener
  useEffect(() => {
    const handleTriggerPrompt = (e) => {
      const { resolve, reject } = e.detail;
      pendingRequestsRef.current.push({ resolve, reject });
      setIsMasterKeyModalOpen(true);
    };

    window.addEventListener("TRIGGER_MASTER_KEY_PROMPT", handleTriggerPrompt);
    return () => {
      window.removeEventListener("TRIGGER_MASTER_KEY_PROMPT", handleTriggerPrompt);
    };
  }, []);

  const handleMasterKeySuccess = (sessionToken) => {
    const pending = pendingRequestsRef.current;
    pendingRequestsRef.current = [];
    pending.forEach(req => req.resolve(sessionToken));
    setIsMasterKeyModalOpen(false);
  };

  const handleMasterKeyClose = () => {
    const pending = pendingRequestsRef.current;
    pendingRequestsRef.current = [];
    pending.forEach(req => req.reject(new Error("Master Key authorization cancelled")));
    setIsMasterKeyModalOpen(false);
  };

  return (
    <div className="admin-shell flex h-screen bg-[var(--bg-color)] text-[var(--text-color)] transition-colors duration-200 relative overflow-hidden font-['Inter']">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        <Topbar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 overflow-y-auto relative p-4 md:p-6 lg:p-8">
          <div className="max-w-[1600px] mx-auto h-full px-4 md:px-6 lg:px-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <MasterKeyModal
        isOpen={isMasterKeyModalOpen}
        onClose={handleMasterKeyClose}
        onSuccess={handleMasterKeySuccess}
      />
    </div>
  );
};
