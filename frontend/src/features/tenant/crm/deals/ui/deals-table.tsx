'use client';

import React from 'react';
import { Briefcase } from 'lucide-react';
import type { Deal } from '@/store/types';
import { DEAL_PRIORITY_COLORS } from '../constants/deal.constants';

interface DealsTableProps {
  deals: Deal[];
  stageNameMap: Record<string, string>;
  stageProbabilityMap: Record<string, number>;
  pipelineNameMap: Record<string, string>;
  onRowClick: (deal: Deal) => void;
}

function formatCurrency(value: number): string {
  return '₱' + value.toLocaleString('en-PH');
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DealsTable({
  deals, stageNameMap, stageProbabilityMap, pipelineNameMap, onRowClick,
}: DealsTableProps) {
  if (deals.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400 dark:text-slate-500">
        <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">No deals found</p>
        <p className="text-xs text-slate-400 mt-1">There are no active or historical deal records for this view.</p>
      </div>
    );
  }

  const columns = ['Deal', 'Value', 'Pipeline', 'Stage', 'Probability', 'Priority', 'Close Date'];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-white/[0.06] text-left">
            {columns.map(h => (
              <th key={h} className={`pb-3 pr-4 font-semibold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider ${h === 'Value' ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deals.map(deal => {
            const prob = stageProbabilityMap[deal.stageId] ?? 0;
            const priorityClass = DEAL_PRIORITY_COLORS[deal.priority] ?? '';
            return (
              <tr key={deal.id}
                onClick={() => onRowClick(deal)}
                className="border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer transition-colors">
                {/* 1. Deal Column (Enriched with title + product subtext + company/contact) */}
                <td className="py-3 pr-4 min-w-[220px]">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">{deal.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {deal.companyName || deal.contactPerson}
                    {deal.leadSource ? ` • ${deal.leadSource}` : ''}
                  </p>
                </td>

                {/* 2. Value Column (Immediately after Deal column) */}
                <td className="py-3 pr-4 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  {typeof deal.value === 'number' && deal.value > 0 ? (
                    <span className="inline-flex flex-col items-end">
                      <span>{formatCurrency(deal.value)}</span>
                      <span className="text-[9px] font-normal text-slate-400 dark:text-slate-500">PHP</span>
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">—</span>
                  )}
                </td>

                {/* 3. Pipeline Column */}
                <td className="py-3 pr-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {pipelineNameMap[deal.pipelineId] ?? '—'}
                </td>

                {/* 4. Stage Column */}
                <td className="py-3 pr-4 whitespace-nowrap">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20">
                    {stageNameMap[deal.stageId] ?? deal.stageId}
                  </span>
                </td>

                {/* 5. Probability Column */}
                <td className="py-3 pr-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  <span className="font-semibold">{prob}%</span>
                  <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                    ({formatCurrency(Math.round((deal.value || 0) * prob / 100))})
                  </span>
                </td>

                {/* 6. Priority Column */}
                <td className="py-3 pr-4 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityClass}`}>
                    {deal.priority}
                  </span>
                </td>

                {/* 7. Close Date Column */}
                <td className="py-3 pr-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {formatDate(deal.expectedCloseDate)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
