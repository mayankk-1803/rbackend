import React from 'react';

export const Card = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-white border border-[#E2E8F0] rounded-md overflow-hidden shadow-sm transition-all duration-150 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ title, subtitle, className = '' }) => (
  <div className={`p-4 border-b border-[#E2E8F0] bg-[#F8FAFC]/50 ${className}`}>
    <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{title}</h3>
    {subtitle && <p className="text-[10px] text-[#94A3B8] mt-1">{subtitle}</p>}
  </div>
);

export const CardContent = ({ children, className = '' }) => (
  <div className={`p-4 ${className}`}>
    {children}
  </div>
);
