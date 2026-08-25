'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/shared/components/ui/tooltip';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MetricItem {
  icon: LucideIcon;
  label: string;
  value: string;
  variant?: 'default' | 'warning' | 'danger';
  tooltip?: string;
}

interface RecordMetricsStripProps {
  metrics: MetricItem[];
}

// ─── Variant Classes ─────────────────────────────────────────────────────────

function getValueClasses(variant?: 'default' | 'warning' | 'danger'): string {
  switch (variant) {
    case 'warning':
      return 'text-amber-600 dark:text-amber-400';
    case 'danger':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-foreground';
  }
}

function getIconClasses(variant?: 'default' | 'warning' | 'danger'): string {
  switch (variant) {
    case 'warning':
      return 'text-amber-500 dark:text-amber-400';
    case 'danger':
      return 'text-red-500 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
}

// ─── Metric Item ─────────────────────────────────────────────────────────────

function MetricCell({ metric }: { metric: MetricItem }): React.ReactElement {
  const Icon = metric.icon;
  const content = (
    <div className="flex items-center gap-2">
      <Icon className={cn('h-4 w-4 shrink-0', getIconClasses(metric.variant))} />
      <div className="min-w-0">
        <p className={cn('text-sm font-semibold leading-tight', getValueClasses(metric.variant))}>
          {metric.value}
        </p>
        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
          {metric.label}
        </p>
      </div>
    </div>
  );

  if (metric.tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default">{content}</div>
        </TooltipTrigger>
        <TooltipContent>{metric.tooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function RecordMetricsStrip({ metrics }: RecordMetricsStripProps): React.ReactElement {
  if (metrics.length === 0) return <></>;

  return (
    <TooltipProvider>
      {/* Desktop: horizontal row with dividers */}
      <div className="hidden md:flex items-center gap-6 py-2">
        {metrics.map((metric, idx) => (
          <React.Fragment key={metric.label}>
            {idx > 0 && (
              <div className="h-8 w-px bg-border shrink-0" aria-hidden="true" />
            )}
            <MetricCell metric={metric} />
          </React.Fragment>
        ))}
      </div>

      {/* Mobile: 2x2 grid */}
      <div className="grid grid-cols-2 gap-3 py-2 md:hidden">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-lg border border-border/50 bg-muted/30 dark:bg-white/[0.02] px-3 py-2"
          >
            <MetricCell metric={metric} />
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
