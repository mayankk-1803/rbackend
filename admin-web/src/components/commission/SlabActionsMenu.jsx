import React, { useState, useRef } from "react";
import { 
  MoreVertical, 
  Edit2, 
  ChevronRight, 
  UserPlus, 
  Copy, 
  X, 
  Check, 
  Trash2 
} from "lucide-react";
import { Link } from "react-router-dom";
import DropdownPortal from "../ui/DropdownPortal";

export const SlabActionsMenu = ({
  slab,
  onEditInit,
  onAssignInit,
  onCloneInit,
  onStatusToggle,
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
        <div className="w-52 bg-[var(--bg-secondary)] border border-[var(--border-soft)] shadow-md rounded-lg py-1.5 text-left font-semibold uppercase text-[10px] tracking-wider">
          <button
            onClick={() => handleAction(onEditInit, slab)}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--accent-hover)] text-[var(--text-primary)] cursor-pointer"
          >
            <Edit2 className="w-3 h-3" /> Edit
          </button>
          
          <Link
            to={`/commission/recharge-slabs?slabId=${slab.id}`}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--accent-hover)] text-[var(--text-primary)] cursor-pointer"
          >
            <ChevronRight className="w-3 h-3" /> Recharge Commission Slab
          </Link>
          
          <Link
            to={`/commission/range-slabs?slabId=${slab.id}`}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--accent-hover)] text-[var(--text-primary)] cursor-pointer"
          >
            <ChevronRight className="w-3 h-3" /> Range Commission Slab
          </Link>
          
          <button
            onClick={() => handleAction(onAssignInit, slab)}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--accent-hover)] text-[var(--text-primary)] cursor-pointer"
          >
            <UserPlus className="w-3 h-3" /> Assign Users
          </button>
          
          <button
            onClick={() => handleAction(onCloneInit, slab)}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--accent-hover)] text-[var(--text-primary)] cursor-pointer"
          >
            <Copy className="w-3 h-3" /> Clone
          </button>
          
          <button
            onClick={() => handleAction(onStatusToggle, slab)}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--accent-hover)] text-[var(--text-primary)] cursor-pointer border-t border-[var(--border-soft)] mt-1 pt-1.5"
          >
            {slab.isActive ? (
              <span className="flex items-center gap-2 text-amber-500"><X className="w-3 h-3" /> Disable</span>
            ) : (
              <span className="flex items-center gap-2 text-emerald-500"><Check className="w-3 h-3" /> Enable</span>
            )}
          </button>
          
          {!slab.isDefault && (
            <button
              onClick={() => handleAction(onDelete, slab.id, slab.name)}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-rose-500/10 text-rose-500 cursor-pointer"
            >
              <Trash2 className="w-3 h-3 text-rose-500" /> Delete
            </button>
          )}
        </div>
      </DropdownPortal>
    </div>
  );
};

export default SlabActionsMenu;
