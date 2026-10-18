'use client';

import { useRef, useState } from 'react';
import { Settings2, Columns3, Check, Loader2, ArrowUpDown } from 'lucide-react';
import type { RecordSort, TableSortOption } from '@leadcrm/shared';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/shared/components/ui/dropdown-menu';
import type { ViewMode } from '@/shared/hooks/use-table-preferences';
import { SortTableDialog } from './sort-table-dialog';
import { TableIconButton } from '@/shared/components/data-grid/table-icon-button';

interface TableSettingsMenuProps {
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  onManageColumns?: () => void;
  onResetColumnSize?: () => void | Promise<unknown>;
  sortFields?: TableSortOption[];
  sort?: RecordSort | null;
  onSortChange?: (sort: RecordSort | null) => void;
}

/** Shared toolbar menu for column management, sizes and display preferences. */
export function TableSettingsMenu({ pageSize, onPageSizeChange, viewMode, onViewModeChange, onManageColumns, onResetColumnSize, sortFields = [], sort = null, onSortChange }: TableSettingsMenuProps) {
  const pending = useRef(false);
  const [resetting, setResetting] = useState(false);
  const [sorting, setSorting] = useState(false);
  const canSort = !!onSortChange && sortFields.length > 0;
  const reset = async () => {
    if (pending.current || !onResetColumnSize) return;
    pending.current = true; setResetting(true);
    try { await onResetColumnSize(); toast.success('Column sizes reset'); }
    catch { toast.error('Unable to reset column sizes. Please try again.'); }
    finally { pending.current = false; setResetting(false); }
  };
  if (!onManageColumns && !onResetColumnSize && !onPageSizeChange && !onViewModeChange && !canSort) return null;
  const mark = (active: boolean) => <Check size={14} aria-hidden="true" className={active ? 'ml-auto' : 'ml-auto invisible'} />;
  return <><DropdownMenu>
    <DropdownMenuTrigger asChild>
      <TableIconButton variant="outline" label="Table settings" disabled={resetting}>
        {resetting ? <Loader2 size={14} className="animate-spin" /> : <Settings2 size={14} />}
      </TableIconButton>
    </DropdownMenuTrigger>
    <DropdownMenuContent aria-label="Table settings">
      {onManageColumns && <DropdownMenuItem onSelect={onManageColumns}><Columns3 size={14} aria-hidden="true" />Manage Columns</DropdownMenuItem>}
      {canSort && <DropdownMenuItem onSelect={() => setSorting(true)}><ArrowUpDown size={14} aria-hidden="true" />Sort Table…</DropdownMenuItem>}
      {onResetColumnSize && <DropdownMenuItem onSelect={() => void reset()}><Columns3 size={14} aria-hidden="true" />Reset Column Size</DropdownMenuItem>}
      {onPageSizeChange && <>
        <DropdownMenuSeparator /><DropdownMenuLabel>Records Per Page</DropdownMenuLabel>
        {[10, 20, 25, 30, 40, 50].map(size => <DropdownMenuItem key={size} role="menuitemradio" aria-checked={size === pageSize} onSelect={() => onPageSizeChange(size)}>{size}{mark(size === pageSize)}</DropdownMenuItem>)}
      </>}
      {onViewModeChange && <>
        <DropdownMenuSeparator /><DropdownMenuLabel>View Mode</DropdownMenuLabel>
        {(['wrap', 'clip'] as const).map(mode => <DropdownMenuItem key={mode} role="menuitemradio" aria-checked={mode === viewMode} onSelect={() => onViewModeChange(mode)}>{mode === 'wrap' ? 'Wrap Text' : 'Clip Text'}{mark(mode === viewMode)}</DropdownMenuItem>)}
      </>}
    </DropdownMenuContent>
  </DropdownMenu>
    {sorting && onSortChange && <SortTableDialog fields={sortFields} sort={sort} defaultSort={{ field: 'createdAt', direction: 'desc' }} onSortChange={onSortChange} onClose={() => setSorting(false)} />}
  </>;
}
