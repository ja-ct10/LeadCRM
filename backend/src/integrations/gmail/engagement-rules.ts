import { CrmStatus, classifyCustomer } from '@leadcrm/shared';

export const ENGAGEMENT_RULE_VERSION = 2;
export const DAY_MS = 86_400_000;
export function normalizeEmail(value: string): string {
  return (value.match(/<([^<>]+)>/)?.[1] ?? value).trim().toLowerCase();
}
export interface EngagementHistory {
  status: string;
  lastCustomerReplyAt: Date | null;
  firstUnansweredOutboundAt: Date | null;
}
/** Completed UTC 24-hour days, independent of local midnight and DST. */
export function engagementStatus(record: EngagementHistory & { qualified?: boolean; firstStaffOutreachAt?: Date | null }, now = new Date()): CrmStatus | undefined {
  return classifyCustomer({ ...record, genuineReply: !!record.lastCustomerReplyAt }, now);
}

export function engagementReason(record: EngagementHistory): string {
  return record.lastCustomerReplyAt
    ? `Customer engagement based on the latest inbound reply at ${record.lastCustomerReplyAt.toISOString()}.`
    : `Waiting for the first customer reply since ${record.firstUnansweredOutboundAt!.toISOString()}.`;
}
