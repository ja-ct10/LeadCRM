"use client";
import { PageHeader } from '@/shared/components/ui/page-header';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Settings }  from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/store/DataContext';
import { getAssignableAgents } from '@/shared/utils/assigned-agents';
import { useAuth } from '@/store/AuthContext';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import { apiClient } from '@/lib/api/client';
import { USE_MOCK_DATA } from '@/lib/config';
import { toFrontendDeal } from '@/lib/api/adapters/deal.adapter';
import { ModuleFilterRail, type FilterGroup } from '@/shared/components/crm/module-filter-rail';
import { FilterButton } from '@/shared/components/crm/filter-button';
import { RefreshButton } from '@/shared/components/crm/refresh-button';
import { CreateActionDropdown } from '@/shared/components/crm/module-workspace';
import { DealPanel } from '@/shared/components/crm';
import { DealFormSheet } from '@/features/tenant/crm/deals/ui/deal-form';
import { DealLostDialog } from '@/shared/components/crm/deal-lost-dialog';
import { PipelineKanbanBoard } from './pipeline-kanban-board';
import { PipelineStagesDialog } from './pipeline-stages-dialog';
import KanbanBoardSkeleton from '@/shared/components/kanban-skeleton';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import ForecastBar from './forecast-bar';
import { getTenantCurrency } from '@/shared/utils/currency';
import type { Deal } from '@/store/types';

export default function PipelinePage({ navigate }: { navigate?: (path: string) => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pipelines, deals, users, addDeals, moveDealStage, refreshPipelines } = useData();
  const { user, tenant } = useAuth();
  const canManageStages = useHasPermission('deals.manage_stages');
  const canCreate = useHasPermission('deals.create'), canEdit = useHasPermission('deals.edit'), canDelete = useHasPermission('deals.archive');
  const availablePipelines = pipelines.filter(p => !p.isArchived);
  const defaultPipeline = availablePipelines.find(p => p.name.trim().toLowerCase() === 'sales pipeline') ?? availablePipelines[0];
  const pipeline = availablePipelines.find(p => p.id === searchParams.get('pipelineId')) ?? defaultPipeline;
  const selectPipeline = (id: string) => {
    const next = new URLSearchParams(searchParams.toString()); next.set('pipelineId', id);
    router.replace('/crm/deals?' + next.toString(), { scroll: false });
    setFilters(previous => ({ ...previous, stage: [] }));
  };
  const [search, setSearch] = useState(''), [myDeals, setMyDeals] = useState(false);
  const [showFilters, setShowFilters] = useState(false), [filterSearch, setFilterSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [manageStages, setManageStages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshPending = useRef(false);
  const [pipelineError, setPipelineError] = useState('');
  const [selected, setSelected] = useState<Deal | null>(null);
  const [createStage, setCreateStage] = useState<string>();
  const [lost, setLost] = useState<{ id: string; stageId: string }>();
  const query = useCachedPage<Deal[]>({ module: 'deals', params: { pipelineId: pipeline?.id }, disabled: USE_MOCK_DATA || !pipeline,
    revalidateOnInvalidation: true, fetchFn: async signal => {
      const records: Deal[] = [];
      for (let page = 1; ; page++) {
        const response = await apiClient.get<{ data: Record<string, unknown>[]; meta: { hasMore: boolean } }>('/crm/deals', { signal, params: { pipelineId: pipeline!.id, page, limit: 100 } });
        records.push(...response.data.map(toFrontendDeal));
        if (!response.meta.hasMore) break;
      }
      return records;
    } });
  const reloadPipelines = async () => {
    setPipelineError('');
    try { await refreshPipelines(); }
    catch (error) { setPipelineError(error instanceof Error ? error.message : 'Unable to load Sales Pipeline'); }
  };
  useEffect(() => { if (!pipeline) void reloadPipelines(); }, [pipeline?.id]);
  const refresh = async () => {
    if (refreshPending.current || query.isRefreshing || query.isInitialLoad) return;
    refreshPending.current = true; setRefreshing(true);
    try { await Promise.all([query.refetch(), reloadPipelines()]); } finally { refreshPending.current = false; setRefreshing(false); }
  };
  const patch = (deal?: Deal) => {
    if (!deal) { void query.refetch(); return; }
    const rows = query.data ?? [];
    query.setData(deal.isArchived || deal.pipelineId !== pipeline?.id ? rows.filter(d => d.id !== deal.id) : rows.some(d => d.id === deal.id) ? rows.map(d => d.id === deal.id ? deal : d) : [...rows, deal]);
    setSelected(current => current?.id === deal.id ? deal : current);
  };
  const all = (USE_MOCK_DATA ? deals : query.data ?? []).filter(d => d.pipelineId === pipeline?.id && !d.isArchived);
  const stageStatus = (deal: Deal) => { const stage = pipeline?.stages.find(s => s.id === deal.stageId); return stage?.isWon ? 'Won' : stage?.isLost ? 'Lost' : 'Open'; };
  const visible = all.filter(deal => {
    const terms = `${deal.title} ${deal.companyName ?? ''} ${deal.contactPerson ?? ''}`.toLowerCase();
    return (!searchParams.get('accountId') && !searchParams.get('organizationId') || (deal.accountId ?? deal.organizationId) === (searchParams.get('accountId') || searchParams.get('organizationId')))
      && (!searchParams.get('leadId') || deal.leadIds?.includes(searchParams.get('leadId')!) || deal.leadId === searchParams.get('leadId'))
      && (!searchParams.get('contactId') || deal.contactIds?.includes(searchParams.get('contactId')!) || deal.contactId === searchParams.get('contactId'))
      && (!search.trim() || terms.includes(search.trim().toLowerCase())) && (!myDeals || deal.assignedUserId === user?.id)
      && (!filters.stage?.length || filters.stage.includes(deal.stageId))
      && (!filters.owner?.length || filters.owner.includes(deal.assignedUserId || 'unassigned'))
      && (!filters.priority?.length || filters.priority.includes(deal.priority))
      && (!filters.product?.length || deal.productInterests?.some(p => filters.product.includes(p)))
      && (!filters.status?.length || filters.status.includes(stageStatus(deal)))
      && (!filters.created?.length || filters.created.some(days => new Date(deal.createdAt).getTime() >= Date.now() - Number(days) * 86400000));
  });
  const groups: FilterGroup[] = [
    { id: 'stage', label: 'Stage', items: pipeline?.stages.map(s => ({ id: s.id, label: s.name })) ?? [] },
    { id: 'owner', label: 'Assigned Agent', items: [...getAssignableAgents(users).map(u => ({ id: u.id, label: `${u.firstName} ${u.lastName}` })), { id: 'unassigned', label: 'Unassigned' }] },
    { id: 'product', label: 'Product Interest', items: [...new Set(all.flatMap(d => d.productInterests ?? []))].map(name => ({ id: name, label: name })) },
    { id: 'priority', label: 'Priority', items: ['Low', 'Medium', 'High'].map(name => ({ id: name, label: name })) },
    { id: 'status', label: 'Deal Status', items: ['Open', 'Won', 'Lost'].map(name => ({ id: name, label: name })) },
    { id: 'created', label: 'Created Date', items: [{ id: '7', label: 'Last 7 days' }, { id: '30', label: 'Last 30 days' }, { id: '90', label: 'Last 90 days' }] },
  ].map(group => ({ ...group, isExpanded: true, items: group.items.map(item => ({ ...item, isChecked: filters[group.id]?.includes(item.id) })) }));
  const move = async (id: string, stageId: string, reason?: string) => {
    if (pipeline?.stages.find(s => s.id === stageId)?.isLost && !reason) { setLost({ id, stageId }); return; }
    try { const next = await moveDealStage(id, stageId, undefined, reason); patch(next); setLost(undefined); toast.success('Deal stage updated'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to move Deal'); throw error; }
  };
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col p-3 sm:p-6">
    <PageHeader title="Deals" subtitle="Track opportunities throughout your pipelines." actionsInlineWithTitle
      actions={pipeline && <div className="flex items-center gap-2">
        {canManageStages && <TooltipProvider><Tooltip><TooltipTrigger asChild>
          <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Manage pipeline stages"
            title="Manage pipeline stages" disabled={USE_MOCK_DATA} onClick={() => setManageStages(true)}>
            <Settings size={16} aria-hidden="true" />
          </Button>
        </TooltipTrigger><TooltipContent>Manage pipeline stages</TooltipContent></Tooltip></TooltipProvider>}
        {canCreate && <CreateActionDropdown primaryActionLabel="New Deal"
          onPrimaryAction={() => setCreateStage((pipeline.stages.find(s => s.isDefault) ?? pipeline.stages.find(s => s.name.toLowerCase() === 'lead'))?.id ?? pipeline.stages[0]?.id)}
          onImport={() => router.push('/crm/deals/import')} />}
      </div>} />
    <div className="mb-3 flex gap-1 border-b border-border">{['All Deals', 'My Deals'].map((label, i) => <button key={label} onClick={() => setMyDeals(!!i)} className={`min-h-11 px-3 text-sm ${myDeals === !!i ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>{label}</button>)}</div>
    <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2"><label className="flex w-full min-w-0 items-center gap-2 text-xs text-muted-foreground sm:w-auto">Pipeline<select aria-label="Pipeline" value={pipeline?.id ?? ''} onChange={event => selectPipeline(event.target.value)} className="h-9 min-w-0 flex-1 max-w-[min(18rem,calc(100vw-4rem))] rounded-lg border border-border bg-card px-2 text-foreground">{availablePipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="relative min-w-32 flex-1 sm:max-w-64"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input aria-label="Search deals" placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-xs" /></div><FilterButton title="Deals" open={showFilters} onClick={() => setShowFilters(!showFilters)} /><div className="ml-auto"><RefreshButton onClick={() => void refresh()} refreshing={refreshing || query.isRefreshing || query.isInitialLoad} /></div></div>
    <div className="flex min-h-0 min-w-0 flex-1 gap-3">
      <ModuleFilterRail showFilters={showFilters} filterGroups={groups} onToggleFilters={() => setShowFilters(false)} filterSearchTerm={filterSearch} onFilterSearch={setFilterSearch} totalRecords={all.length} onClearFilters={() => setFilters({})} onFilterToggle={(group, item) => setFilters(old => ({ ...old, [group]: old[group]?.includes(item) ? old[group].filter(id => id !== item) : [...(old[group] ?? []), item] }))} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <ForecastBar deals={visible} pipelines={pipeline ? [pipeline] : []} tenant={tenant} />
        {(query.error || pipelineError) && <p role="alert" className="rounded border border-red-200 p-3 text-sm text-red-600">{query.error || pipelineError}</p>}
        {!USE_MOCK_DATA && (query.isInitialLoad && !query.data || !pipeline && !pipelineError) ? <KanbanBoardSkeleton /> : pipeline ? <div className="flex min-h-[440px] min-w-0 flex-1 overflow-hidden"><PipelineKanbanBoard pipeline={pipeline} deals={visible} users={users} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} currencyConfig={getTenantCurrency(tenant)} onDealClick={setSelected} onDealMutated={patch} onDealDragEnd={move} onAddDeal={setCreateStage} onLoadMore={() => {}} loadingStages={new Set()} hasMoreByStage={{}} /></div> : null}
      </div>
    </div>
    {manageStages && pipeline && <PipelineStagesDialog pipelineId={pipeline.id} onClose={() => setManageStages(false)} onChanged={async () => { await refreshPipelines(); await query.refetch(); }} />}
    <DealPanel open={!!selected} deal={selected} onOpenChange={open => { if (!open) { setSelected(null); void query.refetch(); } }} />
    <DealFormSheet isOpen={!!createStage} mode="create" onClose={() => setCreateStage(undefined)} preselect={{ pipelineId: pipeline?.id, stageId: createStage }} onSubmit={async values => { await addDeals(values); setCreateStage(undefined); await query.refetch(); }} />
    {lost && <DealLostDialog onClose={() => setLost(undefined)} onSave={reason => move(lost.id, lost.stageId, reason)} />}

  </div>;
}
