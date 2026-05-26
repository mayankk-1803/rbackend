import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { AnimatePresence, motion } from 'framer-motion';

export const Layout = () => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close sidebar on route change on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

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
    </div>
  );
};
