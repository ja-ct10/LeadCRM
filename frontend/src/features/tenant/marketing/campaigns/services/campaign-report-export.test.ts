import { describe, expect, it } from 'vitest';
import { campaignReportCsv } from './campaign-report-export';

describe('campaign export', () => {
  it('matches report metrics and links, respects filtered rows, and escapes formulas', () => {
    const report = { name: '=CMD()', type: 'Email', recipientCount: 4, sentCount: 4, deliveredCount: 3, openedCount: 2, clickedCount: 1, bouncedCount: 1, totalOpens: 7, uniqueOpens: 2, totalClicks: 5, uniqueClicks: 1, ctr: 100 / 3, ctor: 50,
      trackingStatus: 'recorded', trackingUpdatedAt: '2026-10-09T07:00:00Z', topLinks: [{ url: 'https://camxian.com/?a=1&b=2', totalClicks: 5, uniqueClicks: 1, clickShare: 100 }] };
    const csv = campaignReportCsv(report as never, [{ name: '+malicious', email: 'one@example.test', deliveryStatus: 'Delivered', opened: true, clicked: true, lastActivity: null } as never], { search: 'one', filter: 'Clicked' });
    expect(csv).toContain('"Recipients","4"'); expect(csv).toContain('"Opened","2"');
    expect(csv).toContain('"Total Clicks","1"'); expect(csv).toContain('"Bounced","1"');
    expect(csv).toContain('"https://camxian.com/?a=1&b=2","1"');
    expect(csv).not.toMatch(/Total Opens|Unique Opens|Unique Clicks|CTR|CTOR|Click Share/);
    expect(csv).toContain('https://camxian.com/?a=1&b=2'); expect(csv).toContain('"Recipient filter","Clicked"');
    expect(csv).toContain('"\'=CMD()"'); expect(csv).toContain('"\'+malicious"');
    expect(csv).toContain('"Unavailable"');
  });
  it('omits email engagement metrics from SMS exports', () => {
    const csv = campaignReportCsv({ type: 'SMS', topLinks: [] } as never, [], { search: '', filter: 'All recipients' });
    expect(csv).not.toMatch(/Total Clicks|CTR|Original Link URL/);
  });
  it('exports tracked SMS unique clicks, click rate, destinations and provider conflicts without opens', () => {
    const csv = campaignReportCsv({ type: 'SMS', name: 'Tracked SMS', smsTrackingVersion: 1, sentCount: 4, clickedCount: 1,
      topLinks: [{ url: 'https://destination.test/', uniqueClicks: 1 }] } as never,
    [{ name: 'Recipient', phone: '+639171234567', deliveryStatus: 'Delivered', opened: false, clicked: true, providerConflict: true,
      providerEvents: [{ status: 'failed', occurredAt: '2026-10-17T03:15:51Z', receivedAt: '2026-10-17T03:16:00Z' }] }] as never, { search: '', filter: 'Clicked' });
    expect(csv).toContain('"Total Clicks","1"'); expect(csv).toContain('"Click rate (%)","25"');
    expect(csv).toContain('"SMS opens","Unavailable"'); expect(csv).not.toContain('"Opened"');
    expect(csv).toContain('"Delivery Status","Clicked"'); expect(csv).toContain('"https://destination.test/","1"');
    expect(csv).toContain('Provider conflict'); expect(csv).toContain('failed: 2026-10-17T03:15:51Z');
  });
});
