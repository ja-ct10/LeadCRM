'use client';

import React, { useMemo } from 'react';
import type { Deal, Pipeline } from '@/store/types';
import { formatCurrency as formatCurrencyUtil, getTenantCurrency } from '@/shared/utils/currency';
import type { CurrencyConfig } from '@/shared/utils/currency';

/** Server-side forecast response from GET /api/v1/crm/deals/forecast */
export interface ForecastResult {
  total: number;
  currency: string;
  byPipeline: Array<{ pipelineId: string; name: string; total: number }>;
}

interface ForecastBarProps {
  deals: Deal[];
  pipelines: Pipeline[];
  /** Server-computed forecast from the forecast API endpoint */
  serverForecast?: ForecastResult | null;
  /** Tenant object for currency resolution */
  tenant?: { currency?: string } | null;
}

export default function ForecastBar({ deals, pipelines, serverForecast, tenant }: ForecastBarProps) {
  const currencyConfig: CurrencyConfig = useMemo(
    () => {
      // If server forecast provides a currency, use that
      if (serverForecast?.currency) {
        return getTenantCurrency({ currency: serverForecast.currency });
      }
      // Otherwise use tenant config
      return getTenantCurrency(tenant ?? null);
    },
    [serverForecast?.currency, tenant]
  );

  const { forecast, totalOpen, totalPipelineValue } = useMemo(() => {
    // Build stage probability map and terminal flags from all pipelines
    const stageMap: Record<string, { probability: number; isWon: boolean; isLost: boolean }> = {};
    pipelines.forEach(p => p.stages.forEach(s => {
      stageMap[s.id] = { probability: s.probability ?? 0, isWon: !!s.isWon, isLost: !!s.isLost };
    }));

    // UX-2 fix: use flags, never name substrings, to determine terminal status
    const openDeals = deals.filter(d => {
      if (d.isArchived) return false;
      const stageInfo = stageMap[d.stageId];
      if (!stageInfo) return true; // unknown stage — treat as open
      return !stageInfo.isWon && !stageInfo.isLost;
    });

    // Use server forecast total if available, otherwise compute client-side
    const forecastTotal = serverForecast
      ? serverForecast.total
      : openDeals.reduce((sum, d) =>
          sum + d.value * ((stageMap[d.stageId]?.probability ?? 0) / 100), 0,
        );

    const totalPipelineValue = openDeals.reduce((sum, d) => sum + d.value, 0);

    return { forecast: forecastTotal, totalOpen: openDeals.length, totalPipelineValue };
  }, [deals, pipelines, serverForecast]);

  // UX-2 fix: won detection by flag, not name
  const wonDeals = useMemo(() => {
    const stageFlags: Record<string, boolean> = {};
    pipelines.forEach(p => p.stages.forEach(s => {
      if (s.isWon) stageFlags[s.id] = true;
    }));
    return deals.filter(d => !d.isArchived && stageFlags[d.stageId]);
  }, [deals, pipelines]);

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
          <span className="text-base font-bold text-slate-900 dark:text-white">{formatCurrencyUtil(totalPipelineValue, currencyConfig)}</span>
        </div>
      </div>

      <div className="flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 pr-3 last:border-0">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Weighted Forecast</span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{formatCurrencyUtil(forecast, currencyConfig)}</span>
        </div>
      </div>

      <div className="flex flex-col justify-between">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Closed Won Revenue</span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-base font-bold text-blue-600 dark:text-blue-400">{formatCurrencyUtil(wonTotal, currencyConfig)}</span>
        </div>
      </div>
    </div>
  );
}


