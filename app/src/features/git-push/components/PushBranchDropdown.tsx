import React from 'react';
import { Search, GitBranch } from 'lucide-react';

interface BranchItem {
  name: string;
  outgoing?: number;
}

interface PushBranchDropdownProps {
  isOpen: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  emptyText?: string;
  items: (string | BranchItem)[];
  currentValue: string;
  sourceValue?: string;
  sameNameLabel?: string;
  onSelect: (name: string) => Promise<void> | void;
}

export const PushBranchDropdown: React.FC<PushBranchDropdownProps> = ({
  isOpen,
  search,
  onSearchChange,
  placeholder,
  emptyText,
  items,
  currentValue,
  sourceValue,
  sameNameLabel,
  onSelect,
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute left-0 top-full mt-1 w-64 bg-theme-panel border border-theme-border-card rounded-lg shadow-2xl z-[1050] py-1 text-xs animate-in fade-in zoom-in-95 duration-75"
    >
      <div className="p-1.5 border-b border-theme">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-theme-input border border-theme-border-card">
          <Search className="w-3 h-3 text-theme-dim shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className="bg-transparent border-none text-xs text-theme-main focus:outline-none w-full"
            autoFocus
          />
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {items.length === 0 ? (
          emptyText ? (
            <div className="px-3 py-2 text-center text-theme-dim text-[11px]">{emptyText}</div>
          ) : null
        ) : (
          items.map((item) => {
            const name = typeof item === 'string' ? item : item.name;
            const outgoing = typeof item === 'object' ? item.outgoing : undefined;
            const isSelected = name === currentValue;
            const isSameName = sourceValue && name === sourceValue;

            return (
              <button
                key={name}
                type="button"
                onClick={async () => {
                  await onSelect(name);
                }}
                className={`w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-theme-card hover:text-sky-400 cursor-pointer transition ${
                  isSelected ? 'text-sky-400 font-bold bg-sky-500/10' : 'text-theme-main'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <GitBranch className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">{name}</span>
                </div>
                {outgoing !== undefined && outgoing > 0 && (
                  <span className="text-[10px] bg-sky-500/20 text-sky-400 px-1.5 py-0.2 rounded font-mono shrink-0">
                    ↑{outgoing}
                  </span>
                )}
                {isSameName && sameNameLabel && (
                  <span className="text-[10px] text-theme-dim">{sameNameLabel}</span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
