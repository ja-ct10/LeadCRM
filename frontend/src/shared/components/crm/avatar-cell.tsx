'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AvatarCellProps {
  initials: string;
  name: string;
  subtitle?: string;
  /** Optional link-colored text */
  linkText?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Background color class override */
  bgColor?: string;
  /** Activity flag chip (pink date badges) */
  activityFlag?: React.ReactNode;
  onClick?: () => void;
}

// ── Color palette for avatar backgrounds (deterministic from initials) ──────

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
  'bg-orange-500', 'bg-pink-500', 'bg-lime-600', 'bg-sky-500',
];

function getAvatarColor(initials: string): string {
  const charSum = initials.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[charSum % AVATAR_COLORS.length];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AvatarCell({
  initials,
  name,
  subtitle,
  linkText,
  size = 'md',
  bgColor,
  activityFlag,
  onClick,
}: AvatarCellProps): React.ReactElement {
  const sizeClasses = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-8 h-8 text-[11px]',
    lg: 'w-10 h-10 text-[13px]',
  };

  const resolvedBg = bgColor ?? getAvatarColor(initials);

  return (
    <div
      className={cn('flex items-center gap-2.5 min-w-0', onClick && 'cursor-pointer')}
      onClick={onClick}
    >
      {/* Activity flag (date chip before avatar) */}
      {activityFlag}

      {/* Avatar */}
      <div
        className={cn(
          'shrink-0 rounded-full flex items-center justify-center text-white font-bold uppercase',
          sizeClasses[size],
          resolvedBg,
        )}
      >
        {initials}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate leading-tight">
          {name}
        </p>
        {subtitle && (
          <p className="text-[11.5px] text-[#5A6B85] dark:text-slate-400 truncate leading-tight mt-0.5">
            {subtitle}
          </p>
        )}
        {linkText && (
          <p className="text-[11.5px] text-[#2563EB] dark:text-blue-400 truncate leading-tight mt-0.5 font-medium">
            {linkText}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Activity Flag Chip (pink date badge) ───────────────────────────────────────

interface ActivityFlagProps {
  type: 'task' | 'call' | 'meeting';
  date: string;
  isOverdue?: boolean;
}

export function ActivityFlag({ type, date, isOverdue = false }: ActivityFlagProps): React.ReactElement {
  return (
    <div className={cn(
      'shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded-lg text-[10px] font-bold leading-tight',
      isOverdue
        ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
        : 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
    )}>
      <span className="text-[9px] uppercase font-semibold opacity-80">
        {date.split(' ')[0]}
      </span>
      <span className="text-[12px] font-bold">
        {date.split(' ')[1]}
      </span>
    </div>
  );
}
