'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/store/DataContext';
import type { Deal } from '@/store/types';
import type { DealPageFilters } from '../types/deal-page.types';

const EMPTY_FILTERS: DealPageFilters = {
  search: '',
  stages: [],
  priorities: [],
  pipelines: [],
};

export function useDealsPage() {
  const { deals, pipelines } = useData();
  const [filters, setFilters] = useState<DealPageFilters>(EMPTY_FILTERS);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  // Build a stage-name lookup from all pipelines
  const stageNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    pipelines.forEach(p => p.stages.forEach(s => { map[s.id] = s.name; }));
    return map;
  }, [pipelines]);

  // Build a stage-probability lookup
  const stageProbabilityMap = useMemo(() => {
    const map: Record<string, number> = {};
    pipelines.forEach(p => p.stages.forEach(s => { map[s.id] = s.probability ?? 0; }));
    return map;
  }, [pipelines]);

  const pipelineNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    pipelines.forEach(p => { map[p.id] = p.name; });
    return map;
  }, [pipelines]);

  const filtered = useMemo(() => {
    let result = deals.filter(d => !d.isArchived);

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.companyName.toLowerCase().includes(q) ||
        d.contactPerson?.toLowerCase().includes(q),
      );
    }
    if (filters.stages.length > 0) {
      result = result.filter(d => filters.stages.includes(d.stageId));
    }
    if (filters.priorities.length > 0) {
      result = result.filter(d => filters.priorities.includes(d.priority));
    }
    if (filters.pipelines.length > 0) {
      result = result.filter(d => filters.pipelines.includes(d.pipelineId));
    }
    return result;
  }, [deals, filters]);

  // Weighted forecast: sum of (value × probability)
  const forecastTotal = useMemo(() =>
    filtered
      .filter(d => !['stage_won', 'stage_lost'].includes(d.stageId))
      .reduce((sum, d) => sum + d.value * ((stageProbabilityMap[d.stageId] ?? 0) / 100), 0),
    [filtered, stageProbabilityMap],
  );

  return {
    deals: filtered,
    totalCount: deals.filter(d => !d.isArchived).length,
    filters,
    setFilters,
    selectedDeal,
    setSelectedDeal,
    stageNameMap,
    stageProbabilityMap,
    pipelineNameMap,
    forecastTotal,
    pipelines,
  };
}
