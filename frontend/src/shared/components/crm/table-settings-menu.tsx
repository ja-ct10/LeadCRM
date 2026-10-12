'use client';

import { useRef, useState } from 'react';
import { Settings2, Columns3, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/shared/components/ui/dropdown-menu';
import type { ViewMode } from '@/shared/hooks/use-table-preferences';

interface TableSettingsMenuProps {
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  onResetColumnSize?: () => void | Promise<unknown>;
}

/** Toolbar settings preserve the Leads placement; column selection has its own button. */
export function TableSettingsMenu({ pageSize, onPageSizeChange, viewMode, onViewModeChange, onResetColumnSize }: TableSettingsMenuProps) {
  const pending = useRef(false);
  const [resetting, setResetting] = useState(false);
  const reset = async () => {
    if (pending.current || !onResetColumnSize) return;
    pending.current = true; setResetting(true);
    try { await onResetColumnSize(); toast.success('Column sizes reset'); }
    catch { toast.error('Unable to reset column sizes. Please try again.'); }
    finally { pending.current = false; setResetting(false); }
  };
  if (!onResetColumnSize && !onPageSizeChange && !onViewModeChange) return null;
  const mark = (active: boolean) => <Check size={14} aria-hidden="true" className={active ? 'ml-auto' : 'ml-auto invisible'} />;
  return <DropdownMenu>
    <DropdownMenuTrigger disabled={resetting} aria-label="Table settings" className="inline-flex min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
      {resetting ? <Loader2 size={14} className="animate-spin" /> : <Settings2 size={14} />}
    </DropdownMenuTrigger>
    <DropdownMenuContent aria-label="Table settings">
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
  </DropdownMenu>;
}
