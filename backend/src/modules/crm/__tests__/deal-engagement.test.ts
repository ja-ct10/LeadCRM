import { describe, expect, it } from 'vitest';
import { aggregateDealEngagement, classifyDealEngagement, type DealEngagementEvent } from '@leadcrm/shared';
import { CreateDealSchema, UpdateDealSchema } from '../deals/deals.dto';

const start = Date.parse('2026-01-01T00:00:00Z'), day = 86_400_000;
const at = (days: number) => new Date(start + days * day);
const event = (type: DealEngagementEvent['type'], days: number): DealEngagementEvent => ({ type, at: at(days) });
describe('independent Deal engagement', () => {
  it.each([[0, 'Hot'], [8 - 1 / day, 'Hot'], [8, 'Warm'], [30 - 1 / day, 'Warm'], [30, 'Cold']] as const)('ages a qualification at day %s', (days, status) => {
    expect(classifyDealEngagement([event('qualified', 0)], at(days))).toBe(status);
  });
  it('does not expire Inquiry without confirmed outreach', () => expect(classifyDealEngagement([], at(365))).toBe('Inquiry'));
  it('ignores staff follow-ups when timing Inquiry inactivity', () => {
    expect(classifyDealEngagement([event('outreach', 0), event('outreach', 29)], at(30))).toBe('Cold');
    expect(classifyDealEngagement([event('outreach', 0)], at(30 - 1 / day))).toBe('Inquiry');
  });
  it('renews Hot only when a reply arrives before Hot expires', () => {
    expect(classifyDealEngagement([event('qualified', 0), event('reply', 7)], at(14))).toBe('Hot');
    expect(classifyDealEngagement([event('qualified', 0), event('reply', 8)], at(8))).toBe('Warm');
    expect(classifyDealEngagement([event('qualified', 0), event('reply', 31)], at(31))).toBe('Warm');
  });
  it('uses 30 total days, never an additional 30-day Warm period', () => {
    expect(classifyDealEngagement([event('qualified', 0), event('reply', 7)], at(37))).toBe('Cold');
  });
  it('handles duplicated and delayed events chronologically', () => {
    const events = [event('reply', 10), event('qualified', 0), event('reply', 5), event('reply', 5)];
    expect(classifyDealEngagement(events, at(11))).toBe('Hot');
    expect(classifyDealEngagement(events, at(18))).toBe('Warm');
    expect(classifyDealEngagement([...events, event('outreach', 39)], at(40))).toBe('Cold');
  });
  it('requires a new qualification event to regain Hot', () => {
    expect(classifyDealEngagement([event('qualified', 0), event('qualified', 40)], at(41))).toBe('Hot');
  });
  it('ignores future and invalid timestamps and preserves terminal outcomes', () => {
    const events = [event('reply', 2), { type: 'qualified' as const, at: new Date('invalid') }];
    expect(classifyDealEngagement(events, at(1))).toBe('Inquiry');
    expect(classifyDealEngagement(events, at(3), 'won')).toBe('Closed Deal');
    expect(classifyDealEngagement(events, at(3), 'lost')).toBe('Cancelled');
  });
  it('rejects browser-written engagement status', () => {
    expect(UpdateDealSchema.safeParse({ engagementStatus: 'Hot' }).success).toBe(false);
    expect(CreateDealSchema.safeParse({ title: 'Deal', stageId: 'lead', pipelineId: 'sales', engagementStatus: 'Hot' }).success).toBe(false);
  });
});

const deal = (engagementStatus: string, extra = {}) => ({ engagementStatus, isArchived: false, pipelineArchived: false, isWon: false, isLost: false, confirmedWon: false, ...extra });
describe('overall customer aggregation', () => {
  it.each([
    [['Cold', 'Inquiry', 'Warm', 'Hot'], 'Hot'], [['Cold', 'Inquiry', 'Warm'], 'Warm'],
    [['Cold', 'Inquiry'], 'Inquiry'], [['Cold', 'Cold'], 'Cold'],
  ] as const)('uses the highest active engagement among %s', (statuses, expected) => {
    expect(aggregateDealEngagement(statuses.map(status => deal(status)))).toBe(expected);
  });
  it('preserves confirmed historical sales and gives active Deals precedence', () => {
    const won = deal('Closed Deal', { isWon: true, confirmedWon: true, isArchived: true });
    const lost = deal('Cancelled', { isLost: true });
    expect(aggregateDealEngagement([won, lost])).toBe('Closed Deal');
    expect(aggregateDealEngagement([won, lost, deal('Inquiry')])).toBe('Inquiry');
  });
  it('never fabricates a confirmed sale or cancels a customer with no Deals', () => {
    expect(aggregateDealEngagement([])).toBeUndefined();
    expect(aggregateDealEngagement([deal('Closed Deal', { isWon: true })])).toBeUndefined();
    expect(aggregateDealEngagement([deal('Cancelled', { isLost: true }), deal('Cancelled', { isLost: true })])).toBe('Cancelled');
    expect(aggregateDealEngagement([deal('Cancelled', { isLost: true }), deal('Cold')])).toBe('Cold');
  });
});
