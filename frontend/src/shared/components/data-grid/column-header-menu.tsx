'use client';

import { ArrowUp, ArrowDown, Check, Menu, RotateCcw, Pin, Filter, EyeOff } from 'lucide-react';
import { tableSortLabels, type TableSortOption } from '@leadcrm/shared';
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
  sortFields?: TableSortOption[];
  onSortAsc: (columnId: string) => void;
  onSortDesc: (columnId: string) => void;
  onSortReset?: () => void;
  onPinColumn?: (columnId: string) => void;
  onFilterBy?: (columnId: string) => void;
  onHideColumn?: (columnId: string) => void;
}

/** Header actions affect only this column; table-wide sorting lives in settings. */
export function ColumnHeaderMenu({ columnId, columnLabel, isRequired, isSortable = true, isPinned, sortDirection,
  sort, defaultSort = null, sortFields, onSortAsc, onSortDesc, onSortReset, onPinColumn, onFilterBy, onHideColumn }: ColumnHeaderMenuProps) {
  const option = sortFields?.find(field => field.id === columnId);
  const sortable = sortFields ? !!option : isSortable;
  const active = sort ?? (sortDirection ? { field: columnId, direction: sortDirection } : null);
  const current = active?.field === columnId;
  const defaultActive = active?.field === defaultSort?.field && active?.direction === defaultSort?.direction;
  const labels = tableSortLabels(option?.kind);
  const columnActions = !!(onPinColumn || onFilterBy || onHideColumn);
  if (!sortable && !onPinColumn && !onFilterBy && (!onHideColumn || isRequired)) return null;
  const mark = (checked: boolean) => <Check size={14} aria-hidden="true" className={checked ? 'ml-auto' : 'ml-auto invisible'} />;
  return <DropdownMenu>
    <DropdownMenuTrigger aria-label={`Column options for ${columnLabel}`} className="inline-flex shrink-0 items-center justify-center rounded p-1 min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 text-slate-500 dark:text-slate-400 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Menu size={14} aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" aria-label={`Options for ${columnLabel}`} className="w-60">
      <DropdownMenuLabel>{columnLabel}</DropdownMenuLabel>
      {sortable && <>
        <DropdownMenuItem role="menuitemradio" aria-checked={current && active?.direction === 'asc'} onSelect={() => onSortAsc(columnId)}>
          <ArrowUp size={14} aria-hidden="true" />{labels.asc}{mark(current && active?.direction === 'asc')}
        </DropdownMenuItem>
        <DropdownMenuItem role="menuitemradio" aria-checked={current && active?.direction === 'desc'} onSelect={() => onSortDesc(columnId)}>
          <ArrowDown size={14} aria-hidden="true" />{labels.desc}{mark(current && active?.direction === 'desc')}
        </DropdownMenuItem>
        {current && onSortReset && <DropdownMenuItem disabled={defaultActive} onSelect={onSortReset}><RotateCcw size={14} aria-hidden="true" />Restore default sorting</DropdownMenuItem>}
      </>}
      {sortable && columnActions && <DropdownMenuSeparator />}
      {onPinColumn && <DropdownMenuItem onSelect={() => onPinColumn(columnId)}><Pin size={14} aria-hidden="true" />{isPinned ? 'Unpin Column' : 'Pin Column'}</DropdownMenuItem>}
      {onFilterBy && <DropdownMenuItem onSelect={() => onFilterBy(columnId)}><Filter size={14} aria-hidden="true" />Filter by</DropdownMenuItem>}
      {onHideColumn && <DropdownMenuItem disabled={isRequired} onSelect={() => onHideColumn(columnId)}><EyeOff size={14} aria-hidden="true" />Hide Column</DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
