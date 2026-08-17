/**
 * Contacts Module_Config — declarative configuration for the Data_View_System.
 * References the column registry directly (same array instance, not a copy).
 */

import type { ModuleConfig } from '@leadcrm/shared';
import { CONTACTS_COLUMN_REGISTRY } from '@/shared/constants/column-registries';

export const CONTACTS_MODULE_CONFIG: ModuleConfig = {
  moduleId: 'contacts',
  columnRegistry: CONTACTS_COLUMN_REGISTRY,
  availableViews: ['table', 'list', 'grid', 'tile'],
  sortableFields: [
    { id: 'firstName', label: 'Name' },
    { id: 'email', label: 'Email' },
    { id: 'companyName', label: 'Company' },
    { id: 'status', label: 'Type' },
    { id: 'createdAt', label: 'Created Date' },
  ],
  filterGroups: [
    {
      id: 'status',
      label: 'Status',
      items: [
        { id: 'active', label: 'Active' },
        { id: 'inactive', label: 'Inactive' },
        { id: 'prospect', label: 'Prospect' },
      ],
    },
    {
      id: 'source',
      label: 'Source',
      items: [
        { id: 'website', label: 'Website' },
        { id: 'referral', label: 'Referral' },
        { id: 'social', label: 'Social Media' },
        { id: 'import', label: 'Import' },
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
