"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CUSTOMER_STATUS_HELP = exports.LEAD_WORKLOAD_WEIGHTS = void 0;
exports.classifyCustomer = classifyCustomer;
const record_experience_1 = require("./record-experience");
exports.LEAD_WORKLOAD_WEIGHTS = { Inquiry: 1, Warm: 2, Hot: 3, Cold: 1, Closed: 0, Cancelled: 0 };
exports.CUSTOMER_STATUS_HELP = {
    Inquiry: 'New inquiry; awaiting a customer reply.',
    Warm: 'Customer has replied; qualification is pending.',
    Hot: 'Qualified and ready to progress toward closing.',
    Cold: 'Inactive; follow up when appropriate.',
    Closed: 'Sale completed through a confirmed Closed Won Deal.',
    Cancelled: 'Cancelled; messages do not automatically reopen this record.',
};
/** One precedence policy for both people modules and every communication channel. */
function classifyCustomer(record, now = new Date()) {
    const status = (0, record_experience_1.normalizeCrmStatus)(record.status);
    if (status === 'Closed' || status === 'Cancelled')
        return;
    if (record.qualified)
        return 'Hot';
    const valid = (value) => value && Number.isFinite(+value) && +value <= +now ? value : null;
    const reply = valid(record.lastCustomerReplyAt);
    const outreach = valid(record.firstUnansweredOutboundAt) ?? valid(record.firstStaffOutreachAt);
    const baseline = reply ?? outreach;
    if (status === 'Inquiry' && !reply && !valid(record.firstStaffOutreachAt))
        return;
    if (!baseline)
        return record.qualificationChanged ? 'Inquiry' : undefined;
    const days = Math.floor((+now - +baseline) / 86400000);
    if (days >= 30)
        return 'Cold';
    if (record.qualificationChanged)
        return reply ? 'Warm' : 'Inquiry';
    if (record.genuineReply && reply && (status === 'Inquiry' || status === 'Cold'))
        return 'Warm';
    if (status === 'Hot' && days >= 8)
        return 'Warm';
    return status;
}
