import { describe, expect, it } from 'vitest';
import { workflowLossReason, workflowLossReasonIssue } from '@leadcrm/shared';

describe('optional workflow loss reason contract', () => {
  it.each([{}, { includeLossReason: false }, { lostReason: '' }])('permits no configured reason %j', config => {
    expect(workflowLossReasonIssue(config)).toBeUndefined();
    expect(workflowLossReason(config)).toBeUndefined();
  });
  it('retains older saved reasons, trims configured reasons and ignores explicitly disabled reasons', () => {
    expect(workflowLossReason({ lostReason: ' Existing reason ' })).toBe('Existing reason');
    expect(workflowLossReason({ includeLossReason: true, lostReason: ' Not proceeding ' })).toBe('Not proceeding');
    expect(workflowLossReason({ includeLossReason: false, lostReason: 'Old value' })).toBeUndefined();
  });
  it('accepts blank legacy loss-reason settings in drafts and published workflows', () => {
    expect(workflowLossReasonIssue({ includeLossReason: true, lostReason: ' ' }, true)).toBeUndefined();
    expect(workflowLossReasonIssue({ includeLossReason: true, lostReason: ' ' })).toBeUndefined();
  });
  it.each([{ includeLossReason: 'true' }, { lostReason: 12 }, { lostReason: 'a'.repeat(2001) }, { lostReason: '\u0000' }])('rejects invalid persisted configuration %j', config => {
    expect(workflowLossReasonIssue(config, true)).toBeTruthy();
  });
});
