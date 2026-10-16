'use client';

import type { CSSProperties, ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/shared/components/ui/button';

/** Only the handle starts a drag; inputs and action buttons keep their normal interaction. */
export function SortableFieldLayoutItem({ id, groupId, label, disabled, disabledReason, row = false, children }: {
  id: string; groupId?: string; label: string; disabled: boolean; disabledReason?: string; row?: boolean; children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver } = useSortable({ id, disabled, data: { groupId } });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition, position: 'relative', zIndex: isDragging ? 1 : undefined };
  const handle = <Button ref={setActivatorNodeRef} variant="ghost" size="icon" type="button" aria-label={`Reorder ${label}`} title={disabled ? disabledReason ?? 'Sorting is unavailable while searching, loading or saving.' : 'Drag or press Space, then use arrow keys to reorder'}
    className="h-11 w-11 shrink-0 touch-none cursor-grab text-muted-foreground active:cursor-grabbing disabled:cursor-default" disabled={disabled} {...attributes} {...listeners}><GripVertical aria-hidden="true" /></Button>;
  const feedback = isDragging ? 'bg-accent shadow-lg opacity-80' : isOver ? 'bg-accent/50 ring-1 ring-inset ring-primary' : '';
  if (row) return <tr ref={setNodeRef} style={style} className={`border-t border-border ${feedback}`}><td className="w-12 p-1">{handle}</td>{children}</tr>;
  return <div ref={setNodeRef} style={style} className={`flex items-start gap-2 rounded-xl border border-border p-3 sm:p-4 ${feedback}`}>{handle}{children}</div>;
}
