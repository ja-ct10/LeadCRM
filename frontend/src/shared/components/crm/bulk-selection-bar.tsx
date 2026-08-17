'use client';

import React, { useState, useCallback } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/shared/components/ui/alert-dialog';
import type { PermissionKey } from '@leadcrm/shared';
import { motion } from 'motion/react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BulkAction {
  id: string;
  label: string;
  /** Whether this action is destructive (triggers confirmation dialog) */
  destructive: boolean;
  /** Permission key required to show this action */
  permission?: PermissionKey;
  /** Icon component */
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  /** Execute the action on given IDs. Returns { succeeded: string[], failed: string[] } */
  onExecute: (ids: string[]) => Promise<BulkActionResult>;
}

export interface BulkActionResult {
  succeeded: string[];
  failed: string[];
}

export interface BulkSelectionBarProps {
  /** Number of selected records */
  selectedCount: number;
  /** Selected record IDs */
  selectedIds: Set<string>;
  /** Clear all selections */
  onClearSelection: () => void;
  /** Available bulk actions */
  actions: BulkAction[];
  /** Remove specific IDs from selection (on success) */
  onRemoveIds?: (ids: string[]) => void;
  /** Optional className */
  className?: string;
}

// ── Sub-component: Permission-gated action button ─────────────────────────────

interface ActionButtonProps {
  action: BulkAction;
  selectedIds: Set<string>;
  onRemoveIds?: (ids: string[]) => void;
}

function ActionButton({ action, selectedIds, onRemoveIds }: ActionButtonProps): React.ReactElement | null {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // RBAC gating: if permission is specified, check it
  const hasPermission = useHasPermission(action.permission ?? 'contacts.view');
  if (action.permission && !hasPermission) return null;

  const handleExecute = useCallback(async () => {
    setIsExecuting(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await action.onExecute(ids);

      const successCount = result.succeeded.length;
      const failCount = result.failed.length;

      // Summary toast
      if (failCount === 0) {
        toast.success(`${successCount} record${successCount !== 1 ? 's' : ''} processed successfully`);
        // Remove all from selection on full success
        onRemoveIds?.(result.succeeded);
      } else if (successCount === 0) {
        toast.error(`Failed to process ${failCount} record${failCount !== 1 ? 's' : ''}`);
      } else {
        // Partial failure: retain failed record selection
        toast.warning(
          `${successCount} succeeded, ${failCount} failed`,
          { duration: 5000 },
        );
        // Remove succeeded from selection, keep failed selected
        onRemoveIds?.(result.succeeded);
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsExecuting(false);
      setConfirmOpen(false);
    }
  }, [selectedIds, action, onRemoveIds]);

  const handleClick = useCallback(() => {
    if (action.destructive) {
      setConfirmOpen(true);
    } else {
      handleExecute();
    }
  }, [action.destructive, handleExecute]);

  const Icon = action.icon;

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isExecuting}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors',
          action.destructive
            ? 'text-red-300 hover:text-red-100 hover:bg-red-500/20'
            : 'text-slate-200 hover:text-white hover:bg-white/10',
          isExecuting && 'opacity-50 cursor-not-allowed',
        )}
        aria-label={action.label}
      >
        {Icon && <Icon size={13} />}
        {action.label}
      </button>

      {/* Destructive action confirmation dialog */}
      {action.destructive && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle size={18} className="text-red-500" />
                  Confirm {action.label}
                </span>
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action will affect{' '}
                <span className="font-semibold">{selectedIds.size}</span>{' '}
                record{selectedIds.size !== 1 ? 's' : ''}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleExecute}
                variant="destructive"
                className={cn(isExecuting && 'opacity-50 pointer-events-none')}
              >
                {isExecuting ? 'Processing...' : action.label}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * BulkSelectionBar — floating action bar shown when records are selected.
 *
 * Features:
 * - Shows selected count + clear button
 * - Filters actions by RBAC permissions
 * - Destructive actions trigger AlertDialog confirmation with record count
 * - Summary toast on completion (N succeeded, M failed)
 * - Continues processing on partial failure; retains failed record selection
 * - Hidden when no records selected
 *
 * Requirements: 14.3, 14.5, 14.6, 14.7, 14.8, 14.9
 */
export function BulkSelectionBar({
  selectedCount,
  selectedIds,
  onClearSelection,
  actions,
  onRemoveIds,
  className,
}: BulkSelectionBarProps): React.ReactElement | null {
  // Hide bar when no records selected
  if (selectedCount === 0) return null;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
        'bg-[#0F172A] dark:bg-slate-700 text-white rounded-xl',
        'px-4 py-2.5 shadow-xl',
        'flex items-center gap-3',
        className,
      )}
      role="toolbar"
      aria-label="Bulk actions"
    >
      {/* Selected count */}
      <span className="text-[13px] font-semibold tabular-nums">
        {selectedCount} selected
      </span>

      {/* Clear button */}
      <button
        onClick={onClearSelection}
        className="inline-flex items-center gap-1 text-[12px] text-slate-300 hover:text-white transition-colors underline underline-offset-2"
        aria-label="Clear selection"
      >
        <X size={12} />
        Clear
      </button>

      {/* Divider */}
      <div className="h-4 w-px bg-slate-600" aria-hidden="true" />

      {/* Action buttons (RBAC-gated) */}
      {actions.map((action) => (
        <ActionButton
          key={action.id}
          action={action}
          selectedIds={selectedIds}
          onRemoveIds={onRemoveIds}
        />
      ))}
    </motion.div>
  );
}
