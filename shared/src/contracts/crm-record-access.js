"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRM_MODULE_KEYS = exports.CRM_SCOPE_ACTIONS = void 0;
exports.permittedCrmScopes = permittedCrmScopes;
exports.hasCrmRecordAssignmentAccess = hasCrmRecordAssignmentAccess;
exports.canReassignCrmRecord = canReassignCrmRecord;
const permission_modules_1 = require("../constants/permission-modules");
exports.CRM_SCOPE_ACTIONS = { all: 'canViewAll', my: 'canViewMy', active: 'canViewActive' };
exports.CRM_MODULE_KEYS = ['leads', 'contacts', 'accounts', 'deals'];
function permittedCrmScopes(permissions, module) {
    return Object.keys(exports.CRM_SCOPE_ACTIONS).filter(scope => (0, permission_modules_1.hasModulePermission)(permissions, module, exports.CRM_SCOPE_ACTIONS[scope]));
}
function hasCrmRecordAssignmentAccess(policy, record, module, action = 'canEdit') {
    if (!policy || !record || record.tenantId !== policy.tenantId)
        return false;
    if (policy.clientAdmin)
        return true;
    if (!policy.permissions || !module)
        return module === 'accounts' || !policy.assignmentRestricted || record.assignedUserId === policy.userId;
    return [{ permissions: policy.permissions, assignmentRestricted: policy.assignmentRestricted, groupId: undefined }, ...(policy.groupGrants ?? [])]
        .some(grant => (!grant.groupId || grant.groupId === record.ownerGroupId) && (0, permission_modules_1.hasModulePermission)(grant.permissions, module, action) &&
        permittedCrmScopes(grant.permissions, module).some(scope => scope === 'all' || scope === 'my' && record.assignedUserId === policy.userId ||
            scope === 'active' && ['Inquiry', 'Hot', 'Warm', 'INQUIRY', 'HOT', 'WARM'].includes(String(record.status)) && record.assignedUserId === policy.userId) &&
        (module === 'accounts' || !grant.assignmentRestricted || record.assignedUserId === policy.userId));
}
/** Reassignment must be authorized by one unrestricted grant for this record. */
function canReassignCrmRecord(policy, record, module) {
    if (!policy)
        return false;
    if (!policy.permissions)
        return !policy.assignmentRestricted && hasCrmRecordAssignmentAccess(policy, record, module);
    return hasCrmRecordAssignmentAccess({ ...policy,
        permissions: policy.assignmentRestricted ? {} : policy.permissions,
        groupGrants: policy.groupGrants?.filter(grant => !grant.assignmentRestricted),
    }, record, module);
}
