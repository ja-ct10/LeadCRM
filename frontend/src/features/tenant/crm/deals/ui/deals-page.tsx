'use client';

import React, { useState, useMemo } from 'react';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { useColumnPreferences } from '@/shared/hooks/use-column-preferences';
import { useTablePreferences } from '@/shared/hooks/use-table-preferences';
import { ModuleWorkspace, ViewType } from '@/shared/components/crm';
import { DealDetailsModal } from '@/features/tenant/crm/pipeline/ui/deal-details-modal';
import { useDealsPage } from '../hooks/use-deals-page';
import { DEALS_MODULE_CONFIG } from '../deals.config';
import { DEALS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';
import DealsTable from '../ui/deals-table';
import DealFilters from '../ui/deal-filters';
import type { Deal, Task } from '@/store/types';
import type { ColumnConfigItem } from '@leadcrm/shared';
import { usePagination } from '@/shared/hooks/use-pagination';
import { Pagination } from '@/shared/components/ui/pagination';
import { toast } from 'sonner';

function formatCurrency(value: number): string {
  return '₱' + Math.round(value).toLocaleString('en-PH');
}

export default function DealsPage() {
  const { user, tenant } = useAuth();
  const { tasks, users, updateDeal, moveDealStage, deleteDeal, addTask, updateTask, isBillingModuleEnabled } = useData();
  const canCreate = useHasPermission('deals.create');
  const canEdit   = useHasPermission('deals.edit');
  const canDelete = useHasPermission('deals.delete');

  const {
    deals, totalCount, filters, setFilters,
    selectedDeal, setSelectedDeal,
    stageNameMap, stageProbabilityMap, pipelineNameMap,
    forecastTotal, pipelines,
  } = useDealsPage();

  // ── Column Preferences ────────────────────────────────────────────────
  const {
    effectiveColumns,
  } = useColumnPreferences('deals');

  // ── Table Preferences (pageSize, viewMode, sort) ──────────────────────
  const {
    pageSize,
    viewMode,
    sort,
    setPageSize,
    setViewMode,
    setSort,
  } = useTablePreferences('deals');

  /** Visible columns sorted by order — drives table rendering */
  const visibleColumns = useMemo((): ColumnConfigItem[] => {
    if (effectiveColumns.length === 0) {
      return DEALS_COLUMN_REGISTRY
        .filter((col) => col.defaultVisible)
        .sort((a, b) => a.defaultOrder - b.defaultOrder)
        .map((col) => ({ id: col.id, visible: true, order: col.defaultOrder }));
    }
    return [...effectiveColumns]
      .filter((col) => col.visible)
      .sort((a, b) => a.order - b.order);
  }, [effectiveColumns]);

  // ── View state ────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<ViewType>('table');

  const {
    currentPage,
    pageSize: paginationPageSize,
    totalPages,
    totalItems,
    goToPage,
    setPageSize: setPaginationPageSize,
    paginateItems,
  } = usePagination({
    totalItems: deals.length,
    initialPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
    resetDeps: [filters],
  });

  const paginatedDeals = useMemo(() => paginateItems(deals), [paginateItems, deals]);

  const selectedPipeline = selectedDeal
    ? (pipelines.find(p => p.id === selectedDeal.pipelineId) ?? pipelines[0])
    : null;

  const handleNavigate = (path: string) => {
    void path;
  };

  return (
    <>
      <ModuleWorkspace
        moduleId="deals"
        title="All Deals"
        description={`${totalCount} ${totalCount === 1 ? 'deal' : 'deals'} total`}
        primaryActionLabel="Add Deal"
        onPrimaryAction={() => toast.info('Deal creation coming soon')}
        canCreate={canCreate}
        availableViews={['table', 'list', 'grid', 'tile', 'kanban']}
        activeView={activeView}
        onViewChange={setActiveView}

        sortableFields={DEALS_COLUMN_REGISTRY.map((col) => ({ id: col.id, label: col.label }))}
        sort={sort}
        onSortChange={setSort}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalRecords={totalCount}
        onRefresh={() => toast.success('Refreshed')}
        kpiCards={[
          { label: 'TOTAL DEALS', value: String(totalCount) },
          { label: 'WEIGHTED FORECAST', value: formatCurrency(forecastTotal) },
        ]}
      >
        {/* Default children — existing table rendering (used when moduleConfig view renderer is not active) */}
        <div className="space-y-4">
          <DealFilters filters={filters} onChange={setFilters} pipelines={pipelines} />

          <div className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-white/[0.06] p-4">
            <DealsTable
              deals={paginatedDeals}
              stageNameMap={stageNameMap}
              stageProbabilityMap={stageProbabilityMap}
              pipelineNameMap={pipelineNameMap}
              pipelineStagesMap={Object.fromEntries(pipelines.map(p => [p.id, p.stages]))}
              onRowClick={setSelectedDeal}
              onStageChange={async (dealId, stageId) => {
                await moveDealStage(dealId, stageId);
              }}
            />
          </div>

          <div className="mt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={paginationPageSize}
              totalItems={totalItems}
              pageSizeOptions={[10, 25, 50, 100]}
              onPageChange={goToPage}
              onPageSizeChange={setPaginationPageSize}
            />
          </div>
        </div>
      </ModuleWorkspace>

      {selectedDeal && selectedPipeline && (
        <DealDetailsModal
          deal={selectedDeal}
          pipeline={selectedPipeline}
          users={users}
          tasks={tasks.filter((t: Task) => t.dealId === selectedDeal.id)}
          currentUserId={user?.id ?? ''}
          tenantId={tenant?.id ?? ''}
          canEdit={canEdit}
          canDelete={canDelete}
          isAutomatedOnly={false}
          isBillingModuleEnabled={isBillingModuleEnabled}
          onClose={() => setSelectedDeal(null)}
          onUpdateDeal={async (id, updates) => {
            try {
              await updateDeal(id, updates);
              toast.success("Deal updated successfully");
            } catch (err: unknown) {
              toast.error(err instanceof Error ? err.message : "Failed to update deal");
            }
          }}
          onDeleteDeal={async (deal: Deal) => {
            try {
              await deleteDeal(deal.id);
              setSelectedDeal(null);
              toast.success("Deal deleted successfully");
            } catch (err: unknown) {
              toast.error(err instanceof Error ? err.message : "Failed to delete deal");
            }
          }}
          onAddTask={(taskData) => addTask(taskData)}
          onUpdateTask={(id, updates) => updateTask(id, updates)}
          onMarkLost={async (deal: Deal) => {
            const dealPipeline = pipelines.find(p => p.id === deal.pipelineId) ?? pipelines[0];
            const lostStage = dealPipeline?.stages.find(
              s => s.name === 'Closed Lost' || s.isLost
            );
            if (!lostStage) {
              toast.error("No 'Closed Lost' stage found in this pipeline.");
              return;
            }
            try {
              await moveDealStage(deal.id, lostStage.id);
              toast.success("Deal marked as lost");
            } catch (err: unknown) {
              toast.error(err instanceof Error ? err.message : "Failed to update deal");
            }
          }}
          onNavigate={handleNavigate}
        />
      )}
    </>
  );
}