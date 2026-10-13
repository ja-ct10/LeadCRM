'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

/** Refresh control extracted from the Leads workspace toolbar. */
export function RefreshButton({ onClick, disabled, refreshing, silent = false, label = 'Refresh' }: {
  onClick: () => void | Promise<unknown>; disabled?: boolean; refreshing?: boolean; silent?: boolean; label?: string;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const refresh = async () => {
    if (pending.current || disabled || refreshing) return;
    pending.current = true; setBusy(true);
    try { await onClick(); }
    catch (error) { if (mounted.current) toast.error(error instanceof Error ? error.message : 'Unable to refresh. Please try again.'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  return <TooltipProvider><Tooltip><TooltipTrigger asChild>
    <button type="button" onClick={() => void refresh()} disabled={disabled || refreshing || busy} aria-label={label} aria-busy={refreshing || busy} title={label}
      className="p-1.5 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 flex items-center justify-center text-[#5A6B85] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
      <RefreshCw size={15} aria-hidden="true" className={refreshing || busy ? 'animate-spin' : undefined} />
    </button>
  </TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip></TooltipProvider>;
}
