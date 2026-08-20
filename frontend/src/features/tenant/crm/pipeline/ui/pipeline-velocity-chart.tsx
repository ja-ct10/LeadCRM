'use client';

import React from 'react';
import { Clock, TrendingUp } from 'lucide-react';

interface VelocityStage {
  stageId: string;
  name: string;
  avgMinutes: number;
  dealCount: number;
}

interface PipelineVelocityChartProps {
  velocityData: {
    stages: VelocityStage[];
    avgTotalMinutes: number;
  } | null;
  isLoading: boolean;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) {
    const hours = Math.round(minutes / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  const days = Math.round(minutes / 1440);
  return `${days} day${days !== 1 ? 's' : ''}`;
}

function getBarColor(minutes: number): string {
  if (minutes >= 12960) return 'bg-red-500 dark:bg-red-400'; // 9+ days — bottleneck
  if (minutes >= 7200) return 'bg-orange-500 dark:bg-orange-400'; // 5+ days — slow
  return 'bg-emerald-500 dark:bg-emerald-400'; // healthy
}

export default function PipelineVelocityChart({ velocityData, isLoading }: PipelineVelocityChartProps): React.ReactElement {
  if (isLoading) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Deal Velocity</span>
        </div>
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded" style={{ width: `${60 - i * 15}%` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!velocityData || velocityData.stages.length === 0) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Deal Velocity</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          No velocity data available. Stage transitions will appear here once deals move through the pipeline.
        </p>
      </div>
    );
  }

  const maxMinutes = Math.max(...velocityData.stages.map(s => s.avgMinutes), 1);

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Deal Velocity</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Avg total: {formatDuration(velocityData.avgTotalMinutes)}</span>
        </div>
      </div>

      <div className="space-y-2.5">
        {velocityData.stages.map(stage => {
          const widthPercent = Math.max((stage.avgMinutes / maxMinutes) * 100, 2);
          return (
            <div key={stage.stageId} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-medium truncate max-w-[50%]">
                  {stage.name}
                </span>
                <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap ml-2">
                  {formatDuration(stage.avgMinutes)} · {stage.dealCount} deal{stage.dealCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-700/50 rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all duration-300 ${getBarColor(stage.avgMinutes)}`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500 dark:bg-emerald-400" /> Healthy
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-orange-500 dark:bg-orange-400" /> Slow
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-red-500 dark:bg-red-400" /> Bottleneck
        </span>
      </div>
    </div>
  );
}
