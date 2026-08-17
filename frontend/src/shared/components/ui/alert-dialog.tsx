'use client';

import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────
// AlertDialog — accessible confirmation dialog (shadcn-style API)
// Uses role="alertdialog" with proper ARIA semantics for
// destructive/confirmation dialogs that require user acknowledgment.
// ─────────────────────────────────────────────────────

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface AlertDialogContentProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

interface AlertDialogActionProps {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  variant?: 'default' | 'destructive';
}

interface AlertDialogCancelProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function AlertDialog({ open, onOpenChange, children }: AlertDialogProps): React.ReactElement | null {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    const content = contentRef.current;
    if (!content) return;

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const firstFocusable = content.querySelector(focusableSelector) as HTMLElement | null;
    firstFocusable?.focus();

    function handleTab(e: KeyboardEvent): void {
      if (e.key !== 'Tab') return;
      const elements = content!.querySelectorAll(focusableSelector);
      if (elements.length === 0) return;
      const first = elements[0] as HTMLElement;
      const last = elements[elements.length - 1] as HTMLElement;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/40 dark:bg-black/60"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        ref={contentRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        className="relative z-10 w-full max-w-sm mx-4"
      >
        {children}
      </div>
    </div>
  );
}

export function AlertDialogContent({ children, className }: AlertDialogContentProps): React.ReactElement {
  return (
    <div className={cn(
      'p-6 rounded-lg shadow-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700',
      className
    )}>
      {children}
    </div>
  );
}

export function AlertDialogHeader({ children, className }: AlertDialogHeaderProps): React.ReactElement {
  return <div className={cn('space-y-2', className)}>{children}</div>;
}

export function AlertDialogFooter({ children, className }: AlertDialogFooterProps): React.ReactElement {
  return <div className={cn('mt-4 flex justify-end gap-3', className)}>{children}</div>;
}

export function AlertDialogTitle({ children, className }: AlertDialogTitleProps): React.ReactElement {
  return (
    <h3 id="alert-dialog-title" className={cn('text-base font-semibold text-gray-900 dark:text-gray-100', className)}>
      {children}
    </h3>
  );
}

export function AlertDialogDescription({ children, className }: AlertDialogDescriptionProps): React.ReactElement {
  return (
    <p id="alert-dialog-description" className={cn('text-sm text-gray-600 dark:text-gray-400', className)}>
      {children}
    </p>
  );
}

export function AlertDialogAction({ children, onClick, className, variant = 'default' }: AlertDialogActionProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-md transition-colors',
        variant === 'destructive'
          ? 'text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
          : 'text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600',
        className
      )}
    >
      {children}
    </button>
  );
}

export function AlertDialogCancel({ children, onClick, className }: AlertDialogCancelProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors',
        className
      )}
    >
      {children}
    </button>
  );
}
