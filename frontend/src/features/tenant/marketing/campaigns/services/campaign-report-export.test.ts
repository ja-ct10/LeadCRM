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
    expect(csv).toBe('\uFEFF' + [
      `"Campaign","'=CMD()"`,
      '"Metrics scope","Entire campaign"',
      '"Recipient search","one"',
      '"Recipient filter","Clicked"',
      '"Activity timestamps","UTC ISO 8601"',
      '"Provider events updated at","2026-10-09T07:00:00Z"',
      '"Recipients","4"',
      '"Delivered","3"',
      '"Submitted","4"',
      '"Opened","2"',
      '"Total Clicks","1"',
      '"Bounced","1"',
      '',
      '"Recipient","Email","Delivery Status","Opened","Clicked","Last Activity (UTC)"',
      `"'+malicious","one@example.test","Delivered","true","true","Unavailable"`,
      '',
      '"Original Link URL","Total Clicks"',
      '"https://camxian.com/?a=1&b=2","1"',
    ].join('\r\n'));
  });
  it.each([undefined, null, 1])('exports SMS delivery information without engagement for tracking version %s', smsTrackingVersion => {
    const recipients = [
      { name: 'Recipient', phone: '+639171234567', deliveryStatus: 'Delivered', opened: true, clicked: true,
        lastActivity: '2026-10-17T03:17:00Z', providerConflict: true,
        providerEvents: [{ status: 'failed', occurredAt: '2026-10-17T03:15:51Z', receivedAt: '2026-10-17T03:16:00Z' }] },
      { name: 'Other recipient', deliveryStatus: 'Sent' },
      { name: 'Failed recipient', deliveryStatus: 'Failed' },
      { name: 'Unconfirmed recipient', deliveryStatus: 'Unknown' },
    ];
    const csv = campaignReportCsv({ type: 'SMS', name: 'SMS report', smsTrackingVersion, recipientCount: 4, sentCount: 3, deliveredCount: 1, failedCount: 1,
      openedCount: 2, clickedCount: 1, ctr: 25, recipients, topLinks: [{ url: 'https://destination.test/', uniqueClicks: 1 }] } as never,
    [recipients[0]] as never, { search: 'Recipient', filter: 'Delivery: Delivered' });
    for (const [label, value] of [['Recipients', 4], ['Submitted', 3], ['Sent', 2], ['Delivered', 1], ['Failed', 1]]) expect(csv).toContain(`"${label}","${value}"`);
    expect(csv).not.toMatch(/Opened|Clicked|Click rate|Total Clicks|SMS opens|SMS click tracking|Original Link URL|https:\/\/destination/);
    expect(csv).toContain('"Recipient","Phone","Delivery Status","Last Activity (UTC)","Provider conflict","Provider events (UTC)"');
    expect(csv).toContain('"Recipient search","Recipient"'); expect(csv).toContain('"Recipient filter","Delivery: Delivered"');
    expect(csv).toContain('"\'+639171234567","Delivered","2026-10-17T03:17:00Z","true"');
    expect(csv).toContain('failed: 2026-10-17T03:15:51Z (received 2026-10-17T03:16:00Z)');
    expect(csv).not.toContain('Other recipient');
  });
  it('exports an empty SMS report with zero delivery totals and no engagement or links section', () => {
    const csv = campaignReportCsv({ type: 'Sms', recipientCount: 0, sentCount: 0, deliveredCount: 0, recipients: [], topLinks: [] } as never,
      [], { search: '', filter: 'All recipients' });
    expect(csv).toContain('"Sent","0"'); expect(csv).toContain('"Failed","0"');
    expect(csv).not.toMatch(/Opened|Clicked|Click rate|Total Clicks|SMS opens|SMS click tracking|Original Link URL/);
  });
});
