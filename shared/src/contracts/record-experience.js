"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECORD_FILE_MAX_BYTES = exports.LeadStatusSchema = exports.LEAD_STATUSES = exports.CrmStatusSchema = exports.LeadSourceSchema = exports.LEAD_SOURCES = exports.CRM_STATUSES = void 0;
exports.isAssignableAgent = isAssignableAgent;
exports.normalizeCrmStatus = normalizeCrmStatus;
const zod_1 = require("zod");
exports.CRM_STATUSES = ['Hot', 'Warm', 'Cold', 'Closed', 'Cancelled'];
exports.LEAD_SOURCES = ['Google Ads', 'Referral', 'Email Campaign', 'Website', 'Social Media Advertisement', 'Direct Mail', 'Content Marketing', 'Organic', 'Others'];
exports.LeadSourceSchema = zod_1.z.enum(exports.LEAD_SOURCES);
/** Keep assignment eligibility consistent between CRM controls and audience validation. */
function isAssignableAgent(user) {
    var _a;
    return ((_a = user.role) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase()) !== 'client admin' && (!user.status || user.status.toUpperCase() === 'ACTIVE');
}
exports.CrmStatusSchema = zod_1.z.enum(exports.CRM_STATUSES);
exports.LEAD_STATUSES = exports.CRM_STATUSES;
exports.LeadStatusSchema = exports.CrmStatusSchema;
/** Read legacy stored statuses into canonical UI state. API validation stays strict. */
function normalizeCrmStatus(status) {
    var _a;
    return (_a = exports.CRM_STATUSES.find(value => value.toLowerCase() === (status === null || status === void 0 ? void 0 : status.toLowerCase()))) !== null && _a !== void 0 ? _a : 'Warm';
}
exports.RECORD_FILE_MAX_BYTES = 10 * 1024 * 1024;
