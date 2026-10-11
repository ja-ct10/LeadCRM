'use client';
import { useEffect, useRef, useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent, type CollisionDetection } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Pencil, Settings } from 'lucide-react';
import { customFieldTechnicalKey, CLOSING_FIELD_TYPES, ClosingFieldInputSchema, CUSTOM_FIELD_MODULES, CUSTOM_FIELD_MODULE_LABELS, CLOSED_WON_GROUP_ID, defaultFieldLayout, getCrmFieldCatalog, isClosedWonField, normalizeCustomField, type CustomFieldModule, type ClosingField, type ClosingFieldInput, type FieldLayout, type CrmFieldCatalogEntry, type FieldLayoutAction } from '@leadcrm/shared';
import { apiClient } from '@/lib/api/client';
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { PageHeader } from '@/shared/components/ui/page-header';
import { panelBodyClass, panelFooterClass, panelInputClass } from '@/shared/components/side-panel-styles';
import { SlidingDrawer } from '@/shared/components/sliding-drawer';
import { Button, CreateButton } from '@/shared/components/ui/button';
import { ModuleSearchInput } from '@/shared/components/crm/module-search-input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { ManageFieldGroups } from './manage-field-groups';
import { SortableFieldLayoutItem } from './sortable-field-layout';
import { TableLoadingState } from '@/shared/components/crm/table-loading-state';
import { toast } from 'sonner';

const endpoint = '/administration/closing-requirements';
type LayoutResponse = { layout: FieldLayout; fields: CrmFieldCatalogEntry[] };
type FieldDraft = Omit<ClosingFieldInput, 'appliesTo'>;
const empty = (module: CustomFieldModule, layout: FieldLayout): FieldDraft => ({ name: '', type: 'Text', module, group: layout.groups[0].label, groupId: layout.groups[0].id, visibleInForm: true, visibleInDetails: true, order: 0, required: false, active: true, options: [], description: '' });

function FieldForm({ field, module, initialLayout, onSaved, onClose }: { field?: ClosingField; module: CustomFieldModule; initialLayout: FieldLayout; onSaved: () => void; onClose: () => void }) {
  const canDisable = useHasPermission('custom_fields.disable');
  const [layout, setLayout] = useState(initialLayout);
  const [form, setForm] = useState<FieldDraft>(() => field ? { name: field.name, type: field.type, module: field.module, group: field.group, groupId: field.groupId ?? layout.groups.find(group => group.label === field.group)?.id, visibleInForm: field.visibleInForm, visibleInDetails: field.visibleInDetails, order: field.order, required: field.required, active: field.active, options: [...field.options], description: field.description } : empty(module, layout));
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [addingGroup, setAddingGroup] = useState(false), [groupName, setGroupName] = useState('');
  const update = <K extends keyof FieldDraft>(key: K, value: FieldDraft[K]) => setForm(previous => ({ ...previous, [key]: value }));
  const addGroup = async () => {
    if (busy || !groupName.trim()) return; setBusy(true); setError('');
    try { const result = (await apiClient.patch<{ data: LayoutResponse }>(`${endpoint}/layout/${module}`, { action: 'add', label: groupName, expectedRevision: layout.revision ?? 0 })).data; const added = result.layout.groups.find(group => !layout.groups.some(previous => previous.id === group.id))!; setLayout(result.layout); setForm(previous => ({ ...previous, groupId: added.id, group: added.label })); setAddingGroup(false); setGroupName(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to add group.'); } finally { setBusy(false); }
  };
  return <form className="flex h-full min-h-0 flex-col" noValidate onSubmit={async event => {
    event.preventDefault(); if (busy) return; const parsed = ClosingFieldInputSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.issues.map(issue => issue.message).join(' ')); return; } setBusy(true); setError('');
    try { if (field) await apiClient.patch(`${endpoint}/${field.id}`, { ...parsed.data, expectedVersion: field.version, expectedRevision: layout.revision ?? 0 }); else await apiClient.post(endpoint, { ...parsed.data, expectedRevision: layout.revision ?? 0 }); toast.success(field ? 'Field updated' : 'Field created'); onSaved(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save field.'); } finally { setBusy(false); }
  }}>
    <div className={panelBodyClass + ' space-y-5'}>
      <label className="block space-y-1 text-sm">Display label<input autoFocus required maxLength={100} className={panelInputClass} value={form.name} onChange={event => update('name', event.target.value)} /></label>
      <label className="block space-y-1 text-sm">Type<select disabled={!!field} className={panelInputClass} value={form.type} onChange={event => update('type', event.target.value as FieldDraft['type'])}>{CLOSING_FIELD_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
      <p className="text-xs text-muted-foreground">Module: {CUSTOM_FIELD_MODULE_LABELS[module]}{field ? ` · Technical key: ${customFieldTechnicalKey(field)}` : ''}. Type, module and technical key stay fixed after creation.</p>
      <div className="space-y-2"><label className="block space-y-1 text-sm">Group<select required className={panelInputClass} value={form.groupId ?? ''} disabled={!!field && isClosedWonField(field)} onChange={event => { const group = layout.groups.find(group => group.id === event.target.value)!; setForm(previous => ({ ...previous, groupId: group.id, group: group.label })); }}>{layout.groups.filter(group => !field || (group.id === CLOSED_WON_GROUP_ID) === isClosedWonField(field)).map(group => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label><Button type="button" variant="outline" onClick={() => setAddingGroup(true)}>Add Group</Button>
      {addingGroup && <div className="flex flex-wrap gap-2"><input aria-label="New field group name" maxLength={100} value={groupName} className={panelInputClass} onChange={event => setGroupName(event.target.value)} /><Button type="button" disabled={busy || !groupName.trim()} onClick={() => void addGroup()}>Add and select</Button><Button type="button" variant="ghost" onClick={() => setAddingGroup(false)}>Cancel</Button></div>}</div>
      <label className="flex min-h-10 items-center justify-between gap-3">Required<input type="checkbox" checked={form.required} onChange={event => update('required', event.target.checked)} /></label>
      <label className="flex min-h-10 items-center justify-between gap-3">Show in Forms<input type="checkbox" checked={form.visibleInForm} onChange={event => update('visibleInForm', event.target.checked)} /></label>
      <label className="flex min-h-10 items-center justify-between gap-3">Show in Details<input type="checkbox" checked={form.visibleInDetails} onChange={event => update('visibleInDetails', event.target.checked)} /></label>
      {isClosedWonField(form) && <p className="text-xs text-muted-foreground">Required closing evidence stays enforced in the closing dialog regardless of Details visibility.</p>}
      {field && <label className="flex min-h-10 items-center justify-between gap-3">Enabled<input type="checkbox" disabled={!canDisable} checked={form.active} onChange={event => update('active', event.target.checked)} /></label>}
      <label className="block space-y-1 text-sm">Description<textarea maxLength={1000} className={panelInputClass} rows={3} value={form.description} onChange={event => update('description', event.target.value)} /></label>
      {form.type === 'Dropdown' && <label className="block space-y-1 text-sm">Options, one per line<textarea className={panelInputClass} rows={5} value={form.options.join('\n')} onChange={event => update('options', event.target.value.split('\n'))} /></label>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div><div className={panelFooterClass + ' justify-end'}><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy}>{busy ? 'Saving…' : 'Save field'}</Button></div>
  </form>;
}

function NativeFieldForm({ field, layout, onSaved, onClose }: { field: CrmFieldCatalogEntry; layout: FieldLayout; onSaved: () => void; onClose: () => void }) {
  const [label, setLabel] = useState(field.label), [groupId, setGroupId] = useState(field.groupId), [visibleInForm, setVisibleInForm] = useState(field.visibleInForm), [visibleInDetails, setVisibleInDetails] = useState(field.visibleInDetails), [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <form className="space-y-5 p-5" onSubmit={async event => { event.preventDefault(); if (busy) return; setBusy(true); setError(''); try { await apiClient.patch(`${endpoint}/layout/${field.module}`, { action: 'field', technicalKey: field.technicalKey, label, groupId, visibleInForm, visibleInDetails, expectedRevision: layout.revision ?? 0 }); onSaved(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save field.'); } finally { setBusy(false); } }}>
    <label className="block space-y-1 text-sm">Display label<input required maxLength={100} className={panelInputClass} value={label} onChange={event => setLabel(event.target.value)} /></label><p className="text-xs text-muted-foreground">System · {field.type} · {field.technicalKey}</p>
    <label className="block space-y-1 text-sm">Group<select className={panelInputClass} value={groupId} onChange={event => setGroupId(event.target.value)}>{layout.groups.filter(group => group.id !== CLOSED_WON_GROUP_ID).map(group => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>
    <label className="flex min-h-10 items-center justify-between">Show in Forms<input type="checkbox" disabled={field.mandatory} checked={visibleInForm} onChange={event => setVisibleInForm(event.target.checked)} /></label><label className="flex min-h-10 items-center justify-between">Show in Details<input type="checkbox" checked={visibleInDetails} onChange={event => setVisibleInDetails(event.target.checked)} /></label>
    {field.mandatory && <p className="text-xs text-muted-foreground">This required system input stays available in forms.</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy}>{busy ? 'Saving…' : 'Save field'}</Button></div>
  </form>;
}

export function ClosingFieldsSettings() {
  const canEdit = useHasPermission('custom_fields.edit'), canCreate = useHasPermission('custom_fields.create'), canDelete = useHasPermission('custom_fields.delete');
  const [module, setModule] = useState<CustomFieldModule>('leads'), [search, setSearch] = useState('');
  const [panel, setPanel] = useState<'new' | CrmFieldCatalogEntry | null>(null), [manageGroups, setManageGroups] = useState(false), [pending, setPending] = useState(false);
  const [optimistic, setOptimistic] = useState<LayoutResponse | null>(null);
  const saving = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const query = useCachedPage<{ definitions: ClosingField[]; layout: FieldLayout }>({ module: 'settings', params: { fieldLayout: module }, revalidateOnInvalidation: true, fetchFn: async signal => {
    const [fields, layout] = await Promise.all([apiClient.get<{ data: ClosingField[] }>(endpoint, { signal }), apiClient.get<{ data: LayoutResponse }>(`${endpoint}/layout/${module}`, { signal })]);
    return { definitions: fields.data.map(normalizeCustomField), layout: layout.data.layout };
  } });
  const data = query.data?.layout.module === module ? query.data : undefined;
  const override = optimistic?.layout.module === module ? optimistic : null;
  const layout = override?.layout ?? data?.layout ?? defaultFieldLayout(module);
  const fields = override?.fields ?? getCrmFieldCatalog(module, data?.definitions ?? [], layout);
  const ready = !!data && !query.error && !query.isInitialLoad;
  const term = search.trim().toLowerCase();
  const filtered = fields.filter(field => `${field.label} ${field.technicalKey} ${field.canonicalTechnicalKey ?? ''} ${field.group} ${field.type} ${field.kind}`.toLowerCase().includes(term));
  useEffect(() => { if (!pending && data && optimistic && (data.layout.revision ?? 0) >= (optimistic.layout.revision ?? 0)) setOptimistic(null); }, [data, optimistic, pending]);
  const switchModule = (value: CustomFieldModule) => { if (saving.current) return; setModule(value); setPanel(null); setOptimistic(null); };
  const mutateLayout = async (input: FieldLayoutAction): Promise<boolean> => {
    if (saving.current || !ready) return false;
    saving.current = true; setPending(true);
    try {
      const response = await apiClient.patch<{ data: LayoutResponse }>(`${endpoint}/layout/${module}`, { ...input, expectedRevision: input.expectedRevision ?? layout.revision ?? 0 });
      if (response.data) setOptimistic(response.data);
      await query.refetch(); return true;
    } catch (error) {
      setOptimistic(null); toast.error(error instanceof Error ? error.message : 'Unable to update layout');
      await query.refetch(); return false;
    } finally { saving.current = false; setPending(false); }
  };
  const reorderGroups = async (ids: string[]) => {
    if (saving.current || !ready) return;
    setOptimistic({ layout: { ...layout, groups: ids.map((id, order) => ({ ...layout.groups.find(group => group.id === id)!, order })) }, fields });
    await mutateLayout({ action: 'reorderGroups', groupIds: ids, expectedRevision: layout.revision ?? 0 });
  };
  const sameGroupCollision: CollisionDetection = args => closestCenter({ ...args, droppableContainers: args.droppableContainers.filter(container => container.data.current?.groupId === args.active.data.current?.groupId) });
  const reorderFields = async ({ active, over }: DragEndEvent) => {
    if (!canEdit || saving.current || pending || !ready || term || !over || active.id === over.id) return;
    const groupId = active.data.current?.groupId as string;
    if (groupId !== over.data.current?.groupId) return;
    const contained = fields.filter(field => field.groupId === groupId);
    const identity = (field: CrmFieldCatalogEntry) => field.canonicalTechnicalKey ?? field.technicalKey;
    const from = contained.findIndex(field => identity(field) === active.id), to = contained.findIndex(field => identity(field) === over.id);
    if (from < 0 || to < 0) return;
    const ordered = arrayMove(contained, from, to), orders = new Map(ordered.map((field, order) => [identity(field), order]));
    setOptimistic({ layout, fields: fields.map(field => ({ ...field, order: orders.get(identity(field)) ?? field.order })).sort((a, b) => (layout.groups.find(group => group.id === a.groupId)?.order ?? 0) - (layout.groups.find(group => group.id === b.groupId)?.order ?? 0) || a.order - b.order) });
    await mutateLayout({ action: 'reorderFields', groupId, technicalKeys: ordered.map(identity), expectedRevision: layout.revision ?? 0 });
  };
  return <div className="min-w-0 space-y-5">
    <PageHeader title="Customize Fields" titleClassName="whitespace-nowrap text-base [overflow-wrap:normal] sm:text-xl" className="gap-x-2" subtitle="Manage module labels, sections and field presentation." actions={<div className="flex shrink-0 items-center gap-2">
      {(canEdit || canDelete) && <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Manage Field Groups" title="Manage Field Groups" disabled={pending} onClick={() => setManageGroups(true)}><Settings size={16} aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>Manage Field Groups</TooltipContent></Tooltip></TooltipProvider>}
      {canCreate && <CreateButton label="Add Field" disabled={pending || !ready} onClick={() => setPanel('new')} />}
    </div>} />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><select aria-label="Module" className={panelInputClass + ' sm:max-w-48'} value={module} disabled={pending} onChange={event => switchModule(event.target.value as CustomFieldModule)}>{CUSTOM_FIELD_MODULES.map(value => <option key={value} value={value}>{CUSTOM_FIELD_MODULE_LABELS[value]}</option>)}</select><ModuleSearchInput label="Search fields" placeholder="Search labels, technical keys or groups…" value={search} onChange={setSearch} /></div>
    {term && canEdit && <p id="field-sort-hint" className="text-xs text-muted-foreground">Clear search to reorder fields within their group.</p>}
    {query.isInitialLoad || !data && !query.error ? <TableLoadingState label="Loading fields" /> : query.error ? <p role="alert">{query.error}<Button onClick={() => void query.refetch()}>Retry</Button></p> : <DndContext sensors={sensors} collisionDetection={sameGroupCollision} onDragEnd={event => void reorderFields(event)}>
      <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="bg-muted"><tr>{['Drag', 'Label', 'System/Custom', 'Type', 'Technical variable key', 'Group', 'Required', 'Show in Forms', 'Show in Details', 'Actions'].map(label => <th key={label} className="p-3 font-semibold">{label}</th>)}</tr></thead><tbody>
        {[...layout.groups].sort((a, b) => a.order - b.order).map(group => <SortableContext key={group.id} items={fields.filter(field => field.groupId === group.id).map(field => field.canonicalTechnicalKey ?? field.technicalKey)} strategy={verticalListSortingStrategy}>
          {filtered.filter(field => field.groupId === group.id).map(field => <SortableFieldLayoutItem row key={field.canonicalTechnicalKey ?? field.technicalKey} id={field.canonicalTechnicalKey ?? field.technicalKey} groupId={field.groupId} label={field.label} disabled={!canEdit || pending || !ready || !!term}>
            <td className="p-3 font-medium">{field.label}{!field.active && <span className="block text-muted-foreground">Disabled</span>}</td><td className="p-3">{field.kind}</td><td className="p-3">{field.type}</td><td className="max-w-64 break-all p-3 font-mono">{field.technicalKey}</td><td className="p-3">{field.group}</td><td className="p-3">{field.required ? 'Yes' : 'No'}</td>
            {(['visibleInForm', 'visibleInDetails'] as const).map(key => <td key={key} className="p-3"><input aria-label={`${key === 'visibleInForm' ? 'Show in Forms' : 'Show in Details'}: ${field.label}`} type="checkbox" checked={field[key]} disabled={!canEdit || pending || (key === 'visibleInForm' && field.mandatory)} onChange={event => void mutateLayout({ action: 'field', technicalKey: field.technicalKey, [key]: event.target.checked })} /></td>)}
            <td className="p-2"><div className="flex gap-1">{canEdit && <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Edit ${field.label}`} title={`Edit ${field.label}`} disabled={pending} onClick={() => setPanel(field)}><Pencil aria-hidden="true" /></Button>}{canDelete && field.kind === 'Custom' && <Button variant="ghost" size="sm" className="text-destructive" disabled={pending} onClick={async () => {
              if (saving.current || !window.confirm(`Delete “${field.label}” from current configuration? Historical values and evidence will be retained.`)) return;
              saving.current = true; setPending(true); try { await apiClient.delete(`${endpoint}/${field.customFieldId}`); setOptimistic(null); await query.refetch(); toast.success('Field deleted'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to delete field'); } finally { saving.current = false; setPending(false); }
            }}>Delete</Button>}</div></td>
          </SortableFieldLayoutItem>)}
        </SortableContext>)}
      </tbody></table>{!filtered.length && <p className="p-5 text-sm text-muted-foreground">No fields match your search.</p>}</div>
    </DndContext>}
    <SlidingDrawer isOpen={panel !== null} onClose={() => setPanel(null)} title={panel === 'new' ? 'Add Field' : 'Edit Field'}>{panel && (panel === 'new' || panel.customFieldId ? <FieldForm key={panel === 'new' ? module : panel.customFieldId} field={panel === 'new' ? undefined : data?.definitions.find(field => field.id === panel.customFieldId)} module={module} initialLayout={layout} onClose={() => setPanel(null)} onSaved={() => { setPanel(null); void query.refetch(); }} /> : <NativeFieldForm field={panel} layout={layout} onClose={() => setPanel(null)} onSaved={() => { setPanel(null); void query.refetch(); }} />)}</SlidingDrawer>
    <ManageFieldGroups key={module} open={manageGroups} onOpenChange={setManageGroups} module={module} onModuleChange={switchModule} layout={layout} fields={fields} pending={pending} ready={ready} canEdit={canEdit} canDelete={canDelete} mutate={mutateLayout} reorder={reorderGroups} />
  </div>;
}
