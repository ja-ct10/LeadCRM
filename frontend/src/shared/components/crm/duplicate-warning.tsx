'use client';

import React from 'react';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DuplicateMatch } from '@/shared/hooks/use-duplicate-check';

// ─── Types ─────────────────────────────────────────────────────────────────

interface DuplicateWarningProps {
  matches: DuplicateMatch[];
  isChecking?: boolean;
  onUseExisting?: (match: DuplicateMatch) => void;
  onDismiss?: () => void;
  className?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const ENTITY_LABELS: Record<string, string> = {
  lead: 'Lead',
  contact: 'Contact',
  account: 'Account',
};

const CONFIDENCE_STYLES: Record<string, string> = {
  HIGH: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  MEDIUM: 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
};

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * DuplicateWarning — displays a warning when potential duplicate records are found.
 * Shows matched records with confidence levels and actions.
 */
export function DuplicateWarning({
  matches,
  isChecking = false,
  onUseExisting,
  onDismiss,
  className,
}: DuplicateWarningProps): React.ReactElement | null {
  if (matches.length === 0 && !isChecking) return null;

  if (isChecking) {
    return (
      <div className={cn('px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02]', className)}>
        <p className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">Checking for duplicates...</p>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 overflow-hidden',
      className,
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-amber-200/50 dark:border-amber-800/50">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            Possible duplicate{matches.length > 1 ? 's' : ''} found
          </span>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-md text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
            aria-label="Dismiss warning"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Matches */}
      <div className="divide-y divide-amber-200/50 dark:divide-amber-800/50">
        {matches.map((match) => (
          <div key={match.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {match.name}
                </span>
                <span className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border',
                  CONFIDENCE_STYLES[match.confidence] || CONFIDENCE_STYLES.MEDIUM,
                )}>
                  {match.confidence}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.08]">
                  {ENTITY_LABELS[match.entityType] || match.entityType}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                {match.email && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{match.email}</span>
                )}
                {match.phone && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">{match.phone}</span>
                )}
                {match.matchedFields.length > 0 && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">
                    Matched: {match.matchedFields.join(', ')}
                  </span>
                )}
              </div>
            </div>
            {onUseExisting && (
              <button
                type="button"
                onClick={() => onUseExisting(match)}
                className="shrink-0 px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors flex items-center gap-1"
              >
                <ExternalLink size={11} />
                Use Existing
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      {onDismiss && (
        <div className="px-4 py-2 border-t border-amber-200/50 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/10">
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
          >
            Create anyway &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

export default DuplicateWarning;
