'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { Lead } from '@/store/types';
import { ModuleWorkspace, ViewType, RecordDrawer, StatusBadge } from '@/shared/components/crm';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { useFilterUrlSync } from '@/shared/hooks/use-filter-url-sync';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { useColumnPreferences } from '../hooks/use-column-preferences';
import { migrateLocalStorageColumns } from '../services/local-storage-migration';
import { ManageColumnsDrawer } from './manage-columns-drawer';
import { LeadsListView } from './leads-list-view';
import { LeadFormSheet } from './lead-form';
import { LEADS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';
import { toast } from 'sonner';
import { Edit, Phone, Mail, ListTodo, MoreHorizontal, SlidersHorizontal } from 'lucide-react';
import type { ColumnConfigItem } from '@leadcrm/shared';

// ── Leads Page ────────────────────────────────────────────────────────────────

export default function LeadsPage(): React.ReactElement {
  const {
    contacts: leads,
    addContact: addLead,
    updateContact: updateLead,
    users,
    organizations,
  } = useData();
  const { user } = useAuth();
  const canCreate = useHasPermission('contacts.create');
  const canEdit = useHasPermission('contacts.edit');
  const { getParam, getArrayParam, updateParams } = useFilterUrlSync();

  // ── Column Preferences ────────────────────────────────────────────────
  const {
    effectiveColumns,
    isLoading: isColumnsLoading,
    saveColumns,
    resetColumns,
  } = useColumnPreferences('leads');

  const [isManageColumnsOpen, setIsManageColumnsOpen] = useState(false);
  const manageColumnsButtonRef = useRef<HTMLButtonElement>(null);

  // ── One-time localStorage migration (fire-and-forget) ─────────────────
  useEffect(() => {
    migrateLocalStorageColumns();
  }, []);

  /** Visible columns sorted by order — drives table rendering */
  const visibleColumns = useMemo(() => {
    if (effectiveColumns.length === 0) {
      // Fallback to system default when no preferences loaded yet
      return LEADS_COLUMN_REGISTRY
        .filter((col) => col.defaultVisible)
        .sort((a, b) => a.defaultOrder - b.defaultOrder)
        .map((col) => ({ id: col.id, visible: true, order: col.defaultOrder }));
    }
    return [...effectiveColumns]
      .filter((col) => col.visible)
      .sort((a, b) => a.order - b.order);
  }, [effectiveColumns]);

  // ── State ────────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<ViewType>(() => (getParam('view') as ViewType) || 'list');
  const [activeTab, setActiveTab] = useState(() => getParam('tab') || 'all');
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState(() => getParam('search'));
  const [filterSearchTerm, setFilterSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | undefined>();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerTab, setDrawerTab] = useState('overview');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Multi-criteria filter state
  const [selectedSystemFilters, setSelectedSystemFilters] = useState<string[]>(() => getArrayParam('system'));
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => getArrayParam('statuses'));
  const [selectedSources, setSelectedSources] = useState<string[]>(() => getArrayParam('sources'));
  const [selectedOwners, setSelectedOwners] = useState<string[]>(() => getArrayParam('owners'));
  const [selectedRelated, setSelectedRelated] = useState<string[]>(() => getArrayParam('related'));

  const debouncedSearch = useDebounce(searchTerm, 300);

  // Sync to URL
  useEffect(() => {
    updateParams({
      tab: activeTab !== 'all' ? activeTab : null,
      search: debouncedSearch || null,
      view: activeView !== 'list' ? activeView : null,
      system: selectedSystemFilters,
      statuses: selectedStatuses,
      sources: selectedSources,
      owners: selectedOwners,
      related: selectedRelated,
    });
  }, [activeTab, debouncedSearch, activeView, selectedSystemFilters, selectedStatuses, selectedSources, selectedOwners, selectedRelated, updateParams]);

  // ── Filtered Data ────────────────────────────────────────────────────
  const activeLeads = useMemo(
    () => leads.filter((l) => !l.isArchived && l.recordType !== 'Organization'),
    [leads],
  );

  const filteredLeads = useMemo(() => {
    let result = activeLeads;

    // Tab filter
    if (activeTab === 'my') {
      result = result.filter((l) => l.assignedUserId === user?.id);
    }

    // Search
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      result = result.filter(
        (l) =>
          (l.leadPerson ?? l.displayName ?? '').toLowerCase().includes(term) ||
          (l.email ?? '').toLowerCase().includes(term) ||
          (l.companyName ?? '').toLowerCase().includes(term),
      );
    }

    // System Filters
    if (selectedSystemFilters.includes('touched')) {
      result = result.filter((l) => l.lastUpdated || l.updateStatus);
    }
    if (selectedSystemFilters.includes('untouched')) {
      result = result.filter((l) => !l.lastUpdated && !l.updateStatus);
    }

    // Status filter
    if (selectedStatuses.length > 0) {
      result = result.filter((l) => selectedStatuses.includes(l.status));
    }

    // Source filter
    if (selectedSources.length > 0) {
      result = result.filter((l) => selectedSources.includes(l.leadSource ?? ''));
    }

    // Owner filter
    if (selectedOwners.length > 0) {
      result = result.filter((l) => selectedOwners.includes(l.assignedUserId ?? ''));
    }

    // Related filter
    if (selectedRelated.includes('has_email')) {
      result = result.filter((l) => Boolean(l.email));
    }
    if (selectedRelated.includes('has_phone')) {
      result = result.filter((l) => Boolean(l.phone));
    }

    return result;
  }, [activeLeads, activeTab, user?.id, debouncedSearch, selectedSystemFilters, selectedStatuses, selectedSources, selectedOwners, selectedRelated]);

  // ── Helpers ──────────────────────────────────────────────────────────
  const getInitials = (lead: Lead): string => {
    const name = lead.leadPerson ?? lead.displayName ?? lead.firstName ?? '';
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getLeadName = (lead: Lead): string => {
    return lead.leadPerson ?? lead.displayName ?? (`${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || 'Unknown');
  };

  const getOwnerName = (userId?: string): string => {
    if (!userId) return 'Unassigned';
    const u = users.find((usr) => usr.id === userId);
    return u ? `${u.firstName} ${u.lastName}` : 'Unknown';
  };

  const getOwnerInitials = (userId?: string): string => {
    if (!userId) return '?';
    const u = users.find((usr) => usr.id === userId);
    if (!u) return '?';
    return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase();
  };

  const getStatusVariant = (status: string): 'success' | 'info' | 'warn' | 'danger' | 'purple' | 'neutral' => {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'purple' | 'neutral'> = {
      Qualified: 'success',
      New: 'info',
      Contacted: 'info',
      Nurturing: 'purple',
      Unqualified: 'danger',
      Hot: 'danger',
      Warm: 'warn',
      Cold: 'neutral',
    };
    return map[status] ?? 'neutral';
  };

  const formatCurrency = (value?: number): string => {
    if (!value) return '$0';
    if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
    return `$${value.toLocaleString()}`;
  };

  // ── Filter groups for the rail ───────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    activeLeads.forEach((l) => {
      counts[l.status] = (counts[l.status] ?? 0) + 1;
    });
    return counts;
  }, [activeLeads]);

  const touchedCount = activeLeads.filter((l) => l.lastUpdated || l.updateStatus).length;
  const untouchedCount = activeLeads.length - touchedCount;

  const distinctSources = useMemo(() => {
    const set = new Set<string>();
    activeLeads.forEach((l) => { if (l.leadSource) set.add(l.leadSource); });
    return Array.from(set);
  }, [activeLeads]);

  const filterGroups = useMemo(() => [
    {
      id: 'system',
      label: 'System Defined Filters',
      isExpanded: true,
      items: [
        { id: 'touched', label: 'Touched Records', count: touchedCount, isChecked: selectedSystemFilters.includes('touched') },
        { id: 'untouched', label: 'Untouched Records', count: untouchedCount, isChecked: selectedSystemFilters.includes('untouched') },
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
          count: activeLeads.filter((l) => l.leadSource === source).length,
          isChecked: selectedSources.includes(source),
        })),
        ...users.slice(0, 5).map((u) => ({
          id: `owner:${u.id}`,
          label: `Owner: ${u.firstName} ${u.lastName}`,
          count: activeLeads.filter((l) => l.assignedUserId === u.id).length,
          isChecked: selectedOwners.includes(u.id),
        })),
      ],
    },
    {
      id: 'related',
      label: 'Filter By Related Modules',
      isExpanded: true,
      items: [
        { id: 'has_email', label: 'Leads with Email', count: activeLeads.filter((l) => Boolean(l.email)).length, isChecked: selectedRelated.includes('has_email') },
        { id: 'has_phone', label: 'Leads with Phone', count: activeLeads.filter((l) => Boolean(l.phone)).length, isChecked: selectedRelated.includes('has_phone') },
      ],
    },
  ], [touchedCount, untouchedCount, selectedSystemFilters, statusCounts, selectedStatuses, distinctSources, activeLeads, selectedSources, users, selectedOwners, selectedRelated]);

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
    setDrawerTab('overview');
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === filteredLeads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLeads.map((l) => l.id));
    }
  }, [selectedIds.length, filteredLeads]);

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <>
      <ModuleWorkspace
        title="Leads"
        primaryActionLabel="Create Lead"
        onPrimaryAction={handleCreate}
        onImport={() => toast.info('Import feature coming soon')}
        canCreate={canCreate}
        availableViews={['list', 'tile', 'table', 'kanban', 'grid']}
        activeView={activeView}
        onViewChange={setActiveView}
        savedTabs={[
          { id: 'all', label: 'All Leads' },
          { id: 'my', label: 'My Leads' },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        filterGroups={filterGroups}
        onFilterToggle={handleFilterToggle}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        filterSearchTerm={filterSearchTerm}
        onFilterSearch={setFilterSearchTerm}
        totalRecords={filteredLeads.length}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        searchPlaceholder="Search leads..."
        onSort={() => toast.info('Sort options coming soon')}
        onRefresh={() => toast.success('Refreshed')}
        toolbarExtra={
          <button
            ref={manageColumnsButtonRef}
            onClick={() => setIsManageColumnsOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-[#5A6B85] dark:text-slate-300 bg-white dark:bg-slate-800 border border-[#E4E9F0] dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            aria-label="Manage columns"
          >
            <SlidersHorizontal size={13} />
            Columns
          </button>
        }
        bulkSelection={
          selectedIds.length > 0
            ? {
                count: selectedIds.length,
                onClear: () => setSelectedIds([]),
                actions: (
                  <button className="text-[12px] text-white/80 hover:text-white transition-colors">
                    Delete
                  </button>
                ),
              }
            : undefined
        }
      >
        {/* ── List View ─────────────────────────────────────────── */}
        {(activeView === 'list' || activeView === 'table') && isColumnsLoading && (
          <div className="bg-white dark:bg-slate-800/40 border border-[#E4E9F0] dark:border-slate-700 rounded-xl p-8">
            <div className="flex items-center justify-center gap-2 text-[13px] text-[#5A6B85] dark:text-slate-400">
              <div className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
              Loading leads...
            </div>
          </div>
        )}
        {(activeView === 'list' || activeView === 'table') && !isColumnsLoading && (
          <LeadsListView
            leads={filteredLeads}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onRowClick={handleRowClick}
            getInitials={getInitials}
            getLeadName={getLeadName}
            getOwnerName={getOwnerName}
            getOwnerInitials={getOwnerInitials}
            getStatusVariant={getStatusVariant}
            visibleColumns={visibleColumns}
            registry={LEADS_COLUMN_REGISTRY}
          />
        )}

        {/* ── Tile View ─────────────────────────────────────────── */}
        {activeView === 'tile' && (
          <LeadsTileView
            leads={filteredLeads}
            onCardClick={handleRowClick}
            getInitials={getInitials}
            getLeadName={getLeadName}
            getStatusVariant={getStatusVariant}
            formatCurrency={formatCurrency}
          />
        )}

        {/* ── Grid View ─────────────────────────────────────────── */}
        {activeView === 'grid' && (
          <LeadsGridView
            leads={filteredLeads}
            onCardClick={handleRowClick}
            getInitials={getInitials}
            getLeadName={getLeadName}
          />
        )}

        {/* ── Kanban View ───────────────────────────────────────── */}
        {activeView === 'kanban' && (
          <LeadsKanbanView
            leads={filteredLeads}
            onCardClick={handleRowClick}
            getInitials={getInitials}
            getLeadName={getLeadName}
            getStatusVariant={getStatusVariant}
          />
        )}
      </ModuleWorkspace>

      {/* ── Record Drawer ───────────────────────────────────────── */}
      {selectedLead && (
        <RecordDrawer
          isOpen={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          moduleLabel="LEAD"
          avatar={
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-[13px]">
              {getInitials(selectedLead)}
            </div>
          }
          name={getLeadName(selectedLead)}
          subtitle={[selectedLead.email, selectedLead.phone].filter(Boolean).join(' · ')}
          badges={
            <>
              <StatusBadge label={selectedLead.status} variant={getStatusVariant(selectedLead.status)} />
              {selectedLead.score && (
                <StatusBadge label={`Score ${selectedLead.score}`} variant="info" dot={false} />
              )}
              {selectedLead.leadSource && (
                <span className="text-[11px] text-[#5A6B85] dark:text-slate-400 font-medium">
                  {selectedLead.leadSource}
                </span>
              )}
            </>
          }
          kpiTiles={[
            { label: 'EST. VALUE', value: formatCurrency(selectedLead.estimatedValue) },
            { label: 'SCORE', value: String(selectedLead.score ?? '—') },
            { label: 'OWNER', value: getOwnerInitials(selectedLead.assignedUserId) },
            { label: 'CREATED', value: selectedLead.createdAt ? new Date(selectedLead.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—' },
          ]}
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'activity', label: 'Activity' },
            { id: 'related', label: 'Related' },
            { id: 'notes', label: 'Notes' },
          ]}
          activeTab={drawerTab}
          onTabChange={setDrawerTab}
          actions={
            <>
              {canEdit && (
                <button className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors">
                  <Edit size={13} /> Edit
                </button>
              )}
              <button className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-[#0F172A] dark:text-slate-200 bg-white dark:bg-slate-800 border border-[#E4E9F0] dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <Phone size={13} /> Log call
              </button>
              <button className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-[#0F172A] dark:text-slate-200 bg-white dark:bg-slate-800 border border-[#E4E9F0] dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <Mail size={13} /> Email
              </button>
              <button className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-[#0F172A] dark:text-slate-200 bg-white dark:bg-slate-800 border border-[#E4E9F0] dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <ListTodo size={13} /> Task
              </button>
              <button className="w-8 h-8 flex items-center justify-center text-[#5A6B85] hover:text-[#0F172A] dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <MoreHorizontal size={16} />
              </button>
            </>
          }
        >
          {/* Drawer tab content */}
          {drawerTab === 'overview' && (
            <LeadDrawerOverview lead={selectedLead} getOwnerName={getOwnerName} formatCurrency={formatCurrency} organizations={organizations} />
          )}
          {drawerTab === 'activity' && (
            <p className="text-[13px] text-[#5A6B85]">Activity timeline coming soon.</p>
          )}
          {drawerTab === 'related' && (
            <LeadDrawerRelated lead={selectedLead} organizations={organizations} />
          )}
          {drawerTab === 'notes' && (
            <p className="text-[13px] text-[#5A6B85]">Notes coming soon.</p>
          )}
        </RecordDrawer>
      )}

      {/* ── Form Sheet ──────────────────────────────────────────── */}
      <LeadFormSheet
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingLead(undefined); }}
        initialData={editingLead}
        onSave={(data) => {
          if (editingLead) {
            updateLead(editingLead.id, data);
            toast.success('Lead updated');
          } else {
            addLead(data as any);
            toast.success('Lead created');
          }
          setIsFormOpen(false);
          setEditingLead(undefined);
        }}
      />

      {/* ── Manage Columns Drawer ───────────────────────────────── */}
      <ManageColumnsDrawer
        isOpen={isManageColumnsOpen}
        onClose={() => setIsManageColumnsOpen(false)}
        module="leads"
        registry={LEADS_COLUMN_REGISTRY}
        effectiveColumns={effectiveColumns}
        onSave={saveColumns}
        onReset={resetColumns}
        triggerRef={manageColumnsButtonRef}
      />
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// Tile View
// ═══════════════════════════════════════════════════════════════════════════════

interface LeadsTileViewProps {
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
  getInitials: (lead: Lead) => string;
  getLeadName: (lead: Lead) => string;
  getStatusVariant: (status: string) => 'success' | 'info' | 'warn' | 'danger' | 'purple' | 'neutral';
  formatCurrency: (value?: number) => string;
}

function LeadsTileView({ leads, onCardClick, getInitials, getLeadName, getStatusVariant, formatCurrency }: LeadsTileViewProps): React.ReactElement {
  if (leads.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-[13px] text-[#5A6B85]">
        No leads found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {leads.map((lead) => (
        <div
          key={lead.id}
          onClick={() => onCardClick(lead)}
          className="bg-white dark:bg-slate-800/60 border border-[#E4E9F0] dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-[#2563EB]/30 transition-all group"
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-[11px] shrink-0">
              {getInitials(lead)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate group-hover:text-[#2563EB] transition-colors">
                {getLeadName(lead)}
              </p>
              <p className="text-[11.5px] text-[#5A6B85] dark:text-slate-400 truncate">
                {lead.companyName ?? lead.city ?? '—'}
              </p>
            </div>
            <StatusBadge label={lead.status} variant={getStatusVariant(lead.status)} />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#E4E9F0] dark:border-slate-700">
            <span className="text-[12px] text-[#5A6B85] dark:text-slate-400">
              Score: <strong className="text-[#0F172A] dark:text-white">{lead.score ?? 0}</strong>
            </span>
            <span className="text-[13px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
              {formatCurrency(lead.estimatedValue)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Grid View (4-up compact cards)
// ═══════════════════════════════════════════════════════════════════════════════

interface LeadsGridViewProps {
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
  getInitials: (lead: Lead) => string;
  getLeadName: (lead: Lead) => string;
}

function LeadsGridView({ leads, onCardClick, getInitials, getLeadName }: LeadsGridViewProps): React.ReactElement {
  if (leads.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-[13px] text-[#5A6B85]">
        No leads found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
      {leads.map((lead) => (
        <div
          key={lead.id}
          onClick={() => onCardClick(lead)}
          className="bg-white dark:bg-slate-800/60 border border-[#E4E9F0] dark:border-slate-700 rounded-xl p-3 cursor-pointer hover:shadow-md hover:border-[#2563EB]/30 transition-all flex items-center gap-2.5"
        >
          <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
            {getInitials(lead)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-[#0F172A] dark:text-white truncate">
              {getLeadName(lead)}
            </p>
            <p className="text-[10.5px] text-[#5A6B85] dark:text-slate-400 truncate">
              {lead.companyName ?? '—'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Kanban View (by status)
// ═══════════════════════════════════════════════════════════════════════════════

interface LeadsKanbanViewProps {
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
  getInitials: (lead: Lead) => string;
  getLeadName: (lead: Lead) => string;
  getStatusVariant: (status: string) => 'success' | 'info' | 'warn' | 'danger' | 'purple' | 'neutral';
}

const LEAD_STATUSES = ['New', 'Contacted', 'Nurturing', 'Qualified', 'Unqualified'];

function LeadsKanbanView({ leads, onCardClick, getInitials, getLeadName, getStatusVariant }: LeadsKanbanViewProps): React.ReactElement {
  const columns = useMemo(() => {
    return LEAD_STATUSES.map((status) => ({
      status,
      leads: leads.filter((l) => l.status === status),
    }));
  }, [leads]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
      {columns.map(({ status, leads: columnLeads }) => (
        <div
          key={status}
          className="min-w-[260px] w-[260px] flex-shrink-0 bg-[#F6F8FB] dark:bg-slate-800/30 border border-[#E4E9F0] dark:border-slate-700 rounded-xl flex flex-col max-h-[600px]"
        >
          {/* Column header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#E4E9F0] dark:border-slate-700">
            <div className="flex items-center gap-2">
              <StatusBadge label={status} variant={getStatusVariant(status)} />
              <span className="text-[11px] font-semibold text-[#5A6B85] tabular-nums">
                {columnLeads.length}
              </span>
            </div>
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {columnLeads.map((lead) => (
              <div
                key={lead.id}
                onClick={() => onCardClick(lead)}
                className="bg-white dark:bg-slate-800 border border-[#E4E9F0] dark:border-slate-700 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-[9px] shrink-0">
                    {getInitials(lead)}
                  </div>
                  <p className="text-[12px] font-semibold text-[#0F172A] dark:text-white truncate">
                    {getLeadName(lead)}
                  </p>
                </div>
                <p className="text-[11px] text-[#5A6B85] dark:text-slate-400 truncate">
                  {lead.companyName ?? '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Drawer — Overview Tab
// ═══════════════════════════════════════════════════════════════════════════════

interface LeadDrawerOverviewProps {
  lead: Lead;
  getOwnerName: (userId?: string) => string;
  formatCurrency: (value?: number) => string;
  organizations: any[];
}

function LeadDrawerOverview({ lead, getOwnerName, formatCurrency, organizations }: LeadDrawerOverviewProps): React.ReactElement {
  const org = organizations.find((o) => o.id === lead.organizationId);

  const fields = [
    { label: 'Company', value: lead.companyName ?? '—' },
    { label: 'Industry', value: lead.industry ?? '—' },
    { label: 'City', value: lead.city ?? '—' },
    { label: 'Lead source', value: lead.leadSource ?? '—' },
    { label: 'Estimated value', value: formatCurrency(lead.estimatedValue) },
    { label: 'Owner', value: getOwnerName(lead.assignedUserId) },
    { label: 'Created', value: lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
  ];

  return (
    <div className="space-y-6">
      {/* Details grid */}
      <div>
        <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400 mb-3">
          DETAILS
        </h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {fields.map(({ label, value }) => (
            <div key={label}>
              <p className="text-[11.5px] text-[#5A6B85] dark:text-slate-400 mb-0.5">{label}</p>
              <p className="text-[13px] font-medium text-[#0F172A] dark:text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Linked Account */}
      {org && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400">
              LINKED ACCOUNT
            </h3>
            <span className="text-[11px] text-[#5A6B85] tabular-nums">1</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-[#F6F8FB] dark:bg-slate-800/40 rounded-lg border border-[#E4E9F0] dark:border-slate-700">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-[10px]">
              {org.name?.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate">{org.name}</p>
              <p className="text-[11px] text-[#5A6B85] dark:text-slate-400">{org.industry ?? 'Account'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Drawer — Related Tab
// ═══════════════════════════════════════════════════════════════════════════════

interface LeadDrawerRelatedProps {
  lead: Lead;
  organizations: any[];
}

function LeadDrawerRelated({ lead, organizations }: LeadDrawerRelatedProps): React.ReactElement {
  const org = organizations.find((o) => o.id === lead.organizationId);

  return (
    <div className="space-y-6">
      {org && (
        <div>
          <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400 mb-2">
            LINKED ACCOUNT
          </h3>
          <div className="flex items-center gap-3 p-3 bg-[#F6F8FB] dark:bg-slate-800/40 rounded-lg border border-[#E4E9F0] dark:border-slate-700">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-[10px]">
              {org.name?.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate">{org.name}</p>
              <p className="text-[11px] text-[#5A6B85] dark:text-slate-400">{org.industry ?? 'Manufacturing'} · Account</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400 mb-2">
          DEALS FROM THIS LEAD
        </h3>
        <p className="text-[12px] text-[#5A6B85] dark:text-slate-400">No deals linked yet.</p>
      </div>
    </div>
  );
}
