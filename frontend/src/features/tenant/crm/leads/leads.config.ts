/**
 * Leads Module_Config — declarative configuration for the Data_View_System.
 * References the column registry directly (same array instance, not a copy).
 */

import type { ModuleConfig } from '@leadcrm/shared';
import { LEADS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';

export const LEADS_MODULE_CONFIG: ModuleConfig = {
  moduleId: 'leads',
  columnRegistry: LEADS_COLUMN_REGISTRY,
  availableViews: ['table', 'list', 'grid', 'tile'],
  sortableFields: [
    { id: 'firstName', label: 'Name' },
    { id: 'email', label: 'Email' },
    { id: 'companyName', label: 'Company' },
    { id: 'status', label: 'Status' },
    { id: 'source', label: 'Source' },
    { id: 'createdAt', label: 'Created Date' },
  ],
  filterGroups: [
    {
      id: 'status',
      label: 'Status',
      items: [
        { id: 'new', label: 'New' },
        { id: 'contacted', label: 'Contacted' },
        { id: 'qualified', label: 'Qualified' },
        { id: 'unqualified', label: 'Unqualified' },
        { id: 'converted', label: 'Converted' },
      ],
    },
    {
      id: 'source',
      label: 'Source',
      items: [
        { id: 'website', label: 'Website' },
        { id: 'referral', label: 'Referral' },
        { id: 'social', label: 'Social Media' },
        { id: 'email', label: 'Email Campaign' },
        { id: 'cold-call', label: 'Cold Call' },
        { id: 'other', label: 'Other' },
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
};
