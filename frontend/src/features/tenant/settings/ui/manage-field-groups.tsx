'use client';

import { responsiveTypography } from '@/shared/styles/typography';
import { useId, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CUSTOM_FIELD_MODULES, CUSTOM_FIELD_MODULE_LABELS, type CustomFieldModule, type FieldLayout, type FieldLayoutAction, type CrmFieldCatalogEntry } from '@leadcrm/shared';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { panelInputClass } from '@/shared/components/side-panel-styles';
import { SortableFieldLayoutItem } from './sortable-field-layout';

export function ManageFieldGroups({ open, onOpenChange, module, onModuleChange, layout, fields, pending, ready, canEdit, canDelete, mutate, reorder }: {
  open: boolean; onOpenChange: (open: boolean) => void; module: CustomFieldModule; onModuleChange: (module: CustomFieldModule) => void;
  layout: FieldLayout; fields: CrmFieldCatalogEntry[]; pending: boolean; ready: boolean; canEdit: boolean; canDelete: boolean;
  mutate: (action: FieldLayoutAction) => Promise<boolean>; reorder: (ids: string[]) => Promise<void>;
}) {
  const newGroupNameId = useId();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null), [label, setLabel] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null), [destination, setDestination] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const groups = [...layout.groups].sort((a, b) => a.order - b.order);
  const target = groups.find(group => group.id === deleting), count = fields.filter(field => field.groupId === deleting).length;
  const busy = pending || !ready;
  async function onDragEnd(event: DragEndEvent) {
    if (busy || !canEdit || !event.over || event.active.id === event.over.id) return;
    const from = groups.findIndex(group => group.id === event.active.id), to = groups.findIndex(group => group.id === event.over!.id);
    if (from >= 0 && to >= 0) await reorder(arrayMove(groups, from, to).map(group => group.id));
  }
  return <>
    <Dialog open={open} onOpenChange={value => { if (!pending) { onOpenChange(value); setEditing(null); } }}>
      <DialogContent aria-label="Manage Fields Groups" className="flex max-h-[85dvh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0 pr-8"><DialogTitle>Manage Fields Groups</DialogTitle></DialogHeader>
        <label className="mt-5 flex shrink-0 items-center gap-4 text-sm text-muted-foreground">Module
          <select aria-label="Field groups module" className={panelInputClass + ' max-w-60'} value={module} disabled={pending} onChange={event => { setName(''); setEditing(null); setDeleting(null); onModuleChange(event.target.value as CustomFieldModule); }}>{CUSTOM_FIELD_MODULES.map(value => <option key={value} value={value}>{CUSTOM_FIELD_MODULE_LABELS[value]}</option>)}</select>
        </label>
        {canEdit && <form className="my-5 shrink-0 space-y-2 border-b border-border pb-5" onSubmit={async event => { event.preventDefault(); if (busy || !name.trim()) return; if (await mutate({ action: 'add', label: name, expectedRevision: layout.revision ?? 0 })) setName(''); }}>
          <label htmlFor={newGroupNameId} className={`block ${responsiveTypography.control}`}>Add a new group name</label>
          <div className="flex gap-2">
            <input id={newGroupNameId} placeholder="New group name" maxLength={100} className={panelInputClass + ' min-w-0 flex-1'} value={name} disabled={pending} onChange={event => setName(event.target.value)} />
            <Button className="h-10 shrink-0" disabled={busy || !name.trim()}><Plus aria-hidden="true" />Add</Button>
          </div>
        </form>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          {!ready ? <p role="status" className="py-5 text-sm text-muted-foreground">Loading field groups…</p> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={event => void onDragEnd(event)}>
            <SortableContext items={groups.map(group => group.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">{groups.map(group => {
                const fieldCount = fields.filter(field => field.groupId === group.id).length;
                const containsSystemFields = fields.some(field => field.groupId === group.id && field.kind === 'System');
                return <SortableFieldLayoutItem key={group.id} id={group.id} label={`${group.label} group`} disabled={!canEdit || busy || editing !== null}>
                  <div className="min-w-0 flex-1 pt-2">
                    {editing === group.id ? <form className="space-y-2" onSubmit={async event => { event.preventDefault(); if (await mutate({ action: 'rename', groupId: group.id, label, expectedRevision: layout.revision ?? 0 })) setEditing(null); }}>
                      <input autoFocus aria-label={`Group label: ${group.label}`} maxLength={100} className={panelInputClass} value={label} onChange={event => setLabel(event.target.value)} disabled={pending} />
                      <div className="flex gap-2"><Button size="sm" disabled={busy || !label.trim()}>Save</Button><Button size="sm" type="button" variant="outline" disabled={pending} onClick={() => setEditing(null)}>Cancel</Button></div>
                    </form> : <p className={`break-words font-medium ${responsiveTypography.control}`}>{group.label}</p>}
                    <p className="mt-2 text-xs text-muted-foreground">{fieldCount} {fieldCount === 1 ? 'field' : 'fields'}{group.protected ? ' · Protected closing evidence' : ''}</p>
                    {containsSystemFields && <p className="mt-1 text-xs text-muted-foreground">Contains system fields and cannot be deleted.</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {canEdit && <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Rename ${group.label}`} disabled={busy} onClick={() => { setEditing(group.id); setLabel(group.label); }}><Pencil aria-hidden="true" /></Button>}
                    {canDelete && !containsSystemFields && <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive dark:text-destructive hover:text-destructive dark:hover:text-destructive" aria-label={`Delete ${group.label} group`} title={group.protected ? 'Protected closing evidence cannot be deleted' : groups.length === 1 ? 'Keep at least one group' : `Delete ${group.label} group`} disabled={busy || group.protected || groups.length === 1} onClick={() => { setDeleting(group.id); setDestination(''); }}><Trash2 aria-hidden="true" /></Button>}
                  </div>
                </SortableFieldLayoutItem>;
              })}</div>
            </SortableContext>
          </DndContext>}
        </div>
        <div className="mt-5 flex shrink-0 flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{ready ? `${groups.length} ${groups.length === 1 ? 'group' : 'groups'}` : '…'}</span><span>{ready ? `${fields.length} fields in ${CUSTOM_FIELD_MODULE_LABELS[module]}` : '…'}</span></div>
      </DialogContent>
    </Dialog>
    {target && <Dialog open onOpenChange={value => { if (!pending && !value) setDeleting(null); }}>
      <DialogContent aria-label="Delete field group"><DialogHeader><DialogTitle>Delete {target?.label}?</DialogTitle></DialogHeader>
        <p className="my-4 text-sm text-muted-foreground">{count ? `${count} ${count === 1 ? 'field must' : 'fields must'} move to another group. Saved values will be retained.` : 'This empty group will be removed.'}</p>
        {!!count && <label className="block space-y-2 text-sm">Move fields to…<select aria-label="Move fields to" className={panelInputClass} value={destination} disabled={pending} onChange={event => setDestination(event.target.value)}><option value="">Choose a destination group</option>{groups.filter(group => group.id !== deleting && !group.protected).map(group => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>}
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={busy || !!count && !destination} onClick={async () => { if (target && await mutate({ action: 'delete', groupId: target.id, ...(count ? { moveToGroupId: destination } : {}), expectedRevision: layout.revision ?? 0 })) setDeleting(null); }}>Delete group</Button></div>
      </DialogContent>
    </Dialog>}
  </>;
}
