'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { Lead, Organization } from '@/store/types';
import { ModuleWorkspace, ViewType, RecordDrawer, StatusBadge } from '@/shared/components/crm';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { useFilterUrlSync } from '@/shared/hooks/use-filter-url-sync';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { useColumnPreferences } from '@/shared/hooks/use-column-preferences';
import { useTablePreferences } from '@/shared/hooks/use-table-preferences';
import { migrateLocalStorageColumns } from '../services/local-storage-migration';
import { ManageColumnsDrawer } from '@/shared/components/manage-columns-drawer';
import { LeadsTileView, LeadsGridView, LeadsKanbanView, LeadDrawerOverview, LeadDrawerRelated } from './leads-view-components';
import { LeadsListView } from './leads-list-view';
import { LeadsDataGrid } from './leads-data-grid';
import { LeadFormSheet } from './lead-form';
import { LEADS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';
import { LEADS_MODULE_CONFIG } from '../leads.config';
import { toast } from 'sonner';
import { Edit, Phone, Mail, ListTodo, MoreHorizontal } from 'lucide-react';

// â”€â”€ Leads Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  const canDelete = useHasPermission('contacts.delete');
  const { getParam, getArrayParam, updateParams } = useFilterUrlSync();

  // â”€â”€ Column Preferences â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const {
    effectiveColumns,
    isLoading: isColumnsLoading,
    saveColumns,
    resetColumns,
  } = useColumnPreferences('leads');

  const [isManageColumnsOpen, setIsManageColumnsOpen] = useState(false);

  // â”€â”€ Table Preferences (pageSize, viewMode, sort) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const {
    pageSize,
    viewMode,
    sort,
    setPageSize,
    setViewMode,
    setSort,
  } = useTablePreferences('leads');

  // â”€â”€ Pagination state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [currentPage, setCurrentPage] = useState(1);

  // â”€â”€ One-time localStorage migration (fire-and-forget) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    migrateLocalStorageColumns();
  }, []);

  /** Visible columns sorted by order â€” drives table rendering */
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

  // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [activeView, setActiveView] = useState<ViewType>(() => (getParam('view') as ViewType) || 'list');
  const [activeTab, setActiveTab] = useState(() => getParam('tab') || 'all');
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState(() => getParam('search'));
  const [filterSearchTerm, setFilterSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | undefined>();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerTab, setDrawerTab] = useState('overview');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  // â”€â”€ Filtered Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Sorted Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sortedLeads = useMemo(() => {
    if (!sort) return filteredLeads;

    const { field, direction } = sort;
    const sorted = [...filteredLeads].sort((a, b) => {
      const aVal = getFieldValue(a, field);
      const bVal = getFieldValue(b, field);

      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredLeads, sort]);

  // â”€â”€ Paginated Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / pageSize));

  // Reset page when filters/sort/pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, activeTab, selectedSystemFilters, selectedStatuses, selectedSources, selectedOwners, selectedRelated, pageSize, sort]);

  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedLeads.slice(start, start + pageSize);
  }, [sortedLeads, currentPage, pageSize]);

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  /** Extract a sortable value from a lead by field id */
  const getFieldValue = (lead: Lead, field: string): string | number | null => {
    switch (field) {
      case 'firstName':
        return lead.leadPerson ?? lead.displayName ?? lead.firstName ?? '';
      case 'lastName':
        return lead.lastName ?? '';
      case 'email':
        return lead.email ?? '';
      case 'phone':
        return lead.phone ?? '';
      case 'companyName':
        return lead.companyName ?? '';
      case 'status':
        return lead.status ?? '';
      case 'source':
        return lead.leadSource ?? '';
      case 'createdAt':
        return lead.createdAt ?? '';
      case 'updatedAt':
        return (lead as unknown as Record<string, unknown>).updatedAt as string ?? '';
      case 'city':
      case 'address':
      case 'primaryAddressCityState':
        return lead.city ?? '';
      case 'assignedUserId':
        return getOwnerName(lead.assignedUserId);
      default:
        return (lead as unknown as Record<string, unknown>)[field] as string ?? '';
    }
  };

  // â”€â”€ Filter groups for the rail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleCreate = useCallback(() => {
    setEditingLead(undefined);
    setIsFormOpen(true);
  }, []);

  const handleRowClick = useCallback((lead: Lead) => {
    setSelectedLead(lead);
    setDrawerTab('overview');
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === paginatedLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedLeads.map((l) => l.id)));
    }
  }, [selectedIds.size, paginatedLeads]);

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <>
      <ModuleWorkspace
        moduleId="leads"
        title="Leads"
        moduleConfig={LEADS_MODULE_CONFIG}
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
        totalRecords={sortedLeads.length}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        searchPlaceholder="Search leads..."
        sortableFields={LEADS_COLUMN_REGISTRY.map((col) => ({ id: col.id, label: col.label }))}
        sort={sort}
        onSortChange={setSort}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={() => toast.success('Refreshed')}
        onManageColumns={() => setIsManageColumnsOpen(true)}
        onResetColumns={() => {
          resetColumns();
          toast.success('Columns reset to default');
        }}
        bulkSelection={
          selectedIds.size > 0
            ? {
                count: selectedIds.size,
                onClear: () => setSelectedIds(new Set()),
                actions: (
                  <button className="text-[12px] text-white/80 hover:text-white transition-colors">
                    Delete
                  </button>
                ),
              }
            : undefined
        }
      >
        {/* â”€â”€ List View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {(activeView === 'list' || activeView === 'table') && isColumnsLoading && (
          <div className="bg-white dark:bg-slate-800/40 border border-[#E4E9F0] dark:border-slate-700 rounded-xl p-8">
            <div className="flex items-center justify-center gap-2 text-[13px] text-[#5A6B85] dark:text-slate-400">
              <div className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
              Loading leads...
            </div>
          </div>
        )}

        {/* â”€â”€ Table View (new DataGrid) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeView === 'table' && !isColumnsLoading && (
          <LeadsDataGrid
            leads={paginatedLeads}
            totalRecords={sortedLeads.length}
            effectiveColumns={effectiveColumns}
            sort={sort}
            onSortChange={setSort}
            onRowClick={handleRowClick}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            getOwnerName={getOwnerName}
            getOwnerInitials={getOwnerInitials}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={(lead) => { setEditingLead(lead); setIsFormOpen(true); }}
            onDelete={(lead) => {
              // future: confirm + delete
              toast.info(`Delete "${lead.leadPerson ?? lead.displayName}" coming soon`);
            }}
            onManageColumns={() => setIsManageColumnsOpen(true)}
            onHideColumn={(columnId) => {
              const updated = effectiveColumns.map((col) =>
                col.id === columnId ? { ...col, visible: false } : col,
              );
              saveColumns(updated);
              toast.success('Column hidden');
            }}
            onColumnReorder={saveColumns}
          />
        )}

        {/* â”€â”€ List View (legacy flex-based) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeView === 'list' && !isColumnsLoading && (
          <LeadsListView
            leads={paginatedLeads}
            totalRecords={sortedLeads.length}
            currentPage={currentPage}
            pageSize={pageSize}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            viewMode={viewMode}
            selectedIds={Array.from(selectedIds)}
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
            onColumnsReorder={(newCols) => saveColumns(newCols)}
          />
        )}

        {/* â”€â”€ Tile View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

        {/* â”€â”€ Grid View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeView === 'grid' && (
          <LeadsGridView
            leads={filteredLeads}
            onCardClick={handleRowClick}
            getInitials={getInitials}
            getLeadName={getLeadName}
          />
        )}

        {/* â”€â”€ Kanban View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

      {/* â”€â”€ Record Drawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
          subtitle={[selectedLead.email, selectedLead.phone].filter(Boolean).join(' Â· ')}
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
            { label: 'SCORE', value: String(selectedLead.score ?? 'â€”') },
            { label: 'OWNER', value: getOwnerInitials(selectedLead.assignedUserId) },
            { label: 'CREATED', value: selectedLead.createdAt ? new Date(selectedLead.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'â€”' },
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

      {/* â”€â”€ Form Sheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

      {/* â”€â”€ Manage Columns Drawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <ManageColumnsDrawer
        isOpen={isManageColumnsOpen}
        onClose={() => setIsManageColumnsOpen(false)}
        module="leads"
        registry={LEADS_COLUMN_REGISTRY}
        effectiveColumns={effectiveColumns}
        onSave={saveColumns}
        onReset={resetColumns}
      />
    </>
  );
}

