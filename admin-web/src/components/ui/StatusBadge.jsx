import React from 'react';

export const StatusBadge = ({ status = '', className = '' }) => {
  const norm = status.toUpperCase().trim();

  const getStyles = () => {
    switch (norm) {
      // Successes / Actives / Healthy
      case 'SUCCESS':
      case 'PAID':
      case 'ACTIVE':
      case 'RESOLVED':
      case 'HEALTHY':
      case 'UP':
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
        
      // Fails / Inactives / Down / Blocked
      case 'FAILED':
      case 'INACTIVE':
      case 'DOWN':
      case 'REJECTED':
      case 'BLOCKED':
        return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
        
      // Pendings / Warnings / Reviews / Degraded
      case 'PENDING':
      case 'PROCESSING':
      case 'PENDING_REVIEW':
      case 'PROCESSING_REVIEW':
      case 'UNDER_REVIEW':
      case 'DEGRADED':
      case 'PROVIDER_ESCALATED':
      case 'OPEN':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        
      default:
        return 'text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-[var(--border-soft)]';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[9px] font-black rounded uppercase border tracking-wider ${getStyles()} ${className}`}>
      {norm.replace('_', ' ')}
    </span>
  );
};
