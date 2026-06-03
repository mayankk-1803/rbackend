import React, { useState, useRef } from "react";
import { 
  MoreVertical, 
  Edit2, 
  Copy, 
  CheckCircle, 
  XCircle, 
  Trash2 
} from "lucide-react";
import DropdownPortal from "../ui/DropdownPortal";

export const RangeSlabActionsMenu = ({
  rule,
  onEditInit,
  onClone,
  onApproveInit,
  onRejectInit,
  onDelete
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);

  const handleAction = (callback, ...args) => {
    setIsOpen(false);
    callback(...args);
  };

  return (
    <div className="relative inline-block text-center">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1 hover:bg-[var(--accent-hover)] rounded-md transition-colors cursor-pointer inline-block"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>

      <DropdownPortal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={buttonRef}
        align="left"
      >
        <div className="w-44 bg-[var(--bg-secondary)] border border-[var(--border-soft)] shadow-md rounded-lg py-1.5 text-left font-semibold uppercase text-[10px] tracking-wider">
          <button
            onClick={() => handleAction(onEditInit, rule)}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--accent-hover)] text-[var(--text-primary)] cursor-pointer"
          >
            <Edit2 className="w-3 h-3" /> Edit
          </button>
          
          <button
            onClick={() => handleAction(onClone, rule)}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--accent-hover)] text-[var(--text-primary)] cursor-pointer"
          >
            <Copy className="w-3 h-3" /> Clone Rule
          </button>

          {rule.status === "PENDING" && (
            <>
              <button
                onClick={() => handleAction(onApproveInit, rule)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-emerald-500/10 text-emerald-500 cursor-pointer border-t border-[var(--border-soft)] pt-1"
              >
                <CheckCircle className="w-3 h-3" /> Approve
              </button>
              
              <button
                onClick={() => handleAction(onRejectInit, rule)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-rose-500/10 text-rose-500 cursor-pointer"
              >
                <XCircle className="w-3 h-3" /> Reject
              </button>
            </>
          )}

          <button
            onClick={() => handleAction(onDelete, rule.id)}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-rose-500/10 text-rose-500 cursor-pointer border-t border-[var(--border-soft)] mt-1 pt-1"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      </DropdownPortal>
    </div>
  );
};

export default RangeSlabActionsMenu;
