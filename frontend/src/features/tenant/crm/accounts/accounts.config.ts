/**
 * Accounts Module_Config — declarative configuration for the Data_View_System.
 * References the column registry directly (same array instance, not a copy).
 */

import type { ModuleConfig } from '@leadcrm/shared';
import { ACCOUNTS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';

export const ACCOUNTS_MODULE_CONFIG: ModuleConfig = {
  moduleId: 'accounts',
  columnRegistry: ACCOUNTS_COLUMN_REGISTRY,
  availableViews: ['table'],
  sortableFields: [
    { id: 'name', label: 'Name' },
    { id: 'industry', label: 'Industry' },
    { id: 'website', label: 'Website' },
    { id: 'createdAt', label: 'Created Date' },
  ],
  filterGroups: [
    {
      id: 'industry',
      label: 'Industry',
      items: [
        { id: 'technology', label: 'Technology' },
        { id: 'finance', label: 'Finance' },
        { id: 'healthcare', label: 'Healthcare' },
        { id: 'retail', label: 'Retail' },
        { id: 'manufacturing', label: 'Manufacturing' },
        { id: 'other', label: 'Other' },
      ],
    },
    {
      id: 'customerType',
      label: 'Account Type',
      items: [
        { id: 'enterprise', label: 'Enterprise' },
        { id: 'mid-market', label: 'Mid-Market' },
        { id: 'small-business', label: 'Small Business' },
        { id: 'startup', label: 'Startup' },
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
