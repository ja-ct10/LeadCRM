import { describe, expect, it } from 'vitest';
import { classifyCustomer, LEAD_WORKLOAD_WEIGHTS, CRM_STATUSES, CreateLeadSchema, ProductInterestPatchSchema, conditionOperatorLabel } from '@leadcrm/shared';
import { lowestWorkloadRotation } from '../leads/lead-workload';
import { isCustomerSmsReply, SmsReplySchema } from '../../../integrations/sms/sms-replies';

const now = new Date('2026-10-18T12:00:00Z'), day = 86400000;
const ago = (days: number) => new Date(+now - days * day);
const evidence = { status: 'Inquiry', lastCustomerReplyAt: null, firstUnansweredOutboundAt: null, firstStaffOutreachAt: null };

describe('hybrid customer classification', () => {
  it('defaults new Leads to Inquiry while retaining explicitly selected statuses', () => {
    const person = { firstName: 'Nora', lastName: 'Lim', email: 'nora@example.test' };
    expect(CreateLeadSchema.parse(person).status).toBe('Inquiry');
    for (const status of CRM_STATUSES) expect(CreateLeadSchema.parse({ ...person, status }).status).toBe(status);
  });
  it.each(CRM_STATUSES)('qualification takes precedence for %s except terminal outcomes', status => {
    expect(classifyCustomer({ ...evidence, status, qualified: true, lastCustomerReplyAt: ago(60), genuineReply: true }, now)).toBe(['Closed Deal', 'Cancelled'].includes(status) ? undefined : 'Hot');
  });
  it('never cools an untouched Inquiry even when automated outbound evidence exists', () => {
    expect(classifyCustomer({ ...evidence, firstUnansweredOutboundAt: ago(60) }, now)).toBeUndefined();
    expect(classifyCustomer({ ...evidence, firstStaffOutreachAt: ago(30) }, now)).toBe('Cold');
  });
  it.each(['Inquiry', 'Cold'])('a genuine reply makes %s Warm without making it Hot', status => {
    expect(classifyCustomer({ ...evidence, status, genuineReply: true, lastCustomerReplyAt: ago(0) }, now)).toBe('Warm');
  });
  it('preserves elapsed-day thresholds for unprotected historical Hot records', () => {
    expect(classifyCustomer({ ...evidence, status: 'Hot', lastCustomerReplyAt: ago(8 - 1 / day) }, now)).toBe('Hot');
    expect(classifyCustomer({ ...evidence, status: 'Hot', lastCustomerReplyAt: ago(8) }, now)).toBe('Warm');
    expect(classifyCustomer({ ...evidence, status: 'Warm', lastCustomerReplyAt: ago(30 - 1 / day) }, now)).toBe('Warm');
    expect(classifyCustomer({ ...evidence, status: 'Warm', lastCustomerReplyAt: ago(30) }, now)).toBe('Cold');
  });
  it('reevaluates a removed qualification from current evidence', () => {
    expect(classifyCustomer({ ...evidence, status: 'Hot', qualificationChanged: true }, now)).toBe('Inquiry');
    expect(classifyCustomer({ ...evidence, status: 'Hot', qualificationChanged: true, lastCustomerReplyAt: ago(2) }, now)).toBe('Warm');
    expect(classifyCustomer({ ...evidence, status: 'Hot', qualificationChanged: true, lastCustomerReplyAt: ago(31) }, now)).toBe('Cold');
  });
  it.each(['Closed Deal', 'Cancelled'])('messages and inactivity cannot reopen %s', status => {
    expect(classifyCustomer({ ...evidence, status, genuineReply: true, lastCustomerReplyAt: now }, now)).toBeUndefined();
    expect(classifyCustomer({ ...evidence, status, lastCustomerReplyAt: ago(90) }, now)).toBeUndefined();
  });
  it('does not classify from invalid or future timestamps', () => {
    expect(classifyCustomer({ ...evidence, status: 'Cold', genuineReply: true, lastCustomerReplyAt: new Date(+now + 1) }, now)).toBeUndefined();
    expect(classifyCustomer({ ...evidence, lastCustomerReplyAt: new Date('invalid') }, now)).toBeUndefined();
  });
});
describe('assignment and typed filters', () => {
  it('chooses weighted load first and rotates only equally loaded candidates', () => {
    expect(LEAD_WORKLOAD_WEIGHTS).toEqual({ Inquiry: 1, Warm: 2, Hot: 3, Cold: 1, 'Closed Deal': 0, Cancelled: 0 });
    const users = [{ id: 'c' }, { id: 'a' }, { id: 'b' }];
    expect(lowestWorkloadRotation(users, new Map([['a', 9], ['b', 2], ['c', 2]]), 'b')?.id).toBe('c');
    expect(lowestWorkloadRotation(users, new Map([['a', 9], ['b', 2], ['c', 2]]), 'c')?.id).toBe('b');
    expect(lowestWorkloadRotation([], new Map(), '')).toBeUndefined();
  });
  it('requires nonblank supplied categories and rejects control characters', () => {
    for (const category of ['', '   ', null]) expect(ProductInterestPatchSchema.safeParse({ category }).success).toBe(false);
    expect(ProductInterestPatchSchema.parse({ description: 'Updated description' })).toEqual({ description: 'Updated description' });
    expect(ProductInterestPatchSchema.parse({ category: ' Security ' }).category).toBe('Security');
    expect(ProductInterestPatchSchema.safeParse({ category: 'Bad\u0000category' }).success).toBe(false);
  });
  it('changes date phrases without changing numeric comparisons', () => {
    expect(['equals', 'gt', 'gte', 'lt', 'lte', 'between'].map(key => conditionOperatorLabel(key, 'dropdown', 'date'))).toEqual(['On', 'After', 'On or after', 'Before', 'On or before', 'Between']);
    expect(conditionOperatorLabel('gte', 'summary', 'date')).toBe('is on or after');
    expect(conditionOperatorLabel('gt')).toBe('Greater than');
  });
  it('distinguishes customer SMS replies from control messages and automation', () => {
    const reply = SmsReplySchema.parse({ webhookEvent: 'MESSAGE_RECEIVED', smsId: 'one', deviceId: 'a'.repeat(24), sender: '+639171234567', message: 'Yes, please send the quotation.', receivedAt: now.toISOString() });
    expect(isCustomerSmsReply(reply)).toBe(true);
    for (const message of ['STOP', 'help', 'Your verification code is 123456', '']) expect(isCustomerSmsReply({ ...reply, message })).toBe(false);
    expect(isCustomerSmsReply({ ...reply, automated: true })).toBe(false);
  });
});
