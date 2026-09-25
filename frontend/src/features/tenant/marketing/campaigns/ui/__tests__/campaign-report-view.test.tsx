import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CampaignReportView } from '../campaign-report-view';
import { campaignsApi } from '@/shared/services/campaigns.api';

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn() }) }));
vi.mock('@/shared/services/campaigns.api', () => ({ campaignsApi: { get: vi.fn() } }));
vi.mock('@/shared/components/charts/ChartComponents', () => {
  const EmptyChart = () => null;
  return { AreaChart: EmptyChart, Area: EmptyChart, XAxis: EmptyChart, YAxis: EmptyChart, CartesianGrid: EmptyChart, Tooltip: EmptyChart, ResponsiveContainer: EmptyChart };
});
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('campaign engagement report', () => {
  it.each([
    { delivered: 1, opened: 0, clicked: 0, bounced: 0 },
    { delivered: 1, opened: 1, clicked: 0, bounced: 0 },
    { delivered: 1, opened: 1, clicked: 1, bounced: 0 },
    { delivered: 0, opened: 0, clicked: 0, bounced: 1 },
  ])('shows persisted webhook counts: %j', async ({ delivered, opened, clicked, bounced }) => {
    vi.mocked(campaignsApi.get).mockResolvedValue({ success: true, data: {
      id: 'tracking-test', sentCount: 1, recipientCount: 1, failedCount: 0,
      deliveredCount: delivered, openedCount: opened, clickedCount: clicked, bouncedCount: bounced,
    } } as never);
    render(<CampaignReportView campaign={{ id: 'tracking-test', name: 'Tracking', sentCount: 0, openedCount: 0, clickedCount: 0, engagement: 0 } as never}
      activeMetricTab="delivered" onMetricTabChange={vi.fn()} onBack={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Total Submitted 1 Accepted by provider' })).toBeTruthy();
    expect(screen.getByRole('button', { name: `Delivered ${delivered} ${delivered * 100}% Rate` })).toBeTruthy();
    expect(screen.getByRole('button', { name: `Open Rate ${opened * 100}% ${opened} opened` })).toBeTruthy();
    expect(screen.getByRole('button', { name: `Click Rate ${clicked * 100}% ${clicked} clicked` })).toBeTruthy();
    expect(screen.getByRole('button', { name: `Bounce Rate ${bounced * 100}% ${bounced} bounced` })).toBeTruthy();
    expect(campaignsApi.get).toHaveBeenCalledExactlyOnceWith('tracking-test');
  });
});
