'use client';

import React, { useMemo } from 'react';
import type { Deal, Pipeline } from '@/store/types';

interface ForecastBarProps {
  deals: Deal[];
  pipelines: Pipeline[];
}

function formatCurrency(value: number): string {
  return '₱' + Math.round(value).toLocaleString('en-PH');
}

export default function ForecastBar({ deals, pipelines }: ForecastBarProps) {
  const { forecast, totalOpen, totalPipelineValue } = useMemo(() => {
    // Build stage probability map from all pipelines
    const stageMap: Record<string, number> = {};
    pipelines.forEach(p => p.stages.forEach(s => {
      stageMap[s.id] = s.probability ?? 0;
    }));

    const openDeals = deals.filter(d =>
      !d.isArchived &&
      !d.stageId.toLowerCase().includes('won') &&
      !d.stageId.toLowerCase().includes('lost'),
    );

    const forecast = openDeals.reduce((sum, d) =>
      sum + d.value * ((stageMap[d.stageId] ?? 0) / 100), 0,
    );

    const totalPipelineValue = openDeals.reduce((sum, d) => sum + d.value, 0);

    return { forecast, totalOpen: openDeals.length, totalPipelineValue };
  }, [deals, pipelines]);

  const wonDeals = deals.filter(d => d.stageId.toLowerCase().includes('won') && !d.isArchived);
  const wonTotal = wonDeals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
      <div className="flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 pr-3 last:border-0">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Active Open Deals</span>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="text-base font-bold text-slate-900 dark:text-white">{totalOpen}</span>
          <span className="text-[11px] text-slate-500">deals</span>
        </div>
      </div>

      <div className="flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 pr-3 last:border-0">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Total Open Value</span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-base font-bold text-slate-900 dark:text-white">{formatCurrency(totalPipelineValue)}</span>
        </div>
      </div>

      <div className="flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 pr-3 last:border-0">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Weighted Forecast</span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(forecast)}</span>
        </div>
      </div>

      <div className="flex flex-col justify-between">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Closed Won Revenue</span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-base font-bold text-blue-600 dark:text-blue-400">{formatCurrency(wonTotal)}</span>
        </div>
      </div>
    </div>
  );
}


