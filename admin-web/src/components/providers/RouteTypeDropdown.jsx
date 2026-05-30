import React from "react";

export const RouteTypeDropdown = ({ value, onChange, disabled }) => {
  return (
    <select
      value={value || "Both"}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="text-xs bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] outline-none font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
    >
      <option value="Internal">Internal</option>
      <option value="External">External</option>
      <option value="Both">Both</option>
    </select>
  );
};

export default RouteTypeDropdown;
