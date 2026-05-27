import React from 'react';
import { Card, CardHeader, CardContent } from './Card';
import { ResponsiveContainer } from 'recharts';

export const ChartContainer = ({
  title,
  subtitle,
  loading = false,
  height = 300,
  children,
  className = '',
  extraHeaderActions = null
}) => {
  return (
    <Card className={`flex flex-col h-full ${className}`}>
      {(title || extraHeaderActions) && (
        <div className="px-5 py-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-secondary)]/10">
          <div>
            {title && <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">{title}</h3>}
            {subtitle && <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-0.5">{subtitle}</p>}
          </div>
          {extraHeaderActions}
        </div>
      )}
      
      <CardContent className="flex-1 p-5 min-h-0 relative flex items-center justify-center">
        {loading ? (
          <div className="w-full bg-[var(--bg-secondary)]/30 animate-pulse rounded-xl" style={{ height: `${height}px` }} />
        ) : children ? (
          <div className="w-full h-full" style={{ height: `${height}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">No chart data available</div>
        )}
      </CardContent>
    </Card>
  );
};
