/**
 * Leads Module_Config — declarative configuration for the Data_View_System.
 * References the column registry directly (same array instance, not a copy).
 */

import type { ModuleConfig } from '@leadcrm/shared';
import { LEAD_STATUSES, LEADS_TABLE_SORT_FIELDS } from '@leadcrm/shared';
import { LEADS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';

export const LEADS_MODULE_CONFIG: ModuleConfig = {
  moduleId: 'leads',
  columnRegistry: LEADS_COLUMN_REGISTRY,
  availableViews: ['table'],
  sortableFields: LEADS_TABLE_SORT_FIELDS.map(id => ({ id, label: LEADS_COLUMN_REGISTRY.find(column => column.id === id)?.label ?? (id === 'lastSalesActivityAt' ? 'Most Recent Activity' : id) })),
  filterGroups: [
    {
      id: 'status',
      label: 'Status',
      items: LEAD_STATUSES.map(status => ({ id: status.toLowerCase(), label: status })),
    },
    {
      id: 'source',
      label: 'Source',
      items: [
        { id: 'website', label: 'Website' },
        { id: 'referral', label: 'Referral' },
        { id: 'social', label: 'Social Media' },
        { id: 'email', label: 'Email Campaign' },
        { id: 'other', label: 'Other' },
      ],
    },
  ],
  rowActions: [
    { id: 'view', label: 'View' },
    { id: 'edit', label: 'Edit' },
    { id: 'archive', label: 'Archive' },
  ],
  bulkActions: [
    { id: 'archive', label: 'Archive', destructive: false },
    { id: 'export', label: 'Export', destructive: false },
  ],
};
