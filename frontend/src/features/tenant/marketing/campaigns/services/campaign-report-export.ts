import type { CampaignRecipient } from '@leadcrm/shared';
import type { CampaignReportResponse } from '@/shared/services/campaigns.api';

const cell = (value: unknown) => {
  let text = value == null ? 'Unavailable' : String(value);
  if (/^\s*[=+@\-\t\r]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
};

/** Metrics/links cover the whole campaign, matching the cards. Recipient rows
 * honor the visible search/filter; the scope is included explicitly in the file.
 */
export function campaignReportCsv(report: CampaignReportResponse['data'], recipients: CampaignRecipient[], scope: { search: string; filter: string }): string {
  const sms = report.type.toUpperCase() === 'SMS';
  const rows: unknown[][] = [
    ['Campaign', report.name], ['Metrics scope', 'Entire campaign'],
    ['Recipient search', scope.search], ['Recipient filter', scope.filter],
    ['Activity timestamps', 'UTC ISO 8601'], ['Provider events updated at', report.trackingUpdatedAt],
    ['Submitted', report.sentCount], ['Delivered', report.deliveredCount],
  ];
  if (!sms) rows.push(['Total Opens', report.totalOpens], ['Unique Opens', report.uniqueOpens], ['Total Clicks', report.totalClicks], ['Unique Clicks', report.uniqueClicks], ['CTR (%)', report.ctr], ['CTOR (%)', report.ctor], ['Tracking state', report.trackingStatus]);
  rows.push([], ['Recipient', sms ? 'Phone' : 'Email', 'Delivery Status', ...(sms ? [] : ['Opened', 'Clicked']), 'Last Activity (UTC)']);
  for (const row of recipients) rows.push([row.name, sms ? row.phone : row.email, row.deliveryStatus, ...(sms ? [] : [row.opened, row.clicked]), row.lastActivity]);
  if (!sms) {
    rows.push([], ['Original Link URL', 'Link Total Clicks', 'Link Unique Clicks', 'Link Click Share (%)']);
    for (const link of report.topLinks) rows.push([link.url, link.totalClicks, link.uniqueClicks, link.clickShare]);
  }
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
