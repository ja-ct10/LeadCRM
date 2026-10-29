"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_TEMPLATES = void 0;
const permission_modules_1 = require("./permission-modules");
const permissions = (modules, edit = false) => Object.fromEntries(permission_modules_1.PERMISSION_MODULES.filter(m => modules.includes(m.key)).map(m => [m.key, { ...permission_modules_1.EMPTY_PERMISSION_FLAGS, canView: true,
        canViewAll: m.key !== 'tasks' && m.actions.includes('canViewAll'), canViewMy: m.actions.includes('canViewMy'), canViewActive: m.actions.includes('canViewActive'),
        canCreate: edit && m.actions.includes('canCreate'), canEdit: edit && m.actions.includes('canEdit') }]));
exports.ROLE_TEMPLATES = [
    { key: 'sales-admin', name: 'Sales Admin', description: 'CRM editing and Workflow management. Other privileged actions require explicit grants.', permissions: {
            ...permissions(['dashboard', 'leads', 'contacts', 'accounts', 'deals', 'tasks'], true),
            workflows: { ...permission_modules_1.EMPTY_PERMISSION_FLAGS, ...Object.fromEntries(permission_modules_1.PERMISSION_MODULES.find(module => module.key === 'workflows').actions.map(action => [action, true])) },
        } },
    { key: 'sales-associate', name: 'Sales Associate', description: 'CRM editing, Workflow viewing, run checks and execution history.', permissions: {
            ...permissions(['dashboard', 'leads', 'contacts', 'accounts', 'deals', 'tasks'], true),
            workflows: { ...permission_modules_1.EMPTY_PERMISSION_FLAGS, canView: true, canExecute: true, canViewRuns: true },
        } },
    { key: 'sales-manager', name: 'Sales Manager', description: 'CRM editing. Other privileged actions require explicit grants.', permissions: permissions(['dashboard', 'leads', 'contacts', 'accounts', 'deals', 'tasks'], true) },
    { key: 'sales-representative', name: 'Sales Representative', description: 'CRM read and write access.', permissions: permissions(['dashboard', 'leads', 'contacts', 'accounts', 'deals', 'tasks'], true) },
    { key: 'viewer', name: 'Viewer', description: 'Read-only CRM access.', permissions: permissions(['dashboard', 'leads', 'contacts', 'accounts', 'deals', 'tasks']) },
];
