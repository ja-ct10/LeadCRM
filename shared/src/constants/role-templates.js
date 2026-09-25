"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_TEMPLATES = void 0;
const F = { canView: true, canCreate: true, canEdit: true, canDelete: true };
const V = { canView: true, canCreate: false, canEdit: false, canDelete: false };
const N = { canView: false, canCreate: false, canEdit: false, canDelete: false };
const FC = { canView: true, canCreate: true, canEdit: true, canDelete: false };
exports.ROLE_TEMPLATES = [
    {
        key: 'administrator',
        name: 'Administrator',
        description: 'Full access to all tenant modules. Intended for team leads.',
        permissions: {
            dashboard: V,
            contacts: F,
            organizations: F,
            deals: F,
            tasks: F,
            campaigns: F,
            workflows: F,
            settings: F,
            users: F,
            roles: F,
            reports: V,
            audit: V,
        },
    },
    {
        key: 'sales-manager',
        name: 'Sales Manager',
        description: 'Full CRM access, campaign and workflow management, reports. No administration.',
        permissions: {
            dashboard: V,
            contacts: F,
            organizations: F,
            deals: F,
            tasks: F,
            campaigns: FC,
            workflows: FC,
            settings: V,
            users: V,
            roles: N,
            reports: V,
            audit: V,
        },
    },
    {
        key: 'sales-representative',
        name: 'Sales Representative',
        description: 'CRM read + write, view-only on supporting modules. No administration.',
        permissions: {
            dashboard: V,
            contacts: FC,
            organizations: FC,
            deals: FC,
            tasks: FC,
            campaigns: V,
            workflows: V,
            settings: V,
            users: N,
            roles: N,
            reports: V,
            audit: N,
        },
    },
    {
        key: 'viewer',
        name: 'Viewer',
        description: 'Read-only access to CRM, campaigns, workflows, reports, and settings.',
        permissions: {
            dashboard: V,
            contacts: V,
            organizations: V,
            deals: V,
            tasks: V,
            campaigns: V,
            workflows: V,
            settings: V,
            users: N,
            roles: N,
            reports: V,
            audit: N,
        },
    },
];
