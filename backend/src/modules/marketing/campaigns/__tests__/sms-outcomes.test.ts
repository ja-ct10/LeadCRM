import { expect, it } from 'vitest';
import { smsCampaignSummary } from '../sms-campaign-outcomes';
import { deriveCampaignDeliveryStatus } from '../campaign-delivery-status';
import { runSubmissionPool } from '../campaign-submission-pool';
const row = (status: string) => ({ status, failureReason: null, submittedAt: new Date(), sentAt: ['sent', 'delivered'].includes(status) ? new Date() : null, deliveredAt: status === 'delivered' ? new Date() : null });
it.each(['sent', 'delivered', 'failed'])('retains verified %s status when provider event dates are absent', status => {
  const evidence = { ...row(status), sentAt: null, deliveredAt: null };
  expect(smsCampaignSummary([evidence])).toMatchObject({ [status]: 1, submitted: 0, unconfirmed: 0 });
  expect(deriveCampaignDeliveryStatus({ type: 'SMS', status: 'SENDING', recipientCount: 1 }, [evidence])).toBe(status === 'delivered' ? 'DELIVERED' : status === 'sent' ? 'SENT' : 'FAILED');
  expect(evidence.sentAt).toBeNull(); expect(evidence.deliveredAt).toBeNull();
});
it('reconciles disjoint SMS states against the frozen eligible denominator', () => {
  expect(smsCampaignSummary(['pending', 'submitted', 'sent', 'delivered', 'failed', 'unknown', 'excluded'].map(status => ({ ...row(status), submittedAt: status === 'pending' ? null : new Date() })))).toEqual({
    total: 6, pending: 1, submitting: 0, submitted: 1, sent: 1, delivered: 1, failed: 1, unconfirmed: 1,
  });
});
it('keeps incomplete SMS processing Sending and preserves verified Sent without a carrier delivery report', () => {
  expect(deriveCampaignDeliveryStatus({ type: 'SMS', status: 'SENDING', recipientCount: 3 }, ['sent', 'failed', 'submitted'].map(row))).toBe('SENDING');
  expect(deriveCampaignDeliveryStatus({ type: 'SMS', status: 'SENT', recipientCount: 1 }, [row('sent')])).toBe('SENT');
  const verified = { ...row('sent'), failureReason: 'TEXTBEE_UNKNOWN_STATE' };
  expect(deriveCampaignDeliveryStatus({ type: 'SMS', status: 'SENDING', recipientCount: 1 }, [verified])).toBe('SENT');
  expect(smsCampaignSummary([verified])).toMatchObject({ sent: 1, delivered: 0, unconfirmed: 0 });
});
it('fills a freed submission slot while another request is slow, with no concurrency increase', async () => {
  let release!: () => void; const slow = new Promise<void>(resolve => { release = resolve; });
  const started: number[] = []; let active = 0, maximum = 0;
  const work = runSubmissionPool([0, 1, 2, 3, 4, 5, 6], async item => {
    started.push(item); active++; maximum = Math.max(maximum, active);
    if (item === 0) await slow;
    active--;
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(started).toHaveLength(7); expect(maximum).toBeLessThanOrEqual(5);
  release(); await work;
});
it('settles in-flight work before recovery and never starts untouched recipients after a write failure', async () => {
  let release!: () => void; const boundary = new Promise<void>(resolve => { release = resolve; }); const finished: number[] = [];
  const work = runSubmissionPool([0, 1, 2, 3, 4, 5], async item => { if (item === 0) throw new Error('receipt failed'); await boundary; finished.push(item); });
  const result = work.catch(error => error); release(); expect(await result).toMatchObject({ message: 'receipt failed' });
  expect(finished).not.toContain(5);
});
