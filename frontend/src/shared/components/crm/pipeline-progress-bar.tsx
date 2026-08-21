'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

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

// --- Main Component ---

export function PipelineProgressBar({
  stages,
  currentStageId,
  isWon = false,
  isLost = false,
  onStageClick,
  canChangeStage = false,
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
      {/* Compact view for narrow panels */}
      <div className="flex items-center justify-center sm:hidden">
        <span className="text-xs font-medium text-muted-foreground">
          Stage {currentIndex + 1} of {sortedStages.length}
        </span>
      </div>

      {/* Full progress bar for wider panels */}
      <div className="hidden sm:flex items-center w-full gap-0">
        {sortedStages.map((stage, index) => {
          const status = getStageStatus(stage, currentOrder, isWon, isLost);
          const isLast = index === sortedStages.length - 1;

          return (
            <div key={stage.id} className="flex items-center flex-1 last:flex-none">
              {/* Dot */}
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStageClick?.(stage.id)}
                title={stage.name}
                aria-label={`${stage.name}${status === 'current' ? ' (current)' : ''}`}
                className={cn(
                  'relative size-3 rounded-full border-2 shrink-0 transition-colors',
                  getDotClasses(status),
                  isClickable
                    ? 'cursor-pointer hover:ring-2 hover:ring-primary/30'
                    : 'cursor-default'
                )}
              />

              {/* Connecting line */}
              {!isLast && (
                <div
                  className={cn(
                    'h-0.5 flex-1 min-w-2 transition-colors',
                    getLineClasses(
                      index < sortedStages.findIndex((s) => s.id === currentStageId)
                        ? 'completed'
                        : 'future'
                    )
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { PipelineProgressBarProps, StageItem };
