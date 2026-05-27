import React from 'react';
import { RefreshCw } from 'lucide-react';
import { SkeletonLoader } from './SkeletonLoader';
import { EmptyState } from './EmptyState';

export const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = "No entries found",
  onRefresh = null,
  pagination = null, // { page, totalPages, limit, setPage, setLimit }
  className = ''
}) => {
  return (
    <div className={`bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl shadow-soft overflow-hidden ${className}`}>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--bg-secondary)]/30 border-b border-[var(--border-soft)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              {columns.map((col, idx) => (
                <th 
                  key={idx} 
                  className={`px-5 py-3.5 font-semibold ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${col.className || ''}`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-soft)] text-xs">
            {loading ? (
              Array.from({ length: pagination?.limit || 5 }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className={`px-5 py-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}>
                      <div className={`h-3.5 bg-[var(--bg-secondary)] rounded-md ${col.align === 'right' ? 'ml-auto' : col.align === 'center' ? 'mx-auto' : ''}`} style={{ width: col.skeletonWidth || '60%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <EmptyState message={emptyMessage} className="border-none shadow-none rounded-none py-12" />
                </td>
              </tr>
            ) : (
              data.map((row, rIdx) => (
                <tr key={row.id || rIdx} className="hover:bg-[var(--admin-table-row-hover)] transition-colors group">
                  {columns.map((col, cIdx) => {
                    const value = col.accessor ? (typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor]) : null;
                    return (
                      <td 
                        key={cIdx} 
                        className={`px-5 py-3.5 font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors ${
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                        } ${col.cellClassName || ''}`}
                      >
                        {col.cell ? col.cell(row) : value}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      {pagination && (
        <div className="px-5 py-3 border-t border-[var(--border-soft)] flex flex-col sm:flex-row gap-3 justify-between items-center text-[11px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-secondary)]/10">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={pagination.limit}
              onChange={(e) => {
                pagination.setLimit?.(Number(e.target.value));
                pagination.setPage?.(1);
              }}
              className="px-2 py-1 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-lg text-[10px] text-[var(--text-primary)] cursor-pointer outline-none focus:border-[var(--color-primary)]"
            >
              <option value={5}>5 entries</option>
              <option value={10}>10 entries</option>
              <option value={25}>25 entries</option>
              <option value={50}>50 entries</option>
            </select>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[var(--text-secondary)]">Page {pagination.page} of {pagination.totalPages || 1}</span>
            <div className="flex gap-1">
              <button 
                onClick={() => pagination.setPage?.(p => Math.max(p - 1, 1))}
                disabled={pagination.page === 1 || loading}
                className="px-2.5 py-1 text-[10px] font-bold border border-[var(--border-soft)] rounded-lg bg-[var(--card-bg)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <button 
                onClick={() => pagination.setPage?.(p => Math.min(p + 1, pagination.totalPages))}
                disabled={pagination.page === pagination.totalPages || loading}
                className="px-2.5 py-1 text-[10px] font-bold border border-[var(--border-soft)] rounded-lg bg-[var(--card-bg)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
