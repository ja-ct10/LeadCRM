/**
 * Built-in role templates — compile-time constants.
 * Templates create CUSTOM roles (isSystemRole=false); they only provide initial permission flags.
 * Spec 5 Phase B.
 */
import type { PermissionFlags } from '../types/roles';

export interface RoleTemplate {
  key:         string;
  name:        string;
  description: string;
  permissions: Record<string, PermissionFlags>;
}

const F: PermissionFlags  = { canView: true,  canCreate: true,  canEdit: true,  canDelete: true  };
const V: PermissionFlags  = { canView: true,  canCreate: false, canEdit: false, canDelete: false };
const N: PermissionFlags  = { canView: false, canCreate: false, canEdit: false, canDelete: false };
const FC: PermissionFlags = { canView: true,  canCreate: true,  canEdit: true,  canDelete: false };

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    key:         'administrator',
    name:        'Administrator',
    description: 'Full access to all tenant modules. Intended for team leads.',
    permissions: {
      dashboard:     V,
      contacts:      F,
      organizations: F,
      deals:         F,
      tasks:         F,
      campaigns:     F,
      workflows:     F,
      settings:      F,
      users:         F,
      roles:         F,
      reports:       V,
      billing:       F,
      audit:         V,
    },
  },
  {
    key:         'sales-manager',
    name:        'Sales Manager',
    description: 'Full CRM access, campaign and workflow management, reports. No billing or admin.',
    permissions: {
      dashboard:     V,
      contacts:      F,
      organizations: F,
      deals:         F,
      tasks:         F,
      campaigns:     FC,
      workflows:     FC,
      settings:      V,
      users:         V,
      roles:         N,
      reports:       V,
      billing:       N,
      audit:         V,
    },
  },
  {
    key:         'sales-representative',
    name:        'Sales Representative',
    description: 'CRM read + write, view-only on supporting modules. No admin or billing.',
    permissions: {
      dashboard:     V,
      contacts:      FC,
      organizations: FC,
      deals:         FC,
      tasks:         FC,
      campaigns:     V,
      workflows:     V,
      settings:      V,
      users:         N,
      roles:         N,
      reports:       V,
      billing:       N,
      audit:         N,
    },
  },
  {
    key:         'viewer',
    name:        'Viewer / Guest',
    description: 'Read-only access to CRM, campaigns, workflows, reports, and settings.',
    permissions: {
      dashboard:     V,
      contacts:      V,
      organizations: V,
      deals:         V,
      tasks:         V,
      campaigns:     V,
      workflows:     V,
      settings:      V,
      users:         N,
      roles:         N,
      reports:       V,
      billing:       N,
      audit:         N,
    },
  },
];
