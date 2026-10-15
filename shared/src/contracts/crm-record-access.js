"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasCrmRecordAssignmentAccess = hasCrmRecordAssignmentAccess;
function hasCrmRecordAssignmentAccess(policy, record, module) {
    if (!policy || !record || record.tenantId !== policy.tenantId)
        return false;
    return module === 'accounts' || policy.clientAdmin || !policy.assignmentRestricted || record.assignedUserId === policy.userId;
}
