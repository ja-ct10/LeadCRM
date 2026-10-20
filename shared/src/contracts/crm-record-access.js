"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRM_MODULE_KEYS = exports.CRM_SCOPE_ACTIONS = void 0;
exports.permittedCrmScopes = permittedCrmScopes;
exports.hasCrmRecordAssignmentAccess = hasCrmRecordAssignmentAccess;
const permission_modules_1 = require("../constants/permission-modules");
exports.CRM_SCOPE_ACTIONS = { all: 'canViewAll', my: 'canViewMy', active: 'canViewActive' };
exports.CRM_MODULE_KEYS = ['leads', 'contacts', 'accounts', 'deals'];
function permittedCrmScopes(permissions, module) {
    return Object.keys(exports.CRM_SCOPE_ACTIONS).filter(scope => (0, permission_modules_1.hasModulePermission)(permissions, module, exports.CRM_SCOPE_ACTIONS[scope]));
}
function hasCrmRecordAssignmentAccess(policy, record, module) {
    if (!policy || !record || record.tenantId !== policy.tenantId)
        return false;
    return module === 'accounts' || policy.clientAdmin || !policy.assignmentRestricted || record.assignedUserId === policy.userId;
}
