'use client';

import { useState, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description?: string;
  items?: string[];
  warning?: string;
  confirmLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
}

interface UseConfirmDialogResult {
  dialogProps: ConfirmDialogState & { onOpenChange: (open: boolean) => void };
  confirm: (options: Omit<ConfirmDialogState, 'open'>) => void;
  close: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

const DEFAULT_STATE: ConfirmDialogState = {
  open: false,
  title: '',
  onConfirm: () => {},
};

/**
 * useConfirmDialog — manages confirmation dialog state.
 * Use with ConfirmActionDialog component for a complete solution.
 *
 * Usage:
 * ```tsx
 * const { dialogProps, confirm } = useConfirmDialog();
 *
 * // Trigger
 * onClick: () => confirm({
 *   title: 'Delete Lead?',
 *   description: 'This will archive the lead.',
 *   warning: 'This cannot be undone.',
 *   variant: 'destructive',
 *   confirmLabel: 'Delete',
 *   onConfirm: async () => { await deleteLead(id); },
 * })
 *
 * // Render
 * <ConfirmActionDialog {...dialogProps} />
 * ```
 */
export function useConfirmDialog(): UseConfirmDialogResult {
  const [state, setState] = useState<ConfirmDialogState>(DEFAULT_STATE);

  const confirm = useCallback((options: Omit<ConfirmDialogState, 'open'>): void => {
    setState({ ...options, open: true });
  }, []);

  const close = useCallback((): void => {
    setState(DEFAULT_STATE);
  }, []);

  const onOpenChange = useCallback((open: boolean): void => {
    if (!open) close();
  }, [close]);

  return {
    dialogProps: { ...state, onOpenChange },
    confirm,
    close,
  };
}
