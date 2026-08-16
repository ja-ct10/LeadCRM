'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { GripVertical, Lock, X, Search } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Switch } from '@/shared/components/ui/switch';
import { cn } from '@/lib/utils';
import type { ColumnDefinition, ColumnConfigItem } from '@leadcrm/shared';

// ─────────────────────────────────────────────────────
// SHARED MANAGE COLUMNS DRAWER
// Reusable across all modules. Does NOT know about CRM-specific fields.
// Usage:
//   <ManageColumnsDrawer
//     isOpen={isOpen}
//     onClose={() => setIsOpen(false)}
//     module="accounts"
//     registry={ACCOUNTS_COLUMN_REGISTRY}
//     effectiveColumns={effectiveColumns}
//     onSave={saveColumns}
//     onReset={resetColumns}
//   />
// ─────────────────────────────────────────────────────

interface ManageColumnsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  module: string;
  registry: ColumnDefinition[];
  effectiveColumns: ColumnConfigItem[];
  onSave: (config: ColumnConfigItem[]) => Promise<void>;
  onReset: () => Promise<void>;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

interface DisplayColumn extends ColumnConfigItem {
  label: string;
  required: boolean;
}

interface SortableColumnItemProps {
  col: DisplayColumn;
  onToggle: (id: string) => void;
}

function SortableColumnItem({ col, onToggle }: SortableColumnItemProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors',
        'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800',
        isDragging && 'opacity-50 shadow-lg z-10'
      )}
      {...attributes}
    >
      <span
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500 touch-none"
        aria-label={`Drag to reorder ${col.label}`}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm text-gray-900 dark:text-gray-100 truncate">{col.label}</span>
      {col.required ? (
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400" aria-label={`${col.label} is required`}>
          <Lock className="h-3.5 w-3.5" />
          <Switch checked={true} disabled={true} aria-label={`${col.label} visibility (locked)`} />
        </span>
      ) : (
        <Switch
          checked={col.visible}
          onCheckedChange={() => onToggle(col.id)}
          aria-label={`Toggle ${col.label} visibility`}
        />
      )}
    </li>
  );
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function ManageColumnsDrawer({
  isOpen, onClose, module, registry, effectiveColumns, onSave, onReset, triggerRef,
}: ManageColumnsDrawerProps): React.ReactElement | null {
  const [localColumns, setLocalColumns] = useState<ColumnConfigItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Sync local columns when drawer opens or effectiveColumns change
  useEffect(() => {
    if (isOpen) {
      setLocalColumns([...effectiveColumns]);
      setSearchQuery('');
      setSaveState('idle');
      setShowResetConfirm(false);
      setShowCloseConfirm(false);
      setRetryCount(0);
    }
  }, [isOpen, effectiveColumns]);

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  const hasChanges = useMemo(() => {
    if (localColumns.length !== effectiveColumns.length) return true;
    return localColumns.some((col, idx) => {
      const orig = effectiveColumns[idx];
      return col.id !== orig.id || col.visible !== orig.visible || col.order !== orig.order;
    });
  }, [localColumns, effectiveColumns]);

  const displayColumns = useMemo(() => {
    const sorted = [...localColumns].sort((a, b) => a.order - b.order);
    return sorted
      .map((col) => {
        const def = registry.find((r) => r.id === col.id);
        return { ...col, label: def?.label ?? col.id, required: def?.required ?? false };
      })
      .filter((col) => col.label.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [localColumns, registry, searchQuery]);

  const displayColumnIds = useMemo(() => displayColumns.map((col) => col.id), [displayColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLocalColumns((prev) => {
      const allSorted = [...prev].sort((a, b) => a.order - b.order);

      if (searchQuery) {
        const matchingIds = new Set(displayColumns.map((c) => c.id));
        const matchingItems = allSorted.filter((c) => matchingIds.has(c.id));
        const oldIndex = matchingItems.findIndex((c) => c.id === active.id);
        const newIndex = matchingItems.findIndex((c) => c.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;

        const reorderedMatching = arrayMove(matchingItems, oldIndex, newIndex);

        let matchIdx = 0;
        const rebuilt = allSorted.map((c) => {
          if (matchingIds.has(c.id)) {
            return reorderedMatching[matchIdx++];
          }
          return c;
        });

        return rebuilt.map((col, idx) => ({ ...col, order: idx }));
      }

      const oldIndex = allSorted.findIndex((c) => c.id === active.id);
      const newIndex = allSorted.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;

      const reordered = arrayMove(allSorted, oldIndex, newIndex);
      return reordered.map((col, idx) => ({ ...col, order: idx }));
    });
  }, [searchQuery, displayColumns]);

  const handleToggleVisibility = useCallback((columnId: string) => {
    setLocalColumns((prev) =>
      prev.map((col) => (col.id === columnId ? { ...col, visible: !col.visible } : col))
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!hasChanges || saveState === 'saving') return;
    setSaveState('saving');
    try {
      await onSave(localColumns);
      setSaveState('saved');
      setRetryCount(0);
      savedTimerRef.current = setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
      setRetryCount((prev) => prev + 1);
    }
  }, [hasChanges, saveState, localColumns, onSave]);

  const handleRetry = useCallback(async () => {
    if (retryCount >= 3) return;
    await handleSave();
  }, [retryCount, handleSave]);

  const handleResetConfirm = useCallback(async () => {
    setShowResetConfirm(false);
    setSaveState('saving');
    try {
      await onReset();
      setSaveState('idle');
      setRetryCount(0);
    } catch {
      setSaveState('error');
    }
  }, [onReset]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      setShowCloseConfirm(true);
    } else {
      onClose();
      triggerRef?.current?.focus();
    }
  }, [hasChanges, onClose, triggerRef]);

  const handleConfirmClose = useCallback(() => {
    setShowCloseConfirm(false);
    onClose();
    triggerRef?.current?.focus();
  }, [onClose, triggerRef]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') { event.preventDefault(); handleClose(); }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const drawer = drawerRef.current;
    if (!drawer) return;

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const firstFocusable = drawer.querySelector(focusableSelector) as HTMLElement | null;
    firstFocusable?.focus();

    function handleTabTrap(event: KeyboardEvent): void {
      if (event.key !== 'Tab') return;

      const focusableElements = drawer!.querySelectorAll(focusableSelector);
      if (focusableElements.length === 0) return;

      const first = focusableElements[0] as HTMLElement;
      const last = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleTabTrap);
    return () => document.removeEventListener('keydown', handleTabTrap);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70 transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />
      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Manage Columns - ${module}`}
        className={cn(
          'relative w-full max-w-md bg-white dark:bg-gray-900 shadow-xl',
          'flex flex-col h-full transition-transform duration-300',
          'sm:max-w-md max-sm:max-w-full',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Manage Columns</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search columns..."
              className={cn(
                'w-full pl-10 pr-4 py-2 rounded-md border text-sm',
                'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800',
                'text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400'
              )}
              aria-label="Search columns"
            />
          </div>
        </div>
        {/* Column List */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={displayColumnIds} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1" role="list" aria-label="Column list">
                {displayColumns.map((col) => (
                  <SortableColumnItem key={col.id} col={col} onToggle={handleToggleVisibility} />
                ))}
                {displayColumns.length === 0 && (
                  <li className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No columns match your search.
                  </li>
                )}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
        {/* Error State */}
        {saveState === 'error' && retryCount < 3 && (
          <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-700 dark:text-red-400">Unable to save</span>
              <button
                type="button"
                onClick={handleRetry}
                className="px-3 py-1 text-sm font-medium rounded-md text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        {saveState === 'error' && retryCount >= 3 && (
          <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
            <span className="text-sm text-red-700 dark:text-red-400">Unable to save. Please close and try again.</span>
          </div>
        )}
        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Reset to Default
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saveState === 'saving' || saveState === 'saved'}
            className="px-4 py-2 text-sm font-medium rounded-md transition-colors text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveState === 'saving' && 'Saving...'}
            {saveState === 'saved' && 'Saved'}
            {(saveState === 'idle' || saveState === 'error') && 'Save'}
          </button>
        </div>
      </div>
      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <ConfirmDialog
          title="Reset to Default?"
          message="This will remove your custom column configuration and revert to the default layout."
          confirmLabel="Reset"
          cancelLabel="Cancel"
          onConfirm={handleResetConfirm}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
      {/* Close with Unsaved Changes Confirmation */}
      {showCloseConfirm && (
        <ConfirmDialog
          title="Discard changes?"
          message="You have unsaved changes. Are you sure you want to close without saving?"
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onConfirm={handleConfirmClose}
          onCancel={() => setShowCloseConfirm(false)}
        />
      )}
    </div>
  );
}

// --- Confirmation Dialog ---

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps): React.ReactElement {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={onCancel} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="relative z-10 w-full max-w-sm mx-4 p-6 rounded-lg shadow-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
      >
        <h3 id="confirm-dialog-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <p id="confirm-dialog-desc" className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</p>
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium rounded-md transition-colors text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
