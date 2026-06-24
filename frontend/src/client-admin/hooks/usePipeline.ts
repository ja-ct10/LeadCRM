'use client';
import { useMemo, useState } from 'react';
import { Deal, Pipeline } from '../../store/types';

interface UsePipelineOptions {
  deals: Deal[];
  pipelines: Pipeline[];
}

/**
 * Encapsulates filter, search, and derived state for the Pipeline kanban board.
 * Extracted from PipelinePage to keep the page thin and logic reusable.
 */
export function usePipeline({ deals, pipelines }: UsePipelineOptions) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string>('');

  const activePipeline = useMemo(
    () => pipelines.find((p) => p.id === activePipelineId) || pipelines[0] || null,
    [pipelines, activePipelineId]
  );

  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      if (d.isArchived) return false;
      if (activePipeline && d.pipelineId !== activePipeline.id) return false;

      const matchesSearch =
        !searchTerm ||
        d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.contactPerson.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesPriority =
        selectedPriorities.length === 0 ||
        selectedPriorities.includes(d.priority);

      const matchesAssignee =
        selectedAssignees.length === 0 ||
        selectedAssignees.includes(d.assignedUserId || 'unassigned');

      return matchesSearch && matchesPriority && matchesAssignee;
    });
  }, [deals, searchTerm, selectedPriorities, selectedAssignees, activePipeline]);

  const getDealsByStage = (stageId: string) =>
    filteredDeals
      .filter((d) => d.stageId === stageId)
      .sort((a, b) => a.order - b.order);

  return {
    activePipeline,
    setActivePipelineId,
    filteredDeals,
    getDealsByStage,
    searchTerm,
    setSearchTerm,
    selectedPriorities,
    setSelectedPriorities,
    selectedAssignees,
    setSelectedAssignees,
  };
}
