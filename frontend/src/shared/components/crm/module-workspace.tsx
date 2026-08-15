'use client';

import React, { useState, useCallback, ReactNode } from 'react';
import {
  List, LayoutGrid, Table2, Columns3, Grid3X3,
  TrendingUp, Filter, ArrowUpDown, RefreshCw, Search,
  SlidersHorizontal, ChevronDown, X, Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ViewType = 'list' | 'tile' | 'table' | 'kanban' | 'grid' | 'forecast';

interface ViewOption {
  id: ViewType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface SavedViewTab {
  id: string;
  label: string;
  isActive?: boolean;
}

interface FilterGroup {
  id: string;
  label: string;
  isExpanded?: boolean;
  items: FilterItem[];
}

interface FilterItem {
  id: string;
  label: string;
  count?: number;
  isChecked?: boolean;
}

interface KpiCard {
  label: string;
  value: string;
  subtitle?: string;
}

interface ModuleWorkspaceProps {
  /** Module title e.g. "Leads" */
  title: string;
  /** One-line module description */
  description?: string;
  /** Primary action button label e.g. "Create Lead" */
  primaryActionLabel: string;
  /** Primary action callback */
  onPrimaryAction: () => void;
  /** Import action callback */
  onImport?: () => void;
  /** Can user create (RBAC) */
  canCreate?: boolean;
  /** Available view types for this module */
  availableViews: ViewType[];
  /** Currently active view */
  activeView: ViewType;
  /** View change handler */
  onViewChange: (view: ViewType) => void;
  /** Saved view tabs */
  savedTabs?: SavedViewTab[];
  /** Active tab id */
  activeTab?: string;
  /** Tab change handler */
  onTabChange?: (tabId: string) => void;
  /** Filter rail groups */
  filterGroups?: FilterGroup[];
  /** Filter toggle handler */
  onFilterToggle?: (groupId: string, itemId: string) => void;
  /** Filter search term */
  filterSearchTerm?: string;
  /** Filter search handler */
  onFilterSearch?: (term: string) => void;
  /** Show filter rail */
  showFilters?: boolean;
  /** Toggle filter rail visibility */
  onToggleFilters?: () => void;
  /** Total record count for filter rail footer */
  totalRecords?: number;
  /** Module search term */
  searchTerm?: string;
  /** Module search handler */
  onSearch?: (term: string) => void;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Sort handler */
  onSort?: () => void;
  /** Refresh handler */
  onRefresh?: () => void;
  /** KPI strip cards (Accounts, Deals) */
  kpiCards?: KpiCard[];
  /** Extra toolbar content (e.g. pipeline selector) */
  toolbarExtra?: ReactNode;
  /** Content area — the actual view (table/cards/kanban) */
  children: ReactNode;
  /** Bulk selection bar */
  bulkSelection?: { count: number; onClear: () => void; actions: ReactNode };
}

// ── View Icons Map ─────────────────────────────────────────────────────────────

const VIEW_OPTIONS: Record<ViewType, ViewOption> = {
  list: { id: 'list', label: 'List View', icon: List },
  tile: { id: 'tile', label: 'Tile View', icon: LayoutGrid },
  table: { id: 'table', label: 'Table View', icon: Table2 },
  kanban: { id: 'kanban', label: 'Kanban View', icon: Columns3 },
  grid: { id: 'grid', label: 'Grid View', icon: Grid3X3 },
  forecast: { id: 'forecast', label: 'Forecast View', icon: TrendingUp },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ModuleWorkspace({
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  onImport,
  canCreate = true,
  availableViews,
  activeView,
  onViewChange,
  savedTabs,
  activeTab,
  onTabChange,
  filterGroups,
  onFilterToggle,
  filterSearchTerm = '',
  onFilterSearch,
  showFilters = true,
  onToggleFilters,
  totalRecords = 0,
  searchTerm = '',
  onSearch,
  searchPlaceholder = 'Search records...',
  onSort,
  onRefresh,
  kpiCards,
  toolbarExtra,
  children,
  bulkSelection,
}: ModuleWorkspaceProps): React.ReactElement {
  const [viewMenuOpen, setViewMenuOpen] = useState(false);

  const handleViewSelect = useCallback((view: ViewType) => {
    onViewChange(view);
    setViewMenuOpen(false);
  }, [onViewChange]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-[28px] font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-[13px] text-[#5A6B85] dark:text-slate-400 mt-0.5">
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onImport && (
            <button
              onClick={onImport}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-medium text-[#0F172A] dark:text-slate-200 bg-white dark:bg-slate-800 border border-[#E4E9F0] dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Upload size={14} />
              Import
            </button>
          )}
          {canCreate && (
            <button
              onClick={onPrimaryAction}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-[13px] font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors shadow-sm"
            >
              <span className="text-base leading-none">+</span>
              {primaryActionLabel}
              <ChevronDown size={14} className="ml-0.5 opacity-60" />
            </button>
          )}
        </div>
      </div>

      {/* ── Saved View Tabs ─────────────────────────────────────────── */}
      {savedTabs && savedTabs.length > 0 && (
        <div className="flex items-center gap-1 mb-3 border-b border-[#E4E9F0] dark:border-slate-700">
          {savedTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              className={cn(
                'px-3 py-2 text-[13px] font-medium transition-colors relative',
                activeTab === tab.id
                  ? 'text-[#2563EB] dark:text-blue-400'
                  : 'text-[#5A6B85] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white',
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563EB] dark:bg-blue-400 rounded-full" />
              )}
            </button>
          ))}
          <button className="px-2 py-2 text-[#5A6B85] hover:text-[#0F172A] dark:hover:text-white transition-colors">
            <span className="text-lg leading-none">···</span>
          </button>
        </div>
      )}

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Filter toggle */}
        <button
          onClick={onToggleFilters}
          className={cn(
            'inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold rounded-lg border transition-colors',
            showFilters
              ? 'bg-[#2563EB] text-white border-[#2563EB]'
              : 'bg-white dark:bg-slate-800 text-[#5A6B85] dark:text-slate-300 border-[#E4E9F0] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700',
          )}
        >
          <Filter size={13} />
          Filter
        </button>

        {/* Sort */}
        {onSort && (
          <button
            onClick={onSort}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-[#5A6B85] dark:text-slate-300 bg-white dark:bg-slate-800 border border-[#E4E9F0] dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowUpDown size={13} />
            Sort
          </button>
        )}

        {/* View Switcher (segmented) */}
        <div className="inline-flex items-center bg-white dark:bg-slate-800 border border-[#E4E9F0] dark:border-slate-700 rounded-lg p-0.5">
          {availableViews.map((viewId) => {
            const viewOption = VIEW_OPTIONS[viewId];
            const Icon = viewOption.icon;
            const isActive = activeView === viewId;
            return (
              <button
                key={viewId}
                onClick={() => onViewChange(viewId)}
                title={viewOption.label}
                aria-label={viewOption.label}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  isActive
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'text-[#5A6B85] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700',
                )}
              >
                <Icon size={15} />
              </button>
            );
          })}

          {/* View dropdown chevron */}
          <div className="relative">
            <button
              onClick={() => setViewMenuOpen(!viewMenuOpen)}
              className="p-1.5 text-[#5A6B85] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white rounded-md transition-colors"
              aria-label="View options"
            >
              <ChevronDown size={13} />
            </button>
            <AnimatePresence>
              {viewMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-1 w-44 bg-white dark:bg-slate-800 border border-[#E4E9F0] dark:border-slate-700 rounded-xl shadow-lg z-30 py-1.5 overflow-hidden"
                >
                  {availableViews.map((viewId) => {
                    const viewOption = VIEW_OPTIONS[viewId];
                    const Icon = viewOption.icon;
                    const isActive = activeView === viewId;
                    return (
                      <button
                        key={viewId}
                        onClick={() => handleViewSelect(viewId)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors',
                          isActive
                            ? 'text-[#2563EB] dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10'
                            : 'text-[#0F172A] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700',
                        )}
                      >
                        <Icon size={15} />
                        {viewOption.label}
                        {isActive && <span className="ml-auto text-[#2563EB]">✓</span>}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Refresh */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1.5 text-[#5A6B85] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        )}

        {/* Extra toolbar (pipeline selector, etc.) */}
        {toolbarExtra}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Module search */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearch?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-48 lg:w-56 pl-8 pr-3 text-[12px] rounded-lg border border-[#E4E9F0] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 placeholder:text-[#5A6B85] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
          />
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A6B85]" />
        </div>

        {/* Manage columns */}
        <button
          className="p-1.5 text-[#5A6B85] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Manage columns"
        >
          <SlidersHorizontal size={15} />
        </button>
      </div>

      {/* ── KPI Strip ───────────────────────────────────────────────── */}
      {kpiCards && kpiCards.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {kpiCards.map((kpi) => (
            <div
              key={kpi.label}
              className="bg-white dark:bg-slate-800/60 border border-[#E4E9F0] dark:border-slate-700 rounded-xl p-3.5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400 mb-1">
                {kpi.label}
              </p>
              <p className="text-xl font-extrabold text-[#0F172A] dark:text-white tabular-nums">
                {kpi.value}
              </p>
              {kpi.subtitle && (
                <p className="text-[11px] text-[#5A6B85] dark:text-slate-400 mt-0.5">
                  {kpi.subtitle}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Main Content Area ───────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-0">
        {/* Filter Rail */}
        <AnimatePresence>
          {showFilters && filterGroups && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="shrink-0 overflow-hidden"
            >
              <div className="w-[260px] h-full flex flex-col bg-white dark:bg-slate-800/40 border border-[#E4E9F0] dark:border-slate-700 rounded-xl mr-3 overflow-hidden">
                {/* Filter header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E9F0] dark:border-slate-700">
                  <span className="text-[13px] font-semibold text-[#0F172A] dark:text-white">
                    Filter by
                  </span>
                  <button
                    onClick={onToggleFilters}
                    className="p-1 text-[#5A6B85] hover:text-[#0F172A] dark:hover:text-white rounded transition-colors"
                    aria-label="Close filters"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Filter search */}
                <div className="px-3 py-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={filterSearchTerm}
                      onChange={(e) => onFilterSearch?.(e.target.value)}
                      placeholder="Search filters"
                      className="w-full h-8 pl-8 pr-3 text-[12px] rounded-lg border border-[#E4E9F0] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#0F172A] dark:text-slate-200 placeholder:text-[#5A6B85] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
                    />
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A6B85]" />
                  </div>
                </div>

                {/* Filter groups */}
                <div className="flex-1 overflow-y-auto px-3 py-1 custom-scrollbar">
                  {filterGroups.map((group) => (
                    <FilterGroupSection
                      key={group.id}
                      group={group}
                      filterSearchTerm={filterSearchTerm}
                      onToggle={onFilterToggle}
                    />
                  ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-[#E4E9F0] dark:border-slate-700 text-[11.5px] text-[#5A6B85] dark:text-slate-400">
                  {totalRecords} records in this module
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Content area */}
        <div className="flex-1 min-w-0 flex flex-col">
          {children}
        </div>
      </div>

      {/* ── Bulk Selection Bar ───────────────────────────────────────── */}
      <AnimatePresence>
        {bulkSelection && bulkSelection.count > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#0F172A] dark:bg-slate-700 text-white rounded-xl px-4 py-2.5 shadow-xl flex items-center gap-3 text-[13px]"
          >
            <span className="font-semibold">{bulkSelection.count} selected</span>
            <button
              onClick={bulkSelection.onClear}
              className="text-slate-300 hover:text-white text-[12px] underline transition-colors"
            >
              Clear
            </button>
            <div className="h-4 w-px bg-slate-600" />
            {bulkSelection.actions}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Filter Group Sub-component ─────────────────────────────────────────────────

interface FilterGroupSectionProps {
  group: FilterGroup;
  filterSearchTerm?: string;
  onToggle?: (groupId: string, itemId: string) => void;
}

function FilterGroupSection({ group, filterSearchTerm = '', onToggle }: FilterGroupSectionProps): React.ReactElement | null {
  const [isExpanded, setIsExpanded] = useState(group.isExpanded ?? true);

  const visibleItems = React.useMemo(() => {
    if (!filterSearchTerm.trim()) return group.items;
    const term = filterSearchTerm.toLowerCase().trim();
    return group.items.filter((item) => item.label.toLowerCase().includes(term));
  }, [group.items, filterSearchTerm]);

  if (visibleItems.length === 0 && filterSearchTerm.trim()) {
    return null;
  }

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 w-full text-left py-1.5"
      >
        <ChevronDown
          size={12}
          className={cn(
            'text-[#5A6B85] transition-transform',
            !isExpanded && '-rotate-90',
          )}
        />
        <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[#5A6B85] dark:text-slate-400">
          {group.label}
        </span>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-0.5 pl-1">
              {visibleItems.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={item.isChecked ?? false}
                    onChange={() => onToggle?.(group.id, item.id)}
                    className="w-3.5 h-3.5 rounded border-[#E4E9F0] dark:border-slate-600 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer"
                    aria-label={`Filter by ${item.label}`}
                  />
                  <span className="flex-1 text-[12.5px] text-[#0F172A] dark:text-slate-200 truncate min-w-0">
                    {item.label}
                  </span>
                  {item.count !== undefined && (
                    <span className="text-[11px] text-[#5A6B85] dark:text-slate-500 tabular-nums shrink-0">
                      {item.count}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
