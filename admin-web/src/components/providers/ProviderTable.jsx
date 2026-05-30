import React from "react";
import ProviderRow from "./ProviderRow";

export const ProviderTable = ({
  providers,
  loading,
  onToggleField,
  onRouteTypeChange,
  onActionClick
}) => {
  if (loading) {
    return (
      <div className="w-full overflow-hidden border border-[var(--border-soft)] rounded-xl bg-[var(--card-bg)] shadow-soft">
        <div className="p-6 space-y-4">
          <div className="h-6 w-48 bg-[var(--bg-secondary)] rounded-md shimmer-element" />
          <div className="space-y-3">
            {[1, 2].map((n) => (
              <div key={n} className="flex items-center gap-4 py-4 border-b border-[var(--border-soft)] last:border-0">
                <div className="h-10 w-10 bg-[var(--bg-secondary)] rounded-lg shimmer-element shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-1/4 bg-[var(--bg-secondary)] rounded shimmer-element" />
                  <div className="h-3 w-1/3 bg-[var(--bg-secondary)] rounded shimmer-element" />
                </div>
                <div className="h-8 w-24 bg-[var(--bg-secondary)] rounded-lg shimmer-element shrink-0" />
                <div className="h-8 w-24 bg-[var(--bg-secondary)] rounded-lg shimmer-element shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto border border-[var(--border-soft)] rounded-xl bg-[var(--card-bg)] shadow-soft gpu-accelerated">
      <table className="w-full border-collapse text-left text-xs align-middle">
        <thead>
          <tr className="border-b border-[var(--border-soft)] bg-[var(--admin-table-header-bg)]">
            <th className="py-3.5 text-center font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider w-10">
              #
            </th>
            <th className="py-3.5 text-center font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider w-14">
              Actions
            </th>
            <th className="py-3.5 font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider min-w-[150px]">
              Provider Name
            </th>
            <th className="py-3.5 font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
              Callback / Route ID
            </th>
            <th className="py-3.5 text-center font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider w-28">
              In Switch
            </th>
            <th className="py-3.5 text-center font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider w-28">
              Current Queue
            </th>
            <th className="py-3.5 text-center font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider w-28">
              Is Active
            </th>
            <th className="py-3.5 font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
              API URL
            </th>
            <th className="py-3.5 font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
              Status Check URL
            </th>
            <th className="py-3.5 font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
              Balance URL
            </th>
            <th className="py-3.5 font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
              Dispute URL
            </th>
            <th className="py-3.5 font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider w-32">
              Route Type
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-soft)]">
          {providers && providers.length > 0 ? (
            providers.map((provider, index) => (
              <ProviderRow
                key={provider.id}
                provider={provider}
                index={index}
                onToggleField={onToggleField}
                onRouteTypeChange={onRouteTypeChange}
                onActionClick={onActionClick}
              />
            ))
          ) : (
            <tr>
              <td colSpan={12} className="text-center py-20 text-[var(--text-muted)] text-sm border-dashed">
                No active gateway providers found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ProviderTable;
