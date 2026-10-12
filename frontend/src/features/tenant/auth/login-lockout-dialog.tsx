'use client';

import { useId } from 'react';
import { LockKeyhole } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/shared/components/ui/dialog';
import { ThemeScope } from '@/shared/components/theme-scope';

export function LoginLockoutDialog({ open, onOpenChange, countdown, seconds }: {
  open: boolean; onOpenChange: (open: boolean) => void; countdown: string; seconds: number;
}) {
  const titleId = useId(), descriptionId = useId();
  return (
    <ThemeScope className="contents">
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-labelledby={titleId} aria-describedby={descriptionId}
        className="max-w-[26rem] bg-white dark:bg-slate-950 text-center p-5 sm:p-7 border-gray-200 dark:border-white/10">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/15">
          <LockKeyhole aria-hidden="true" className="h-9 w-9 text-red-600 dark:text-red-400" />
        </div>
        <DialogTitle id={titleId} className="font-display text-xl sm:text-2xl font-bold leading-tight text-slate-900 dark:text-white">
          Too Many Login Attempts
        </DialogTitle>
        <DialogDescription id={descriptionId} className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-400">
          You have reached the maximum number of failed login attempts. For security reasons, sign-in has been temporarily disabled for 5 minutes.
        </DialogDescription>
        <div role="timer" aria-live="off" aria-label={`Time remaining: ${countdown}`}
          className="mx-auto my-5 w-fit rounded-xl bg-red-50 dark:bg-red-500/10 px-7 py-3 text-4xl sm:text-5xl font-bold tabular-nums text-red-600 dark:text-red-400">
          {countdown}
        </div>
        <p role="status" className="sr-only">
          {seconds > 60 ? `${Math.ceil(seconds / 60)} minutes remaining.` : seconds > 10 ? 'Less than one minute remaining.' : `${seconds} seconds remaining.`}
        </p>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Please wait until the timer reaches 00:00 before trying to sign in again.
        </p>
        <DialogClose className="mt-6 min-h-11 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          Close
        </DialogClose>
      </DialogContent>
    </Dialog>
    </ThemeScope>
  );
}
