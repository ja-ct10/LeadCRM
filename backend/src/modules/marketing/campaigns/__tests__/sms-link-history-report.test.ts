import { beforeEach, describe, expect, it, vi } from 'vitest';

const reportStore = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock('../campaigns.repository', () => ({ findCampaignReport: reportStore.find }));
vi.mock('../../../../config/database.config', () => ({ default: {} }));
import { getCampaignReport } from '../campaigns.service';

const token = 'a'.repeat(24);
const receipt = { id: token, url: 'https://example.test/products?a=1&b=2#destination',
  clickedAt: '2026-10-02T03:12:00.123', lastClickedAt: '2026-10-02T03:13:00.456', clickCount: 4 };
function savedReport() {
  return { id: 'campaign', tenantId: 'tenant', name: 'Original campaign', type: 'SMS', status: 'SENT', isArchived: true,
    smsTrackingVersion: 1, recipientCount: 1, sentCount: 1, failedCount: 0, openedCount: 0,
    submissionStartedAt: new Date('2026-10-02T03:00:00Z'), submissionFinishedAt: new Date('2026-10-02T03:01:00Z'), submissionInterruptedAt: null,
    emailDeliveryLogs: [], campaignContacts: [{ id: 'recipient', tenantId: 'tenant', status: 'sent', email: null, phone: '+639171234567',
      contact: null, lead: null, personalization: { first_name: 'Original', last_name: 'Recipient' }, failureReason: null,
      providerUpdatedAt: null, submittedAt: new Date('2026-10-02T03:01:00Z'), sentAt: new Date('2026-10-02T03:01:01Z'), deliveredAt: null,
      openedAt: null, clickedAt: new Date('2026-10-02T03:12:00.123Z'), bouncedAt: null, smsLinkHistory: [receipt], smsWebhookReceipts: [],
      providerErrorMessage: null, smsStatusConflict: false,
    }] };
}
beforeEach(() => reportStore.find.mockReset());
describe('frozen SMS link history in Campaign reports', () => {
  it('preserves historical link totals, unique recipients, destinations and UTC activity without exposing tokens', async () => {
    reportStore.find.mockResolvedValue(savedReport());
    const report = await getCampaignReport('campaign', 'tenant');
    expect(report).toMatchObject({ smsTrackingVersion: 1, clickedCount: 1, totalClicks: 4, uniqueClicks: 1, totalOpens: null,
      trackingStatus: 'recorded', trackingUpdatedAt: '2026-10-02T03:13:00.456Z',
      recipients: [{ name: 'Original Recipient', clicked: true, lastActivity: '2026-10-02T03:13:00.456Z' }],
      topLinks: [{ url: receipt.url, uniqueClicks: 1, totalClicks: 4, lastClicked: '2026-10-02T03:13:00.456Z' }],
    });
    expect(JSON.stringify(report)).not.toContain(token);
    expect(reportStore.find).toHaveBeenCalledWith('campaign', 'tenant');
  });

  it('does not fabricate link counts for new untracked SMS or corrupt historical payloads', async () => {
    const report = savedReport();
    report.smsTrackingVersion = 0;
    report.campaignContacts[0].smsLinkHistory = [];
    report.campaignContacts[0].clickedAt = null as never;
    reportStore.find.mockResolvedValue(report);
    expect(await getCampaignReport('campaign', 'tenant')).toMatchObject({ clickedCount: 0, totalClicks: null, uniqueClicks: null, ctr: null,
      trackingStatus: 'historical_unavailable', topLinks: [] });
  });
});
