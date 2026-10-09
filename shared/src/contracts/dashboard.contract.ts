import { z } from 'zod';

export const DASHBOARD_TIMEZONE = 'Asia/Manila';
export const DASHBOARD_RANGES = ['today', 'last7', 'last30', 'thisMonth', 'lastMonth', 'last3', 'last6', 'thisYear', 'custom'] as const;
export type DashboardRange = typeof DASHBOARD_RANGES[number];
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00+08:00`);
  return Number.isFinite(+date) && new Date(+date + 8 * 3600000).toISOString().slice(0, 10) === value;
}, 'Enter a valid calendar date.');
export const DashboardQuerySchema = z.object({
  range: z.enum(DASHBOARD_RANGES).default('thisMonth'), start: day.optional(), end: day.optional(),
}).strict().superRefine((query, ctx) => {
  if (query.range === 'custom' && (!query.start || !query.end || query.start > query.end)) {
    ctx.addIssue({ code: 'custom', message: 'Choose a valid start and end date.' });
  }
});
export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;

/** Inclusive Manila calendar dates, represented as a half-open UTC interval. */
export function dashboardPeriod(query: DashboardQuery, now = new Date()) {
  const today = new Date(+now + 8 * 3600000).toISOString().slice(0, 10);
  const [year, month] = today.split('-').map(Number);
  const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
  let start = today, end = today;
  if (query.range === 'last7' || query.range === 'last30') start = new Date(Date.parse(today) - (query.range === 'last7' ? 6 : 29) * 86400000).toISOString().slice(0, 10);
  if (query.range === 'thisMonth') start = iso(year, month - 1, 1);
  if (query.range === 'lastMonth') { start = iso(year, month - 2, 1); end = iso(year, month - 1, 0); }
  if (query.range === 'last3' || query.range === 'last6') start = iso(year, month - (query.range === 'last3' ? 3 : 6), 1);
  if (query.range === 'thisYear') start = iso(year, 0, 1);
  if (query.range === 'custom') { start = query.start!; end = query.end!; }
  const from = new Date(`${start}T00:00:00+08:00`);
  const until = new Date(+new Date(`${end}T00:00:00+08:00`) + 86400000);
  if (+until - +from > 732 * 86400000) throw new Error('Choose a reporting period of at most two years.');
  return { start, end, from, until, timezone: DASHBOARD_TIMEZONE, interval: (+until - +from > 93 * 86400000 ? 'month' : 'day') as 'day' | 'month' };
}

export interface DashboardStage {
  id: string; name: string; order: number; color: string | null; probability: number | null; isWon: boolean; isLost: boolean;
}
export interface DashboardReport {
  generatedAt: string; queryMs: number; scope: 'organization' | 'assigned'; currency: string;
  period: { start: string; end: string; timezone: string; interval: 'day' | 'month' };
  access: { deals: boolean; leads: boolean; tasks: boolean };
  pipeline: { id: string; name: string; stages: DashboardStage[] } | null;
  metrics: {
    totalRevenue: number | null; forecastedRevenue: number | null; activeDeals: number | null;
    totalLeads: number | null; won: number | null; lost: number | null; winRate: number | null; averageDealDays: number | null;
    openPipelineValue: number | null; forecastMissing: number; monetaryMissing: number; currencyExcluded: number; closingDateMissing: number;
  };
  trend: Array<{ name: string; revenue: number; won: number; lost: number }>;
  distribution: Array<{ id: string; name: string; color: string | null; count: number; value: number | null; percentage: number }>;
  conversion: {
    cohort: number; missingHistory: number;
    stages: Array<{ id: string; name: string; color: string | null; reached: number }>;
    leadToContacted: number | null; contactedToQualified: number | null;
    qualifiedToWon: number | null; qualifiedToLost: number | null;
  } | null;
  leaderboard: Array<{ id: string; firstName: string; lastName: string; won: number; revenue: number }>;
  actions: Array<{ id: string; title: string; kind: 'task' | 'lead' | 'deal'; dueDate: string | null; priority: string; overdue: boolean; href: string }>;
  pendingActions: number; warnings: string[];
}

/** Excel-compatible escaping, including formula injection through whitespace. */
export function dashboardCsv(report: DashboardReport): string {
  const rows: Array<Array<string | number | null>> = [
    ['LeadCRM Dashboard', 'Value', 'Time basis / unit'],
    ['Reporting period', `${report.period.start} through ${report.period.end}`, report.period.timezone],
    ['Generated at', report.generatedAt, report.scope],
    ['Total Revenue', report.metrics.totalRevenue, `Period / ${report.currency}`],
    ['Forecasted Revenue', report.metrics.forecastedRevenue, `Current open pipeline / ${report.currency}`],
    ['Active Deals', report.metrics.activeDeals, 'Current'], ['Total Leads', report.metrics.totalLeads, 'Current unconverted, unarchived'],
    ['Win Rate', report.metrics.winRate, 'Period / %'], ['Average Deal Velocity', report.metrics.averageDealDays, 'Period / days'],
    ['Open Pipeline Value', report.metrics.openPipelineValue, `Current / ${report.currency}`],
    ['Bucket', 'Revenue', 'Won', 'Lost'], ...report.trend.map(row => [row.name, report.metrics.totalRevenue === null ? null : row.revenue, row.won, row.lost]),
    ['Open stage', 'Deal count', `Value (${report.currency})`, 'Percentage'], ...report.distribution.map(row => [row.name, row.count, row.value, row.percentage]),
    ['Credited sales agent', 'Won deals', `Revenue (${report.currency})`], ...report.leaderboard.map(row => [`${row.firstName} ${row.lastName}`, row.won, row.revenue]),
    ['Conversion stage', 'Distinct deals reached', 'Created-in-period cohort'], ...(report.conversion?.stages.map(row => [row.name, row.reached, report.conversion!.cohort]) ?? []),
    ['Progression', 'Percent', 'History-based cohort intersection'],
    ['Lead to Contacted', report.conversion?.leadToContacted ?? null], ['Contacted to Qualified', report.conversion?.contactedToQualified ?? null],
    ['Qualified to Closed Won', report.conversion?.qualifiedToWon ?? null], ['Qualified to Closed Lost', report.conversion?.qualifiedToLost ?? null],
    ['Action', 'Due', 'Priority'], ...report.actions.map(row => [row.title, row.dueDate, row.priority]),
    ...report.warnings.map(warning => ['Reporting limitation', warning]),
  ];
  return '\uFEFF' + rows.map(row => row.map(value => {
    let cell = value === null ? 'Unavailable' : String(value);
    if (/^[\s\uFEFF]*[=+\-@]/.test(cell) || /^[\t\r\n]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
}
