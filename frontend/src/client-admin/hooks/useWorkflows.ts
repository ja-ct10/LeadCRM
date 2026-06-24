'use client';
import { useMemo, useState } from 'react';
import { Workflow } from '../../store/types';

interface UseWorkflowsOptions {
  workflows: Workflow[];
}

/**
 * Encapsulates filter logic for the Workflows automation page.
 * Extracted so WorkflowsPage stays under the 800-line page limit.
 */
export function useWorkflows({ workflows }: UseWorkflowsOptions) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const filteredWorkflows = useMemo(() => {
    return workflows.filter((wf) => {
      if (wf.isArchived) return false;

      const matchesSearch =
        !searchTerm ||
        wf.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (wf.description &&
          wf.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus =
        selectedStatuses.length === 0 ||
        selectedStatuses.includes(wf.status);

      const matchesCategory =
        selectedCategories.length === 0 ||
        (wf.category && selectedCategories.includes(wf.category));

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [workflows, searchTerm, selectedStatuses, selectedCategories]);

  return {
    filteredWorkflows,
    searchTerm,
    setSearchTerm,
    selectedStatuses,
    setSelectedStatuses,
    selectedCategories,
    setSelectedCategories,
  };
}
