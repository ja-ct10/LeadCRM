'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { Lead } from '@/store/types';
import { ModuleWorkspace, ViewType, RecordDrawer, StatusBadge, AvatarCell, ActivityFlag } from '@/shared/components/crm';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { LeadFormSheet } from './lead-form';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Edit, Phone, Mail, ListTodo, MoreHorizontal } from 'lucide-react';

// ── Leads Page ────────────────────────────────────────────────────────────────

export default function LeadsPage(): React.ReactElement {
  const {
    contacts: leads,
    addContact: addLead,
    updateContact: updateLead,
    deleteContact: deleteLead,
    users,
    organizations,
  } = useData();
  const { user } = useAuth();
  const canCreate = useHasPermission('contacts.create');
  const canEdit = useHasPermission('contacts.edit');
  const canDelete = useHasPermission('contacts.delete');

  // ── State ────────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<ViewType>('list');
  const [activeTab, setActiveTab] = useState('all');
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSearchTerm, setFilterSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | undefined>();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerTab, setDrawerTab] = useState('overview');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filter state
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);

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
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (l) =>
          (l.leadPerson ?? l.displayName ?? '').toLowerCase().includes(term) ||
          (l.email ?? '').toLowerCase().includes(term) ||
          (l.companyName ?? '').toLowerCase().includes(term),
      );
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

    return result;
  }, [activeLeads, activeTab, user?.id, searchTerm, selectedStatuses, selectedSources, selectedOwners]);

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

  const filterGroups = useMemo(() => [
    {
      id: 'system',
      label: 'System Defined Filters',
      isExpanded: true,
      items: [
        { id: 'touched', label: 'Touched Records', count: touchedCount, isChecked: false },
        { id: 'untouched', label: 'Untouched Records', count: untouchedCount, isChecked: false },
        { id: 'record-action', label: 'Record Action', count: 0, isChecked: false },
        { id: 'related-action', label: 'Related Records Action', count: 0, isChecked: false },
      ],
    },
    {
      id: 'fields',
      label: 'Filter By Fields',
      isExpanded: true,
      items: [
        { id: 'lead-owner', label: 'Lead Owner', isChecked: selectedOwners.length > 0 },
        { id: 'lead-status', label: 'Lead Status', isChecked: selectedStatuses.length > 0 },
        { id: 'lead-source', label: 'Lead Source', isChecked: selectedSources.length > 0 },
        { id: 'company', label: 'Company', isChecked: false },
        { id: 'industry', label: 'Industry', isChecked: false },
        { id: 'score', label: 'Score', isChecked: false },
        { id: 'created-time', label: 'Created Time', isChecked: false },
        { id: 'email-opt-out', label: 'Email Opt Out', isChecked: false },
      ],
    },
    {
      id: 'related',
      label: 'Filter By Related Modules',
      isExpanded: false,
      items: [],
    },
  ], [touchedCount, untouchedCount, selectedOwners, selectedStatuses, selectedSources]);

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
        description="Inbound and outbound leads waiting to be qualified into contacts."
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
        {activeView === 'list' && (
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
            formatCurrency={formatCurrency}
          />
        )}

        {/* ── Table View ────────────────────────────────────────── */}
        {activeView === 'table' && (
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
            formatCurrency={formatCurrency}
            dense
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
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components — List View
// ═══════════════════════════════════════════════════════════════════════════════

interface LeadsListViewProps {
  leads: Lead[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onRowClick: (lead: Lead) => void;
  getInitials: (lead: Lead) => string;
  getLeadName: (lead: Lead) => string;
  getOwnerName: (userId?: string) => string;
  getOwnerInitials: (userId?: string) => string;
  getStatusVariant: (status: string) => 'success' | 'info' | 'warn' | 'danger' | 'purple' | 'neutral';
  formatCurrency: (value?: number) => string;
  dense?: boolean;
}

function LeadsListView({
  leads,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onRowClick,
  getInitials,
  getLeadName,
  getOwnerName,
  getOwnerInitials,
  getStatusVariant,
  formatCurrency,
  dense = false,
}: LeadsListViewProps): React.ReactElement {
  if (leads.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-[13px] text-[#5A6B85] dark:text-slate-400">
        No leads found. Adjust your filters or create a new lead.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800/40 border border-[#E4E9F0] dark:border-slate-700 rounded-xl overflow-hidden">
      {/* Table header */}
      <div className={cn(
        'grid items-center border-b border-[#E4E9F0] dark:border-slate-700 bg-[#F6F8FB] dark:bg-slate-800/60 sticky top-0 z-10',
        'text-[11.5px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400',
        dense
          ? 'grid-cols-[40px_1fr_1fr_120px_80px_100px_100px_80px] h-10 px-3'
          : 'grid-cols-[40px_1.2fr_1fr_120px_80px_100px_100px_80px] h-11 px-3',
      )}>
        <label className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={selectedIds.length === leads.length && leads.length > 0}
            onChange={onSelectAll}
            className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer"
            aria-label="Select all leads"
          />
        </label>
        <span className="px-3">LEAD NAME</span>
        <span className="px-3">COMPANY</span>
        <span className="px-3">STATUS</span>
        <span className="px-3 text-center">SCORE</span>
        <span className="px-3">SOURCE</span>
        <span className="px-3 text-right">EST. VALUE</span>
        <span className="px-3 text-right">OWNER</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[#E4E9F0] dark:divide-slate-700">
        {leads.map((lead) => {
          const isSelected = selectedIds.includes(lead.id);
          const scorePercent = Math.min((lead.score ?? 0), 100);

          return (
            <div
              key={lead.id}
              onClick={() => onRowClick(lead)}
              className={cn(
                'grid items-center cursor-pointer transition-colors group',
                dense
                  ? 'grid-cols-[40px_1fr_1fr_120px_80px_100px_100px_80px] h-[44px] px-3'
                  : 'grid-cols-[40px_1.2fr_1fr_120px_80px_100px_100px_80px] h-[52px] px-3',
                isSelected
                  ? 'bg-blue-50/60 dark:bg-blue-500/5'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
              )}
            >
              {/* Checkbox */}
              <label className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelect(lead.id)}
                  className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer"
                  aria-label={`Select ${getLeadName(lead)}`}
                />
              </label>

              {/* Lead name + avatar */}
              <div className="flex items-center gap-2.5 px-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                  {getInitials(lead)}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white truncate leading-tight group-hover:text-[#2563EB] transition-colors">
                    {getLeadName(lead)}
                  </p>
                  {lead.city && (
                    <p className="text-[11px] text-[#5A6B85] dark:text-slate-400 truncate mt-0.5">
                      {lead.city}
                    </p>
                  )}
                </div>
              </div>

              {/* Company */}
              <div className="px-3 min-w-0">
                <p className="text-[13px] text-[#0F172A] dark:text-slate-200 truncate">
                  {lead.companyName ?? '—'}
                </p>
              </div>

              {/* Status */}
              <div className="px-3">
                <StatusBadge label={lead.status} variant={getStatusVariant(lead.status)} />
              </div>

              {/* Score */}
              <div className="px-3 flex items-center gap-2 justify-center">
                <div className="w-10 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#2563EB] rounded-full transition-all"
                    style={{ width: `${scorePercent}%` }}
                  />
                </div>
                <span className="text-[12px] font-semibold text-[#0F172A] dark:text-white tabular-nums w-6 text-right">
                  {lead.score ?? 0}
                </span>
              </div>

              {/* Source */}
              <div className="px-3">
                <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 truncate">
                  {lead.leadSource ?? '—'}
                </p>
              </div>

              {/* Est. Value */}
              <div className="px-3 text-right">
                <p className="text-[13px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
                  {formatCurrency(lead.estimatedValue)}
                </p>
              </div>

              {/* Owner */}
              <div className="px-3 flex items-center justify-end gap-1.5">
                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-300">
                  {getOwnerInitials(lead.assignedUserId)}
                </div>
                <span className="text-[11px] text-[#5A6B85] dark:text-slate-400 truncate max-w-[60px] hidden xl:inline">
                  {getOwnerName(lead.assignedUserId).split(' ')[0]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#E4E9F0] dark:border-slate-700 bg-[#F6F8FB] dark:bg-slate-800/60">
        <span className="text-[12px] text-[#5A6B85] dark:text-slate-400">
          Total records <strong className="font-semibold text-[#0F172A] dark:text-white">{leads.length}</strong>
        </span>
        <div className="flex items-center gap-2 text-[12px] text-[#5A6B85]">
          <span>1 to {Math.min(leads.length, 25)}</span>
          <button className="p-1 hover:text-[#0F172A] dark:hover:text-white transition-colors" aria-label="Previous page">&lt;</button>
          <button className="p-1 hover:text-[#0F172A] dark:hover:text-white transition-colors" aria-label="Next page">&gt;</button>
        </div>
      </div>
    </div>
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
