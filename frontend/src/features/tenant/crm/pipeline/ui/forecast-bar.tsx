'use client';

import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import type { Deal, Pipeline } from '@/store/types';

interface ForecastBarProps {
  deals: Deal[];
  pipelines: Pipeline[];
}

function formatCurrency(value: number): string {
  return '₱' + Math.round(value).toLocaleString('en-PH');
}

export default function ForecastBar({ deals, pipelines }: ForecastBarProps) {
  const { stageMap, forecast, totalOpen } = useMemo(() => {
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

    return { stageMap, forecast, totalOpen: openDeals.length };
  }, [deals, pipelines]);

  const wonDeals = deals.filter(d => d.stageId.toLowerCase().includes('won') && !d.isArchived);
  const wonTotal = wonDeals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-200 dark:border-white/[0.06]">
      <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />

      <div className="flex flex-wrap gap-6">
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Open Deals</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">{totalOpen}</p>
        </div>

        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Weighted Forecast</p>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(forecast)}</p>
        </div>

        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Won Revenue</p>
          <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatCurrency(wonTotal)}</p>
        </div>
      </div>
    </div>
  );
}
