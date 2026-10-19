import React from 'react';
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DashboardReport, DashboardQuery } from '@leadcrm/shared';
import Dashboard from './dashboard';

const mocks = vi.hoisted(() => ({ report: null as DashboardReport | null, query: null as DashboardQuery | null, error: null as string | null, loading: false, refresh: vi.fn(async () => true), charts: [] as any[], success: vi.fn(), failure: vi.fn() }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'agent', firstName: 'Sales' } }) }));
vi.mock('../hooks/use-dashboard-report', () => ({ useDashboard: (query: DashboardQuery) => { mocks.query = query; return { report: mocks.report, error: mocks.error, loading: mocks.loading, refresh: mocks.refresh }; } }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.failure } }));
vi.mock('react-chartjs-2', () => ({
  Bar: (props: any) => { mocks.charts.push({ type: 'bar', ...props }); return <canvas />; },
  Line: (props: any) => { mocks.charts.push({ type: 'area', ...props }); return <canvas />; },
  Doughnut: (props: any) => { mocks.charts.push({ type: 'pie', ...props }); return <canvas />; },
}));

beforeEach(() => {
  mocks.charts = [];
  mocks.loading = false; mocks.error = null;
  mocks.refresh.mockResolvedValue(true); mocks.success.mockClear(); mocks.failure.mockClear();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const stages = ['Lead','Contacted','Qualified','Closed Won','Closed Lost'].map((name, order) => ({
    id: ['lead','contacted','qualified','won','lost'][order], name, order, color: '#123456', probability: null,
    isWon: order === 3, isLost: order === 4,
  }));
  mocks.report = {
    generatedAt: '2020-01-15T04:00:00Z', queryMs: 1, currency: 'PHP', scope: 'organization',
    period: { start: '2020-01-01', end: '2020-01-15', interval: 'month', timezone: 'Asia/Manila' },
    access: { deals: true, leads: true, tasks: true }, pipeline: { id: 'sales', name: 'Sales Pipeline', stages },
    metrics: { totalRevenue: 45000, forecastedRevenue: 225000, activeDeals: 3, totalLeads: 1, won: 1, lost: 0,
      currentWon: 2, totalDeals: 25, winRate: 8, averageDealDays: 4, openPipelineValue: 225000,
      forecastMissing: 0, monetaryMissing: 0, currencyExcluded: 0, closingDateMissing: 0, unattributedWon: 1, unattributedRevenue: 1000 },
    trend: [{ name: '2020-01-01', revenue: 45000, won: 1, lost: 0 }],
    distribution: stages.slice(0, 3).map(stage => ({ id: stage.id, name: stage.name, color: stage.color,
      count: stage.id === 'lead' ? 3 : 0, value: stage.id === 'lead' ? 225000 : 0, percentage: stage.id === 'lead' ? 100 : 0 })),
    conversion: { cohort: 10, missingHistory: 1, period: { start: '2020-01-01', end: '2020-01-15', range: 'month', timezone: 'Asia/Manila', observationCutoff: '2020-01-15T04:00:00Z' },
      stages: stages.map(stage => ({ id: stage.id, name: stage.name, color: stage.color, reached: stage.id === 'lead' ? 9 : 1 })),
      leadToContacted: null, contactedToQualified: null, qualifiedToWon: null, qualifiedToLost: null },
    leaderboard: [{ id: 'agent', firstName: 'Historical', lastName: 'Agent', won: 2, revenue: 44000 }],
    actions: [], pendingActions: 0, warnings: ['Missing historical stage data.', 'Missing historical stage data.'],
  };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); mocks.refresh.mockClear(); });

it('preserves Reports current all-time KPI counts and exact backend forecast, with separate unattributed revenue', () => {
  render(<Dashboard presentation="reporting" />);
  const rate = within(screen.getByRole('group', { name: 'Win Rate' }));
  expect(rate.getByText('8%')).toBeTruthy();
  expect(rate.getByText('2 won / 25 total deals · current')).toBeTruthy();
  expect(within(screen.getByRole('group', { name: 'Forecasted Revenue' })).getByText('₱225,000.00')).toBeTruthy();
  expect(screen.getByText('Historical Agent')).toBeTruthy();
  expect(screen.getByText('1 won deals · ₱1,000.00 without verified eligible sales credit')).toBeTruthy();
});
it('exposes unique backend warnings, cohort totals and incomplete history without conflating current stages', () => {
  render(<Dashboard presentation="reporting" />);
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
  render(<Dashboard presentation="reporting" />);
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
  render(<Dashboard presentation="reporting" />);
  expect(screen.getByText('No won revenue in the selected period.')).toBeTruthy();
  expect(screen.getByText('No resolved deals in the selected period.')).toBeTruthy();
  expect(screen.getByText('Pipeline value unavailable.')).toBeTruthy();
  expect(within(screen.getByRole('group', { name: 'Forecasted Revenue' })).getByText('Unavailable')).toBeTruthy();
  expect(mocks.charts.filter(chart => chart.type === 'area' || chart.type === 'bar')).toHaveLength(0);
});

it('renders exactly five mapped KPIs and the five requested sections in sample order', () => {
  render(<Dashboard />);
  expect(within(screen.getByLabelText('Dashboard KPIs')).getAllByRole('group').map(group => group.getAttribute('aria-label'))).toEqual(['Revenue', 'Forecast', 'Open Deals', 'Leads', 'Win Rate']);
  expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual(['Action Center', 'Revenue Trend', 'Pipeline Overview', 'Conversion Funnel', 'Sales Leaderboard']);
  for (const removed of ['Avg Deal Velocity', 'Deals Won vs. Lost', 'Pipeline Distribution', 'Pipeline Value by Stage']) expect(screen.queryByText(removed)).toBeNull();
  expect(within(screen.getByRole('group', { name: 'Revenue' })).getByLabelText('₱45,000.00').textContent).toBe('₱45K');
  expect(within(screen.getByRole('group', { name: 'Forecast' })).getByLabelText('₱225,000.00').textContent).toBe('₱225K');
  expect(within(screen.getByRole('group', { name: 'Open Deals' })).getByText('3')).toBeTruthy();
  expect(within(screen.getByRole('group', { name: 'Leads' })).getByText('1')).toBeTruthy();
  expect(within(screen.getByRole('group', { name: 'Win Rate' })).getByText('8%')).toBeTruthy();
});

it('shows exact compact amounts on keyboard focus', async () => {
  render(<Dashboard />);
  const amount = within(screen.getByRole('group', { name: 'Revenue' })).getByLabelText('₱45,000.00');
  expect(amount.tabIndex).toBe(0);
  fireEvent.focus(amount);
  expect(await screen.findByRole('tooltip')).toHaveProperty('textContent', '₱45,000.00');
});

it('uses real distribution values, saved colors and count-relative widths, excluding closed stages', () => {
  mocks.report!.distribution = [
    { id: 'lead', name: 'Lead', color: '#FFCC00', count: 13, value: 132123, percentage: 72.2 },
    { id: 'contacted', name: 'Contacted', color: '#123456', count: 3, value: 37000, percentage: 16.7 },
    { id: 'qualified', name: 'Qualified', color: '#654321', count: 2, value: null, percentage: 11.1 },
    { id: 'won', name: 'Closed Won', color: null, count: 8, value: 1000, percentage: 0 },
  ];
  render(<Dashboard />);
  const pipeline = within(screen.getByRole('region', { name: 'Pipeline Overview' }));
  expect(pipeline.getAllByRole('listitem').map(row => row.getAttribute('aria-label'))).toEqual(['Lead', 'Contacted', 'Qualified']);
  const lead = within(pipeline.getByRole('listitem', { name: 'Lead' }));
  expect(lead.getByText('13 deals')).toBeTruthy();
  expect(lead.getByLabelText('₱132,123.00').textContent).toBe('₱132.1K');
  expect((lead.getByRole('meter').firstChild as HTMLElement).style.width).toBe('100%');
  expect((lead.getByRole('meter').firstChild as HTMLElement).style.backgroundColor).toBe('rgb(255, 204, 0)');
  const contacted = pipeline.getByRole('meter', { name: 'Contacted deal count relative to largest stage' });
  expect(parseFloat((contacted.firstChild as HTMLElement).style.width)).toBeCloseTo(3 / 13 * 100);
  expect(within(pipeline.getByRole('listitem', { name: 'Qualified' })).getByText('Unavailable')).toBeTruthy();
});

it('matches current pipeline counts by stage ID and uses separately labeled backend historical rates', () => {
  mocks.report!.distribution.forEach((stage, index) => { stage.count = [17, 1, 2][index]; });
  mocks.report!.distribution.reverse();
  mocks.report!.metrics.currentWon = 1;
  mocks.report!.metrics.won = 0;
  Object.assign(mocks.report!.conversion!, { missingHistory: 0, leadToContacted: 20.8, contactedToQualified: 40, qualifiedToWon: 33.3, qualifiedToLost: 5 });
  mocks.report!.conversion!.stages.forEach((stage, index) => { stage.reached = [24, 5, 3, 1, 3][index]; });
  render(<Dashboard />);
  const funnel = within(screen.getByRole('region', { name: 'Conversion Funnel' }));
  expect(funnel.getByRole('list', { name: 'Current pipeline stages' }).children).toHaveLength(4);
  expect(funnel.getAllByRole('listitem').map(row => row.getAttribute('aria-label'))).toEqual(['Lead: 17 deals', 'Contacted: 1 deal', 'Qualified: 2 deals', 'Closed Won: 1 deal']);
  expect(funnel.getByText('Current pipeline stage counts')).toBeTruthy();
  expect(funnel.getByRole('heading', { name: 'Historical Conversion Rates' })).toBeTruthy();
  expect(funnel.getByText(/Deals created during the current month · Recorded milestones through today.*Date filter applies only to historical rates/)).toBeTruthy();
  for (const rate of ['20.8%', '40%', '33.3%']) expect(funnel.getByText(rate)).toBeTruthy();
  expect(funnel.queryByText('200%')).toBeNull();
  expect(funnel.queryByText('24')).toBeNull();
  expect((funnel.getByRole('listitem', { name: 'Lead: 17 deals' }).firstChild as HTMLElement).style.backgroundColor).toBe('rgb(18, 52, 86)');
  expect(funnel.queryByText(/Closed Lost/)).toBeNull();
  expect(funnel.queryByText('Cohort details')).toBeNull();
  expect(funnel.queryByText(/deals in the creation cohort/)).toBeNull();
  expect(funnel.getAllByRole('term').map(term => term.textContent)).toEqual(['Lead → Contacted', 'Contacted → Qualified', 'Qualified → Closed Won']);
});
it('keeps current counts when history is incomplete or the selected cohort is empty', () => {
  const view = render(<Dashboard />);
  const funnel = within(screen.getByRole('region', { name: 'Conversion Funnel' }));
  expect(funnel.getByText('1 deals lack recorded starting history. Historical conversion rates are unavailable.')).toBeTruthy();
  expect(funnel.getAllByRole('definition').map(rate => rate.textContent)).toEqual(['Unavailable', 'Unavailable', 'Unavailable']);
  expect(funnel.getByRole('listitem', { name: 'Lead: 3 deals' })).toBeTruthy();
  mocks.report!.conversion!.cohort = 0;
  mocks.report!.conversion!.missingHistory = 0;
  mocks.report!.conversion!.stages.forEach(stage => { stage.reached = 0; });
  view.rerender(<Dashboard />);
  expect(funnel.getByRole('listitem', { name: 'Lead: 3 deals' })).toBeTruthy();
  expect(funnel.getByRole('listitem', { name: 'Closed Won: 2 deals' })).toBeTruthy();
  expect(funnel.getAllByRole('definition').map(rate => rate.textContent)).toEqual(['Unavailable', 'Unavailable', 'Unavailable']);
});
it('does not substitute zero for unavailable current counts or show counts without Deals access', () => {
  mocks.report!.metrics.currentWon = null;
  mocks.report!.distribution = [];
  const view = render(<Dashboard />);
  const funnel = within(screen.getByRole('region', { name: 'Conversion Funnel' }));
  expect(funnel.getAllByRole('listitem', { name: /Unavailable/ })).toHaveLength(4);
  mocks.report!.access.deals = false;
  mocks.report!.pipeline = null;
  mocks.report!.conversion = null;
  view.rerender(<Dashboard />);
  expect(funnel.getByText('Deal reporting unavailable.')).toBeTruthy();
  expect(funnel.queryByRole('list')).toBeNull();
});
it('accepts the same normalized official stage names as the backend', () => {
  mocks.report!.distribution[0].name = ' lead ';
  render(<Dashboard />);
  expect(within(screen.getByRole('region', { name: 'Pipeline Overview' })).getByText('3 deals')).toBeTruthy();
});

it('keeps action ordering, summaries, links, actual priority and Manila due dates', () => {
  mocks.report!.actions = [
    { id: 'task', kind: 'task', title: 'Call customer', dueDate: '2020-01-14T18:00:00Z', priority: 'High', overdue: true, href: '/operations/taskboard?taskId=task' },
    { id: 'pending', kind: 'task', title: 'Prepare proposal', dueDate: null, priority: 'Low', overdue: false, href: '/operations/taskboard?taskId=pending' },
    { id: 'lead', kind: 'lead', title: 'Doris Joe', dueDate: null, priority: 'High', overdue: false, href: '/crm/leads/lead' },
    { id: 'deal', kind: 'deal', title: 'Customer renewal', dueDate: null, priority: 'Medium', overdue: false, href: '/crm/deals/deal' },
  ];
  mocks.report!.pendingActions = 4;
  render(<Dashboard />);
  const actions = within(screen.getByRole('region', { name: 'Action Center' }));
  expect(actions.getByText('1 overdue task · 1 hot lead · 1 stale deal')).toBeTruthy();
  expect(actions.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(mocks.report!.actions.map(action => action.href));
  expect(actions.getByText('DJ')).toBeTruthy();
  expect(actions.getByText('Hot lead · High')).toBeTruthy();
  expect(actions.getByText('Pending task · Low')).toBeTruthy();
  expect(actions.getByText('Due Jan 15, 2020')).toBeTruthy();
  expect(actions.queryByText(/Follow-up overdue/)).toBeNull();
});

it('renders backend leaderboard rank, initials, revenue and attributed deal count', () => {
  render(<Dashboard />);
  const board = within(screen.getByRole('region', { name: 'Sales Leaderboard' }));
  expect(board.getByLabelText('Rank 1')).toBeTruthy();
  expect(board.getByText('HA')).toBeTruthy();
  expect(board.getByText('Historical Agent')).toBeTruthy();
  expect(board.getByLabelText('₱44,000.00').textContent).toBe('₱44K');
  expect(board.getByText('2 deals')).toBeTruthy();
  expect(board.getByText('1 won deals · ₱1,000.00 without verified eligible sales credit')).toBeTruthy();
});

it('renders truthful empty states, zero current counts and unavailable rates', () => {
  mocks.report!.metrics.totalRevenue = 0;
  mocks.report!.metrics.forecastedRevenue = null;
  mocks.report!.distribution.forEach(stage => { stage.count = 0; });
  mocks.report!.metrics.currentWon = 0;
  mocks.report!.leaderboard = [];
  mocks.report!.conversion!.cohort = 0;
  mocks.report!.conversion!.missingHistory = 0;
  mocks.report!.conversion!.stages.forEach(stage => { stage.reached = 0; });
  render(<Dashboard />);
  for (const empty of ['No actions require attention.', 'No won revenue in the selected period.', 'No open deals.', 'No verified eligible sales attribution in this period.']) expect(screen.getByText(empty)).toBeTruthy();
  expect(screen.getByRole('list', { name: 'Current pipeline stages' }).children).toHaveLength(4);
  expect(screen.getAllByRole('listitem', { name: /0 deals/ })).toHaveLength(4);
  expect(within(screen.getByRole('group', { name: 'Forecast' })).getByText('Unavailable')).toBeTruthy();
  expect(screen.queryByRole('meter')).toBeNull();
  expect(mocks.charts).toHaveLength(0);
});

it('preserves chart report data, compact ticks, exact tooltips and opt-in data points', () => {
  render(<Dashboard />);
  const trend = mocks.charts.find(chart => chart.type === 'area');
  expect(mocks.charts).toHaveLength(1);
  expect(trend.data.datasets[0].data).toEqual([45000]);
  expect(trend.data.datasets[0].pointRadius).toBe(6);
  expect(trend.options.scales.x.ticks.callback(0)).toBe('Jan');
  expect(trend.options.plugins.tooltip.callbacks.title([{ label: '2020-01-01' }])).toBe('Jan 2020');
  expect(trend.options.plugins.tooltip.callbacks.label({ dataset: { label: 'Revenue (PHP)' }, parsed: { y: 45000 } })).toBe('Revenue (PHP): ₱45,000.00');
});

it('preserves Reports global, revenue interval and historical funnel filters', () => {
  render(<Dashboard presentation="reporting" />);
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard date range' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Last 3 Months' }));
  fireEvent.click(screen.getByRole('button', { name: 'Filter Revenue Trend' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Week' }));
  fireEvent.click(screen.getByRole('button', { name: 'Filter Deal Pipeline Conversion Funnel' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Year' }));
  expect(mocks.query).toMatchObject({ range: 'last3', revenueInterval: 'week', funnelRange: 'year' });
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard date range' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Custom Date Range' }));
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2020-01-01' } });
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2020-01-02' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
  expect(mocks.query).toMatchObject({ range: 'custom', start: '2020-01-01', end: '2020-01-02', revenueInterval: 'week', funnelRange: 'year' });
  fireEvent.click(screen.getByRole('button', { name: 'Filter Deal Pipeline Conversion Funnel' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Custom Range' }));
  fireEvent.change(screen.getByLabelText('Funnel From Date'), { target: { value: '2020-01-03' } });
  fireEvent.change(screen.getByLabelText('Funnel To Date'), { target: { value: '2020-01-04' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply funnel dates' }));
  expect(mocks.query).toMatchObject({ range: 'custom', start: '2020-01-01', end: '2020-01-02', funnelRange: 'custom', funnelStart: '2020-01-03', funnelEnd: '2020-01-04' });
});

it('keeps Dashboard on this month while independent chart filters and refresh remain usable', async () => {
  const view = render(<Dashboard />);
  expect(screen.queryByRole('button', { name: 'Dashboard date range' })).toBeNull();
  expect(screen.getByText(/Welcome back,/)).toBeTruthy();
  expect(screen.getByLabelText('Current date and time')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Filter Revenue Trend' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Week' }));
  fireEvent.click(screen.getByRole('button', { name: 'Filter Conversion Funnel' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Custom Range' }));
  fireEvent.change(screen.getByLabelText('Funnel From Date'), { target: { value: '2020-01-03' } });
  fireEvent.change(screen.getByLabelText('Funnel To Date'), { target: { value: '2020-01-04' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply funnel dates' }));
  expect(mocks.query).toMatchObject({ range: 'thisMonth', start: undefined, end: undefined, revenueInterval: 'week', funnelRange: 'custom', funnelStart: '2020-01-03', funnelEnd: '2020-01-04' });
  const before = screen.getByRole('list', { name: 'Current pipeline stages' }).textContent;
  mocks.report!.conversion!.period = { ...mocks.report!.conversion!.period, range: 'custom', start: '2020-01-03', end: '2020-01-04' };
  mocks.report!.conversion!.stages.forEach(stage => { stage.reached = 0; });
  view.rerender(<Dashboard />);
  expect(screen.getByRole('list', { name: 'Current pipeline stages' }).textContent).toBe(before);
  expect(screen.getByText(/Deals created Jan 3, 2020 – Jan 4, 2020 · Recorded milestones through Jan 4, 2020/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Sync Metrics' }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  expect(mocks.query!.range).toBe('thisMonth');
  view.unmount();
  render(<Dashboard />);
  expect(mocks.query).toMatchObject({ range: 'thisMonth', start: undefined, end: undefined, revenueInterval: 'month', funnelRange: 'month' });
});

it('clears hidden global dates when switching from Reports to Dashboard', () => {
  const view = render(<Dashboard presentation="reporting" />);
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard date range' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Custom Date Range' }));
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2020-01-01' } });
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2020-01-02' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
  expect(mocks.query!.range).toBe('custom');
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard date range' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Custom Date Range' }));
  view.rerender(<Dashboard />);
  expect(mocks.query).toMatchObject({ range: 'thisMonth', start: undefined, end: undefined });
  expect(screen.queryByRole('button', { name: 'Dashboard date range' })).toBeNull();
  expect(screen.queryByLabelText('Start date')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Apply dates' })).toBeNull();
});

it('retains missing conversion data and disables Sync Metrics while loading', () => {
  mocks.report!.conversion = null;
  mocks.loading = true;
  render(<Dashboard />);
  expect(screen.getByText('Deal history unavailable.')).toBeTruthy();
  expect(screen.getByRole('listitem', { name: 'Lead: 3 deals' })).toBeTruthy();
  expect(screen.getByRole('listitem', { name: 'Closed Won: 2 deals' })).toBeTruthy();
  const sync = screen.getByRole('button', { name: 'Syncing…' }) as HTMLButtonElement;
  expect(sync.disabled).toBe(true);
  fireEvent.click(sync);
  expect(mocks.refresh).not.toHaveBeenCalled();
});

it('uses Sync Metrics and reports refresh success or failure', async () => {
  render(<Dashboard />);
  fireEvent.click(screen.getByRole('button', { name: 'Sync Metrics' }));
  await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Dashboard metrics refreshed'));
  mocks.refresh.mockResolvedValueOnce(false);
  fireEvent.click(screen.getByRole('button', { name: 'Sync Metrics' }));
  await waitFor(() => expect(mocks.failure).toHaveBeenCalledWith('Dashboard could not refresh'));
  expect(mocks.refresh).toHaveBeenCalledTimes(2);
});

it('uses the simplified loading skeleton and preserves permission-based unavailable states', () => {
  mocks.report = null; mocks.loading = true;
  const view = render(<Dashboard />);
  expect(screen.getByLabelText('Loading Dashboard')).toBeTruthy();
  mocks.loading = false; mocks.error = 'Your reporting access changed.';
  view.rerender(<Dashboard />);
  expect(screen.getByRole('alert').textContent).toContain('Your reporting access changed.');
  expect(screen.queryByRole('group')).toBeNull();
});
