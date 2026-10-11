'use client';
import { formatDateTime } from '@/shared/components/data-grid/cell-renderers';
import { RecordCustomFieldDetails } from './record-custom-fields';
import { useFieldLayout } from '@/shared/hooks/use-field-layout';
import { panelSurfaceClass, panelHeaderClass, panelTitleClass, panelCloseClass } from '@/shared/components/side-panel-styles';

import React, { useEffect, useId, useState } from 'react';
import { DealClosingRequirements } from './deal-closing-requirements';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, Building, ChevronDown, ChevronRight, ExternalLink, Globe, Inbox, Mail, MapPin, MoreHorizontal, Loader2, Pencil, Phone, Plus, User, UserPlus, X, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { USE_MOCK_DATA } from '@/lib/config';
import { cn, getCRMStatusStyles } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import type { Lead, Contact } from '@/store/types';
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import { useRecordRelationships } from '@/shared/hooks/use-record-relationships';
import { useRecordActivities, type RecordActivityFilters, type TimelineActivity } from '@/shared/hooks/use-record-activities';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { Button } from '@/shared/components/ui/button';
import { Sheet, SheetContent } from '@/shared/components/ui/sheet';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { RecordTimelineTab } from './record-timeline-tab';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { CLOSED_WON_GROUP_ID, CRM_STATUSES, getCrmFieldCatalog, normalizeCrmStatus } from '@leadcrm/shared';
import type { RecordFileMetadata } from '@leadcrm/shared';
import { RecordFilesTab } from './record-files-tab';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { RecordSection } from './record-section';
export { RecordSection } from './record-section';
import { InlineDealForm } from './inline-deal-form';
import { RelatedTasks } from '@/features/tenant/operations/tasks/ui/related-tasks';
import type { Account } from '@/features/tenant/crm/accounts/types/account.types';
import { CatalogProductInterestSelect } from './product-interest-select';
import { EntityCombobox } from '@/shared/components/entity-combobox';
import { CrmEmailSchema } from '@leadcrm/shared';
import { DealCardMenu } from './deal-card-menu';
import { duplicateDeal } from '@/shared/services/deals-actions.api';
import { RecordBackButton } from './record-back-button';
import { ConvertLeadDialog } from '@/features/tenant/crm/leads/ui/convert-lead-dialog';
import { recordEmailComposeHref } from '@/features/tenant/inbox/services/compose-navigation';
import { copyTextWithFeedback } from '@/shared/utils/clipboard';

export type CrmRecordModule = 'leads' | 'contacts' | 'accounts' | 'deals';
type RecordData = Record<string, unknown>;
interface Relationships {
  hasMoreDeals?: boolean;
  account?: RecordData | null;
  contact?: RecordData | null;
  sourceLead?: RecordData | null;
  contacts?: RecordData[];
  leads?: RecordData[];
  deals?: RecordData[];
  activities?: TimelineActivity[];
}
const labels = { leads: 'Lead', contacts: 'Contact', accounts: 'Account', deals: 'Deal' };
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const personName = (record?: RecordData | null) => record ? [text(record.firstName), text(record.lastName)].filter(Boolean).join(' ') : '';
const object = (value: unknown): RecordData | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordData : undefined;
const displayText = (value: unknown): string => Array.isArray(value) ? value.join(', ') || '—' : String(value ?? '') || '—';
const present = (value: unknown) => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);


function RecordQuickInfo({ items, actions }: { items: { value: string; icon: LucideIcon; href?: string; label?: string; onClick?: () => void; ariaLabel?: string; disabled?: boolean }[]; actions?: React.ReactNode }) {
  return <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1 sm:mt-4 sm:gap-1.5">
    {items.filter(item => item.value).map(({ value, icon: Icon, href, label, onClick, ariaLabel, disabled }) => {
      const content = <><Icon className="h-3 w-3 shrink-0 text-muted-foreground sm:h-3.5 sm:w-3.5" /><span className="min-w-0 [overflow-wrap:anywhere]">{label}{value}</span></>;
      const cls = 'inline-flex min-h-8 max-w-full items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-foreground sm:min-h-9 sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-xs';
      if (onClick) return <button key={label || value} type="button" onClick={onClick} aria-label={ariaLabel} title={ariaLabel} disabled={disabled} className={cn(cls, 'text-left enabled:cursor-pointer enabled:hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60')}>{content}</button>;
      return href ? <a key={label || value} href={href} className={cn(cls, 'hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring')}>{content}</a> : <span key={label || value} className={cls}>{content}</span>;
    })}
    {actions}
  </div>;
}

// ── InlineEditRows — click-to-edit About section ─────────────────────────────
interface InlineRowDef {
  technicalKey?: string;
  label: string;
  value: unknown;
  apiField?: string;
  required?: boolean;
  maxLength?: number;
  type?: 'text' | 'email' | 'tel' | 'url' | 'select' | 'textarea' | 'date' | 'products' | 'users' | 'accounts' | 'contacts' | 'leads';
  valueMode?: 'id' | 'name';
  displayValue?: unknown;
  productLabels?: Record<string, string>;
  options?: string[];
}

function InlineEditRows({ rows, canEdit, onSave }: {
  rows: InlineRowDef[];
  canEdit: boolean;
  onSave: (field: string, value: string | string[]) => Promise<void>;
}) {
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string | string[]>('');
  const [isSaving, setIsSaving] = useState(false);
  const [fieldError, setFieldError] = useState('');

  const startEdit = (label: string, value: unknown) => {
    setFieldError('');
    setEditingLabel(label);
    setEditValue(Array.isArray(value) ? value : String(value ?? ''));
  };
  const cancelEdit = () => { setEditingLabel(null); setEditValue(''); };
  const commitEdit = async (apiField: string) => {
    if (isSaving) return;
    setFieldError('');
    const row = rows.find(row => row.apiField === apiField);
    if (row?.required && (typeof editValue !== 'string' || !editValue.trim())) { setFieldError(`${row.label} is required`); return; }
    if (row?.required && typeof editValue === 'string' && editValue.trim().length > (row.maxLength ?? 100)) { setFieldError(`Max ${row.maxLength ?? 100} characters`); return; }
    if (rows.find(row => row.apiField === apiField)?.type === 'email') {
      const result = CrmEmailSchema.safeParse(editValue);
      if (!result.success) { setFieldError(result.error.issues[0].message); return; }
    }
    setIsSaving(true);
    try { await onSave(apiField, typeof editValue === 'string' ? editValue.trim() : editValue); setEditingLabel(null); }
    catch (error) { setFieldError(error instanceof Error ? error.message : 'Unable to save field'); }
    finally { setIsSaving(false); }
  };

  return (
    <dl className="divide-y divide-border/60">
      {rows.filter(({ value, displayValue, apiField, label, required }) => required || present(displayValue ?? value) || (canEdit && !!apiField) || editingLabel === label).map(({ label, value, apiField, type, options, valueMode, displayValue, productLabels, required, maxLength }) => {
        const isEditing = editingLabel === label;
        const editable = canEdit && !!apiField;
        return (
          <div key={label} className={cn('grid min-w-0 gap-3 px-3 py-2.5 text-xs', required ? 'grid-cols-[minmax(max-content,2fr)_minmax(0,3fr)]' : 'grid-cols-[minmax(0,2fr)_minmax(0,3fr)]')}>
            <dt className="text-muted-foreground self-start pt-0.5">{label}{(required || type === 'email' && editable) && <span className="text-red-500"> *</span>}</dt>
            <dd className="min-w-0">
              {isEditing && apiField ? (
                <div className="flex flex-col gap-1.5">
                  {type === 'products' ? <CatalogProductInterestSelect values={Array.isArray(editValue) ? editValue : []} onChange={setEditValue} valueMode={valueMode} labels={productLabels} disabled={isSaving} /> : type === 'users' || type === 'accounts' ? <EntityCombobox entityType={type} multiple={false} disabled={isSaving} value={String(editValue) || null} onChange={value => setEditValue(value || '')} /> : type === 'contacts' || type === 'leads' ? <EntityCombobox entityType={type} multiple disabled={isSaving} values={Array.isArray(editValue) ? editValue : []} onMultiChange={setEditValue} /> : type === 'select' ? (
                    <select aria-label={label} disabled={isSaving} value={Array.isArray(editValue) ? editValue.join(', ') : editValue} onChange={e => setEditValue(e.target.value)} autoFocus className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                      {options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : type === 'textarea' ? (
                    <textarea aria-label={label} disabled={isSaving} value={Array.isArray(editValue) ? editValue.join(', ') : editValue} onChange={e => setEditValue(e.target.value)} rows={3} autoFocus onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); }} className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                  ) : (
                    <input aria-label={label} disabled={isSaving} type={type ?? 'text'} required={required || type === 'email'} aria-required={required || type === 'email'} aria-invalid={!!fieldError} maxLength={type === 'email' ? 254 : required ? maxLength ?? 100 : undefined} value={Array.isArray(editValue) ? editValue.join(', ') : editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') void commitEdit(apiField); if (e.key === 'Escape') cancelEdit(); }} className={cn("w-full rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring", fieldError ? "border-red-500" : "border-input")} />
                  )}
                  {fieldError && <p role="alert" className="text-xs text-destructive">{fieldError}</p>}
                  <div className="flex flex-wrap justify-end gap-1">
                    <button type="button" onClick={() => void commitEdit(apiField)} disabled={isSaving} className="inline-flex items-center rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">{isSaving ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Saving…</> : 'Save'}</button>
                    <button type="button" onClick={cancelEdit} disabled={isSaving} className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent disabled:opacity-50 transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" disabled={!editable || isSaving} aria-label={editable ? `Edit ${label}` : undefined}
                  className={cn('group flex w-full items-start justify-end gap-1.5 text-right [overflow-wrap:anywhere] focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default', editable && 'hover:text-primary hover:underline')}
                  onClick={() => startEdit(label, value)}>
                  <span className="min-w-0">{displayText(displayValue ?? value)}</span>{editable && <Pencil aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />}
                </button>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function RecordRows({ rows }: { rows: [string, unknown][] }) {
  return <dl className="divide-y divide-border/60">{rows.filter(([, value]) => present(value)).map(([label, value]) => <div key={label} className="grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-2.5 text-xs">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-right [overflow-wrap:anywhere]">{Array.isArray(value) ? <span className="flex flex-wrap justify-end gap-1">{value.map((item, index) => <span key={index} className="rounded-md bg-[var(--primary)]/10 px-1.5 py-0.5 text-[var(--primary)]">{String(item)}</span>)}</span> : String(value)}</dd>
  </div>)}</dl>;
}

function RelatedRecords({ records, module, empty }: { records: RecordData[]; module: string; empty: string }) {
  if (module === 'deals') return records.length ? <div className="divide-y divide-border/60">{records.filter(record => !record.isArchived).map(record => <div key={text(record.id)} className="flex min-w-0 items-center gap-2 px-3 py-2"><Link href={'/crm/deals/' + encodeURIComponent(text(record.id))} className="min-w-0 flex-1 py-2 text-sm font-medium [overflow-wrap:anywhere]">{text(record.title)}<span className="mt-1 block text-xs text-muted-foreground">{text(object(record.stage)?.name)}</span></Link><DealCardMenu dealId={text(record.id)} dealTitle={text(record.title)} /></div>)}</div> : <p className="p-4 text-sm text-muted-foreground">{empty}</p>;
  return records.length ? <div className="divide-y divide-border/60">{records.map(record => <Link key={text(record.id)} href={`/crm/${module}/${encodeURIComponent(text(record.id))}`} className="flex min-w-0 items-center gap-3 px-3 py-3 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
    <div className="min-w-0 flex-1 [overflow-wrap:anywhere]"><p className="text-sm font-medium">{text(record.name) || text(record.title) || personName(record)}</p><p className="mt-0.5 text-xs text-muted-foreground">{text(record.email) || text(record.industry) || text(object(record.stage)?.name)}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
  </Link>)}</div> : <p className="px-4 py-7 text-center text-sm text-muted-foreground">{empty}</p>;
}

/** The drawer and route render this same record reader, actions and content. */
export function CrmRecordView({ module, id, onClose, onEdit, focusClosing = false, focusNote = false }: { module: CrmRecordModule; id: string; onClose?: () => void; onEdit?: (record: RecordData) => void; focusClosing?: boolean; focusNote?: boolean }) {
  const router = useRouter();
  const fieldLayout = useFieldLayout(module);
  const { user, tenant } = useAuth();
  const data = useData();
  const canEdit = useHasPermission(module === 'deals' ? 'deals.edit' : module === 'accounts' ? 'accounts.edit' : module === 'leads' ? 'leads.edit' : 'contacts.edit');
  const hasArchivePermission = useHasPermission(module === 'deals' ? 'deals.archive' : module === 'accounts' ? 'accounts.archive' : module === 'leads' ? 'leads.archive' : 'contacts.archive');
  const canArchive = hasArchivePermission && !USE_MOCK_DATA;
  const canCreateDeal = useHasPermission('deals.create');
  const canReadDeals = useHasPermission('deals.view');
  const canReadContacts = useHasPermission('contacts.view');
  const canReadLeads = useHasPermission('leads.view');
  const canReadAccounts = useHasPermission('accounts.view');
  const [tab, setTab] = useState(focusClosing ? 'details' : 'activity');
  const [closingAttention, setClosingAttention] = useState(focusClosing);
  const [detailsVisited, setDetailsVisited] = useState(false);
  const [converting, setConverting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [creatingDeal, setCreatingDeal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lostStage, setLostStage] = useState<string>();
  const [lostReason, setLostReason] = useState('');
  const [taskCount, setTaskCount] = useState<number>();
  const [savingField, setSavingField] = useState<string | null>(null);
  const recordQuery = useCachedPage<RecordData>({ module, params: { recordId: id }, revalidateOnInvalidation: true,
    fetchFn: async signal => (await apiClient.get<{ data: RecordData }>(`/crm/${module}/${encodeURIComponent(id)}`, { signal })).data });
  const [activityFilters, setActivityFilters] = useState<RecordActivityFilters>({});
  const relatedQuery = useRecordRelationships<Relationships>(module, id, module === 'deals' || USE_MOCK_DATA || !detailsVisited || !recordQuery.data);
  const timeline = useRecordActivities(module, id, !!recordQuery.data || USE_MOCK_DATA, undefined, activityFilters);
  const mockRecords = module === 'deals' ? data.deals : module === 'accounts' ? data.organizations : data.contacts;
  const mockRecord = USE_MOCK_DATA ? mockRecords.find(item => item.id === id && item.tenantId === tenant?.id) : undefined;
  const record = USE_MOCK_DATA ? mockRecord as unknown as RecordData : recordQuery.data;
  useEffect(() => {
    const focus = (event: Event) => {
      if (module !== 'deals' || (event as CustomEvent<string>).detail !== id) return;
      event.preventDefault(); setTab('details'); setDetailsVisited(true); setClosingAttention(true);
    };
    window.addEventListener('deal-closing-required', focus);
    return () => window.removeEventListener('deal-closing-required', focus);
  }, [module, id]);
  useEffect(() => {
    if (!closingAttention || !record || tab !== 'details') return;
    const frame = requestAnimationFrame(() => { const section = document.getElementById(`closing-requirements-${id}`); section?.scrollIntoView({ block: 'start' }); section?.focus(); setClosingAttention(false); });
    return () => cancelAnimationFrame(frame);
  }, [closingAttention, record, tab, id]);
  const filesQuery = useCachedPage<RecordFileMetadata[]>({ module, params: { recordId: id, files: true }, revalidateOnInvalidation: true,
    disabled: tab !== 'files' || !recordQuery.data || USE_MOCK_DATA,
    fetchFn: async signal => (await apiClient.get<{ data: RecordFileMetadata[] }>(`/crm/${module}/${encodeURIComponent(id)}/files`, { signal })).data });

  const relationships = relatedQuery.data;
  const label = labels[module];
  const edit = () => {
    setTab('details'); setDetailsVisited(true);
  };
  const save = async (payload: RecordData) => {
    if (saving) return;
    setSaving(true);
    try {
      if (USE_MOCK_DATA) {
        if (module === 'accounts') await data.updateOrganization(id, payload);
        else if (module === 'deals') await data.updateDeal(id, payload);
        else await data.updateContact(id, payload);
      } else { const response = await apiClient.put<{ data: RecordData }>(`/crm/${module}/${encodeURIComponent(id)}`, payload); if (response.data) recordQuery.setData(response.data); }
      toast.success(`${label} updated`);
    } catch (error) { toast.error(error instanceof Error ? error.message : `Failed to update ${label.toLowerCase()}`); }
    finally { setSaving(false); }
  };

  const saveField = async (apiField: string, value: string | string[]): Promise<void> => {
    if (savingField) return;
    setSavingField(apiField);
    try {
      if (USE_MOCK_DATA) {
        if (module === 'accounts') await data.updateOrganization(id, { [apiField]: value });
        else if (module === 'deals') await data.updateDeal(id, { [apiField]: value });
        else await data.updateContact(id, { [apiField]: value });
      } else {
        const trimmed = typeof value === 'string' ? value.trim() : value;
        if (apiField === 'email' && (module === 'leads' || module === 'contacts')) CrmEmailSchema.parse(trimmed);
        const normalized = apiField === 'website' && module === 'accounts' && typeof trimmed === 'string' && trimmed && !/^https?:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed;
        const response = await apiClient.put<{ data: RecordData }>(`/crm/${module}/${encodeURIComponent(id)}`, { [apiField]: module === 'deals' && ['accountId', 'assignedUserId', 'expectedCloseDate'].includes(apiField) && normalized === '' ? null : apiField === 'expectedCloseDate' && normalized ? new Date(String(normalized)).toISOString() : normalized });
        if (response.data) recordQuery.setData(response.data);
      }
      toast.success('Field updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update field');
      throw error;
    } finally {
      setSavingField(null);
    }
  };

  if (recordQuery.isInitialLoad) return <div role="status" aria-label={`Loading ${label.toLowerCase()}`} className="relative space-y-4 p-4 animate-pulse">{onClose && <Button variant="ghost" size="icon" className="absolute right-3 top-3" onClick={onClose} aria-label="Close record" title="Close record"><X size={16} /></Button>}<div className="h-12 w-12 rounded-xl bg-muted" /><div className="h-5 w-2/3 rounded bg-muted" /><div className="h-9 rounded-xl bg-muted" /><div className="h-44 rounded-xl bg-muted" /></div>;
  if (!record) return <div className="space-y-4 p-5"><h2 className="font-semibold">Unable to open {label.toLowerCase()}</h2><p role="alert" className="text-sm text-muted-foreground">{recordQuery.error || 'Record not found or access is unavailable.'}</p><Button variant="outline" onClick={() => void recordQuery.refetch()}>Retry</Button>{onClose && <Button variant="ghost" onClick={onClose}>Close</Button>}</div>;

  const title = module === 'deals' ? text(record.title) : module === 'accounts' ? text(record.name) : personName(record);
  const person = module === 'deals' ? object((record.contactDeals as RecordData[] | undefined)?.[0]?.contact) ?? object((record.leadDeals as RecordData[] | undefined)?.[0]?.lead) : record;
  const source = (module === 'deals' ? (record.productInterests as string[] | undefined)?.join(', ') : '') || text(record.source) || text(record.leadSource);
  const owner = personName(object(record.assignedUser)) || personName(object(record.owner));
  const company = text(object(record.organization)?.name) || text(person?.companyName) || text(person?.company) || text(record.companyName) || text(record.company) || text(object(record.account)?.name);
  const location = [text(record.address), text(record.city), text(record.province), text(record.country)].filter(Boolean).join(', ');
  const personChipActions = module === 'contacts' || (module === 'leads' && !!onClose);
  const email = text(person?.email);
  const phone = text(person?.phone);
  const emailChipAction = personChipActions || module === 'deals';
  // The API projects canonical Product relations into these ID/name arrays.
  const dealProductIds = (record.productInterestIds as string[] | undefined)?.length ? record.productInterestIds as string[] : record.productInterestId ? [text(record.productInterestId)] : [];
  const dealProductNames = record.productInterests as string[] | undefined;
  const dealProductName = text(object(record.productInterestRecord)?.name) || (record.productInterestRecord !== null && dealProductIds.length === 1 && dealProductNames?.length === 1 ? dealProductNames[0] : '');
  const composeHref = emailChipAction ? recordEmailComposeHref(email, module === 'deals' ? `${dealProductName || 'Product'} Inquiry` : undefined) : null;
  const subtitle = module === 'deals' ? `₱${Number(record.value ?? 0).toLocaleString()} · ${text(object(record.pipeline)?.name)}` : module === 'accounts' ? text(record.industry) || text(record.website) : company || text(record.jobTitle) || location;
  const rawStatus = text(module === 'deals' ? object(record.stage)?.name : module === 'accounts' ? '' : record.status);
  const status = module === 'leads' || module === 'contacts' ? normalizeCrmStatus(rawStatus) : rawStatus;
  const statusLabel = status === status.toUpperCase() ? status.charAt(0) + status.slice(1).toLowerCase() : status;
  const dealStages = data.pipelines.find(p => p.id === record.pipelineId)?.stages ?? [];
  const changeStage = async (stageId: string, reason?: string) => {
    setSaving(true);
    try { await data.moveDealStage(id, stageId, undefined, reason); setLostStage(undefined); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to move Deal'); }
    finally { setSaving(false); }
  };
  const statuses = [...CRM_STATUSES];
  const rows: [string, unknown][] = [
    ...(module === 'accounts' ? [['Account name', record.name], ['Industry', record.industry], ['Company size', record.size]] as [string, unknown][] : []),
    ...(module === 'deals' ? [['Deal title', title], ['Deal value', subtitle.split(' · ')[0]], ['Priority', record.priority], ['Associated Lead / Contact', personName(person)], ['Created', formatDateTime(record.createdAt as string | null | undefined)]] as [string, unknown][] : []),
    ['Email', person?.email], ['Phone', person?.phone], ['Address', location], ['Company', module !== 'accounts' ? company : undefined], ['Job title', record.jobTitle], ['Website', record.website],
    ['Product interests', record.productInterest ?? record.productInterests], ['Source', module === 'deals' ? record.leadSource : source], ['Status', statusLabel], ['Assigned Agent', owner], ['Notes', module === 'deals' ? undefined : record.notes ?? record.description],
  ];
  const productIds = (record.productInterestIds as string[] | undefined)?.length ? record.productInterestIds as string[] : record.productInterestId ? [text(record.productInterestId)] : [];
  const productNames = (record.productInterest ?? record.productInterests ?? []) as string[];
  const productRow: InlineRowDef = { technicalKey: 'productInterestIds', label: 'Product interests', value: module === 'leads' || module === 'deals' ? productIds : productNames, displayValue: productNames, apiField: module === 'leads' ? 'productInterest' : module === 'deals' ? undefined : 'productInterests', type: 'products', valueMode: module === 'leads' || module === 'deals' ? 'id' : 'name', productLabels: Object.fromEntries(productIds.map((id, i) => [id, productNames[i] ?? 'Unavailable product'])) };
  const aboutRows: InlineRowDef[] = module === 'deals' ? [
    { label: 'Deal title', value: title, apiField: 'title' },
    { technicalKey: 'value', label: 'Deal value', value: subtitle.split(' · ')[0] },
    productRow,
    { label: 'Priority', value: record.priority, apiField: 'priority', type: 'select', options: ['LOW', 'MEDIUM', 'HIGH'] },
    { label: 'Expected close date', value: text(record.expectedCloseDate).slice(0, 10), apiField: 'expectedCloseDate', type: 'date' },
    { technicalKey: 'pipelineId', label: 'Pipeline', value: object(record.pipeline)?.name },
    { technicalKey: 'stageId', label: 'Stage', value: statusLabel },
    ...(canReadAccounts ? [{ technicalKey: 'accountId', label: 'Account', value: object(record.organization)?.name ?? object(record.account)?.name }] : []),
    { label: 'Assigned Agent', value: record.assignedUserId, displayValue: owner, apiField: 'assignedUserId', type: 'users' },
    { label: 'Source', value: record.leadSource, apiField: 'leadSource' },
    { label: 'Industry', value: record.industry, apiField: 'industry' },
    { label: 'Address', value: record.address, apiField: 'address' },
    { technicalKey: 'createdAt', label: 'Created', value: record.createdAt, displayValue: formatDateTime(record.createdAt as string | null | undefined) },
  ] : [
    ...(module === 'accounts' ? [
      { label: 'Account name', value: record.name, apiField: 'name', required: true, maxLength: 255 },
      { label: 'Industry', value: record.industry, apiField: 'industry' },
      { label: 'Company size', value: record.size, apiField: 'size', type: 'select' as const, options: ['1-10', '11-50', '51-200', '200+'] },
      { label: 'Website', value: record.website, apiField: 'website', type: 'url' as const },
      { label: 'City', value: record.city, apiField: 'city' },
      { label: 'Province', value: record.province, apiField: 'province' },
      { label: 'Country', value: record.country, apiField: 'country' },
    ] : [
      { label: 'First name', value: record.firstName, apiField: 'firstName', required: true },
      { label: 'Last name', value: record.lastName, apiField: 'lastName', required: true },
      { label: 'Email', value: record.email, apiField: 'email', type: 'email' as const },
      { label: 'Phone', value: record.phone, apiField: 'phone', type: 'tel' as const },
      { label: 'Company', value: module === 'leads' ? record.companyName : record.company, apiField: module === 'leads' ? 'companyName' : 'company' },
      ...(module === 'contacts' ? [{ label: 'Job title', value: record.jobTitle, apiField: 'jobTitle' }] : []),
      ...(canReadAccounts ? [{ technicalKey: 'accountId', label: 'Account', value: object(record.account)?.name ?? object(record.organization)?.name }] : []),
      { label: 'Source', value: source, apiField: 'source' },
    ]),
    { label: 'Address', value: record.address, apiField: 'address' },
    productRow,
    ...(module === 'contacts' || module === 'accounts' ? [{ technicalKey: 'activeProductIds', label: 'Active Products', value: record.activeProducts }] : []),
    ...(module === 'accounts' ? [] : [{ label: 'Status', value: statusLabel, apiField: 'status', type: 'select' as const, options: statuses }]),
    { technicalKey: 'assignedUserId', label: 'Assigned Agent', value: record.assignedUserId, displayValue: owner, apiField: 'assignedUserId', type: 'users' },
    ...(module === 'leads' ? [] : [{ label: 'Notes', value: record.notes, apiField: 'notes', type: 'textarea' as const }]),
    ...(module === 'accounts' ? [{ label: 'Internal Notes', value: record.internalNotes, apiField: 'internalNotes', type: 'textarea' as const }] : []),
    { technicalKey: 'createdAt', label: 'Created', value: record.createdAt, displayValue: formatDateTime(record.createdAt as string | null | undefined) },
  ];
  const catalog = fieldLayout.data?.fields ?? getCrmFieldCatalog(module, [], fieldLayout.layout);
  const configuredRows = aboutRows.map(row => ({ row, field: catalog.find(field => field.technicalKey === (row.technicalKey ?? row.apiField)) })).filter(item => item.field?.visibleInDetails !== false);

  const customFields = object(record.customFields);
  const deals = relationships?.deals ?? [];
  const links = module === 'deals' ? { dealId: id } : module === 'leads' ? { leadId: id } : module === 'contacts' ? { contactId: id } : { accountId: id };
  const activityLoading = timeline.isInitialLoad;
  const activityError = timeline.error;
  const formRecord = { ...record, companyName: company, leadSource: source, organizationId: record.accountId, productInterests: record.productInterest ?? record.productInterests, status: statusLabel };
  const website = text(record.website);
  const websiteHref = website && !/^[a-z][a-z0-9+.-]*:/i.test(website) ? `https://${website}` : /^https?:\/\//i.test(website) ? website : undefined;

  const manageMenu = (canEdit || canArchive) && (
    <DropdownMenu>
      <TooltipProvider><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="Record actions" title="Record actions">
          <MoreHorizontal size={16} />
        </Button>
      </DropdownMenuTrigger></TooltipTrigger><TooltipContent>Record actions</TooltipContent></Tooltip></TooltipProvider>
      <DropdownMenuContent align="end">
        {canEdit && <DropdownMenuItem onSelect={edit}><Pencil size={14} />Edit {label.toLowerCase()}</DropdownMenuItem>}
        {module === 'deals' && canCreateDeal && !USE_MOCK_DATA && <DropdownMenuItem onSelect={() => { void duplicateDeal(id).then(next => router.push('/crm/deals/' + next.id)).catch(() => {}); }}>Duplicate deal</DropdownMenuItem>}
        {canEdit && !USE_MOCK_DATA && module === 'leads' && !record.contactId && <DropdownMenuItem onSelect={() => setConverting(true)}><UserPlus size={14} />Convert to contact</DropdownMenuItem>}
        {canArchive && <DropdownMenuItem onSelect={() => setArchiving(true)}><Archive size={14} />Archive {label.toLowerCase()}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return <div className={cn('flex h-full min-h-0 min-w-0 flex-col [--panel-gutter:1rem]', onClose ? 'bg-white dark:bg-slate-900 sm:[--panel-gutter:1.5rem]' : 'bg-background')}>
    <Tabs defaultValue="activity" value={tab} onValueChange={value => { setTab(value); if (value === 'details') setDetailsVisited(true); }} className="flex min-h-0 flex-1 flex-col">
      <header className={cn('@container max-h-[60dvh] shrink-0 overflow-y-auto', onClose ? panelHeaderClass : 'border-b border-border bg-card p-3 sm:p-4')}>
        <div className={cn('mx-auto min-w-0', !onClose && 'max-w-[1440px]')}>
        {!onClose && (
          <div className="mb-3">
            <RecordBackButton label={`${label}s`} onClick={() => { if (window.history.length > 1 && new URLSearchParams(window.location.search).get('from') === module) router.back(); else router.push(`/crm/${module}`); }} />
            <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <span>CRM</span><ChevronRight size={12} /><Link className="hover:text-[var(--primary)]" href={`/crm/${module}`}>{label}s</Link><ChevronRight size={12} /><span className="min-w-0 [overflow-wrap:anywhere]" aria-current="page">{title}</span>
            </nav>
          </div>
        )}
        <div className="relative flex min-w-0 flex-wrap items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)]">{module === 'accounts' ? <Building size={20} /> : module === 'deals' ? title.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() : `${text(record.firstName)[0] || ''}${text(record.lastName)[0] || ''}`}</div>
          <div className={cn('min-w-0 flex-1 basis-[calc(100%-64px)] @min-[400px]:basis-0 @min-[400px]:pr-0', onClose ? 'pr-11' : 'pr-9')}>
            <div className="mb-1 flex flex-wrap gap-1"><span className="rounded bg-[var(--primary)]/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-[var(--primary)]">{label.toUpperCase()}</span>{source && <span className="max-w-full rounded border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground [overflow-wrap:anywhere]">{source}</span>}</div>
            <h1 className={onClose ? panelTitleClass : 'text-base font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-lg'}>{title}</h1>
            {subtitle && <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{subtitle}</p>}
            {onClose && <Link href={`/crm/${module}/${encodeURIComponent(id)}?from=${module}`} className="mt-1 inline-flex min-h-8 items-center gap-1 text-xs font-medium text-[var(--primary)]">Open full page <ExternalLink size={11} /></Link>}
          </div>
          <div className={cn('ml-[52px] flex min-w-0 max-w-[calc(100%-52px)] items-center gap-1.5 [&>div]:min-w-0 @min-[400px]:ml-0', onClose ? '@min-[400px]:pr-11' : '@min-[400px]:pr-9')}>
            {manageMenu}
            {module !== 'accounts' && <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="Open messages" title="Open messages" onClick={() => router.push('/inbox')}><Inbox size={16} /></Button></TooltipTrigger><TooltipContent>Open messages</TooltipContent></Tooltip></TooltipProvider>}
            {status && (canEdit ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={saving} className={cn('min-h-9 min-w-0 max-w-full gap-1 rounded-lg text-xs', getCRMStatusStyles(statusLabel))}><span className="min-w-0 max-w-[90px] truncate @min-[400px]:max-w-[140px]">{statusLabel}</span><ChevronDown size={12} className="shrink-0" /></Button></DropdownMenuTrigger><DropdownMenuContent>{module === 'deals' ? dealStages.map(stage => <DropdownMenuItem key={stage.id} onSelect={() => { if (stage.id === record.stageId) return; if (stage.isLost) { setLostReason(''); setLostStage(stage.id); } else void changeStage(stage.id); }}>{stage.name}</DropdownMenuItem>) : statuses.map(option => <DropdownMenuItem key={option} onSelect={() => void save({ status: option })}>{option}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu> : <span className={cn('rounded-lg px-2 py-1 text-xs', getCRMStatusStyles(statusLabel))}>{statusLabel}</span>)}
            {onClose && <Button variant="ghost" size="icon" className={panelCloseClass + " absolute -right-1 -top-1"} onClick={onClose} aria-label="Close record" title="Close record"><X size={16} /></Button>}
          </div>
        </div>
        <RecordQuickInfo items={[
          { value: email || (module === 'deals' ? 'No email address is available for this Deal.' : ''), icon: Mail, ...(emailChipAction ? { onClick: () => { if (composeHref) router.push(composeHref); }, ariaLabel: email ? `Compose email to ${email}` : 'No email address is available for this Deal.', disabled: !composeHref } : { href: email ? `mailto:${email}` : undefined }) },
          { value: phone, icon: Phone, ...(personChipActions ? { onClick: () => { void copyTextWithFeedback(phone, 'Phone number'); }, ariaLabel: `Copy phone number ${phone}` } : { href: phone ? `tel:${phone}` : undefined }) },
          ...(module === 'deals' ? [{ value: personName(person), icon: User }, { value: company, icon: Building }] : []),
          { value: owner, icon: User, label: 'Agent: ' },
          ...(module === 'accounts' ? [{ value: website, icon: Globe, href: websiteHref }] : []),
          { value: location, icon: MapPin, ...(personChipActions ? { onClick: () => { void copyTextWithFeedback(location, 'Address'); }, ariaLabel: `Copy address ${location}` } : {}) },
        ]} />
        <div className="mt-4" onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
          const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
          if (current < 0) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          tabs[next].focus(); tabs[next].click();
        }}><TabsList className="grid w-full grid-cols-3 gap-1 overflow-visible bg-muted/70">
          <TabsTrigger value="activity" badge={timeline.total} className="min-w-0 px-1 py-2 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm [&>span]:justify-center [&>span]:gap-1">Activity</TabsTrigger>
          <TabsTrigger value="details" badge={rows.filter(([, value]) => present(value)).length} className="min-w-0 px-1 py-2 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm [&>span]:justify-center [&>span]:gap-1">Details</TabsTrigger>
          <TabsTrigger value="files" className="min-w-0 px-1 py-2 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm [&>span]:justify-center">Files</TabsTrigger>
        </TabsList></div>
        </div>
      </header>
      <div data-record-scroll className={cn('min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain', onClose ? 'bg-white dark:bg-slate-900' : 'bg-muted/20')}>
        <div className={cn('mx-auto w-full min-w-0', !onClose && 'max-w-[1440px]')}>
          <TabsContent value="activity" forceMount className={cn('m-0', onClose && '[&>div]:px-[var(--panel-gutter)]')}>
            <RecordTimelineTab compact focusNote={focusNote && tab === 'activity'} activities={timeline.activities} module={module} recordId={id} loading={activityLoading} error={activityError} hasMore={timeline.hasMore} onLoadMore={timeline.loadMore} onFiltersChange={setActivityFilters}
              tasks={<RecordSection title="Tasks" count={taskCount}><RelatedTasks links={links} onCountChange={setTaskCount} /></RecordSection>} />
          </TabsContent>
          <TabsContent value="details" forceMount className={cn('m-0 p-4', onClose && 'px-[var(--panel-gutter)]')}><div className="space-y-3">
            {module === 'deals' && !USE_MOCK_DATA && <DealClosingRequirements focusRequested={closingAttention} dealId={id} canEdit={canEdit} />}
            {!USE_MOCK_DATA && <RecordCustomFieldDetails module={module} recordId={id} canEdit={canEdit} editorOnly />}
            {[...fieldLayout.layout.groups].sort((a, b) => a.order - b.order).filter(group => group.id !== CLOSED_WON_GROUP_ID).map(group => <RecordSection key={group.id} title={group.label}>
              {catalog.filter(field => field.groupId === group.id && field.visibleInDetails).map(field => {
                if (field.customFieldId) return !USE_MOCK_DATA && <RecordCustomFieldDetails key={field.technicalKey} module={module} recordId={id} fieldId={field.customFieldId} embedded />;
                const row = configuredRows.find(item => item.field?.technicalKey === field.technicalKey)?.row;
                return row ? <InlineEditRows key={field.technicalKey} rows={[{ ...row, label: field.label }]} canEdit={canEdit && !USE_MOCK_DATA} onSave={saveField} /> : null;
              })}
            </RecordSection>)}
            {detailsVisited && relatedQuery.isInitialLoad && <p role="status" className="animate-pulse p-3 text-sm text-muted-foreground">Loading related records…</p>}
            {relatedQuery.error && <div role="alert" className="rounded-xl border border-border p-3 text-sm"><p>{relatedQuery.error}</p><Button variant="ghost" size="sm" onClick={() => void relatedQuery.refetch()}>Retry related records</Button></div>}
            {module === 'deals' && <><RecordSection title="Lead/Contact">{canReadLeads && <RelatedRecords records={(record.leadDeals as RecordData[] | undefined)?.map(link => object(link.lead)!).filter(Boolean) ?? []} module="leads" empty="No originating Lead." />}{canReadContacts && <RelatedRecords records={(record.contactDeals as RecordData[] | undefined)?.map(link => object(link.contact)!).filter(Boolean) ?? []} module="contacts" empty="No Contact linked yet." />}</RecordSection>{canReadAccounts && <RecordSection title="Account"><RelatedRecords records={object(record.organization) || object(record.account) ? [object(record.organization) ?? object(record.account)!] : []} module="accounts" empty="No Account linked yet." /></RecordSection>}</>}
            {relationships && <>
              {module === 'accounts' && canReadContacts && <RecordSection title="Contacts" count={(relationships.contacts?.length ?? 0) < 50 ? relationships.contacts?.length : undefined}><RelatedRecords records={relationships.contacts ?? []} module="contacts" empty="No contacts linked to this account." /></RecordSection>}
              {module !== 'deals' && canReadDeals && <RecordSection title="Deals" count={deals.length < 50 ? deals.length : undefined} actions={canCreateDeal && !USE_MOCK_DATA && <Button variant="ghost" size="sm" className="min-h-9 gap-1 text-xs text-[var(--primary)]" onClick={() => setCreatingDeal(true)}><Plus size={13} />Create deal</Button>}>
                <RelatedRecords records={deals} module="deals" empty={`No deals attached to this ${label.toLowerCase()}.`} />
                {relationships.hasMoreDeals && <Button variant="ghost" size="sm" onClick={relatedQuery.loadMore} disabled={relatedQuery.isRefreshing}>Load older deals</Button>}
                {creatingDeal && <div className="border-t border-border p-3"><InlineDealForm relatedRecord={{ type: module === 'leads' ? 'lead' : module === 'contacts' ? 'contact' : 'account', id }} onError={error => toast.error(error instanceof Error ? error.message : 'Failed to create deal')} onCancel={() => setCreatingDeal(false)} onSubmit={async values => {
                  await apiClient.post('/crm/deals', { customFieldValues: values.customFieldValues, title: values.title, productInterestIds: values.productInterestIds, pipelineId: values.pipelineId, stageId: values.stageId, priority: values.priority, expectedCloseDate: values.expectedCloseDate ? new Date(values.expectedCloseDate).toISOString() : undefined, ...(module === 'leads' ? { leadIds: [id] } : module === 'contacts' ? { contactIds: [id] } : { accountId: id }) });
                  setCreatingDeal(false);
                }} /></div>}
              </RecordSection>}
              {module !== 'accounts' && canReadAccounts && <RecordSection title={module === 'leads' ? 'Company / Organization' : 'Account / Company'} count={relationships.account ? 1 : 0}><RelatedRecords records={relationships.account ? [relationships.account] : []} module="accounts" empty="No parent company assigned." /></RecordSection>}
              {module === 'contacts' && relationships.sourceLead && canReadLeads && <RecordSection title="Related leads" count={1}><RelatedRecords records={[relationships.sourceLead]} module="leads" empty="" /></RecordSection>}
            </>}

            {USE_MOCK_DATA && customFields && Object.keys(customFields).length > 0 && <RecordSection title="Custom fields" count={Object.keys(customFields).length}><RecordRows rows={Object.entries(customFields)} /></RecordSection>}
          </div></TabsContent>
          <TabsContent value="files" className={cn('m-0', onClose && '[&>div]:px-[var(--panel-gutter)]')}>
            <RecordFilesTab files={filesQuery.data ?? []} loading={filesQuery.isInitialLoad} error={filesQuery.error} onRetry={() => void filesQuery.refetch()}
              onUpload={canEdit && !USE_MOCK_DATA ? async file => {
                const query = new URLSearchParams({ name: file.name, type: file.type || 'application/octet-stream' });
                await apiClient.upload(`/crm/${module}/${encodeURIComponent(id)}/files?${query}`, new Blob([file], { type: 'application/octet-stream' }));
              } : undefined} />
          </TabsContent>
        </div>
      </div>
    </Tabs>

    <Dialog open={Boolean(lostStage)} onOpenChange={open => { if (!open && !saving) setLostStage(undefined); }}>
      <DialogContent showClose={false} aria-label="Close Deal as lost" className="max-w-sm">
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (lostStage && !saving) void changeStage(lostStage, lostReason); }}>
          <label className="block text-sm">Lost reason<textarea required maxLength={2000} value={lostReason} onChange={e => setLostReason(e.target.value)} className="mt-2 w-full rounded border bg-background p-2" /></label>
          <div className="flex flex-wrap gap-2"><Button disabled={saving || !lostReason.trim()}>Save</Button><Button type="button" variant="ghost" disabled={saving} onClick={() => setLostStage(undefined)}>Cancel</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    {converting && <ConvertLeadDialog isOpen lead={formRecord as unknown as Lead} onClose={() => setConverting(false)} onSuccess={() => setConverting(false)} />}
    <ConfirmActionDialog open={archiving} onOpenChange={setArchiving} title={`Archive ${label}`} description={`${title} will be moved to Archived Data.`} warning="You can restore this record later from Settings → Archived Data." confirmLabel="Archive" variant="destructive" onConfirm={async () => {
      try { await apiClient.patch(`/crm/${module}/${encodeURIComponent(id)}/archive`); toast.success(`${label} archived`); setArchiving(false); if (onClose) onClose(); else router.push(`/crm/${module}`); }
      catch (error) { throw new Error(error instanceof Error ? error.message : 'Failed to archive record'); }
    }} />
  </div>;
}

export function CrmRecordPanel({ module, id, open, onOpenChange, onEdit, focusClosing, focusNote }: { module: CrmRecordModule; id?: string; open: boolean; onOpenChange: (open: boolean) => void; onEdit?: (record: RecordData) => void; focusClosing?: boolean; focusNote?: boolean }) {
  const { user } = useAuth();
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent showClose={false} aria-label={`${labels[module]} details`} className={panelSurfaceClass}>
    {open && id && <CrmRecordView key={`${module}:${id}:${user?.id}`} module={module} id={id} onClose={() => onOpenChange(false)} onEdit={onEdit} focusClosing={focusClosing} focusNote={focusNote} />}
  </SheetContent></Sheet>;
}
