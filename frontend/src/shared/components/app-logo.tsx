import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function AppLogo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <img
      src={compact ? '/camxian_logo_2.png' : '/camxian_logo.png'}
      alt="Camxian Technologies"
      width={compact ? 332 : 1005}
      height={171}
      className={cn('block h-auto max-w-full rounded bg-white object-contain', className)}
    />
  );
}

export function AppBrand({ children, className, captionClassName }: { children: ReactNode; className?: string; captionClassName?: string }) {
  return (
    <div className={cn('flex max-w-full flex-col items-center gap-2 text-center', className)}>
      {children}
      <p className={cn('w-full text-center text-xs leading-5 text-slate-500 dark:text-slate-400', captionClassName)}>Powered by LeadCRM</p>
    </div>
  );
}
