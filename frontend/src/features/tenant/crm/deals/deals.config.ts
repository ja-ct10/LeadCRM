/**
 * Deals Module_Config — declarative configuration for the Data_View_System.
 * References the column registry directly (same array instance, not a copy).
 * Includes kanbanGroupingField for Kanban view stage-based grouping.
 */

import type { ModuleConfig } from '@leadcrm/shared';
import { DEALS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';

export const DEALS_MODULE_CONFIG: ModuleConfig = {
  moduleId: 'deals',
  columnRegistry: DEALS_COLUMN_REGISTRY,
  availableViews: ['table', 'list', 'grid', 'tile', 'kanban'],
  sortableFields: [
    { id: 'title', label: 'Name' },
    { id: 'stageId', label: 'Stage' },
    { id: 'value', label: 'Value' },
    { id: 'expectedCloseDate', label: 'Expected Close Date' },
    { id: 'createdAt', label: 'Created Date' },
  ],
  filterGroups: [
    {
      id: 'stageId',
      label: 'Stage',
      items: [
        { id: 'prospecting', label: 'Prospecting' },
        { id: 'qualification', label: 'Qualification' },
        { id: 'proposal', label: 'Proposal' },
        { id: 'negotiation', label: 'Negotiation' },
        { id: 'closed-won', label: 'Closed Won' },
        { id: 'closed-lost', label: 'Closed Lost' },
      ],
    },
    {
      id: 'priority',
      label: 'Priority',
      items: [
        { id: 'high', label: 'High' },
        { id: 'medium', label: 'Medium' },
        { id: 'low', label: 'Low' },
      ],
    },
  ],
  rowActions: [
    { id: 'view', label: 'View' },
    { id: 'edit', label: 'Edit' },
    { id: 'delete', label: 'Delete' },
  ],
  bulkActions: [
    { id: 'delete', label: 'Delete', destructive: true },
    { id: 'export', label: 'Export', destructive: false },
  ],
  kanbanGroupingField: 'stageId',
};
