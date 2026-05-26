import React from 'react';

export const Input = ({ label, error, className = '', ...props }) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-3.5 py-2.5 text-xs bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl
          outline-none focus:ring-2 focus:ring-[var(--admin-focus-ring)] focus:border-[var(--color-primary)] transition-all duration-150
          placeholder:text-[var(--text-muted)] text-[var(--text-primary)]
          ${error ? 'border-rose-500 focus:ring-rose-500/10 focus:border-rose-500' : ''}
        `}
        {...props}
      />
      {error && <p className="text-[10px] text-rose-500 font-medium">{error}</p>}
    </div>
  );
};

export const Select = ({ label, options, className = '', ...props }) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className="
            w-full px-3.5 py-2.5 text-xs bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl
            outline-none focus:ring-2 focus:ring-[var(--admin-focus-ring)] focus:border-[var(--color-primary)] transition-all duration-150
            text-[var(--text-primary)] cursor-pointer
          "
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled} className="bg-[var(--card-bg)] text-[var(--text-primary)]">
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
