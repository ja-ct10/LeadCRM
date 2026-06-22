import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCRMStatusStyles(status: string): string {
  switch (status) {
    case 'Hot':
      return 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20';
    case 'Warm':
      return 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
    case 'Closed':
      return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
    case 'Cancelled':
      return 'bg-slate-50 dark:bg-slate-500/10 text-slate-500 dark:text-slate-405 border-slate-200 dark:border-slate-500/20';
    case 'Cold':
    default:
      return 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/20';
  }
}

export function getCRMStatusStripColor(status: string): string {
  switch (status) {
    case 'Hot': return 'bg-rose-500';
    case 'Warm': return 'bg-amber-500';
    case 'Closed': return 'bg-emerald-500';
    case 'Cancelled': return 'bg-slate-400';
    case 'Cold':
    default:
      return 'bg-sky-500';
  }
}
