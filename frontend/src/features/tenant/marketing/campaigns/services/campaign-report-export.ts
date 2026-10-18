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
    ['Recipients', report.recipientCount], ['Delivered', report.deliveredCount], ['Submitted', report.sentCount],
  ];
  if (!sms) rows.push(['Opened', report.openedCount], ['Total Clicks', report.clickedCount], ['Bounced', report.bouncedCount]);
  if (sms) rows.push(['Sent', report.recipients.filter(row => ['Sent', 'Delivered'].includes(row.deliveryStatus)).length], ['Failed', report.failedCount ?? 0]);
  rows.push([], ['Recipient', sms ? 'Phone' : 'Email', 'Delivery Status', ...(!sms ? ['Opened', 'Clicked'] : []), 'Last Activity (UTC)', ...(sms ? ['Provider conflict', 'Provider events (UTC)'] : [])]);
  for (const row of recipients) rows.push([row.name, sms ? row.phone : row.email, row.deliveryStatus, ...(!sms ? [row.opened, row.clicked] : []), row.lastActivity,
    ...(sms ? [row.providerConflict ?? false, (row.providerEvents ?? []).map(event => `${event.status}: ${event.occurredAt ?? 'time unavailable'} (received ${event.receivedAt})`).join('; ')] : [])]);
  if (!sms) {
    rows.push([], ['Original Link URL', 'Total Clicks']);
    for (const link of report.topLinks) rows.push([link.url, link.uniqueClicks]);
  }
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
