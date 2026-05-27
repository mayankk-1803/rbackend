import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

export const AnalyticsCard = ({
  title,
  value,
  trend,
  trendDirection = 'up',
  trendLabel = '',
  icon: Icon,
  colorClass = 'text-green-500 bg-green-500/10 border-green-500/20',
  loading = false,
  progress = null,
  gradient = false
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.01 }}
      className={`relative overflow-hidden p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-soft)] shadow-soft transition-all duration-150 ${
        gradient ? 'bg-gradient-to-br from-[var(--card-bg)] to-[var(--bg-secondary)]' : ''
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider truncate">{title}</p>
          {loading ? (
            <div className="h-8 w-24 bg-[var(--bg-secondary)] animate-pulse rounded-lg mt-1" />
          ) : (
            <h3 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight truncate leading-none mt-1">
              {value}
            </h3>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${colorClass} flex items-center justify-center shrink-0`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
        )}
      </div>

      {!loading && (trend !== undefined || progress !== null) && (
        <div className="mt-4 flex flex-col gap-2">
          {trend !== undefined && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold">
              <span className={`flex items-center gap-0.5 ${
                trendDirection === 'up' ? 'text-emerald-500' : trendDirection === 'down' ? 'text-rose-500' : 'text-[var(--text-secondary)]'
              }`}>
                {trendDirection === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
                {trendDirection === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
                {trend}
              </span>
              <span className="text-[var(--text-muted)] font-medium">{trendLabel}</span>
            </div>
          )}
          
          {progress !== null && (
            <div className="space-y-1">
              <div className="w-full bg-[var(--bg-secondary)] rounded-full h-1">
                <div 
                  className="bg-[var(--color-primary)] h-1 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] font-bold text-[var(--text-muted)]">
                <span>PROGRESS</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Decorative background shape */}
      <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-current opacity-[0.015] blur-xl pointer-events-none" />
    </motion.div>
  );
};
