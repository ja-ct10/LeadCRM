'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, DollarSign, Building, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/shared/components/ui/tooltip';
import type { DealCardData } from './deal-card.utils';
import {
  normalizePriority,
  getPriorityClasses,
  getStageClasses,
  formatDealValue,
  formatCloseDate,
} from './deal-card.utils';

// ─── Props ───────────────────────────────────────────────────────────────────

interface DealCardProps {
  deal: DealCardData;
  variant?: 'compact' | 'full';
  onNavigate?: () => void;
  showActions?: boolean;
  menuContent?: React.ReactNode;
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority?: string }): React.ReactElement {
  const level = normalizePriority(priority);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        getPriorityClasses(level)
      )}
    >
      {level}
    </span>
  );
}

function StageBadge({ name, isWon, isLost }: { name?: string; isWon?: boolean; isLost?: boolean }): React.ReactElement | null {
  if (!name) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
        getStageClasses(isWon, isLost)
      )}
    >
      {name}
    </span>
  );
}

function OwnerAvatar({ user }: { user?: { firstName: string; lastName: string } }): React.ReactElement {
  if (!user) {
    return (
      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
        <User className="h-3 w-3 text-muted-foreground" />
      </div>
    );
  }
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
            {initials}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {user.firstName} {user.lastName}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function MiniProgressDots({ stageOrder, totalStages, isWon, isLost }: {
  stageOrder?: number;
  totalStages?: number;
  isWon?: boolean;
  isLost?: boolean;
}): React.ReactElement | null {
  if (stageOrder === undefined || totalStages === undefined || totalStages < 2) return null;

  const maxDots = Math.min(totalStages, 6);
  const dots = Array.from({ length: maxDots }, (_, i) => {
    const isCurrent = i === stageOrder;
    const isCompleted = i < stageOrder;
    return (
      <div
        key={i}
        className={cn(
          'h-1.5 w-1.5 rounded-full transition-colors',
          isCurrent && !isWon && !isLost && 'bg-primary ring-1 ring-primary/30',
          isCurrent && isWon && 'bg-emerald-500',
          isCurrent && isLost && 'bg-destructive',
          isCompleted && 'bg-primary/50',
          !isCurrent && !isCompleted && 'bg-muted-foreground/20',
        )}
      />
    );
  });

  return <div className="flex items-center gap-1">{dots}</div>;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DealCard({
  deal,
  variant = 'compact',
  onNavigate,
  showActions = true,
  menuContent,
}: DealCardProps): React.ReactElement {
  const router = useRouter();

  const handleNavigate = useCallback((): void => {
    if (onNavigate) {
      onNavigate();
    } else {
      router.push(`/crm/deals/${deal.id}`);
    }
  }, [deal.id, onNavigate, router]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNavigate();
    }
  }, [handleNavigate]);

  const valueDisplay = formatDealValue(deal.value, deal.currency);
  const closeDateDisplay = formatCloseDate(deal.expectedCloseDate);

  return (
    <article
      tabIndex={0}
      role="article"
      aria-label={`Deal: ${deal.title}`}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative border border-border rounded-xl bg-card p-4 cursor-pointer transition-all duration-150',
        'hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40',
        'dark:bg-card dark:hover:border-primary/30',
        variant === 'full' && 'p-5',
      )}
    >
      {/* Row 1: Title + Priority + Menu */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <h3 className={cn(
            'font-semibold text-foreground truncate',
            variant === 'compact' ? 'text-sm' : 'text-base',
          )}>
            {deal.title}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <PriorityBadge priority={deal.priority} />
          {showActions && menuContent && (
            <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              {menuContent}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Value · Stage · Close Date */}
      <div className="flex items-center flex-wrap gap-2 mb-2 text-xs text-muted-foreground">
        {valueDisplay !== '—' && (
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            {valueDisplay}
          </span>
        )}
        <StageBadge name={deal.stageName} isWon={deal.isWon} isLost={deal.isLost} />
        {closeDateDisplay !== '—' && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {closeDateDisplay}
          </span>
        )}
      </div>

      {/* Row 3: Owner + Company */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <OwnerAvatar user={deal.assignedUser} />
          {deal.companyName && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground truncate">
              <Building className="h-3 w-3 shrink-0" />
              <span className="truncate">{deal.companyName}</span>
            </span>
          )}
        </div>
        {variant === 'full' && (
          <MiniProgressDots
            stageOrder={deal.stageOrder}
            totalStages={deal.totalStages}
            isWon={deal.isWon}
            isLost={deal.isLost}
          />
        )}
      </div>

      {/* Full variant: additional context */}
      {variant === 'full' && deal.daysInStage !== undefined && (
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {deal.daysInStage} {deal.daysInStage === 1 ? 'day' : 'days'} in stage
          </span>
          {deal.pipelineName && (
            <span className="truncate max-w-[140px]">{deal.pipelineName}</span>
          )}
        </div>
      )}
    </article>
  );
}

export type { DealCardProps, DealCardData };
