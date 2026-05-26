import React from 'react';
import { motion } from 'framer-motion';

export const Button = ({ children, variant = 'primary', size = 'md', className = '', loading = false, ...props }) => {
  const variants = {
    primary: 'bg-[var(--color-primary)] text-[var(--bg-primary)] hover:opacity-90 shadow-sm',
    secondary: 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]',
    outline: 'border border-[var(--border-soft)] text-[var(--text-primary)] hover:bg-[var(--accent-hover)]',
    ghost: 'text-[var(--text-secondary)] hover:bg-[var(--accent-hover)] hover:text-[var(--text-primary)]',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2 text-sm rounded-xl',
    lg: 'px-6 py-3 text-base rounded-xl',
  };

  return (
    <motion.button
      whileTap={{ scale: props.disabled || loading ? 1 : 0.98 }}
      className={`
        inline-flex items-center justify-center font-medium transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      disabled={loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : null}
      {children}
    </motion.button>
  );
};
