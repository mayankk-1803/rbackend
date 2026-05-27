import React from 'react';
import { motion } from 'framer-motion';

export const SectionHeader = ({ title, highlight = '', subtitle, children, className = '' }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}
    >
      <div>
        <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">
          {title} {highlight && <span className="text-[var(--color-primary)] font-extrabold">{highlight}</span>}
        </h2>
        {subtitle && <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">{subtitle}</p>}
      </div>
      
      {children && (
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {children}
        </div>
      )}
    </motion.div>
  );
};
