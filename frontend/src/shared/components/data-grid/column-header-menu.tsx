/**
 * ColumnHeaderMenu — Dropdown menu triggered by the ≡ icon on each column header.
 *
 * Actions:
 * - Asc: Sort column ascending
 * - Desc: Sort column descending
 * - Pin Column: Pin/unpin column to left
 * - Filter by: Open filter for this column
 * - Hide Column: Hide this column from view
 *
 * Matches the Close CRM / Zoho CRM column menu pattern.
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Pin,
  Filter,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ColumnHeaderMenuProps {
  /** Column ID */
  columnId: string;
  /** Column label (for display) */
  columnLabel: string;
  /** Whether column is required (cannot be hidden) */
  isRequired?: boolean;
  /** Whether column is currently pinned */
  isPinned?: boolean;
  /** Current sort direction for this column */
  sortDirection?: 'asc' | 'desc' | null;
  /** Sort ascending */
  onSortAsc: (columnId: string) => void;
  /** Sort descending */
  onSortDesc: (columnId: string) => void;
  /** Pin/unpin column */
  onPinColumn?: (columnId: string) => void;
  /** Filter by this column */
  onFilterBy?: (columnId: string) => void;
  /** Hide this column */
  onHideColumn?: (columnId: string) => void;
}

// ─── Menu Item ───────────────────────────────────────────────────────────────

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  destructive?: boolean;
}

function MenuItem({ icon, label, onClick, disabled, active, destructive }: MenuItemProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-left transition-colors rounded-md',
        disabled && 'opacity-40 cursor-not-allowed',
        !disabled && !destructive && 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60',
        !disabled && destructive && 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10',
        active && 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
      )}
    >
      <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">{icon}</span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ColumnHeaderMenu({
  columnId,
  columnLabel,
  isRequired = false,
  isPinned = false,
  sortDirection = null,
  onSortAsc,
  onSortDesc,
  onPinColumn,
  onFilterBy,
  onHideColumn,
}: ColumnHeaderMenuProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div className="relative inline-flex" ref={menuRef}>
      {/* Trigger — hamburger icon (≡) */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={cn(
          'w-5 h-5 flex items-center justify-center rounded transition-colors',
          'text-slate-400 dark:text-slate-500',
          'hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-600/40',
          isOpen && 'text-slate-600 dark:text-slate-300 bg-slate-200/60 dark:bg-slate-600/40',
        )}
        aria-label={`Column options for ${columnLabel}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2 4h10M2 7h10M2 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute top-full left-0 mt-1 z-50',
            'w-[180px] py-1.5 px-1',
            'bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/[0.08]',
            'rounded-lg shadow-xl',
          )}
          role="menu"
          aria-label={`Options for ${columnLabel}`}
        >
          <MenuItem
            icon={<ArrowUp size={14} />}
            label="Asc"
            onClick={() => { onSortAsc(columnId); setIsOpen(false); }}
            active={sortDirection === 'asc'}
          />
          <MenuItem
            icon={<ArrowDown size={14} />}
            label="Desc"
            onClick={() => { onSortDesc(columnId); setIsOpen(false); }}
            active={sortDirection === 'desc'}
          />

          {/* Separator */}
          <div className="my-1 border-t border-gray-100 dark:border-white/[0.06]" />

          {onPinColumn && (
            <MenuItem
              icon={<Pin size={14} />}
              label={isPinned ? 'Unpin Column' : 'Pin Column'}
              onClick={() => { onPinColumn(columnId); setIsOpen(false); }}
            />
          )}

          {onFilterBy && (
            <MenuItem
              icon={<Filter size={14} />}
              label="Filter by"
              onClick={() => { onFilterBy(columnId); setIsOpen(false); }}
            />
          )}

          {onHideColumn && (
            <MenuItem
              icon={<EyeOff size={14} />}
              label="Hide Column"
              onClick={() => { onHideColumn(columnId); setIsOpen(false); }}
              disabled={isRequired}
            />
          )}
        </div>
      )}
    </div>
  );
}
