'use client';
import { showCrmMutationError } from '@/shared/utils/crm-mutation-error';
import { useCrmTabs } from '@/shared/hooks/use-crm-tabs';
import { useCrmRecordAccess } from '@/shared/hooks/use-crm-record-access';
import { LEAD_SOURCES, formatLeadName, reconcileTableColumns } from '@leadcrm/shared';
import { assignedAgentName } from '@/shared/utils/assigned-agents';

import { LeadCreatedFilter, createdFilterCondition, emptyCreatedFilter, type CreatedFilterDraft } from './lead-created-filter';
import { isCurrentLeadSource } from '@/lib/constants';
import { useConfirmDialog } from '@/shared/hooks/use-confirm-dialog';
import { Button } from '@/shared/components/ui/button';
import { ConfirmActionDialog } from '@/shared/components/crm/confirm-action-dialog';
import { leadsService } from '../services/leads.service';
import { ExportCsvButton } from '@/shared/components/crm/export-csv-button';
import { moduleListParams } from '@/shared/services/module-list-params';
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useData } from '@/store/DataContext';
import { getAssignableAgents } from '@/shared/utils/assigned-agents';
import { useAuth } from '@/store/AuthContext';
import { useLeadsData } from '../hooks/use-leads-data';
import { DataErrorState } from '@/shared/components/crm/data-view-states';
import type { Lead } from '@/store/types';
import { ModuleWorkspace, ViewType, LeadPanel } from '@/shared/components/crm';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { useFilterUrlSync } from '@/shared/hooks/use-filter-url-sync';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { useColumnPreferences } from '@/shared/hooks/use-column-preferences';
import { useTablePreferences } from '@/shared/hooks/use-table-preferences';
import { migrateLocalStorageColumns } from '../services/local-storage-migration';
import { ManageColumnsDrawer } from '@/shared/components/manage-columns-drawer';
import { LeadsDataGrid } from './leads-data-grid';
import { LeadFormSheet } from './lead-form';
import { ConvertLeadDialog } from './convert-lead-dialog';
import { MergeRecordsDialog } from '@/shared/components/crm/merge-records-dialog';
import { EntityCombobox } from '@/shared/components/entity-combobox';
import { SlidingDrawer } from '@/shared/components/sliding-drawer';
import { useRouter } from 'next/navigation';
// @deprecated — ImportLeadsDrawer replaced by full-page import at /crm/leads/import
// import { ImportLeadsDrawer } from './import-leads-drawer';
import { LEADS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';
import { LEADS_MODULE_CONFIG } from '../leads.config';
import { toast } from 'sonner';
import { LeadsPagination } from '@/shared/components/crm/leads-pagination';
import { ActionableEmptyState } from '@/shared/components/actionable-empty-state';
import { Target } from 'lucide-react';

// ── Leads Page ────────────────────────────────────────────────────────────────

export default function LeadsPage(): React.ReactElement {
  const router = useRouter();
  const {
    addContact: addLead,
    updateContact: updateLead,
    users,
  } = useData();
  const { user } = useAuth();
  const isClientAdmin = user?.role === 'Client Admin';
  const tabAccess = useCrmTabs('leads', [{ id: 'all', label: 'All Leads' }, { id: 'my', label: 'My Leads' }, { id: 'active', label: 'Active Leads' }]);
  const { dialogProps, confirm, close } = useConfirmDialog();
  const canCreate = useHasPermission('leads.create');
  const canImport = useHasPermission('leads.import');
  const canEdit = useHasPermission('leads.edit');
  const canDelete = useHasPermission('leads.archive');
  const recordAccess = useCrmRecordAccess();
  const { getParam, getArrayParam, updateParams } = useFilterUrlSync('leads');

  // ── Column Preferences ────────────────────────────────────────────────
  const {
    effectiveColumns,
    isLoading: isColumnsLoading,
    saveColumns,
    resetColumns,
    resetColumnWidths,
    saveColumnWidth,
  } = useColumnPreferences('leads');

  const [isManageColumnsOpen, setIsManageColumnsOpen] = useState(false);
  const columnsTriggerRef = useRef<HTMLElement | null>(null);
  const openManageColumns = () => { columnsTriggerRef.current = document.activeElement as HTMLElement; setIsManageColumnsOpen(true); };

  // ── Table Preferences (pageSize, viewMode, sort) ──────────────────────
  const {
    pageSize,
    viewMode,
    sort,
    setPageSize,
    setViewMode,
    setSort,
    persistFilters,
  } = useTablePreferences('leads');

  // ── Pagination state ──────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);

  // ── One-time localStorage migration (fire-and-forget) ─────────────────
  useEffect(() => {
    migrateLocalStorageColumns();
  }, []);

  // ── State ────────────────────────────────────────────────────────────
  const activeView: ViewType = 'table';
  const tabParam = getParam('tab');
  const unavailableTab = !!tabParam && !tabAccess.tabs.some(tab => tab.id === tabParam);
  const [selectedTab, setActiveTab] = useState(() => tabAccess.tabs.some(tab => tab.id === tabParam) ? tabParam : tabAccess.firstId);
  const activeTab = !unavailableTab && tabAccess.tabs.some(tab => tab.id === selectedTab) ? selectedTab : tabAccess.firstId;
  useEffect(() => {
    if (activeTab !== selectedTab) setActiveTab(activeTab);
  }, [activeTab, selectedTab]);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState(() => getParam('search'));
  const highlightId = getParam('highlight') ?? undefined;
  const [filterSearchTerm, setFilterSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | undefined>();
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [mergingLead, setMergingLead] = useState<Lead | null>(null);
  const [mergeSecondaryId, setMergeSecondaryId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Multi-criteria filter state
  const [selectedSystemFilters, setSelectedSystemFilters] = useState<string[]>(() => getArrayParam('system'));
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => getArrayParam('statuses'));
  const [selectedSources, setSelectedSources] = useState<string[]>(() => getArrayParam('sources').filter(isCurrentLeadSource));
  const [selectedOwners, setSelectedOwners] = useState<string[]>(() => getArrayParam('owners'));
  const [selectedRelated, setSelectedRelated] = useState<string[]>(() => getArrayParam('related'));

  const [createdFilter, setCreatedFilter] = useState<CreatedFilterDraft>(() => ({
    operator: (getParam('createdOperator') || '') as CreatedFilterDraft['operator'],
    from: getParam('createdFrom') || '', to: getParam('createdTo') || '',
  }));
  useEffect(() => { setCurrentPage(1); }, [createdFilter, selectedStatuses, selectedSources, selectedOwners, activeTab]);

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (!highlightId) return;
    setSearchTerm(''); setActiveTab(tabAccess.firstId); setCurrentPage(1);
    setSelectedSystemFilters([]);
    setSelectedStatuses([]);
    setSelectedSources([]);
    setSelectedOwners([]);
    setSelectedRelated([]);
  }, [highlightId, tabAccess.firstId]);

  // ── Server-side data (replaces DataContext contacts array) ────────────
  // useLeadsData owns the fetch, implements stale-while-revalidate, and
  // drives background refresh every 60s + on window focus.
  // Placed after debouncedSearch so the hook param is always defined.

  // Build FilterCondition[] from the filter rail state.
  // Only fields the backend repository handles are included.
  // Every visible filter is applied before server pagination.
  // Tab scope is combined with the rail filters by the backend.
  const serverFilters = useMemo((): import('@leadcrm/shared').FilterCondition[] => {
    const conditions: import('@leadcrm/shared').FilterCondition[] = [];

    if (activeTab === 'my' || activeTab === 'active') conditions.push({ field: 'scope', operator: 'equals', value: activeTab });

    // Status filter
    if (selectedStatuses.length > 0) {
      conditions.push({ field: 'status', operator: 'in', value: selectedStatuses });
    }

    // Source filter — frontend calls it 'leadSource'; backend Prisma field is 'source'
    if (selectedSources.length > 0) {
      conditions.push({ field: 'source', operator: 'in', value: selectedSources });
    }

    // Owner filter
    if (selectedOwners.length > 0) {
      conditions.push({ field: 'assignedUserId', operator: 'in', value: selectedOwners });
    }

    if (selectedRelated.length) conditions.push({ field: 'related', operator: 'in', value: selectedRelated });
    if (selectedSystemFilters.length) conditions.push({ field: 'system', operator: 'in', value: selectedSystemFilters });
    conditions.push(...createdFilterCondition(createdFilter));
    return conditions;
  }, [activeTab, user?.id, selectedStatuses, selectedSources, selectedOwners, createdFilter, selectedRelated, selectedSystemFilters]);

  const {
    leads,
    facets,
    meta: leadsMeta,
    isInitialLoad: isLeadsInitialLoad,
    isRefreshing: isLeadsRefreshing,
    error: leadsError,
    refetch: refetchLeads,
  } = useLeadsData({
    disabled: !tabAccess.firstId,
    page: highlightId ? 1 : currentPage,
    recordId: highlightId,
    pageSize,
    sort: sort ?? null,
    search: debouncedSearch || undefined,
    filter: serverFilters.length > 0 ? serverFilters : undefined,
  });

  useEffect(() => {
    if (leadsError) toast.error(leadsError);
  }, [leadsError]);

  // Total record count from server metadata (falls back to current page
  // length while metadata is still loading on first render)
  const serverTotal = leadsMeta?.total ?? leads.length;
  const showNoMatches = Boolean(debouncedSearch.trim() || serverFilters.length || highlightId || serverTotal > 0);

  // Sync to URL
  useEffect(() => {
    if (highlightId) {
      if (unavailableTab) updateParams({ tab: null });
      return;
    }
    updateParams({
      tab: activeTab !== 'all' ? activeTab : null,
      search: debouncedSearch || null,
      view: null,
      system: selectedSystemFilters,
      statuses: selectedStatuses,
      sources: selectedSources,
      owners: selectedOwners,
      related: selectedRelated,
      createdOperator: createdFilter.operator || null, createdFrom: createdFilter.from || null, createdTo: createdFilter.to || null,
    });
  }, [activeTab, debouncedSearch, activeView, selectedSystemFilters, selectedStatuses, selectedSources, selectedOwners, selectedRelated, createdFilter, highlightId, unavailableTab, updateParams]);

  // -- Persist filter selections (fire-and-forget) ------------------------
  useEffect(() => {
    const conditions: { field: string; operator: string; value: unknown }[] = [];
    if (selectedStatuses.length > 0) {
      conditions.push({ field: 'status', operator: 'in', value: selectedStatuses });
    }
    if (selectedSources.length > 0) {
      conditions.push({ field: 'source', operator: 'in', value: selectedSources });
    }
    if (selectedOwners.length > 0) {
      conditions.push({ field: 'assignedUserId', operator: 'in', value: selectedOwners });
    }
    if (selectedRelated.length > 0) {
      conditions.push({ field: 'related', operator: 'in', value: selectedRelated });
    }
    if (selectedSystemFilters.length > 0) {
      conditions.push({ field: 'system', operator: 'in', value: selectedSystemFilters });
    }
    conditions.push(...createdFilterCondition(createdFilter));
    persistFilters(conditions);
  }, [selectedStatuses, selectedSources, selectedOwners, selectedRelated, selectedSystemFilters, createdFilter, persistFilters]);

  const activeLeads = leads;

  // ── Helpers ──────────────────────────────────────────────────────────
  const getOwnerName = (userId?: string): string => assignedAgentName(users, userId);

  // Reset to page 1 whenever the query params that affect server results change.
  // The hook re-fetches automatically when `currentPage` or other params change.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, activeTab, selectedStatuses, selectedSources, selectedOwners, selectedRelated, selectedSystemFilters, createdFilter, pageSize, sort]);
  useEffect(() => {
    if (leadsMeta && currentPage > Math.max(1, Math.ceil(leadsMeta.total / pageSize))) setCurrentPage(Math.max(1, Math.ceil(leadsMeta.total / pageSize)));
  }, [leadsMeta, currentPage, pageSize]);

  // ── Helpers ──────────────────────────────────────────────────────────
  const getOwnerInitials = (userId?: string): string => {
    if (!userId) return '?';
    const u = users.find((usr) => usr.id === userId);
    if (!u) return '?';
    return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase();
  };

  // ── Filter groups for the rail ───────────────────────────────────────
  const statusCounts = useMemo(() => Object.fromEntries(['Inquiry','Hot','Warm','Cold','Closed Deal','Cancelled'].map(status => [status, facets?.['status:' + status] ?? 0])), [facets]);
  const touchedCount = facets?.touched ?? 0, untouchedCount = facets?.untouched ?? 0;
  const distinctSources = LEAD_SOURCES;

  const filterGroups = useMemo(() => [
    {
      id: 'system',
      label: 'System Defined Filters',
      isExpanded: true,
      items: [
        { id: 'touched', label: 'Updated Records', count: touchedCount, isChecked: selectedSystemFilters.includes('touched') },
        { id: 'untouched', label: 'Never Updated', count: untouchedCount, isChecked: selectedSystemFilters.includes('untouched') },
      ],
    },
    {
      id: 'fields',
      label: 'Filter By Fields',
      isExpanded: true,
      items: [
        ...Object.entries(statusCounts).map(([status, count]) => ({
          id: `status:${status}`,
          label: `Status: ${status}`,
          count,
          isChecked: selectedStatuses.includes(status),
        })),
        ...distinctSources.map((source) => ({
          id: `source:${source}`,
          label: `Source: ${source}`,
          count: facets?.['source:' + source] ?? 0,
          isChecked: selectedSources.includes(source),
        })),
        ...getAssignableAgents(users, ['leads']).map((u) => ({
          id: `owner:${u.id}`,
          label: `Assigned Agent: ${u.firstName} ${u.lastName}`,
          count: facets?.['owner:' + u.id] ?? 0,
          isChecked: selectedOwners.includes(u.id),
        })),
      ],
    },
    {
      id: 'related',
      label: 'Filter By Related Modules',
      isExpanded: true,
      items: [
        { id: 'has_email', label: 'Leads with Email', count: facets?.has_email ?? 0, isChecked: selectedRelated.includes('has_email') },
        { id: 'has_phone', label: 'Leads with Phone', count: facets?.has_phone ?? 0, isChecked: selectedRelated.includes('has_phone') },
      ],
    },
  ], [touchedCount, untouchedCount, selectedSystemFilters, statusCounts, selectedStatuses, distinctSources, facets, selectedSources, users, selectedOwners, selectedRelated]);

  const handleFilterToggle = useCallback((groupId: string, itemId: string) => {
    if (groupId === 'system') {
      setSelectedSystemFilters((prev) =>
        prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId],
      );
    } else if (groupId === 'fields') {
      if (itemId.startsWith('status:')) {
        const status = itemId.replace('status:', '');
        setSelectedStatuses((prev) =>
          prev.includes(status) ? prev.filter((x) => x !== status) : [...prev, status],
        );
      } else if (itemId.startsWith('source:')) {
        const source = itemId.replace('source:', '');
        setSelectedSources((prev) =>
          prev.includes(source) ? prev.filter((x) => x !== source) : [...prev, source],
        );
      } else if (itemId.startsWith('owner:')) {
        const ownerId = itemId.replace('owner:', '');
        setSelectedOwners((prev) =>
          prev.includes(ownerId) ? prev.filter((x) => x !== ownerId) : [...prev, ownerId],
        );
      }
    } else if (groupId === 'related') {
      setSelectedRelated((prev) =>
        prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId],
      );
    }
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleCreate = useCallback(() => {
    setEditingLead(undefined);
    setIsFormOpen(true);
  }, []);

  const handleRowClick = useCallback((lead: Lead) => {
    setSelectedLead(lead);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────
  const confirmArchive = (ids: string[], name: string) => confirm({
    title: 'Archive Lead' + (ids.length > 1 ? 's?' : '?'),
    description: `${name} will be removed from active Leads and moved to Archived Data. You can restore this record later.`,
    confirmLabel: 'Archive',
    variant: 'destructive',
    onConfirm: async () => {
      const results = await Promise.allSettled(ids.map(id => leadsService.archive(id)));
      const failedIds = ids.filter((_, index) => results[index].status === 'rejected');
      setSelectedIds(previous => new Set([...previous].filter(id => failedIds.includes(id))));
      if (failedIds.length) {
        confirmArchive(failedIds, ids.length === 1 ? name : `${failedIds.length} lead${failedIds.length === 1 ? '' : 's'}`);
        const failure = results.find(result => result.status === 'rejected');
        throw new Error(failure?.status === 'rejected' && failure.reason instanceof Error ? failure.reason.message : 'Unable to archive the remaining records. Please try again.');
      }
      close();
      toast.success('Lead archived');
    },
  });

  React.useLayoutEffect(() => { setSelectedLead(null); setEditingLead(undefined); setSelectedIds(new Set()); }, [tabAccess.firstId]);

  if (!tabAccess.firstId) return <p role="alert" className="p-4">You do not have permission to access this module.</p>;

  return (
    <>
      <ConfirmActionDialog {...dialogProps} />
      <ModuleWorkspace
        exportAction={<ExportCsvButton module="leads" params={moduleListParams({ search: debouncedSearch, filter: serverFilters, sort })} />}
        moduleId="leads"
        title="Leads"
        description="Manage and track potential customers and sales opportunities."
        moduleConfig={LEADS_MODULE_CONFIG}
        primaryActionLabel="Create Lead"
        onPrimaryAction={handleCreate}
        onImport={canImport ? () => router.push('/crm/leads/import') : undefined}
        canCreate={canCreate}
        availableViews={['table']}
        activeView={'table' as ViewType}
        onViewChange={() => {}}
        savedTabs={tabAccess.tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        filterContent={<LeadCreatedFilter value={createdFilter} onChange={setCreatedFilter} />}
        onClearFilters={() => { setCreatedFilter(emptyCreatedFilter); setSelectedStatuses([]); setSelectedSources([]); setSelectedOwners([]); setSelectedRelated([]); setSelectedSystemFilters([]); setActiveTab(tabAccess.firstId); setSearchTerm(''); setCurrentPage(1); }}
        filterGroups={filterGroups}
        onFilterToggle={handleFilterToggle}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        filterSearchTerm={filterSearchTerm}
        onFilterSearch={setFilterSearchTerm}
        totalRecords={serverTotal}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        searchPlaceholder="Search leads..."
        pageSize={pageSize}
        sort={sort}
        onSortChange={next => { setSort(next); setCurrentPage(1); }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={refetchLeads}
        refreshDisabled={isLeadsInitialLoad || isLeadsRefreshing}
        refreshing={isLeadsRefreshing}
        loading={(isLeadsInitialLoad || isColumnsLoading)}
        loadingLabel={isLeadsInitialLoad ? 'Loading leads...' : 'Loading columns...'}
        onManageColumns={openManageColumns}
        onResetColumns={resetColumnWidths}
        bulkSelection={
          selectedIds.size > 0
            ? {
                count: selectedIds.size,
                onClear: () => setSelectedIds(new Set()),
                actions: (
                  canDelete && (
                    <Button variant="outline" disabled={[...selectedIds].some(id => !recordAccess.canMutate(leads.find(record => record.id === id)))}
                      onClick={() => confirmArchive([...selectedIds], `${selectedIds.size} leads`)}
                    >
                      Archive
                    </Button>
                  )
                ),
              }
            : undefined
        }
      >
        {highlightId && <div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-500">
          <span>Showing selected search result</span>
          <button className="text-blue-600 underline" onClick={() => updateParams({ highlight: null, search: null })}>Show all records</button>
        </div>}
        {/* ── List View ─────────────────────────────────────────── */}
        {/* Error state: only show when there's no data at all to display */}
        {leadsError && !isLeadsInitialLoad && leads.length === 0 && (
          <DataErrorState
            message={leadsError}
            onRetry={refetchLeads}
          />
        )}

        {!isLeadsInitialLoad && !isColumnsLoading && !leadsError && leads.length === 0 && (
          <ActionableEmptyState
            icon={Target}
            title={showNoMatches ? 'No matching records' : 'No leads yet'}
            description={showNoMatches
              ? 'Try a different search term or clear your filters.'
              : 'Add your first lead to start tracking potential customers.'}
            actionLabel={!showNoMatches && canCreate ? 'Add Lead' : undefined}
            onAction={!showNoMatches && canCreate ? handleCreate : undefined}
          />
        )}

        {leads.length > 0 && (
          <LeadsDataGrid
            sort={sort}
            onSortChange={next => { setSort(next); setCurrentPage(1); }}
            leads={leads}
            totalRecords={serverTotal}
            effectiveColumns={effectiveColumns}
            onRowClick={handleRowClick}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            getOwnerName={getOwnerName}
            getOwnerInitials={getOwnerInitials}
            canEdit={canEdit}
            canArchive={canDelete}
            onEdit={(lead) => { setEditingLead(lead); setIsFormOpen(true); }}
            onArchive={(lead) => confirmArchive([lead.id], formatLeadName(lead))}
            onConvert={(lead) => setConvertingLead(lead)}
            onMerge={canEdit && canDelete ? (lead) => setMergingLead(lead) : undefined}
            onHideColumn={async (columnId) => {
              const updated = reconcileTableColumns('leads', effectiveColumns, LEADS_COLUMN_REGISTRY).map((col) =>
                col.id === columnId ? { ...col, visible: false } : col,
              );
              try {
                await saveColumns(updated);
                toast.success('Column hidden');
              } catch {
                toast.error('Failed to hide column. Reverted.');
              }
            }}
            onColumnWidthChange={(id, width) => { void saveColumnWidth(id, width).catch(() => toast.error('Unable to save column width. Please try again.')); }}
            highlightRowId={highlightId}
            viewMode={viewMode}          />
        )}

        {/* ── Bottom Pagination + Per Page ─────────────────────── */}
        {!isColumnsLoading && !isLeadsInitialLoad && leads.length > 0 && serverTotal > 0 && (
          <LeadsPagination currentPage={currentPage} totalRecords={serverTotal} pageSize={pageSize}
            onPageChange={setCurrentPage} onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
            refreshing={isLeadsRefreshing} />
        )}

      </ModuleWorkspace>

      {/* ── Slide-Over Record Panel ─────────────────────────────────── */}
      <LeadPanel
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
        lead={selectedLead}
        onEdit={(lead) => {
          setEditingLead(lead);
          setIsFormOpen(true);
        }}
      />

      {/* ── Form Sheet ──────────────────────────────────────────── */}
      <LeadFormSheet
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingLead(undefined); }}
        initialData={editingLead}
        onSave={async (data) => {
          try {
            if (editingLead) {
              await updateLead(editingLead.id, data);
              toast.success('Lead updated');
            } else {
              await addLead(data as any);
              toast.success('Lead created');
            }
            setIsFormOpen(false);
            setEditingLead(undefined);
          } catch (err: unknown) {
            showCrmMutationError(err, 'Failed to save lead');
            throw err;
          }
        }}
      />

      {/* ── Import Leads — now a full-page experience at /crm/leads/import ─── */}

      {/* ── Convert Lead Dialog ─────────────────────────────────── */}
      {convertingLead && (
        <ConvertLeadDialog
          isOpen={!!convertingLead}
          onClose={() => setConvertingLead(null)}
          lead={convertingLead}
          onSuccess={() => setConvertingLead(null)}
        />
      )}

      {/* ── Merge Lead: Step 1 — Pick secondary record ───────────── */}
      {mergingLead && !mergeSecondaryId && (
        <SlidingDrawer
          isOpen={true}
          onClose={() => setMergingLead(null)}
          title="Merge Lead"
          subtitle={`Select a record to merge with ${mergingLead.firstName} ${mergingLead.lastName}`}
        >
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Select the duplicate lead to merge into the primary record.
            </p>
            <EntityCombobox
              entityType="leads"
              value={null}
              onChange={(id) => { if (id === mergingLead.id) { toast.error('Choose a different Lead to merge.'); return; } if (id) setMergeSecondaryId(id); }}
              placeholder="Search for the duplicate lead..."
            />
          </div>
        </SlidingDrawer>
      )}

      {/* ── Merge Lead: Step 2 — Full comparison ─────────────────── */}
      {mergingLead && mergeSecondaryId && (
        <MergeRecordsDialog
          isOpen={true}
          onClose={() => { setMergingLead(null); setMergeSecondaryId(null); }}
          entityType="lead"
          primaryId={mergingLead.id}
          secondaryId={mergeSecondaryId}
          onSuccess={() => { setMergingLead(null); setMergeSecondaryId(null); void refetchLeads(); }}
        />
      )}

      {/* ── Manage Columns Drawer ───────────────────────────────── */}
      <ManageColumnsDrawer
        isOpen={isManageColumnsOpen}
        onClose={() => setIsManageColumnsOpen(false)}
        module="leads"
        registry={LEADS_COLUMN_REGISTRY}
        triggerRef={columnsTriggerRef}
        effectiveColumns={effectiveColumns}
        onSave={saveColumns}
        onReset={resetColumns}
      />
    </>
  );
}
