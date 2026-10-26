import { cn } from '@/lib/utils';

export function UnreadNotificationDot({ label, className }: { label: string; className?: string }) {
  return <span role="status" aria-label={label} className={cn('inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500', className)} />;
}
