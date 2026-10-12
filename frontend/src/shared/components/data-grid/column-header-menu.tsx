'use client';

import { useState } from 'react';
import { ArrowUp, ArrowDown, Check, Menu, RotateCcw, Pin, Filter, EyeOff } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/shared/components/ui/dropdown-menu';
import type { SortState } from './types';

export interface ColumnHeaderMenuProps {
  columnId: string;
  columnLabel: string;
  isRequired?: boolean;
  isSortable?: boolean;
  isPinned?: boolean;
  sortDirection?: 'asc' | 'desc' | null;
  sort?: SortState | null;
  defaultSort?: SortState | null;
  sortFields?: { id: string; label: string }[];
  onSortAsc: (columnId: string) => void;
  onSortDesc: (columnId: string) => void;
  onSortReset?: () => void;
  onPinColumn?: (columnId: string) => void;
  onFilterBy?: (columnId: string) => void;
  onHideColumn?: (columnId: string) => void;
}

/** Shared portal menu keeps sorting reachable for pinned and hidden fields. */
export function ColumnHeaderMenu({ columnId, columnLabel, isRequired, isSortable = true, isPinned, sortDirection,
  sort, defaultSort = null, sortFields, onSortAsc, onSortDesc, onSortReset, onPinColumn, onFilterBy, onHideColumn }: ColumnHeaderMenuProps) {
  const fields = sortFields ?? (isSortable ? [{ id: columnId, label: columnLabel }] : []);
  const initialField = fields.some(option => option.id === columnId) ? columnId : sort?.field ?? fields[0]?.id;
  const [field, setField] = useState(initialField);
  const active = sort ?? (sortDirection ? { field: columnId, direction: sortDirection } : null);
  const selected = fields.find(option => option.id === field);
  const defaultActive = active?.field === defaultSort?.field && active?.direction === defaultSort?.direction;
  const mark = (checked: boolean) => <Check size={14} aria-hidden="true" className={checked ? 'ml-auto' : 'ml-auto invisible'} />;
  return <DropdownMenu onOpenChange={open => { if (open) setField(initialField); }}>
    <DropdownMenuTrigger aria-label={`Column options for ${columnLabel}`} className="inline-flex shrink-0 items-center justify-center rounded p-1 min-h-8 min-w-8 text-slate-500 dark:text-slate-400 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Menu size={14} aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" aria-label={`Options for ${columnLabel}`} className="w-60">
      {fields.length > 0 && <>
        <DropdownMenuLabel>{active ? `Current: ${fields.find(option => option.id === active.field)?.label ?? active.field}, ${active.direction === 'asc' ? 'ascending' : 'descending'}` : 'Current: default sorting'}</DropdownMenuLabel>
        <DropdownMenuLabel>{selected?.label ?? 'Sort field'}</DropdownMenuLabel>
        <DropdownMenuItem disabled={!selected} role="menuitemradio" aria-checked={active?.field === field && active.direction === 'asc'} onSelect={() => field && onSortAsc(field)}>
          <ArrowUp size={14} aria-hidden="true" />Sort ascending{mark(active?.field === field && active.direction === 'asc')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!selected} role="menuitemradio" aria-checked={active?.field === field && active.direction === 'desc'} onSelect={() => field && onSortDesc(field)}>
          <ArrowDown size={14} aria-hidden="true" />Sort descending{mark(active?.field === field && active.direction === 'desc')}
        </DropdownMenuItem>
        {onSortReset && <DropdownMenuItem aria-current={defaultActive ? 'true' : undefined} onSelect={onSortReset}><RotateCcw size={14} aria-hidden="true" />Restore default sorting{mark(defaultActive)}</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Sort field</DropdownMenuLabel>
        {fields.map(option => <DropdownMenuItem key={option.id} role="menuitemradio" aria-checked={option.id === field}
          onClick={event => { event.preventDefault(); setField(option.id); }}>
          {option.label}{mark(option.id === field)}
        </DropdownMenuItem>)}
      </>}
      {(onPinColumn || onFilterBy || onHideColumn) && <DropdownMenuSeparator />}
      {onPinColumn && <DropdownMenuItem onSelect={() => onPinColumn(columnId)}><Pin size={14} />{isPinned ? 'Unpin Column' : 'Pin Column'}</DropdownMenuItem>}
      {onFilterBy && <DropdownMenuItem onSelect={() => onFilterBy(columnId)}><Filter size={14} />Filter by</DropdownMenuItem>}
      {onHideColumn && <DropdownMenuItem disabled={isRequired} onSelect={() => onHideColumn(columnId)}><EyeOff size={14} />Hide Column</DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
