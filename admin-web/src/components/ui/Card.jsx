import React from 'react';

export const Card = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl overflow-hidden shadow-soft transition-all duration-150 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ title, subtitle, className = '' }) => (
  <div className={`p-4 border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]/50 ${className}`}>
    <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{title}</h3>
    {subtitle && <p className="text-[10px] text-[var(--text-muted)] mt-1">{subtitle}</p>}
  </div>
);

export const CardContent = ({ children, className = '' }) => (
  <div className={`p-4 ${className}`}>
    {children}
  </div>
);
