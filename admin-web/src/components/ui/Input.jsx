import React from 'react';

export const Input = ({ label, error, className = '', ...props }) => {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-3 py-2 text-sm bg-white border border-[#E2E8F0] rounded-md
          outline-none focus:ring-2 focus:ring-[#2563EB]/10 focus:border-[#2563EB] transition-all duration-150
          placeholder:text-[#94A3B8]
          ${error ? 'border-red-500 focus:ring-red-500/10 focus:border-red-500' : ''}
        `}
        {...props}
      />
      {error && <p className="text-[10px] text-red-500 font-medium">{error}</p>}
    </div>
  );
};

export const Select = ({ label, options, className = '', ...props }) => {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider">
          {label}
        </label>
      )}
      <select
        className="
          w-full px-3 py-2 text-sm bg-white border border-[#E2E8F0] rounded-md
          outline-none focus:ring-2 focus:ring-[#2563EB]/10 focus:border-[#2563EB] transition-all duration-150
          appearance-none
        "
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};
