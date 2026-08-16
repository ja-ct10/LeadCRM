/**
 * ActivityFlag — Colored date badge with activity type icon.
 *
 * Shows recent activity dates (e.g., "Aug 13") with an icon indicating
 * the activity type (phone call, email, task, meeting).
 *
 * Used in the DataGrid first column area alongside the checkbox.
 */

'use client';

import React from 'react';
import { Phone, Mail, CalendarCheck, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ActivityType = 'call' | 'email' | 'task' | 'meeting' | 'sms';

export interface ActivityFlagProps {
  /** Activity date */
  date: Date | string;
  /** Activity type determines the icon */
  type: ActivityType;
  /** Whether this activity is overdue */
  overdue?: boolean;
}

// ─── Icon Map ────────────────────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<ActivityType, React.ReactNode> = {
  call: <Phone size={10} />,
  email: <Mail size={10} />,
  task: <CalendarCheck size={10} />,
  meeting: <CalendarCheck size={10} />,
  sms: <MessageSquare size={10} />,
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ActivityFlag({ date, type, overdue = false }: ActivityFlagProps): React.ReactElement {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const formatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const icon = ACTIVITY_ICONS[type] ?? ACTIVITY_ICONS.call;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold leading-tight whitespace-nowrap',
        overdue
          ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
          : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300',
      )}
      title={`${type.charAt(0).toUpperCase() + type.slice(1)} — ${formatted}`}
    >
      <span className={cn(
        overdue ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-400',
      )}>
        {icon}
      </span>
      {formatted}
    </span>
  );
}
