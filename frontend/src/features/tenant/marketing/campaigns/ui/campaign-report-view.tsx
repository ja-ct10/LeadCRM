'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Filter, Link2, Mail, Send, Target, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { CampaignClickedLink, CampaignRecipient } from '@leadcrm/shared';
import type { Campaign } from '@/store/types';
import { campaignsApi, type CampaignReportResponse } from '@/shared/services/campaigns.api';
import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { RecordBackButton } from '@/shared/components/crm/record-back-button';
import { ModuleTableToolbar } from '@/shared/components/crm/module-table-toolbar';
import { AvatarCell } from '@/shared/components/crm/avatar-cell';
import { DataLoadingSkeleton } from '@/shared/components/crm/data-view-states';
import { DataGrid, type DataGridColumnDef } from '@/shared/components/data-grid';
import { formatDateTime } from '@/shared/components/data-grid/cell-renderers';
import { CampaignStatusBadge, formatCampaignStatus } from './campaign-status-badge';

const recipientFilters = ['All recipients', 'Delivered', 'Bounced', 'Opened', 'Clicked', 'Submitted', 'Sent', 'Failed', 'Pending'] as const;
type RecipientFilter = typeof recipientFilters[number];
const engagement = (value: boolean, label: string) => <span aria-label={value ? label : `Not ${label.toLowerCase()}`}>
  {value ? <Check size={16} className="text-emerald-600" aria-hidden="true" /> : <span className="text-slate-400" aria-hidden="true">—</span>}
</span>;
const recipientColumns: DataGridColumnDef<CampaignRecipient>[] = [
  { id: 'recipient', header: 'Recipient', accessor: row => row.name, width: 220,
    cell: (_, row) => <AvatarCell name={row.name} initials={row.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('')} /> },
  { id: 'email', header: 'Email', accessor: row => row.email || '—', width: 240 },
  { id: 'delivery', header: 'Delivery Status', accessor: row => row.deliveryStatus, width: 150,
    cell: (_, row) => <Badge variant={row.deliveryStatus === 'Delivered' ? 'success' : ['Bounced', 'Failed'].includes(row.deliveryStatus) ? 'destructive' : 'secondary'} title={row.failureReason ?? undefined}>{row.deliveryStatus}</Badge> },
  { id: 'opened', header: 'Opened', accessor: row => row.opened, width: 90, cell: (_, row) => engagement(row.opened, 'Opened') },
  { id: 'clicked', header: 'Clicked', accessor: row => row.clicked, width: 90, cell: (_, row) => engagement(row.clicked, 'Clicked') },
  { id: 'activity', header: 'Last Activity', accessor: row => formatDateTime(row.lastActivity), width: 220 },
  { id: 'actions', header: 'Actions', accessor: () => '', width: 80, cell: (_, row) => <Button variant="ghost" size="icon" disabled={!row.email}
    aria-label={`Copy email for ${row.name}`} title="Copy email" onClick={async () => {
      try { await navigator.clipboard.writeText(row.email || ''); toast.success('Email copied.'); }
      catch { toast.error('Unable to copy email.'); }
    }}><Copy size={14} /></Button> },
];
const linkColumns: DataGridColumnDef<CampaignClickedLink>[] = [
  { id: 'url', header: 'Link', accessor: row => row.url, width: 380, cell: (_, row) =>
    <a href={/^https?:\/\//i.test(row.url) ? row.url : undefined} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 text-blue-600 hover:underline">
      <Link2 size={16} className="shrink-0" aria-hidden="true" /><span className="truncate">{row.url}</span>
    </a> },
  { id: 'total', header: 'Total Clicks', accessor: row => row.totalClicks, width: 130 },
  { id: 'rate', header: 'Click Rate', accessor: row => `${Math.round(row.clickRate)}%`, width: 110 },
  { id: 'last', header: 'Last Clicked', accessor: row => formatDateTime(row.lastClicked), width: 220 },
];

export function CampaignReportView({ campaign, onBack }: { campaign: Campaign; onBack: () => void }) {
  const [report, setReport] = useState<CampaignReportResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RecipientFilter>('All recipients');
  const request = useRef(0);
  const inFlight = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);
  const fetchReport = useCallback(async (background = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const sequence = ++request.current;
    const controller = new AbortController();
    activeRequest.current = controller;
    if (!background) setLoading(true);
    setError('');
    try {
      const result = await campaignsApi.report(campaign.id, controller.signal);
      if (sequence === request.current) setReport(result.data);
    } catch (failure) {
      if (sequence === request.current) setError(failure instanceof Error ? failure.message : 'Unable to load campaign report. Please try again.');
    } finally {
      if (sequence === request.current) { inFlight.current = false; setLoading(false); }
    }
  }, [campaign.id]);
  useEffect(() => {
    setReport(null); setSearch(''); setFilter('All recipients');
    inFlight.current = false;
    void fetchReport();
    const refresh = () => { if (!document.hidden) void fetchReport(true); };
    const interval = setInterval(refresh, 2500);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      request.current++;
      activeRequest.current?.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [fetchReport]);

  const recipients = report?.recipients ?? [];
  const visibleRecipients = useMemo(() => recipients.filter(row => {
    const query = search.trim().toLowerCase();
    return `${row.name} ${row.email || ''} ${row.phone || ''}`.toLowerCase().includes(query) &&
      (filter === 'All recipients' || (filter === 'Opened' ? row.opened : filter === 'Clicked' ? row.clicked : row.deliveryStatus === filter));
  }), [recipients, search, filter]);
  const current = report ?? campaign;
  const status = formatCampaignStatus(current.status);
  const isSms = current.type.toUpperCase() === 'SMS';
  const columns: DataGridColumnDef<CampaignRecipient>[] = isSms ? recipientColumns.filter(c => !['opened', 'clicked'].includes(c.id)).map(c => c.id === 'email' ? { ...c, id: 'phone', header: 'Phone', accessor: row => row.phone || '—' } : c.id === 'actions' ? { ...c, cell: (_, row) => <Button variant="ghost" size="icon" disabled={!row.phone} aria-label={`Copy phone for ${row.name}`} title="Copy phone" onClick={async () => { try { await navigator.clipboard.writeText(row.phone || ''); toast.success('Phone copied.'); } catch { toast.error('Unable to copy phone.'); } }}><Copy size={14} /></Button> } : c) : recipientColumns;
  const filters = isSms ? recipientFilters.filter(f => !['Bounced', 'Opened', 'Clicked'].includes(f)) : recipientFilters;
  const initialLoading = loading && !report;
  const count = report?.recipientCount ?? 0;
  const metrics: { label: string; value: number | string }[] = isSms ? [
    { label: 'Recipients', value: count }, { label: 'Submitted', value: report?.sentCount ?? 0 },
    { label: 'Sent', value: recipients.filter(r => ['Sent', 'Delivered'].includes(r.deliveryStatus)).length },
    { label: 'Delivered', value: report?.deliveredCount ?? 0 },
    { label: 'Failed', value: report?.failedCount ?? 0 },
  ] : [
    { label: 'Recipients', value: count },
    { label: 'Delivered', value: report?.deliveredCount ?? 0 },
    { label: 'Opened', value: report?.openedCount ?? 0 },
    { label: 'Clicked', value: report?.clickedCount ?? 0 },
    { label: 'Bounced', value: report?.bouncedCount ?? 0 },
  ];
  const details = [
    { label: 'Type', value: current.type === 'Sms' ? 'SMS' : current.type, icon: Mail },
    { label: 'Status', value: status, icon: Check },
    { label: 'Target Segment', value: current.targetAudience, icon: Target },
    { label: 'Recipients', value: `${count} recipient${count === 1 ? '' : 's'}`, icon: Users },
    { label: isSms ? 'Submitted' : 'Sent', value: formatDateTime(current.sentAt), icon: Send },
  ];

  return <div className="w-full min-w-0 space-y-6">
    <header className="min-w-0">
      <RecordBackButton label="Campaigns" onClick={onBack} />
      <div className="mb-3 flex flex-wrap gap-2">
        <Badge className="uppercase">{current.type} campaign</Badge>
        <CampaignStatusBadge status={current.status} />
      </div>
      <h1 className="break-words text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{current.name} Report</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Performance overview and recipient activity</p>
    </header>
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-300">
      <span className="min-w-0 flex-1">{error}{report && ' Previously loaded data is shown.'}</span>
      <Button variant="outline" onClick={() => void fetchReport()} disabled={loading}>Retry</Button>
    </div>}
    {(report || initialLoading) && <>
      <section aria-label="Campaign metrics" aria-busy={initialLoading} className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {metrics.map((metric, index) => <Card key={metric.label} className="min-w-0 rounded-lg p-4 shadow-sm">
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">{metric.label}</h2>
          {initialLoading ? <div aria-hidden="true" className="h-8 w-20 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /> :
            <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-2xl font-semibold text-slate-900 dark:text-white">{metric.value.toLocaleString()}</span>
              {index > 0 && typeof metric.value === 'number' && <span className={index === 4 ? 'text-sm text-rose-600' : 'text-sm text-slate-500 dark:text-slate-400'}>{count ? Math.round(metric.value / count * 100) : 0}%</span>}
            </div>}
        </Card>)}
      </section>
      <section aria-labelledby="campaign-details-title">
        <h2 id="campaign-details-title" className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Campaign details</h2>
        <Card className="rounded-lg shadow-none overflow-hidden">
          {initialLoading ? <div aria-hidden="true"><DataLoadingSkeleton rowCount={2} columnCount={3} /></div> :
            <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
              {details.map(({ label, value, icon: Icon }) => <div key={label} className="flex min-w-0 items-start gap-3 border-b border-slate-100 dark:border-slate-800 p-4 xl:border-b-0 xl:border-r last:border-0">
                <span className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-2 text-blue-500"><Icon size={17} aria-hidden="true" /></span>
                <div className="min-w-0"><dt className="text-[10px] uppercase text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 break-words text-xs text-slate-900 dark:text-white">{value || '—'}</dd></div>
              </div>)}
            </dl>}
        </Card>
      </section>
      <section aria-labelledby="recipients-title" className="min-w-0 space-y-3" aria-busy={loading}>
        <div><h2 id="recipients-title" className="text-sm font-semibold text-slate-900 dark:text-white">Recipient performance</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{initialLoading ? 'Recipient activity' : `${visibleRecipients.length} of ${recipients.length} recipients`}</p></div>
        <ModuleTableToolbar label="Recipients" search={search} onSearch={setSearch} placeholder="Search recipients..." refreshing={loading} onRefresh={() => void fetchReport()}
          filter={<DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" aria-label="Filter recipients"><Filter size={13} />{filter === 'All recipients' ? 'Filter' : filter}<ChevronDown size={13} /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" aria-label="Recipient status filters">{filters.map(option => <DropdownMenuItem key={option} role="menuitemradio" aria-checked={filter === option} onSelect={() => setFilter(option)}>{option}{filter === option && <Check size={14} className="ml-auto" />}</DropdownMenuItem>)}</DropdownMenuContent>
          </DropdownMenu>} />
        <DataGrid ariaLabel="Recipient performance table" columns={columns} data={visibleRecipients} getRowId={row => row.id} isLoading={initialLoading} height="auto"
          emptyMessage={recipients.length ? 'No recipients match your search and filter.' : 'No recipients yet.'} />
      </section>
      {!isSms && <section aria-labelledby="top-links-title" className="min-w-0 space-y-3">
        <div><h2 id="top-links-title" className="text-sm font-semibold text-slate-900 dark:text-white">Top links clicked</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Links that generated engagement from this campaign</p></div>
        {initialLoading ? <div aria-hidden="true"><DataLoadingSkeleton rowCount={1} columnCount={4} /></div> : report?.topLinks.length ?
          <DataGrid ariaLabel="Top links clicked table" columns={linkColumns} data={report.topLinks} getRowId={row => row.url} height="auto" /> :
          <Card className="rounded-lg p-4 shadow-none text-xs text-slate-500 dark:text-slate-400">No clicked links recorded for this campaign.</Card>}
      </section>}
    </>}
  </div>;
}
