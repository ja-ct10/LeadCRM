"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_MODULES = void 0;
exports.PERMISSION_MODULES = [
    { key: 'dashboard', label: 'Dashboard', actions: ['canView'] },
    { key: 'contacts', label: 'Contacts', actions: ['canView', 'canCreate', 'canEdit', 'canDelete'] },
    { key: 'accounts', label: 'Accounts', actions: ['canView', 'canCreate', 'canEdit', 'canDelete'] },
    { key: 'deals', label: 'Deals & Pipeline', actions: ['canView', 'canCreate', 'canEdit', 'canDelete'] },
    { key: 'tasks', label: 'Tasks', actions: ['canView', 'canCreate', 'canEdit', 'canDelete'] },
    { key: 'campaigns', label: 'Campaigns', actions: ['canView', 'canCreate', 'canEdit', 'canDelete'] },
    { key: 'workflows', label: 'Workflows', actions: ['canView', 'canCreate', 'canEdit', 'canDelete'] },
    { key: 'settings', label: 'Settings', actions: ['canView', 'canCreate', 'canEdit', 'canDelete'] },
    { key: 'users', label: 'Users', actions: ['canView', 'canCreate', 'canEdit', 'canDelete'] },
    { key: 'roles', label: 'Roles & Permissions', actions: ['canView', 'canCreate', 'canEdit', 'canDelete'] },
    { key: 'reports', label: 'Reports', actions: ['canView'] },
    { key: 'audit', label: 'Audit Log', actions: ['canView'] },
];
