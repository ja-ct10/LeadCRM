/**
 * SortableHeaderCell — wrapper for DataGrid header cells enabling drag-and-drop reorder.
 *
 * Uses @dnd-kit/sortable to make individual header cells draggable.
 * When column reordering is disabled or a column is locked, renders without drag behavior.
 */

'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';

interface SortableHeaderCellProps {
  /** Column ID used as the sortable item identifier */
  columnId: string;
  /** Whether this column is draggable */
  isDraggable: boolean;
  /** Standard className for the th element */
  className?: string;
  /** Inline style for the th element */
  style?: React.CSSProperties;
  /** Click handler (e.g. for sort) */
  onClick?: () => void;
  /** ARIA sort value */
  ariaSort?: 'ascending' | 'descending' | 'none';
  /** Children content */
  children: React.ReactNode;
}

export function SortableHeaderCell({
  columnId,
  isDraggable,
  className,
  style,
  onClick,
  ariaSort,
  children,
}: SortableHeaderCellProps): React.ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: columnId,
    disabled: !isDraggable,
  });

  const dragStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  return (
    <th
      ref={setNodeRef}
      scope="col"
      className={cn(
        className,
        isDragging && 'bg-blue-50 dark:bg-blue-900/20',
      )}
      style={dragStyle}
      onClick={onClick}
      aria-sort={ariaSort}
    >
      <div className="flex items-center gap-0.5">
        {/* Drag handle — only shown when draggable */}
        {isDraggable && (
          <button
            type="button"
            className={cn(
              'flex-shrink-0 p-0.5 rounded cursor-grab active:cursor-grabbing',
              'text-slate-300 dark:text-slate-600',
              'hover:text-slate-500 dark:hover:text-slate-400',
              'opacity-0 group-hover/header:opacity-100 transition-opacity',
              isDragging && 'opacity-100',
            )}
            aria-label={`Drag to reorder ${columnId} column`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={12} />
          </button>
        )}
        {/* Column content (label + sort indicator etc.) */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </th>
  );
}
