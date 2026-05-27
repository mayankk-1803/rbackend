import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

export const EmptyState = ({
  title = "No data found",
  message = "Try adjusting your search criteria or selecting other filter ranges.",
  icon: Icon = AlertCircle,
  actionLabel = null,
  onAction = null,
  className = ''
}) => {
  return (
    <div className={`p-8 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-soft)] shadow-soft text-center flex flex-col items-center justify-center space-y-4 max-w-md mx-auto ${className}`}>
      <div className="p-3 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl text-[var(--text-secondary)]">
        <Icon className="w-6 h-6 opacity-60" />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-extrabold text-[var(--text-primary)] uppercase tracking-tight">{title}</h4>
        <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed max-w-[280px] mx-auto">{message}</p>
      </div>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="outline" size="sm" className="mt-2 text-[10px] font-bold uppercase tracking-wider">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
