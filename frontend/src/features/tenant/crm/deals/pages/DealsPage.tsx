'use client';

import React from 'react';
import { Briefcase, TrendingUp } from 'lucide-react';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { useHasPermission } from '@/shared/hooks/usePermissions';
import { DealDetailsModal } from '@/features/tenant/crm/pipeline/ui/deal-details-modal';
import { useDealsPage } from '../hooks/use-deals-page';
import DealsTable from '../ui/deals-table';
import DealFilters from '../ui/deal-filters';
import type { Deal, Task } from '@/store/types';

function formatCurrency(value: number): string {
  return '₱' + Math.round(value).toLocaleString('en-PH');
}

export default function DealsPage() {
  const { user, tenant } = useAuth();
  const { tasks, users, updateDeal, deleteDeal, addTask, updateTask, isBillingModuleEnabled } = useData();
  const canEdit   = useHasPermission('deals.edit');
  const canDelete = useHasPermission('deals.delete');

  const {
    deals, totalCount, filters, setFilters,
    selectedDeal, setSelectedDeal,
    stageNameMap, stageProbabilityMap, pipelineNameMap,
    forecastTotal, pipelines,
  } = useDealsPage();

  const selectedPipeline = selectedDeal
    ? (pipelines.find(p => p.id === selectedDeal.pipelineId) ?? pipelines[0])
    : null;

  const handleNavigate = (path: string) => {
    // No-op in the standalone deals page — navigation handled by App Router
    void path;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-blue-500" />
            All Deals
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {totalCount} {totalCount === 1 ? 'deal' : 'deals'} total
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Weighted Forecast</p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              {formatCurrency(forecastTotal)}
            </p>
          </div>
        </div>
      </div>

      <DealFilters filters={filters} onChange={setFilters} pipelines={pipelines} />

      <div className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-white/[0.06] p-4">
        <DealsTable
          deals={deals}
          stageNameMap={stageNameMap}
          stageProbabilityMap={stageProbabilityMap}
          pipelineNameMap={pipelineNameMap}
          onRowClick={setSelectedDeal}
        />
      </div>

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
          onUpdateDeal={(id, updates) => updateDeal(id, updates)}
          onDeleteDeal={(deal: Deal) => { deleteDeal(deal.id); setSelectedDeal(null); }}
          onAddTask={(taskData) => addTask(taskData)}
          onUpdateTask={(id, updates) => updateTask(id, updates)}
          onMarkLost={(deal: Deal) => updateDeal(deal.id, { stageId: 'stage_lost' })}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}
