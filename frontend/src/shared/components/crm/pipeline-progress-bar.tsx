'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/shared/components/ui/tooltip';

// --- Types ---

interface StageItem {
  id: string;
  name: string;
  isWon?: boolean;
  isLost?: boolean;
  order: number;
  color?: string;
}

interface PipelineProgressBarProps {
  stages: StageItem[];
  currentStageId: string;
  isWon?: boolean;
  isLost?: boolean;
  onStageClick?: (stageId: string) => void;
  canChangeStage?: boolean;
  /** Show stage name labels below dots. Default: true */
  showLabels?: boolean;
}

// --- Helpers ---

type StageStatus = 'completed' | 'current' | 'future' | 'won' | 'lost';

function getStageStatus(
  stage: StageItem,
  currentOrder: number,
  isWon: boolean,
  isLost: boolean
): StageStatus {
  if (isWon && stage.id === 'won') return 'won';
  if (isLost && stage.id === 'lost') return 'lost';
  if (stage.isWon && isWon) return 'won';
  if (stage.isLost && isLost) return 'lost';
  if (stage.order < currentOrder) return 'completed';
  if (stage.order === currentOrder) return 'current';
  return 'future';
}

function getDotClasses(status: StageStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-primary/60 border-primary/60';
    case 'current':
      return 'bg-primary border-primary ring-2 ring-primary/20';
    case 'won':
      return 'bg-emerald-500 border-emerald-500 dark:bg-emerald-400 dark:border-emerald-400';
    case 'lost':
      return 'bg-destructive border-destructive';
    case 'future':
      return 'bg-transparent border-muted-foreground/40';
  }
}

function getLineClasses(status: StageStatus): string {
  switch (status) {
    case 'completed':
    case 'current':
      return 'bg-primary/60';
    case 'won':
      return 'bg-emerald-500 dark:bg-emerald-400';
    case 'lost':
      return 'bg-destructive';
    case 'future':
      return 'bg-muted-foreground/20';
  }
}

function getLabelClasses(status: StageStatus): string {
  switch (status) {
    case 'current':
      return 'font-semibold text-primary';
    case 'completed':
      return 'text-muted-foreground';
    case 'won':
      return 'font-semibold text-emerald-600 dark:text-emerald-400';
    case 'lost':
      return 'font-semibold text-destructive';
    case 'future':
      return 'text-muted-foreground/60';
  }
}

// --- Main Component ---

export function PipelineProgressBar({
  stages,
  currentStageId,
  isWon = false,
  isLost = false,
  onStageClick,
  canChangeStage = false,
  showLabels = true,
}: PipelineProgressBarProps): React.ReactNode {
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.order - b.order),
    [stages]
  );

  const currentStage = sortedStages.find((s) => s.id === currentStageId);
  const currentOrder = currentStage?.order ?? 0;
  const currentIndex = sortedStages.findIndex((s) => s.id === currentStageId);

  const isClickable = Boolean(onStageClick) && canChangeStage;

  return (
    <div className="w-full">
      {/* Compact view for narrow screens — shows current stage name */}
      <div className="flex items-center justify-center sm:hidden">
        <span className="text-xs font-medium text-muted-foreground">
          Stage: <span className="text-foreground font-semibold">{currentStage?.name ?? 'Unknown'}</span>
          {' '}({currentIndex + 1}/{sortedStages.length})
        </span>
      </div>

      {/* Full progress bar for wider panels */}
      <div className="hidden sm:flex items-start w-full gap-0">
        <TooltipProvider>
          {sortedStages.map((stage, index) => {
            const status = getStageStatus(stage, currentOrder, isWon, isLost);
            const isLast = index === sortedStages.length - 1;
            const lineStatus = index < currentIndex ? 'completed' : 'future';

            return (
              <div key={stage.id} className={cn('flex flex-col items-center', !isLast && 'flex-1')}>
                {/* Dot + Line row */}
                <div className="flex items-center w-full">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={!isClickable}
                        onClick={() => isClickable && onStageClick?.(stage.id)}
                        aria-label={`${stage.name}${status === 'current' ? ' (current)' : ''}`}
                        className={cn(
                          'relative shrink-0 rounded-full border-2 transition-all',
                          status === 'current' ? 'size-3.5' : 'size-3',
                          getDotClasses(status),
                          isClickable
                            ? 'cursor-pointer hover:ring-2 hover:ring-primary/30'
                            : 'cursor-default'
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{stage.name}</TooltipContent>
                  </Tooltip>

                  {/* Connecting line */}
                  {!isLast && (
                    <div
                      className={cn(
                        'h-0.5 flex-1 min-w-2 transition-colors',
                        getLineClasses(lineStatus)
                      )}
                    />
                  )}
                </div>

                {/* Label below dot */}
                {showLabels && (
                  <span
                    className={cn(
                      'text-[10px] mt-1.5 max-w-[72px] truncate text-center leading-tight',
                      getLabelClasses(status),
                    )}
                    title={stage.name}
                  >
                    {stage.name}
                  </span>
                )}
              </div>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}

export type { PipelineProgressBarProps, StageItem };
