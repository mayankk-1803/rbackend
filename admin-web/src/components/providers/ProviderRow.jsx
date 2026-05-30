import React from "react";
import ProviderToggle from "./ProviderToggle";
import RouteTypeDropdown from "./RouteTypeDropdown";
import ProviderActionsMenu from "./ProviderActionsMenu";
import { Link2 } from "lucide-react";

export const ProviderRow = ({
  provider,
  index,
  onToggleField,
  onRouteTypeChange,
  onActionClick
}) => {
  // Classification badge styles
  const getHealthBadgeClass = (status) => {
    switch (String(status || "").toUpperCase()) {
      case "HEALTHY":
        return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
      case "DEGRADED":
        return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
      case "UNSTABLE":
        return "bg-orange-500/10 text-orange-500 border border-orange-500/20";
      case "UNKNOWN":
        return "bg-gray-500/10 text-gray-500 border border-gray-500/20";
      case "DOWN":
      default:
        return "bg-rose-500/10 text-rose-500 border border-rose-500/20";
    }
  };

  // Truncates long URLs cleanly
  const renderUrl = (url) => {
    if (!url) return <span className="text-[var(--text-muted)] font-bold">—</span>;
    return (
      <span className="flex items-center gap-1 text-[11px] font-mono tracking-wider max-w-[150px] truncate hover:text-[var(--color-primary)] transition-all cursor-help" title={url}>
        <Link2 className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
        {url}
      </span>
    );
  };

  return (
    <tr className="hover:bg-[var(--admin-table-row-hover)] border-b border-[var(--border-soft)] transition-colors">
      {/* 1. # */}
      <td className="text-center font-bold text-[var(--text-muted)] text-xs w-10">
        {index + 1}
      </td>

      {/* 2. Actions */}
      <td className="text-center w-14">
        <ProviderActionsMenu provider={provider} onAction={onActionClick} />
      </td>

      {/* 3. Provider Name */}
      <td>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[var(--text-primary)] text-sm tracking-tight">
              {provider.name}
            </span>
            {provider.maintenanceMode && (
              <span className="px-1.5 py-0.5 text-[8px] font-extrabold uppercase bg-amber-500/15 text-amber-500 border border-amber-500/20 rounded">
                MNT
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-secondary)] font-extrabold uppercase tracking-wider">
              {provider.code}
            </span>
            {provider.successRate !== null && provider.successRate !== undefined ? (
              <>
                <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-full tracking-wider ${getHealthBadgeClass(provider.healthStatus)}`}>
                  {provider.healthStatus || "UNKNOWN"}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-semibold">
                  SR: {Number(provider.successRate).toFixed(0)}%
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-semibold">
                  Lat: {provider.avgResponseTime}ms
                </span>
              </>
            ) : (
              <>
                <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-full tracking-wider ${getHealthBadgeClass("UNKNOWN")}`}>
                  UNKNOWN
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-semibold">
                  SR: —
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-semibold">
                  Lat: —
                </span>
              </>
            )}
          </div>
        </div>
      </td>

      {/* 4. Callback / Route ID */}
      <td className="font-mono text-xs text-[var(--text-primary)] font-bold">
        {provider.callbackId || provider.code}
      </td>

      {/* 5. In Switch Toggle */}
      <td className="text-center w-28">
        <ProviderToggle
          checked={provider.inSwitch}
          onChange={(val) => onToggleField(provider.id, "inSwitch", val, provider.version)}
        />
      </td>

      {/* 6. Current Queue Count */}
      <td className="text-center w-28">
        <span className={`px-2.5 py-1 text-xs font-black rounded-lg border tracking-tight ${
          (provider.currentQueue || 0) > 10
            ? "bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse"
            : (provider.currentQueue || 0) > 0
            ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
            : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
        }`}>
          {provider.currentQueue || 0} jobs
        </span>
      </td>

      {/* 7. IsActive Toggle */}
      <td className="text-center w-28">
        <ProviderToggle
          checked={provider.isActive}
          onChange={(val) => onToggleField(provider.id, "isActive", val, provider.version)}
        />
      </td>

      {/* 8. API URL */}
      <td>{renderUrl(provider.apiUrl)}</td>

      {/* 9. Status Check URL */}
      <td>{renderUrl(provider.statusCheckUrl)}</td>

      {/* 10. Balance URL */}
      <td>{renderUrl(provider.balanceUrl)}</td>

      {/* 11. Dispute URL */}
      <td>{renderUrl(provider.disputeUrl)}</td>

      {/* 12. Route Type Dropdown */}
      <td className="w-32">
        <RouteTypeDropdown
          value={provider.routeType}
          onChange={(val) => onRouteTypeChange(provider.id, val, provider.version)}
        />
      </td>
    </tr>
  );
};

export default ProviderRow;
