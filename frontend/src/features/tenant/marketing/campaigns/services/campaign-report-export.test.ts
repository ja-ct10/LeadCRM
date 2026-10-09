import { describe, expect, it } from 'vitest';
import { campaignReportCsv } from './campaign-report-export';

describe('campaign export', () => {
  it('matches report metrics and links, respects filtered rows, and escapes formulas', () => {
    const report = { name: '=CMD()', type: 'Email', sentCount: 4, deliveredCount: 3, totalOpens: 7, uniqueOpens: 2, totalClicks: 5, uniqueClicks: 1, ctr: 100 / 3, ctor: 50,
      trackingStatus: 'recorded', trackingUpdatedAt: '2026-10-09T07:00:00Z', topLinks: [{ url: 'https://camxian.com/?a=1&b=2', totalClicks: 5, uniqueClicks: 1, clickShare: 100 }] };
    const csv = campaignReportCsv(report as never, [{ name: '+malicious', email: 'one@example.test', deliveryStatus: 'Delivered', opened: true, clicked: true, lastActivity: null } as never], { search: 'one', filter: 'Clicked' });
    expect(csv).toContain('"Total Clicks","5"'); expect(csv).toContain('"CTOR (%)","50"');
    expect(csv).toContain('https://camxian.com/?a=1&b=2'); expect(csv).toContain('"Recipient filter","Clicked"');
    expect(csv).toContain('"\'=CMD()"'); expect(csv).toContain('"\'+malicious"');
    expect(csv).toContain('"Unavailable"');
  });
  it('omits email engagement metrics from SMS exports', () => {
    const csv = campaignReportCsv({ type: 'SMS', topLinks: [] } as never, [], { search: '', filter: 'All recipients' });
    expect(csv).not.toMatch(/Total Clicks|CTR|Original Link URL/);
  });
});
