'use client';

import { useState, useRef } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import type { CrmEnvironment } from '@leadcrm/shared';
import { toast } from 'sonner';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/store/AuthContext';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/shared/components/ui/alert-dialog';

const options = [
  { value: 'SANDBOX', label: 'Sandbox', description: 'Safe environment for testing CRM features and workflows.' },
  { value: 'PRODUCTION', label: 'Live', description: 'Production environment containing real operational CRM data.' },
] as const;

export function EnvironmentSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, switchEnvironment, isSwitchingEnvironment } = useAuth();
  const [pending, setPending] = useState<CrmEnvironment | null>(null);
  const submitting = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  if (!user || user.role === 'System Admin') return null;
  const active = user.activeEnvironment ?? 'SANDBOX';
  const live = pending === 'PRODUCTION';
  const close = () => { if (!submitting.current) { setPending(null); trigger.current?.focus(); } };
  const confirm = async () => {
    if (!pending || submitting.current) return;
    submitting.current = true;
    try {
      await switchEnvironment(pending);
      const recordRoute = pathname.match(/^(\/crm\/(?:leads|contacts|accounts|companies|deals))\//);
      if (recordRoute) router.replace(recordRoute[1]);
      setPending(null);
      trigger.current?.focus();
    } catch (error) {
      toast.error(error instanceof Error && error.message.includes('mock mode') ? error.message : 'Unable to switch environment. Please try again.');
    } finally { submitting.current = false; }
  };
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button ref={trigger} onFocus={event => { trigger.current = event.currentTarget; }} variant="outline" size="sm" disabled={isSwitchingEnvironment} aria-label={`Environment: ${active === 'PRODUCTION' ? 'Live' : 'Sandbox'}`}>
          {isSwitchingEnvironment ? <Loader2 size={14} className="animate-spin" /> : <span className={`h-2 w-2 rounded-full ${active === 'PRODUCTION' ? 'bg-emerald-500' : 'bg-amber-500'}`} />}
          {isSwitchingEnvironment ? 'Switching...' : active === 'PRODUCTION' ? 'Live' : 'Sandbox'}
          <ChevronDown size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="end">
        <p className="px-3 py-2 text-xs font-semibold text-[var(--text-tertiary)]">Environment</p>
        {options.map(option => <DropdownMenuItem key={option.value} disabled={isSwitchingEnvironment}
          onSelect={() => { if (option.value !== active) setPending(option.value); }}>
          <Check size={16} className={active === option.value ? 'shrink-0' : 'invisible shrink-0'} />
          <span><span className="block font-medium">{option.label}{active === option.value && <span className="sr-only"> (active)</span>}</span>
            <span className="block text-xs text-[var(--text-tertiary)] whitespace-normal">{option.description}</span></span>
        </DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
    <AlertDialog open={pending !== null} onOpenChange={open => { if (!open) close(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{live ? 'Switch to Live Environment?' : 'Switch to Sandbox?'}</AlertDialogTitle>
          <AlertDialogDescription>{live
            ? 'You are about to enter the Production environment. Changes made in Live may affect real CRM records and operational data.'
            : 'You are about to enter the Sandbox environment. Sandbox is intended for testing CRM features and workflows without affecting production CRM data.'}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" disabled={isSwitchingEnvironment} onClick={close}>Cancel</Button>
          <Button disabled={isSwitchingEnvironment} onClick={() => void confirm()}>{isSwitchingEnvironment ? 'Switching...' : `Switch to ${live ? 'Live' : 'Sandbox'}`}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
