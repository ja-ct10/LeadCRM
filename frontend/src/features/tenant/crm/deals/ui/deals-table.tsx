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
        <p className="text-sm">No deals found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-white/[0.06] text-left">
            {['Deal', 'Pipeline', 'Stage', 'Value', 'Probability', 'Priority', 'Close Date'].map(h => (
              <th key={h} className="pb-3 pr-4 font-medium text-slate-500 dark:text-slate-400">{h}</th>
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
                className="border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors">
                <td className="py-3 pr-4">
                  <p className="font-medium text-slate-900 dark:text-white">{deal.title}</p>
                  <p className="text-xs text-slate-400">{deal.companyName}</p>
                </td>
                <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                  {pipelineNameMap[deal.pipelineId] ?? '—'}
                </td>
                <td className="py-3 pr-4">
                  <span className="px-2 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    {stageNameMap[deal.stageId] ?? deal.stageId}
                  </span>
                </td>
                <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">
                  {formatCurrency(deal.value)}
                </td>
                <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                  {prob}%
                  <span className="ml-1 text-xs text-slate-400">
                    ({formatCurrency(Math.round(deal.value * prob / 100))})
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityClass}`}>
                    {deal.priority}
                  </span>
                </td>
                <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
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
