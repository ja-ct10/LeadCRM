import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignReportView } from '../campaign-report-view';
import { campaignsApi } from '@/shared/services/campaigns.api';
vi.mock('@/shared/services/campaigns.api', () => ({ campaignsApi: { report: vi.fn() } }));
const campaign = { id: 'campaign', name: 'Autumn update', type: 'Email', status: 'sent', targetAudience: 'Customers', sentCount: 4, engagement: 0, createdAt: '2026-10-02', sentAt: '2026-10-02T02:10:00Z' } as const;
const recipients = [
  { id: 'a', name: 'Doris Testing', email: 'doris@example.com', deliveryStatus: 'Delivered', opened: true, clicked: false },
  { id: 'b', name: 'Luis Reyes', email: 'luis@example.com', deliveryStatus: 'Delivered', opened: true, clicked: true },
  { id: 'c', name: 'Mara Santos', email: 'mara@example.com', deliveryStatus: 'Bounced', opened: false, clicked: false },
  { id: 'd', name: 'Anna Cruz', email: 'anna@example.com', deliveryStatus: 'Delivered', opened: false, clicked: false },
].map(row => ({ ...row, lastActivity: '2026-10-02T03:13:00Z', failureReason: null }));
const response = () => ({ success: true, data: { ...campaign, recipientCount: 4, deliveredCount: 3, openedCount: 2, clickedCount: 1, bouncedCount: 1,
  recipients, topLinks: [{ url: 'https://camxian.com/cctv-surveillance-system', uniqueClicks: 1, totalClicks: 2, clickRate: 25, lastClicked: '2026-10-02T03:13:00Z' }] } });
const mount = () => render(<CampaignReportView campaign={campaign as never} onBack={vi.fn()} />);
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); vi.mocked(campaignsApi.report).mockResolvedValue(response() as never); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const select = (label: string) => { fireEvent.click(screen.getByRole('button', { name: 'Filter recipients' })); fireEvent.click(screen.getByRole('menuitemradio', { name: label })); };
const rows = () => within(screen.getAllByRole('grid')[0]).getAllByRole('row').slice(1);
describe('campaign report', () => {
  it('reports SMS phone and provider states without email engagement metrics', async () => {
    vi.mocked(campaignsApi.report).mockResolvedValue({ success: true, data: { ...response().data, type: 'SMS', recipients: [
      { ...recipients[0], email: null, phone: '+639171234567', deliveryStatus: 'Sent', opened: false },
      { ...recipients[1], email: null, phone: '+639181234567', deliveryStatus: 'Requires review', opened: false, clicked: false },
      { ...recipients[2], email: null, phone: '+639191234567', deliveryStatus: 'Failed' },
    ], failedCount: 1, topLinks: [] } } as never);
    render(<CampaignReportView campaign={{ ...campaign, type: 'SMS' } as never} onBack={vi.fn()} />);
    await screen.findByText('+639171234567');
    const metrics = screen.getByRole('region', { name: 'Campaign metrics' });
    expect(metrics.textContent).toContain('Submitted'); expect(metrics.textContent).toContain('Requires review1'); expect(metrics.textContent).toContain('Failed1');
    expect(screen.queryByRole('columnheader', { name: 'Email' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Opened' })).toBeNull(); expect(screen.queryByRole('columnheader', { name: 'Clicked' })).toBeNull();
    expect(screen.queryByText('No clicked links recorded for this campaign.')).toBeNull();
    select('Requires review'); expect(rows()).toHaveLength(1);
    select('All recipients'); fireEvent.change(screen.getByLabelText('Search recipients'), { target: { value: '63919' } }); expect(rows()).toHaveLength(1);
  });
  it('renders real counts, delivery and engagement values, dates and link data without the retired panels', async () => {
    mount(); await screen.findByText('Doris Testing');
    expect(screen.getByRole('heading', { name: 'Autumn update Report' })).toBeTruthy();
    const metrics = screen.getByRole('region', { name: 'Campaign metrics' });
    expect(metrics.textContent).toContain('Recipients4'); expect(metrics.textContent).toContain('Delivered375%'); expect(metrics.textContent).toContain('Opened250%');
    expect(rows()).toHaveLength(4); expect(screen.getAllByLabelText('Opened')).toHaveLength(2); expect(screen.getAllByLabelText('Not opened')).toHaveLength(2);
    expect(screen.getAllByLabelText('Clicked')).toHaveLength(1); expect(screen.getByRole('link', { name: /camxian/ }).getAttribute('href')).toContain('/cctv-surveillance-system');
    expect(screen.queryByText(/2026-10-02T/)).toBeNull(); expect(screen.getAllByText(/Oct 2, 2026/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Engagement Overview')).toBeNull(); expect(screen.queryByText('Device Breakdown')).toBeNull(); expect(screen.queryByText('Sent Overview')).toBeNull();
  });
  it.each([['Delivered', 3], ['Bounced', 1], ['Opened', 2], ['Clicked', 1], ['All recipients', 4]])('filters %s across all recipient records', async (filter, count) => {
    mount(); await screen.findByText('Doris Testing'); select(String(filter)); expect(rows()).toHaveLength(count as number);
  });
  it('combines name/email search with status and shows a meaningful no-match state', async () => {
    mount(); await screen.findByText('Doris Testing'); select('Delivered');
    fireEvent.change(screen.getByLabelText('Search recipients'), { target: { value: ' LUIS@EXAMPLE ' } });
    expect(rows()).toHaveLength(1); expect(screen.getByText('1 of 4 recipients')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search recipients'), { target: { value: 'Doris Testing' } }); expect(screen.getByText('Doris Testing')).toBeTruthy();
    select('Bounced'); expect(screen.getByText('No recipients match your search and filter.')).toBeTruthy();
  });
  it('retains rows during refresh, blocks duplicate requests, and applies both metrics and recipient changes', async () => {
    mount(); await screen.findByText('Doris Testing');
    let resolve!: (value: never) => void;
    vi.mocked(campaignsApi.report).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const refresh = screen.getByRole('button', { name: 'Refresh' }); fireEvent.click(refresh); fireEvent.click(refresh);
    expect(screen.getByText('Doris Testing')).toBeTruthy(); expect(campaignsApi.report).toHaveBeenCalledTimes(2); expect((refresh as HTMLButtonElement).disabled).toBe(true);
    const next = response(); next.data.recipients = recipients.slice(1); next.data.recipientCount = 3;
    await act(async () => resolve(next as never)); expect(screen.queryByText('Doris Testing')).toBeNull(); expect(screen.getByText('3 of 3 recipients')).toBeTruthy();
  });
  it('shows initial skeleton, recoverable errors, and compact recipient/link empty states', async () => {
    let reject!: (value: Error) => void;
    vi.mocked(campaignsApi.report).mockReturnValueOnce(new Promise((_, fail) => { reject = fail; })); mount();
    expect(screen.getByRole('status', { name: 'Loading data' })).toBeTruthy();
    await act(async () => reject(new Error('Report access denied.'))); expect(screen.getByRole('alert').textContent).toContain('Report access denied.');
    vi.mocked(campaignsApi.report).mockResolvedValueOnce({ success: true, data: { ...response().data, recipients: [], topLinks: [] } } as never);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' })); await screen.findByText('No recipients yet.'); expect(screen.getByText('No clicked links recorded for this campaign.')).toBeTruthy();
  });
  it('keeps loaded data and exposes refresh failures', async () => {
    mount(); await screen.findByText('Doris Testing'); vi.mocked(campaignsApi.report).mockRejectedValueOnce(new Error('Network unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' })); await screen.findByRole('alert'); expect(screen.getByText('Doris Testing')).toBeTruthy();
  });
});
