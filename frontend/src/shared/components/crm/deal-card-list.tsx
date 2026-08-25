'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Trophy, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { DealCard } from './deal-card';
import { DealCardMenu } from './deal-card-menu';
import type { DealCardData } from './deal-card.utils';
import { formatDealValue } from './deal-card.utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'active' | 'won' | 'lost';

interface DealCardListProps {
  deals: DealCardData[];
  entityType: 'account' | 'contact' | 'lead';
  entityId: string;
  onCreateDeal?: () => void;
  onEditDeal?: (dealId: string) => void;
  onDeleteDeal?: (dealId: string) => Promise<void>;
  onArchiveDeal?: (dealId: string) => Promise<void>;
  onDealMutated?: () => void;
  isLoading?: boolean;
  maxVisible?: number;
}

// ─── Filter Helpers ──────────────────────────────────────────────────────────

function filterDealsByStatus(deals: DealCardData[], filter: StatusFilter): DealCardData[] {
  switch (filter) {
    case 'active':
      return deals.filter((d) => !d.isWon && !d.isLost && !d.isArchived);
    case 'won':
      return deals.filter((d) => d.isWon);
    case 'lost':
      return deals.filter((d) => d.isLost);
    default:
      return deals;
  }
}

function computePipelineTotal(deals: DealCardData[]): number {
  return deals
    .filter((d) => !d.isWon && !d.isLost && !d.isArchived)
    .reduce((sum, d) => sum + (d.value ?? 0), 0);
}

function computeActiveCount(deals: DealCardData[]): number {
  return deals.filter((d) => !d.isWon && !d.isLost && !d.isArchived).length;
}

// ─── Filter URL Builder ──────────────────────────────────────────────────────

function buildViewAllUrl(entityType: 'account' | 'contact' | 'lead', entityId: string): string {
  const paramMap: Record<string, string> = {
    account: 'organizationId',
    contact: 'contactId',
    lead: 'leadId',
  };
  return `/crm/deals?${paramMap[entityType]}=${entityId}`;
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function SummaryHeader({ activeCount, pipelineTotal, currency }: {
  activeCount: number;
  pipelineTotal: number;
  currency?: string;
}): React.ReactElement {
  const valueStr = formatDealValue(pipelineTotal, currency);
  return (
    <div className="flex items-center gap-2 text-sm">
      <Trophy className="h-4 w-4 text-amber-500" />
      <span className="font-medium text-foreground">
        {activeCount} Active {activeCount === 1 ? 'Deal' : 'Deals'}
      </span>
      {pipelineTotal > 0 && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{valueStr} total pipeline</span>
        </>
      )}
    </div>
  );
}

function FilterChips({ active, onChange }: {
  active: StatusFilter;
  onChange: (filter: StatusFilter) => void;
}): React.ReactElement {
  const filters: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'won', label: 'Won' },
    { id: 'lost', label: 'Lost' },
  ];

  return (
    <div className="flex items-center gap-1" role="tablist" aria-label="Deal status filter">
      {filters.map((f) => (
        <button
          key={f.id}
          type="button"
          role="tab"
          aria-selected={active === f.id}
          onClick={() => onChange(f.id)}
          className={cn(
            'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
            active === f.id
              ? 'bg-primary/10 text-primary dark:bg-primary/20'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function LoadingSkeleton(): React.ReactElement {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse border border-border rounded-xl p-4">
          <div className="h-4 w-3/4 bg-muted rounded-full mb-2" />
          <div className="h-3 w-1/2 bg-muted/60 rounded-full mb-2" />
          <div className="h-3 w-1/3 bg-muted/40 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ entityType, onCreateDeal, canCreate }: {
  entityType: string;
  onCreateDeal?: () => void;
  canCreate: boolean;
}): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Trophy className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        No deals associated with this {entityType}.
      </p>
      {canCreate && onCreateDeal && (
        <Button variant="outline" size="sm" onClick={onCreateDeal} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Create Deal
        </Button>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DealCardList({
  deals,
  entityType,
  entityId,
  onCreateDeal,
  onEditDeal,
  onDeleteDeal,
  onArchiveDeal,
  onDealMutated,
  isLoading = false,
  maxVisible = 5,
}: DealCardListProps): React.ReactElement {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const canCreate = useHasPermission('deals.create');

  // Memoized computations
  const activeCount = useMemo(() => computeActiveCount(deals), [deals]);
  const pipelineTotal = useMemo(() => computePipelineTotal(deals), [deals]);
  const filteredDeals = useMemo(() => filterDealsByStatus(deals, statusFilter), [deals, statusFilter]);
  const visibleDeals = useMemo(() => filteredDeals.slice(0, maxVisible), [filteredDeals, maxVisible]);
  const hasMore = filteredDeals.length > maxVisible;

  const handleEditDeal = useCallback((dealId: string) => {
    onEditDeal?.(dealId);
  }, [onEditDeal]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (deals.length === 0) {
    return <EmptyState entityType={entityType} onCreateDeal={onCreateDeal} canCreate={canCreate} />;
  }

  return (
    <div className="space-y-3">
      {/* Header: Summary + Create button */}
      <div className="flex items-center justify-between">
        <SummaryHeader activeCount={activeCount} pipelineTotal={pipelineTotal} />
        {canCreate && onCreateDeal && (
          <Button variant="outline" size="sm" onClick={onCreateDeal} className="gap-1.5 h-7 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Create Deal
          </Button>
        )}
      </div>

      {/* Filter Chips */}
      {deals.length > 1 && (
        <FilterChips active={statusFilter} onChange={setStatusFilter} />
      )}

      {/* Deal Cards */}
      <div className="space-y-2">
        {visibleDeals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            variant="compact"
            showActions
            menuContent={
              <DealCardMenu
                dealId={deal.id}
                dealTitle={deal.title}
                onEdit={onEditDeal ? () => handleEditDeal(deal.id) : undefined}
                onDelete={onDeleteDeal}
                onArchive={onArchiveDeal}
                onDuplicated={onDealMutated}
              />
            }
          />
        ))}
      </div>

      {/* View All link */}
      {hasMore && (
        <Link
          href={buildViewAllUrl(entityType, entityId)}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline pt-1"
        >
          View all {filteredDeals.length} deals
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
