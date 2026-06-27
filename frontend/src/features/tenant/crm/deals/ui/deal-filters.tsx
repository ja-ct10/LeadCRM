'use client';

import React from 'react';
import { TrelloFilter } from '@/shared/components/TrelloFilter';
import { DEAL_PRIORITIES } from '../constants/deal.constants';
import type { DealPageFilters } from '../types/deal-page.types';
import type { Pipeline } from '@/store/types';

interface DealFiltersProps {
  filters: DealPageFilters;
  onChange: (f: DealPageFilters) => void;
  pipelines: Pipeline[];
}

export default function DealFilters({ filters, onChange, pipelines }: DealFiltersProps) {
  // Collect all unique stages across all pipelines
  const allStages = pipelines.flatMap(p => p.stages).map(s => ({ id: s.id, label: s.name }));
  const uniqueStages = Array.from(new Map(allStages.map(s => [s.id, s])).values());

  return (
    <TrelloFilter
      searchTerm={filters.search}
      setSearchTerm={search => onChange({ ...filters, search })}
      statuses={uniqueStages}
      selectedStatuses={filters.stages}
      setSelectedStatuses={stages => onChange({ ...filters, stages })}
      labels={DEAL_PRIORITIES.map(p => ({ id: p, label: p }))}
      selectedLabels={filters.priorities}
      setSelectedLabels={priorities => onChange({ ...filters, priorities })}
      labelsTitle="Priority"
    />
  );
}
