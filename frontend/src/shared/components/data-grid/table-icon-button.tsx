'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

/** DataGrid quick-action styling with accessible tooltips and disabled states. */
export const TableIconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string; ariaLabel?: string; touchFriendly?: boolean; variant?: 'ghost' | 'outline';
}>(function TableIconButton({ label, ariaLabel = label, children, onClick, disabled, touchFriendly = false, variant = 'ghost', className, ...props }, ref) {
  return <TooltipProvider><Tooltip><TooltipTrigger asChild>
    <button {...props} ref={ref} type="button" onClick={event => { event.stopPropagation(); onClick?.(event); }} disabled={disabled} aria-label={ariaLabel} title={label}
      className={cn(variant === 'outline'
        ? 'inline-flex min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'
        : cn(touchFriendly && 'min-w-11 min-h-11 sm:min-w-0 sm:min-h-0', 'p-1.5 inline-flex shrink-0 items-center justify-center rounded-md transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40'), className)}>
      {children}
    </button>
  </TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip></TooltipProvider>;
});
