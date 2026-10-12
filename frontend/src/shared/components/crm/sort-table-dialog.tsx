'use client';

import { useId, useState } from 'react';
import { tableSortLabels, type RecordSort, type TableSortOption } from '@leadcrm/shared';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';

interface SortTableDialogProps {
  fields: TableSortOption[];
  sort: RecordSort | null;
  defaultSort: RecordSort;
  onSortChange: (sort: RecordSort | null) => void;
  onClose: () => void;
}

/** A separate draft prevents field/direction browsing from changing the list. */
export function SortTableDialog({ fields, sort, defaultSort, onSortChange, onClose }: SortTableDialogProps) {
  const id = useId();
  const current = sort ?? defaultSort;
  const [draft, setDraft] = useState<RecordSort>(() => fields.some(field => field.id === current.field)
    ? current : { field: fields[0]?.id ?? '', direction: 'asc' });
  const option = fields.find(field => field.id === draft.field);
  const currentOption = fields.find(field => field.id === current.field);
  const labels = tableSortLabels(option?.kind);
  const unchanged = current.field === draft.field && current.direction === draft.direction;
  const isDefault = current.field === defaultSort.field && current.direction === defaultSort.direction;
  const selectClass = 'min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-sm" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
      <DialogHeader>
        <DialogTitle id={`${id}-title`}>Sort Table</DialogTitle>
        <DialogDescription id={`${id}-description`}>Sort all matching records, including by hidden columns.</DialogDescription>
      </DialogHeader>
      <p className="mt-4 text-sm text-muted-foreground">Current: {currentOption?.label ?? current.field} — {tableSortLabels(currentOption?.kind)[current.direction]}</p>
      <form onSubmit={event => { event.preventDefault(); if (!option || unchanged) return; onSortChange(draft); onClose(); }}>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={`${id}-field`} className="text-sm font-medium">Sort field</label>
            <select id={`${id}-field`} className={selectClass} value={draft.field} onChange={event => setDraft(previous => ({ ...previous, field: event.target.value }))}>
              {fields.map(field => <option key={field.id} value={field.id}>{field.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${id}-direction`} className="text-sm font-medium">Direction</label>
            <select id={`${id}-direction`} className={selectClass} value={draft.direction} onChange={event => setDraft(previous => ({ ...previous, direction: event.target.value as RecordSort['direction'] }))}>
              <option value="asc">{labels.asc}</option><option value="desc">{labels.desc}</option>
            </select>
          </div>
        </div>
        <Button type="button" variant="ghost" className="mt-4 min-h-11 w-full" disabled={isDefault} onClick={() => { onSortChange(null); onClose(); }}>Restore default sorting</Button>
        <DialogFooter className="mt-3">
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="min-h-11" disabled={!option || unchanged}>Apply</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
