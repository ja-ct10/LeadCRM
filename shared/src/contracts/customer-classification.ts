import { normalizeCrmStatus, type CrmStatus } from './record-experience';

export const LEAD_WORKLOAD_WEIGHTS: Record<CrmStatus, number> = { Inquiry: 1, Warm: 2, Hot: 3, Cold: 1, Closed: 0, Cancelled: 0 };
export const CUSTOMER_STATUS_HELP: Record<CrmStatus, string> = {
  Inquiry: 'New inquiry; awaiting a customer reply.',
  Warm: 'Customer has replied; qualification is pending.',
  Hot: 'Qualified and ready to progress toward closing.',
  Cold: 'Inactive; follow up when appropriate.',
  Closed: 'Sale completed through a confirmed Closed Won Deal.',
  Cancelled: 'Cancelled; messages do not automatically reopen this record.',
};
export interface CustomerClassificationEvidence {
  status: string;
  qualified?: boolean;
  qualificationChanged?: boolean;
  genuineReply?: boolean;
  lastCustomerReplyAt: Date | null;
  firstUnansweredOutboundAt: Date | null;
  firstStaffOutreachAt?: Date | null;
}
/** One precedence policy for both people modules and every communication channel. */
export function classifyCustomer(record: CustomerClassificationEvidence, now = new Date()): CrmStatus | undefined {
  const status = normalizeCrmStatus(record.status);
  if (status === 'Closed' || status === 'Cancelled') return;
  if (record.qualified) return 'Hot';
  const valid = (value: Date | null | undefined) => value && Number.isFinite(+value) && +value <= +now ? value : null;
  const reply = valid(record.lastCustomerReplyAt);
  const outreach = valid(record.firstUnansweredOutboundAt) ?? valid(record.firstStaffOutreachAt);
  const baseline = reply ?? outreach;
  if (status === 'Inquiry' && !reply && !valid(record.firstStaffOutreachAt)) return;
  if (!baseline) return record.qualificationChanged ? 'Inquiry' : undefined;
  const days = Math.floor((+now - +baseline) / 86_400_000);
  if (days >= 30) return 'Cold';
  if (record.qualificationChanged) return reply ? 'Warm' : 'Inquiry';
  if (record.genuineReply && reply && (status === 'Inquiry' || status === 'Cold')) return 'Warm';
  if (status === 'Hot' && days >= 8) return 'Warm';
  return status;
}
