import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DashboardReport } from '@leadcrm/shared';
import Dashboard from './dashboard';

const mocks = vi.hoisted(() => ({ report: null as DashboardReport | null, refresh: vi.fn(async () => true), charts: [] as any[] }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'agent', firstName: 'Sales' } }) }));
vi.mock('../hooks/use-dashboard-report', () => ({ useDashboard: () => ({ report: mocks.report, error: null, loading: false, refresh: mocks.refresh }) }));
vi.mock('react-chartjs-2', () => ({
  Bar: (props: any) => { mocks.charts.push({ type: 'bar', ...props }); return <canvas />; },
  Line: (props: any) => { mocks.charts.push({ type: 'area', ...props }); return <canvas />; },
  Doughnut: (props: any) => { mocks.charts.push({ type: 'pie', ...props }); return <canvas />; },
}));

beforeEach(() => {
  mocks.charts = [];
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  mocks.report = {
    generatedAt: '2020-01-15T04:00:00Z', queryMs: 1, currency: 'PHP', scope: 'organization',
    period: { start: '2020-01-01', end: '2020-01-15', interval: 'month', timezone: 'Asia/Manila' },
    access: { deals: true, leads: true, tasks: true }, pipeline: null,
    metrics: { totalRevenue: 45000, forecastedRevenue: 225000, activeDeals: 3, totalLeads: 1, won: 1, lost: 0,
      currentWon: 2, totalDeals: 25, winRate: 8, averageDealDays: 4, openPipelineValue: 225000,
      forecastMissing: 0, monetaryMissing: 0, currencyExcluded: 0, closingDateMissing: 0, unattributedWon: 1, unattributedRevenue: 1000 },
    trend: [{ name: '2020-01-01', revenue: 45000, won: 1, lost: 0 }],
    distribution: [{ id: 'lead', name: 'Lead', color: '#123456', count: 3, value: 225000, percentage: 100 }],
    conversion: { cohort: 10, missingHistory: 1, period: { start: '2020-01-01', end: '2020-01-15', range: 'month', timezone: 'Asia/Manila', observationCutoff: '2020-01-15T04:00:00Z' },
      stages: ['Lead','Contacted','Qualified','Closed Won','Closed Lost'].map((name, index) => ({ id: String(index), name, color: '#123456', reached: index === 0 ? 9 : 1 })),
      leadToContacted: null, contactedToQualified: null, qualifiedToWon: null, qualifiedToLost: null },
    leaderboard: [{ id: 'agent', firstName: 'Historical', lastName: 'Agent', won: 2, revenue: 44000 }],
    actions: [], pendingActions: 0, warnings: ['Missing historical stage data.', 'Missing historical stage data.'],
  };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); mocks.refresh.mockClear(); });

it('renders current all-time KPI counts and exact backend forecast, with separate unattributed revenue', () => {
  render(<Dashboard />);
  const rate = within(screen.getByRole('group', { name: 'Win Rate' }));
  expect(rate.getByText('8%')).toBeTruthy();
  expect(rate.getByText('2 won / 25 total deals · current')).toBeTruthy();
  expect(within(screen.getByRole('group', { name: 'Forecasted Revenue' })).getByText('₱225,000.00')).toBeTruthy();
  expect(screen.getByText('Historical Agent')).toBeTruthy();
  expect(screen.getByText('1 won deals · ₱1,000.00 without verified eligible sales credit')).toBeTruthy();
});
it('exposes unique backend warnings, cohort totals and incomplete history without conflating current stages', () => {
  render(<Dashboard />);
  fireEvent.click(screen.getByText('Reporting warnings (1)'));
  expect(screen.getAllByText('Missing historical stage data.')).toHaveLength(1);
  expect(screen.getByText('10 deals in the creation cohort · Historical milestones, not current stages')).toBeTruthy();
  expect(screen.getByText(/1 deals lack recorded starting history/)).toBeTruthy();
  expect(screen.getByText('Qualified → Closed Won: Unavailable')).toBeTruthy();
  expect(screen.getByText('Lead: 3 (100%)')).toBeTruthy();
});
it('shows backend conversion rates and formats single-bucket revenue and won/lost dates', () => {
  mocks.report!.conversion!.missingHistory = 0;
  mocks.report!.conversion!.qualifiedToWon = 37.5;
  render(<Dashboard />);
  expect(screen.getByText('Qualified → Closed Won: 37.5%')).toBeTruthy();
  const trend = mocks.charts.find(chart => chart.type === 'area');
  const outcomes = mocks.charts.find(chart => chart.type === 'bar' && chart.data.datasets[0].label === 'Closed Won');
  expect(trend.data.datasets[0].data).toEqual([45000]);
  expect(trend.options.scales.x.offset).toBe(true);
  expect(trend.options.plugins.tooltip.callbacks.title([{ label: '2020-01-01' }])).toBe('Jan 2020');
  expect(outcomes.options.scales.x.ticks.callback(0)).toBe('Jan 2020');
  expect(mocks.charts.find(chart => chart.type === 'bar' && chart.data.datasets[0].label === 'Value (PHP)').options.indexAxis).toBe('x');
});
it('uses meaningful revenue and outcome empty states and unavailable monetary data', () => {
  mocks.report!.metrics.totalRevenue = 0;
  mocks.report!.metrics.won = 0; mocks.report!.metrics.lost = 0;
  mocks.report!.metrics.openPipelineValue = null; mocks.report!.metrics.forecastedRevenue = null;
  render(<Dashboard />);
  expect(screen.getByText('No won revenue in the selected period.')).toBeTruthy();
  expect(screen.getByText('No resolved deals in the selected period.')).toBeTruthy();
  expect(screen.getByText('Pipeline value unavailable.')).toBeTruthy();
  expect(within(screen.getByRole('group', { name: 'Forecasted Revenue' })).getByText('Unavailable')).toBeTruthy();
  expect(mocks.charts.filter(chart => chart.type === 'area' || chart.type === 'bar')).toHaveLength(0);
});
