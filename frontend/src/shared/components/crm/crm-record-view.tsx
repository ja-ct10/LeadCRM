'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, Building, ChevronDown, ChevronRight, ExternalLink, FolderOpen, Globe, Mail, MapPin, MoreHorizontal, Pencil, Phone, Plus, User, UserPlus, X, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api/client';
import { USE_MOCK_DATA } from '@/lib/config';
import { cn, getCRMStatusStyles } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import type { Lead, Contact } from '@/store/types';
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import { useRecordActivities, type TimelineActivity } from '@/shared/hooks/use-record-activities';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { Button } from '@/shared/components/ui/button';
import { Sheet, SheetContent } from '@/shared/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { RecordTimelineTab } from './record-timeline-tab';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { InlineDealForm } from './inline-deal-form';
import { DEFAULT_LEAD_STATUSES, DEFAULT_ACCOUNT_STATUSES } from './moduleConfig';
import { RelatedTasks } from '@/features/tenant/operations/tasks/ui/related-tasks';
import { LeadFormSheet } from '@/features/tenant/crm/leads/ui/lead-form';
import { ContactFormSheet } from '@/features/tenant/crm/contacts/ui/contact-form';
import { AccountFormSheet } from '@/features/tenant/crm/accounts/ui/account-form';
import type { Account } from '@/features/tenant/crm/accounts/types/account.types';
import { DealFormSheet } from '@/features/tenant/crm/deals/ui/deal-form';
import { toBackendUpdateDeal, toFrontendDeal } from '@/lib/api/adapters/deal.adapter';
import { ConvertLeadDialog } from '@/features/tenant/crm/leads/ui/convert-lead-dialog';

export type CrmRecordModule = 'leads' | 'contacts' | 'accounts' | 'deals';
type RecordData = Record<string, unknown>;
interface Relationships {
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
const present = (value: unknown) => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);

export function RecordSection({ title, count, actions, children }: { title: string; count?: number; actions?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
    <div className="flex flex-wrap items-center gap-x-2 border-b border-border/60 px-3 py-1">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', !open && '-rotate-90')} />
        <span className="break-words">{title}</span>
        {count !== undefined && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{count}</span>}
      </button>
      {actions}
    </div>
    <div id={id} hidden={!open}>{children}</div>
  </section>;
}

function RecordQuickInfo({ items, actions }: { items: { value: string; icon: LucideIcon; href?: string; label?: string }[]; actions: React.ReactNode }) {
  return <div className="mt-4 flex min-w-0 flex-wrap items-center gap-1.5">
    {items.filter(item => item.value).map(({ value, icon: Icon, href, label }) => {
      const content = <><Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="min-w-0 [overflow-wrap:anywhere]">{label}{value}</span></>;
      const cls = 'inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground';
      return href ? <a key={label || value} href={href} className={cn(cls, 'hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring')}>{content}</a> : <span key={label || value} className={cls}>{content}</span>;
    })}
    {actions}
  </div>;
}

function RecordRows({ rows }: { rows: [string, unknown][] }) {
  return <dl className="divide-y divide-border/60">{rows.filter(([, value]) => present(value)).map(([label, value]) => <div key={label} className="grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-2.5 text-xs">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-right [overflow-wrap:anywhere]">{Array.isArray(value) ? <span className="flex flex-wrap justify-end gap-1">{value.map((item, index) => <span key={index} className="rounded-md bg-[var(--primary)]/10 px-1.5 py-0.5 text-[var(--primary)]">{String(item)}</span>)}</span> : String(value)}</dd>
  </div>)}</dl>;
}

function RelatedRecords({ records, module, empty }: { records: RecordData[]; module: string; empty: string }) {
  return records.length ? <div className="divide-y divide-border/60">{records.map(record => <Link key={text(record.id)} href={`/crm/${module}/${encodeURIComponent(text(record.id))}`} className="flex min-w-0 items-center gap-3 px-3 py-3 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
    <div className="min-w-0 flex-1 [overflow-wrap:anywhere]"><p className="text-sm font-medium">{text(record.name) || text(record.title) || personName(record)}</p><p className="mt-0.5 text-xs text-muted-foreground">{text(record.email) || text(record.industry) || text(object(record.stage)?.name)}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
  </Link>)}</div> : <p className="px-4 py-7 text-center text-sm text-muted-foreground">{empty}</p>;
}

/** The drawer and route render this same record reader, actions and content. */
export function CrmRecordView({ module, id, onClose, onEdit }: { module: CrmRecordModule; id: string; onClose?: () => void; onEdit?: (record: RecordData) => void }) {
  const router = useRouter();
  const { user, tenant } = useAuth();
  const data = useData();
  const canEdit = useHasPermission(module === 'deals' ? 'deals.edit' : module === 'accounts' ? 'accounts.edit' : 'contacts.edit');
  const hasArchivePermission = useHasPermission(module === 'deals' ? 'deals.delete' : module === 'accounts' ? 'accounts.delete' : 'contacts.delete');
  const canArchive = hasArchivePermission && !USE_MOCK_DATA;
  const canCreateDeal = useHasPermission('deals.create');
  const canReadDeals = useHasPermission('deals.view');
  const canReadContacts = useHasPermission('contacts.view');
  const canReadAccounts = useHasPermission('accounts.view');
  const [tab, setTab] = useState('activity');
  const [detailsVisited, setDetailsVisited] = useState(false);
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [creatingDeal, setCreatingDeal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lostStage, setLostStage] = useState<string>();
  const [lostReason, setLostReason] = useState('');
  const [taskCount, setTaskCount] = useState<number>();
  const recordQuery = useCachedPage<RecordData>({ module, params: { recordId: id }, revalidateOnInvalidation: true,
    fetchFn: async signal => (await apiClient.get<{ data: RecordData }>(`/crm/${module}/${encodeURIComponent(id)}`, { signal })).data });
  // Contacts' timeline is already included in this endpoint; avoid a second read.
  const relatedQuery = useCachedPage<Relationships>({ module, params: { recordId: id, relationships: true }, revalidateOnInvalidation: true,
    disabled: module === 'deals' || USE_MOCK_DATA || (!detailsVisited && module !== 'contacts') || !recordQuery.data || !!recordQuery.error,
    fetchFn: async signal => (await apiClient.get<{ data: Relationships }>(`/crm/${module}/${encodeURIComponent(id)}/relationships?limit=50`, { signal })).data });
  const timeline = useRecordActivities(module, id, !!recordQuery.data && !recordQuery.error || USE_MOCK_DATA, module === 'contacts' ? relatedQuery.data?.activities ?? [] : undefined);
  const mockRecords = module === 'deals' ? data.deals : module === 'accounts' ? data.organizations : data.contacts;
  const mockRecord = USE_MOCK_DATA ? mockRecords.find(item => item.id === id && item.tenantId === tenant?.id && ((item as unknown as RecordData).environment ?? 'SANDBOX') === (user?.activeEnvironment ?? 'SANDBOX')) : undefined;
  const record = USE_MOCK_DATA ? mockRecord as unknown as RecordData : recordQuery.data;
  const relationships = relatedQuery.data;
  const label = labels[module];
  const refresh = () => { void recordQuery.refetch(); if (module !== 'deals') void relatedQuery.refetch(); void timeline.refetch(); };
  const edit = () => {
    // Contact's canonical API fields differ from Lead's form fields. Keep its
    // save adapter here for both surfaces instead of the list's legacy handler.
    if (record && onEdit && module !== 'contacts') onEdit({ ...record, leadSource: record.source, productInterests: record.productInterest ?? record.productInterests });
    else setEditing(true);
  };
  const save = async (payload: RecordData) => {
    if (saving) return;
    setSaving(true);
    try {
      if (USE_MOCK_DATA) {
        if (module === 'accounts') await data.updateOrganization(id, payload);
        else if (module === 'deals') await data.updateDeal(id, payload);
        else await data.updateContact(id, payload);
      } else await apiClient.put(`/crm/${module}/${encodeURIComponent(id)}`, payload);
      setEditing(false);
      refresh();
      toast.success(`${label} updated`);
    } catch (error) { toast.error(error instanceof Error ? error.message : `Failed to update ${label.toLowerCase()}`); }
    finally { setSaving(false); }
  };

  if (recordQuery.isInitialLoad) return <div role="status" aria-label={`Loading ${label.toLowerCase()}`} className="relative space-y-4 p-4 animate-pulse">{onClose && <Button variant="ghost" size="icon" className="absolute right-3 top-3" onClick={onClose} aria-label="Close record" title="Close record"><X size={16} /></Button>}<div className="h-12 w-12 rounded-xl bg-muted" /><div className="h-5 w-2/3 rounded bg-muted" /><div className="h-9 rounded-xl bg-muted" /><div className="h-44 rounded-xl bg-muted" /></div>;
  if (recordQuery.error || !record) return <div className="space-y-4 p-5"><h2 className="font-semibold">Unable to open {label.toLowerCase()}</h2><p role="alert" className="text-sm text-muted-foreground">{recordQuery.error || 'Record not found or access is unavailable.'}</p><Button variant="outline" onClick={() => void recordQuery.refetch()}>Retry</Button>{onClose && <Button variant="ghost" onClick={onClose}>Close</Button>}</div>;

  const title = module === 'deals' ? text(record.title) : module === 'accounts' ? text(record.name) : personName(record);
  const person = module === 'deals' ? object((record.leadDeals as RecordData[] | undefined)?.[0]?.lead) ?? object((record.contactDeals as RecordData[] | undefined)?.[0]?.contact) : record;
  const source = (module === 'deals' ? (record.productInterests as string[] | undefined)?.join(', ') : '') || text(record.source) || text(record.leadSource);
  const owner = personName(object(record.assignedUser)) || personName(object(record.owner));
  const company = text(object(record.organization)?.name) || text(person?.companyName) || text(person?.company) || text(record.companyName) || text(record.company) || text(object(record.account)?.name);
  const location = [text(record.address), text(record.city), text(record.province), text(record.country)].filter(Boolean).join(', ');
  const subtitle = module === 'deals' ? `₱${Number(record.value ?? 0).toLocaleString()} · ${text(object(record.pipeline)?.name)}` : module === 'accounts' ? text(record.industry) || text(record.website) : company || text(record.jobTitle) || location;
  const status = text(module === 'deals' ? object(record.stage)?.name : module === 'accounts' ? record.customerType : record.status);
  const statusLabel = status === status.toUpperCase() ? status.charAt(0) + status.slice(1).toLowerCase() : status;
  const dealStages = data.pipelines.find(p => p.id === record.pipelineId)?.stages ?? [];
  const changeStage = async (stageId: string, reason?: string) => {
    setSaving(true);
    try { await data.moveDealStage(id, stageId, undefined, reason); setLostStage(undefined); refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to move Deal'); }
    finally { setSaving(false); }
  };
  const statuses = module === 'accounts' ? DEFAULT_ACCOUNT_STATUSES.map(item => item.label) : module === 'leads' ? DEFAULT_LEAD_STATUSES.map(item => item.label) : ['Hot', 'Warm', 'Cold', 'Cancelled', 'Closed'];
  const rows: [string, unknown][] = [
    ...(module === 'accounts' ? [['Account name', record.name], ['Industry', record.industry], ['Company size', record.size]] as [string, unknown][] : []),
    ...(module === 'deals' ? [['Deal title', title], ['Deal value', subtitle.split(' · ')[0]], ['Priority', record.priority], ['Associated Lead / Contact', personName(person)], ['Created', record.createdAt ? new Date(String(record.createdAt)).toLocaleDateString() : '']] as [string, unknown][] : []),
    ['Email', person?.email], ['Phone', person?.phone], ['Address', location], ['Company', module !== 'accounts' ? company : undefined], ['Job title', record.jobTitle], ['Website', record.website],
    ['Product interests', record.productInterest ?? record.productInterests], ['Source', module === 'deals' ? record.leadSource : source], ['Status', statusLabel], ['Owner / Representative', owner], ['Notes', record.notes ?? record.description],
  ];
  const customFields = object(record.customFields);
  const deals = relationships?.deals ?? [];
  const links = module === 'deals' ? { dealId: id } : module === 'leads' ? { leadId: id } : module === 'contacts' ? { contactId: id } : { accountId: id };
  const activityLoading = module === 'contacts' ? relatedQuery.isInitialLoad : timeline.isInitialLoad;
  const activityError = module === 'contacts' ? relatedQuery.error : timeline.error;
  const formRecord = { ...record, companyName: company, leadSource: source, organizationId: record.accountId, productInterests: record.productInterest ?? record.productInterests, status: statusLabel };
  const website = text(record.website);
  const websiteHref = website && !/^[a-z][a-z0-9+.-]*:/i.test(website) ? `https://${website}` : /^https?:\/\//i.test(website) ? website : undefined;

  return <div className="flex h-full min-h-0 min-w-0 flex-col bg-background [--panel-gutter:1rem]">
    <Tabs defaultValue="activity" value={tab} onValueChange={value => { setTab(value); if (value === 'details') setDetailsVisited(true); }} className="flex min-h-0 flex-1 flex-col">
      <header className="@container max-h-[60dvh] shrink-0 overflow-y-auto border-b border-border bg-card p-4">
        <div className={cn('mx-auto min-w-0', !onClose && 'max-w-4xl')}>
        {!onClose && <nav aria-label="Breadcrumb" className="mb-4 flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground"><span>CRM</span><ChevronRight size={12} /><Link className="hover:text-[var(--primary)]" href={`/crm/${module}`}>{label}s</Link><ChevronRight size={12} /><span className="min-w-0 [overflow-wrap:anywhere]" aria-current="page">{title}</span></nav>}
        <div className="relative flex min-w-0 flex-wrap items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)]">{module === 'accounts' ? <Building size={20} /> : module === 'deals' ? title.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() : `${text(record.firstName)[0] || ''}${text(record.lastName)[0] || ''}`}</div>
          <div className="min-w-0 flex-1 basis-[calc(100%-64px)] pr-9 @min-[400px]:basis-0 @min-[400px]:pr-0">
            <div className="mb-1 flex flex-wrap gap-1"><span className="rounded bg-[var(--primary)]/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-[var(--primary)]">{label.toUpperCase()}</span>{source && <span className="max-w-full rounded border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground [overflow-wrap:anywhere]">{source}</span>}</div>
            <h1 className="text-lg font-semibold leading-tight tracking-tight [overflow-wrap:anywhere]">{title}</h1>
            {subtitle && <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{subtitle}</p>}
            {onClose && <Link href={`/crm/${module}/${encodeURIComponent(id)}`} className="mt-1 inline-flex min-h-8 items-center gap-1 text-xs font-medium text-[var(--primary)]">Open full page <ExternalLink size={11} /></Link>}
          </div>
          <div className="ml-[52px] flex max-w-[calc(100%-52px)] items-center gap-1 @min-[400px]:ml-0 @min-[400px]:pr-9">
            {status && (canEdit ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={saving} className={cn('min-h-9 max-w-full gap-1 rounded-lg text-xs', getCRMStatusStyles(statusLabel))}>{statusLabel}<ChevronDown size={12} /></Button></DropdownMenuTrigger><DropdownMenuContent>{module === 'deals' ? dealStages.map(stage => <DropdownMenuItem key={stage.id} onSelect={() => { if (stage.id === record.stageId) return; if (stage.isLost) { setLostReason(''); setLostStage(stage.id); } else void changeStage(stage.id); }}>{stage.name}</DropdownMenuItem>) : statuses.map(option => <DropdownMenuItem key={option} onSelect={() => void save({ [module === 'accounts' ? 'customerType' : 'status']: module === 'contacts' ? option.toUpperCase() : option })}>{option}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu> : <span className={cn('rounded-lg px-2 py-1 text-xs', getCRMStatusStyles(statusLabel))}>{statusLabel}</span>)}
            {onClose && <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-9 w-9" onClick={onClose} aria-label="Close record" title="Close record"><X size={16} /></Button>}
          </div>
        </div>
        <RecordQuickInfo items={[
          { value: text(person?.email), icon: Mail, href: person?.email ? `mailto:${text(person.email)}` : undefined },
          { value: text(person?.phone), icon: Phone, href: person?.phone ? `tel:${text(person.phone)}` : undefined },
          ...(module === 'deals' ? [{ value: personName(person), icon: User }, { value: company, icon: Building }] : []),
          { value: owner, icon: User, label: 'Rep: ' },
          ...(module === 'accounts' ? [{ value: website, icon: Globe, href: websiteHref }] : []),
          { value: location, icon: MapPin },
        ]} actions={(canEdit || canArchive) && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9" aria-label="Record actions" title="Record actions"><MoreHorizontal size={16} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
          {canEdit && <DropdownMenuItem onSelect={edit}><Pencil size={14} />Edit {label.toLowerCase()}</DropdownMenuItem>}
          {canEdit && !USE_MOCK_DATA && module === 'leads' && !record.contactId && <DropdownMenuItem onSelect={() => setConverting(true)}><UserPlus size={14} />Convert to contact</DropdownMenuItem>}
          {canArchive && <DropdownMenuItem onSelect={() => setArchiving(true)}><Archive size={14} />Archive {label.toLowerCase()}</DropdownMenuItem>}
        </DropdownMenuContent></DropdownMenu>} />
        <div className="mt-4" onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
          const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
          if (current < 0) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          tabs[next].focus(); tabs[next].click();
        }}><TabsList className="grid w-full grid-cols-3 gap-1 overflow-visible bg-muted/70">
          <TabsTrigger value="activity" badge={!activityLoading && !activityError && timeline.activities.length < (module === 'contacts' ? 50 : 100) ? timeline.activities.length : undefined} className="min-w-0 px-1 py-2 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm [&>span]:justify-center [&>span]:gap-1">Activity</TabsTrigger>
          <TabsTrigger value="details" badge={rows.filter(([, value]) => present(value)).length} className="min-w-0 px-1 py-2 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm [&>span]:justify-center [&>span]:gap-1">Details</TabsTrigger>
          <TabsTrigger value="files" className="min-w-0 px-1 py-2 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm [&>span]:justify-center">Files</TabsTrigger>
        </TabsList></div>
        </div>
      </header>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-muted/20">
        <div className={cn('mx-auto w-full min-w-0', !onClose && 'max-w-4xl')}>
          <TabsContent value="activity" forceMount className="m-0"><RecordTimelineTab compact activities={timeline.activities} module={module} recordId={id} loading={activityLoading} error={activityError} onActivityCreated={refresh} /></TabsContent>
          <TabsContent value="details" forceMount className="m-0 p-4"><div className="space-y-3">
            <RecordSection title="About" actions={canEdit && <Button variant="ghost" size="icon" className="h-9 w-9 text-[var(--primary)]" onClick={edit} aria-label="Edit record details" title="Edit record details"><Pencil size={15} /></Button>}><RecordRows rows={rows} /></RecordSection>
            {detailsVisited && module !== 'accounts' && <RecordSection title="Tasks" count={taskCount}><RelatedTasks links={links} onCountChange={setTaskCount} /></RecordSection>}
            {detailsVisited && relatedQuery.isInitialLoad && <p role="status" className="animate-pulse p-3 text-sm text-muted-foreground">Loading related records…</p>}
            {relatedQuery.error && <div role="alert" className="rounded-xl border border-border p-3 text-sm"><p>{relatedQuery.error}</p><Button variant="ghost" size="sm" onClick={() => void relatedQuery.refetch()}>Retry related records</Button></div>}
            {module === 'deals' && <RecordSection title="Associations">{canReadContacts && <><RelatedRecords records={(record.leadDeals as RecordData[] | undefined)?.map(link => object(link.lead)!).filter(Boolean) ?? []} module="leads" empty="No originating Lead." /><RelatedRecords records={(record.contactDeals as RecordData[] | undefined)?.map(link => object(link.contact)!).filter(Boolean) ?? []} module="contacts" empty="No Contact linked yet." /></>}{canReadAccounts && record.organization != null && <RelatedRecords records={[object(record.organization)!]} module="accounts" empty="" />}</RecordSection>}
            {relationships && <>
              {module === 'accounts' && canReadContacts && <RecordSection title="Contacts" count={(relationships.contacts?.length ?? 0) < 50 ? relationships.contacts?.length : undefined}><RelatedRecords records={relationships.contacts ?? []} module="contacts" empty="No contacts linked to this account." /></RecordSection>}
              {module !== 'deals' && canReadDeals && <RecordSection title="Deals" count={deals.length < 50 ? deals.length : undefined} actions={canCreateDeal && !USE_MOCK_DATA && <Button variant="ghost" size="sm" className="min-h-9 gap-1 text-xs text-[var(--primary)]" onClick={() => setCreatingDeal(true)}><Plus size={13} />Create deal</Button>}>
                <RelatedRecords records={deals} module="deals" empty={`No deals attached to this ${label.toLowerCase()}.`} />
                {deals.length === 50 && <p className="px-3 pb-3 text-xs text-muted-foreground">Showing the latest 50 linked deals.</p>}
                {creatingDeal && <div className="border-t border-border p-3"><InlineDealForm relatedRecord={{ type: module === 'leads' ? 'lead' : module === 'contacts' ? 'contact' : 'account', id }} onError={error => toast.error(error instanceof Error ? error.message : 'Failed to create deal')} onCancel={() => setCreatingDeal(false)} onSubmit={async values => {
                  await apiClient.post('/crm/deals', { title: values.title, value: values.value, pipelineId: values.pipelineId, stageId: values.stageId, description: values.description, expectedCloseDate: values.expectedCloseDate ? new Date(values.expectedCloseDate).toISOString() : undefined, ...(module === 'leads' ? { leadIds: [id] } : module === 'contacts' ? { contactIds: [id] } : { accountId: id }) });
                  setCreatingDeal(false); void relatedQuery.refetch();
                }} /></div>}
              </RecordSection>}
              {module === 'leads' && canReadContacts && <RecordSection title="Converted contact" count={relationships.contact ? 1 : 0}><RelatedRecords records={relationships.contact ? [relationships.contact] : []} module="contacts" empty="Not yet converted to a contact." /></RecordSection>}
              {module !== 'accounts' && canReadAccounts && <RecordSection title={module === 'leads' ? 'Company / Organization' : 'Account / Company'} count={relationships.account ? 1 : 0}><RelatedRecords records={relationships.account ? [relationships.account] : []} module="accounts" empty="No parent company assigned." /></RecordSection>}
              {module === 'contacts' && relationships.sourceLead && canReadContacts && <RecordSection title="Related leads" count={1}><RelatedRecords records={[relationships.sourceLead]} module="leads" empty="" /></RecordSection>}
            </>}
            {detailsVisited && module === 'accounts' && <RecordSection title="Tasks" count={taskCount}><RelatedTasks links={links} onCountChange={setTaskCount} /></RecordSection>}
            {customFields && Object.keys(customFields).length > 0 && <RecordSection title="Custom fields" count={Object.keys(customFields).length}><RecordRows rows={Object.entries(customFields)} /></RecordSection>}
          </div></TabsContent>
          <TabsContent value="files" className="m-0 p-4"><div className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-12 text-center"><FolderOpen className="mx-auto mb-3 h-9 w-9 rounded-full bg-[var(--primary)]/10 p-2 text-[var(--primary)]" /><p className="text-sm text-muted-foreground">No files attached.</p></div></TabsContent>
        </div>
      </div>
    </Tabs>
    {editing && module === 'leads' && <LeadFormSheet isOpen initialData={formRecord as unknown as Lead} onClose={() => setEditing(false)} onSave={values => void save(values as RecordData)} />}
    {editing && module === 'contacts' && <ContactFormSheet isOpen statusOptions={statuses} initialData={formRecord as unknown as Contact} onClose={() => setEditing(false)} onSave={values => { const { companyName, leadSource, productInterest, ...rest } = values; void save({ ...rest, company: companyName, source: leadSource, productInterests: productInterest, status: text(values.status).toUpperCase() }); }} />}
    {editing && module === 'deals' && <DealFormSheet isOpen mode="edit" initialData={toFrontendDeal(record)} onClose={() => setEditing(false)} onSubmit={async values => { await save(toBackendUpdateDeal(values)); }} />}
    {lostStage && <div role="dialog" aria-modal="true" aria-label="Close Deal as lost" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"><form className="w-full max-w-sm space-y-3 rounded-xl bg-card p-4" onSubmit={e => { e.preventDefault(); void changeStage(lostStage, lostReason); }}><label className="block text-sm">Lost reason<textarea required maxLength={2000} value={lostReason} onChange={e => setLostReason(e.target.value)} className="mt-2 w-full rounded border bg-background p-2" /></label><Button disabled={saving || !lostReason.trim()}>Save</Button><Button type="button" variant="ghost" onClick={() => setLostStage(undefined)}>Cancel</Button></form></div>}
    {editing && module === 'accounts' && <AccountFormSheet isOpen initialData={record as unknown as Account} onClose={() => setEditing(false)} onSave={values => void save(values as RecordData)} />}
    {converting && <ConvertLeadDialog isOpen lead={formRecord as unknown as Lead} onClose={() => setConverting(false)} onSuccess={refresh} />}
    <ConfirmActionDialog open={archiving} onOpenChange={setArchiving} title={`Archive ${label}`} description={`${title} will be moved to Archived Data.`} warning="You can restore this record later from Settings → Archived Data." confirmLabel="Archive" variant="default" onConfirm={async () => {
      try { await apiClient.patch(`/crm/${module}/${encodeURIComponent(id)}/archive`); toast.success(`${label} archived`); setArchiving(false); if (onClose) onClose(); else router.push(`/crm/${module}`); }
      catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to archive record'); }
    }} />
  </div>;
}

export function CrmRecordPanel({ module, id, open, onOpenChange, onEdit }: { module: CrmRecordModule; id?: string; open: boolean; onOpenChange: (open: boolean) => void; onEdit?: (record: RecordData) => void }) {
  const { user } = useAuth();
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent showClose={false} aria-label={`${labels[module]} details`} className="w-full max-w-full sm:max-w-[480px]">
    {open && id && <CrmRecordView key={`${module}:${id}:${user?.id}:${user?.activeEnvironment}`} module={module} id={id} onClose={() => onOpenChange(false)} onEdit={onEdit} />}
  </SheetContent></Sheet>;
}
