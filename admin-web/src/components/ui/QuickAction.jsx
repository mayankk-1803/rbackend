import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

export const QuickAction = ({
  title,
  description,
  icon: Icon,
  onClick,
  colorClass = 'text-[var(--color-primary)] bg-[var(--color-primary-glow)] border-[var(--border-soft)]',
  className = ''
}) => {
  return (
    <motion.button
      whileHover={{ y: -1, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 bg-[var(--card-bg)] border border-[var(--border-soft)] hover:border-[var(--color-primary)]/30 rounded-2xl shadow-soft hover:shadow-medium text-left transition-all duration-150 cursor-pointer ${className}`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {Icon && (
          <div className={`p-2.5 rounded-xl ${colorClass} flex items-center justify-center shrink-0`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
        )}
        <div className="space-y-0.5 min-w-0">
          <h4 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-tight truncate">{title}</h4>
          {description && <p className="text-[10px] text-[var(--text-secondary)] font-medium truncate">{description}</p>}
        </div>
      </div>
      
      <div className="p-1 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors shrink-0">
        <ArrowUpRight className="w-4 h-4 opacity-55" />
      </div>
    </motion.button>
  );
};
