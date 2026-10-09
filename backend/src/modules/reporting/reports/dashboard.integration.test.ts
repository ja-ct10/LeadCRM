import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';
import type { Server } from 'node:http';
import { replayCrmMigrations } from '../../../tests/replay-crm-migrations';
import { installTenantScoping } from '../../../core/tenant/tenant-prisma';
import { tenantContext } from '../../../core/tenant/tenant-context';
import { DashboardQuerySchema, dashboardPeriod, dashboardCsv } from '@leadcrm/shared';

vi.mock('../../../config/database.config', () => ({ default: new PrismaClient({ datasources: { db: { url: process.env.DASHBOARD_TEST_DATABASE_URL! } } }) }));
let pg: PGlite, socket: PGLiteSocketServer, db: PrismaClient, server: Server, base: string;
let dashboard: typeof import('./dashboard.service').getDashboard;
let move: typeof import('../../crm/deals/deals.repository').moveDealStage;
let adminToken: string, agentToken: string, foreignToken: string;
const now = new Date('2020-01-15T04:00:00Z');
const query = { range: 'custom', start: '2020-01-01', end: '2020-01-31' };
const admin = { userId: 'admin', tenantId: 'a', role: 'Client Admin', email: 'admin@camxian.com' };
const agent = { userId: 'agent', tenantId: 'a', role: 'Sales', email: 'agent@camxian.com' };
const scoped = <T>(work: () => T) => tenantContext.run({ tenantId: 'a' }, work);
const report = () => scoped(() => dashboard(admin, query, now));
async function deal(id: string, stageId: string, value: number | null = 1000, extra = {}) {
  return db.deal.create({ data: { id, tenantId: 'a', title: id, pipelineId: 'sales', stageId, assignedUserId: 'agent', ownerId: 'agent',
    value, currency: 'PHP', createdAt: new Date('2020-01-01T00:00:00Z'), tags: [], ...extra } });
}
async function close(id: string, stageId: 'won' | 'lost', closedAt = new Date('2020-01-05T00:00:00Z')) {
  await db.deal.update({ where: { id }, data: { stageId, closedAt } });
  await db.dealStageHistory.create({ data: { tenantId: 'a', dealId: id, previousStageId: 'qualified', newStageId: stageId, movedById: 'admin', movedAt: closedAt } });
}
async function http(path: string, token = adminToken, method = 'GET', body?: unknown) {
  return fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeAll(async () => {
  process.env.JWT_SECRET = 'disposable-dashboard-test-secret';
  pg = await PGlite.create(); await replayCrmMigrations(pg);
  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 }); await socket.start();
  process.env.DASHBOARD_TEST_DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1`;
  db = (await import('../../../config/database.config')).default; installTenantScoping(db);
  dashboard = (await import('./dashboard.service')).getDashboard;
  move = (await import('../../crm/deals/deals.repository')).moveDealStage;
  await db.tenant.createMany({ data: [{ id: 'a', name: 'A', slug: 'a', onboardingStep: 3, onboardingCompletedAt: now }, { id: 'b', name: 'B', slug: 'b', onboardingStep: 3, onboardingCompletedAt: now }] });
  await db.user.createMany({ data: [
    { id: 'admin', tenantId: 'a', role: 'Client Admin', email: 'admin@camxian.com' },
    { id: 'agent', tenantId: 'a', role: 'Sales', email: 'agent@camxian.com' },
    { id: 'other-agent', tenantId: 'a', role: 'Sales', email: 'other@camxian.com' },
    { id: 'foreign', tenantId: 'b', role: 'Client Admin', email: 'foreign@camxian.com' },
    { id: 'denied', tenantId: 'a', role: 'Viewer', email: 'denied@camxian.com' },
  ].map(user => ({ ...user, firstName: user.id, lastName: 'Test', mustChangePassword: false, onboardingCompletedAt: now })) });
  await db.roleDefinition.create({ data: { id: 'sales-role', tenantId: 'a', name: 'Sales' } });
  await db.rolePermission.createMany({ data: ['dashboard','deals','leads','tasks'].map(module => ({ tenantId: 'a', roleId: 'sales-role', module, canView: true, canEdit: true, canCreate: true })) });
  await db.userRole.createMany({ data: ['agent','other-agent'].map(userId => ({ tenantId: 'a', userId, roleId: 'sales-role' })) });
  await db.pipeline.createMany({ data: [{ id: 'sales', tenantId: 'a', name: 'Sales Pipeline' }, { id: 'foreign-sales', tenantId: 'b', name: 'Sales Pipeline' }] });
  await db.stage.createMany({ data: [
    ['lead','Lead',10,'#3B82F6'], ['contacted','Contacted',40,'#F59E0B'], ['qualified','Qualified',70,'#8B5CF6'],
    ['won','Closed Won',100,'#059669'], ['lost','Closed Lost',0,'#DC2626'],
  ].flatMap(([id, name, probability, color], order) => ['a','b'].map(tenantId => ({ id: tenantId === 'a' ? String(id) : `foreign-${id}`,
    tenantId, pipelineId: tenantId === 'a' ? 'sales' : 'foreign-sales', name: String(name), probability: Number(probability), color: String(color), order,
    isWon: id === 'won', isLost: id === 'lost', requiredFields: [] }))) });
  await db.closingFieldDefinition.create({ data: { tenantId: 'a', id: 'optional', definition: { id: 'optional', name: 'Optional note', module: 'deals', group: 'Closed Won Requirements', type: 'Text', required: false, active: true, order: 0, options: [] } } });
  const { createAuthSessionToken } = await import('../../../core/auth/auth-session');
  for (const id of ['admin','agent','foreign']) {
    const token = await createAuthSessionToken(await db.user.findUniqueOrThrow({ where: { id } }));
    if (id === 'admin') adminToken = token; if (id === 'agent') agentToken = token; if (id === 'foreign') foreignToken = token;
  }
  const app = (await import('../../../app')).default;
  server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
}, 90000);
afterAll(async () => {
  server?.closeAllConnections(); if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await db?.$disconnect(); await socket?.stop(); await pg?.close();
});

describe('authoritative dashboard', () => {
  it('uses Manila boundaries, calendar validation and bounded custom ranges', () => {
    expect(dashboardPeriod({ range: 'today' }, new Date('2020-01-01T16:30:00Z')).from.toISOString()).toBe('2020-01-01T16:00:00.000Z');
    expect(dashboardPeriod({ range: 'lastMonth' }, new Date('2020-03-01T00:00:00Z'))).toMatchObject({ start: '2020-02-01', end: '2020-02-29' });
    expect(DashboardQuerySchema.safeParse({ range: 'custom', start: '2020-02-30', end: '2020-03-01' }).success).toBe(false);
    expect(() => dashboardPeriod({ range: 'custom', start: '2010-01-01', end: '2020-01-01' })).toThrow();
  });
  it('renders an actually empty workspace without fabricated rates or velocity', async () => {
    const result = await report();
    expect(result.metrics).toMatchObject({ totalRevenue: 0, activeDeals: 0, totalLeads: 0, forecastedRevenue: 0, winRate: null, averageDealDays: null });
    expect(result.distribution.map(row => row.count)).toEqual([0,0,0]); expect(result.pendingActions).toBe(0);
  });
  it('reconciles revenue, outcomes, open counts, values, forecast and creation-to-close duration', async () => {
    await deal('open-lead', 'lead', 1000); await deal('open-contacted', 'contacted', 2000); await deal('open-qualified', 'qualified', 3000);
    await deal('winner', 'qualified', 45000); await close('winner', 'won');
    await deal('loser', 'qualified', 90000); await close('loser', 'lost');
    await db.lead.createMany({ data: [
      { id: 'active-lead', tenantId: 'a', firstName: 'Active', lastName: 'Lead', assignedUserId: 'agent', status: 'Hot' },
      { id: 'archived-lead', tenantId: 'a', firstName: 'Archived', lastName: 'Lead', isArchived: true },
      { id: 'converted-lead', tenantId: 'a', firstName: 'Converted', lastName: 'Lead', convertedAt: now },
    ] });
    const result = await report();
    expect(result.metrics).toMatchObject({ totalRevenue: 45000, won: 1, lost: 1, winRate: 50, activeDeals: 3, forecastedRevenue: 3000, openPipelineValue: 6000, totalLeads: 1, averageDealDays: 4 });
    expect(result.trend.reduce((sum, row) => sum + row.revenue, 0)).toBe(result.metrics.totalRevenue);
    expect(result.trend.reduce((sum, row) => sum + row.won, 0)).toBe(1);
    expect(result.trend.reduce((sum, row) => sum + row.lost, 0)).toBe(1);
    expect(result.distribution.reduce((sum, row) => sum + row.count, 0)).toBe(result.metrics.activeDeals);
    expect(result.distribution.reduce((sum, row) => sum + (row.value ?? 0), 0)).toBe(result.metrics.openPipelineValue);
    expect(result.leaderboard[0]).toMatchObject({ id: 'agent', won: 1, revenue: 45000 });
  });
  it('handles stage movements, skips, backwards moves, lost reopening, repeated closure and actual future history', async () => {
    await deal('journey', 'lead', 500);
    for (const stageId of ['contacted','qualified','lead','qualified','lost','qualified']) {
      await scoped(() => move('journey', 'a', stageId, 'admin', undefined, undefined, stageId === 'lost' ? 'Deferred' : undefined));
    }
    await scoped(() => move('journey', 'a', 'won', 'admin'));
    await scoped(() => move('journey', 'a', 'won', 'admin'));
    await expect(scoped(() => move('journey', 'a', 'qualified', 'admin'))).rejects.toThrow('won');
    expect(await db.dealStageHistory.count({ where: { dealId: 'journey', newStageId: 'won' } })).toBe(1);
    const result = await scoped(() => dashboard(admin, query));
    expect(result.conversion!.stages.map(row => row.reached)).toEqual([2,2,4,2,2]);
    expect(result.conversion!.qualifiedToWon).toBe(50);
    expect(result.conversion!.qualifiedToLost).toBe(50);
    // Lifetime milestones retain the earlier Lost event even after reopening;
    // period outcome metrics use the one current authoritative terminal result.
    expect(result.metrics.activeDeals).toBe(3);
  });
  it('handles Manila month edges without losing the first or last bucket', async () => {
    await deal('boundary', 'qualified', 250, { createdAt: new Date('2019-12-01T00:00:00Z') });
    await close('boundary', 'won', new Date('2019-12-31T16:00:00Z'));
    expect((await db.deal.findUniqueOrThrow({ where: { id: 'boundary' } })).closedAt?.toISOString()).toBe('2019-12-31T16:00:00.000Z');
    const result = await report();
    expect(result.trend[0]).toMatchObject({ name: '2020-01-01', revenue: 250 });
    expect(result.trend.reduce((sum, row) => sum + row.revenue, 0)).toBe(result.metrics.totalRevenue);
  });
  it('does not claim missing probabilities or missing monetary values are verified zero', async () => {
    await db.stage.update({ where: { id: 'lead' }, data: { probability: null } });
    expect((await report()).metrics.forecastedRevenue).toBeNull();
    await db.stage.update({ where: { id: 'lead' }, data: { probability: 10 } });
    await deal('missing-value', 'lead', null);
    expect((await report()).metrics).toMatchObject({ forecastedRevenue: null, openPipelineValue: null, totalRevenue: 45250 });
    await db.deal.update({ where: { id: 'missing-value' }, data: { isArchived: true } });
  });
  it('reconciles cent-normalized legacy amounts across dates and stage groups', async () => {
    const before = await report();
    await deal('fraction-open-lead', 'lead', 0.004);
    await deal('fraction-open-contacted', 'contacted', 0.004);
    for (const [id, date] of [['fraction-win-a','2020-01-06'],['fraction-win-b','2020-01-07']]) {
      await deal(id, 'qualified', 0.004); await close(id, 'won', new Date(date));
    }
    const result = await report();
    expect(result.metrics.totalRevenue).toBe(before.metrics.totalRevenue);
    expect(result.metrics.totalRevenue).toBe(result.trend.reduce((sum,row) => sum + row.revenue,0));
    expect(result.metrics.openPipelineValue).toBe(result.distribution.reduce((sum,row) => sum + (row.value ?? 0),0));
    await db.deal.updateMany({ where: { id: { startsWith: 'fraction-' } }, data: { isArchived: true } });
  });
  it('isolates currencies, unknown closing dates and legacy attribution instead of guessing', async () => {
    await deal('dollars', 'qualified', 999999, { currency: 'USD' }); await close('dollars', 'won');
    await deal('unknown-close', 'won', 999999);
    const result = await report();
    expect(result.metrics.totalRevenue).toBe(45250); expect(result.metrics.currencyExcluded).toBe(1);
    // The journey closed after this fixed as-of date; it and the null date are excluded.
    expect(result.metrics.closingDateMissing).toBe(2);
    expect(result.warnings.join(' ')).toContain('another or unknown currency');
    await db.deal.update({ where: { id: 'unknown-close' }, data: { closedAt: new Date('2020-01-05T00:00:00Z') } });
    expect((await report()).warnings.join(' ')).toContain('historical agent attribution');
    await db.deal.update({ where: { id: 'unknown-close' }, data: { isArchived: true } });
  });
  it('keeps won attribution after reassignment and records incomplete legacy conversion', async () => {
    await db.deal.update({ where: { id: 'winner' }, data: { assignedUserId: 'other-agent', ownerId: 'other-agent', revenueOwnerId: 'other-agent', revenueOwnerEligible: false } });
    expect((await report()).leaderboard.find(row => row.id === 'agent')?.revenue).toBe(45250);
    expect((await db.deal.findUniqueOrThrow({ where: { id: 'winner' } })).revenueOwnerId).toBe('agent');
    await db.dealStageHistory.deleteMany({ where: { dealId: 'open-lead' } });
    const conversion = (await report()).conversion!;
    expect(conversion.missingHistory).toBeGreaterThan(0);
    expect(conversion.leadToContacted).toBeNull();
    expect(conversion.qualifiedToWon).toBeNull();
  });
  it('tracks only qualifying tasks and links authorized actionable records', async () => {
    await db.task.createMany({ data: [
      { id: 'overdue', status: 'pending', dueDate: new Date('2019-12-01'), title: 'Overdue' },
      { id: 'today', status: 'in_progress', dueDate: now, title: 'Today' },
      { id: 'done', status: 'completed', dueDate: now, title: 'Done' },
      { id: 'cancelled', status: 'cancelled', dueDate: now, title: 'Cancelled' },
    ].map(task => ({ ...task, tenantId: 'a', assignedUserId: 'agent' })) });
    const result = await report();
    expect(result.actions[0]).toMatchObject({ id: 'overdue', overdue: true, href: '/operations/taskboard?taskId=overdue' });
    expect(result.actions.map(row => row.id)).not.toContain('done'); expect(result.actions.map(row => row.id)).not.toContain('cancelled');
  });
  it('publishes revision counters only for committed data and covers archive, tasks, roles and tenant isolation', async () => {
    const before = await db.dashboardRevision.findUniqueOrThrow({ where: { tenantId: 'a' } });
    await expect(db.$transaction(async tx => { await tx.deal.update({ where: { id: 'open-qualified' }, data: { value: 777 } }); throw new Error('rollback'); })).rejects.toThrow('rollback');
    expect(await db.dashboardRevision.findUniqueOrThrow({ where: { tenantId: 'a' } })).toEqual(before);
    await db.deal.update({ where: { id: 'open-qualified' }, data: { value: 3500 } });
    await db.task.update({ where: { id: 'overdue' }, data: { status: 'completed' } });
    const after = await db.dashboardRevision.findUniqueOrThrow({ where: { tenantId: 'a' } });
    expect(after.analytics).toBeGreaterThan(before.analytics); expect(after.actions).toBeGreaterThan(before.actions);
    const foreignBefore = await db.dashboardRevision.findUniqueOrThrow({ where: { tenantId: 'b' } });
    await db.lead.update({ where: { id: 'active-lead' }, data: { isArchived: true } });
    expect(await db.dashboardRevision.findUniqueOrThrow({ where: { tenantId: 'b' } })).toEqual(foreignBefore);
  });
  it('enforces staff scope, module restrictions, HTTP auth, exports and cross-tenant requests', async () => {
    const personal = await scoped(() => dashboard(agent, query, now));
    expect(personal.scope).toBe('assigned'); expect(personal.metrics.totalRevenue).toBe(250);
    expect((await http('/reporting/dashboard', '')).status).toBe(401);
    expect((await http('/reporting/dashboard?tenantId=b')).status).toBe(400);
    const foreign = await (await http('/reporting/dashboard', foreignToken)).json();
    expect(foreign.data.metrics.totalRevenue).toBe(0); expect(foreign.data.actions).toEqual([]);
    const response = await http('/reporting/dashboard/export?range=custom&start=2020-01-01&end=2020-01-31');
    expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('text/csv');
    const csv = await response.text(); expect(csv).toContain('Reporting period'); expect(csv).toContain('Current open pipeline');
    const injected = { ...await report(), actions: [{ id: 'x', title: ' =HYPERLINK("evil")', kind: 'task' as const, dueDate: null, priority: 'High', overdue: false, href: '/x' }] };
    expect(dashboardCsv(injected)).toContain('"\' =HYPERLINK(""evil"")"');
    await db.rolePermission.updateMany({ where: { roleId: 'sales-role', module: 'deals' }, data: { canView: false } });
    const restricted = await scoped(() => dashboard(agent, query));
    expect(restricted.metrics.totalRevenue).toBeNull(); expect(restricted.trend).toEqual([]); expect(restricted.leaderboard).toEqual([]);
    expect((await http('/reporting/pipeline-summary', agentToken)).status).toBe(403);
    await db.rolePermission.updateMany({ where: { roleId: 'sales-role', module: 'dashboard' }, data: { canView: false } });
    expect((await http('/reporting/dashboard', agentToken)).status).toBe(403);
    expect((await http('/reporting/dashboard/export', agentToken)).status).toBe(403);
    expect((await http('/reporting/dashboard/events', agentToken)).status).toBe(403);
  });
  it('streams committed tenant revisions and rechecks live session authorization', async () => {
    await db.rolePermission.updateMany({ where: { roleId: 'sales-role', module: 'dashboard' }, data: { canView: true } });
    const a = new AbortController(), b = new AbortController();
    const open = (token: string, signal: AbortSignal) => fetch(base + '/reporting/dashboard/events', { headers: { Authorization: `Bearer ${token}` }, signal });
    const readEvent = async (reader: ReadableStreamDefaultReader<Uint8Array>, event: string) => {
      let buffer = '';
      for (;;) {
        const part = await reader.read();
        if (part.done) throw new Error('Stream ended before event');
        buffer += new TextDecoder().decode(part.value);
        const match = buffer.match(new RegExp(`event: ${event}\\ndata: ([^\\n]+)`));
        if (match) return JSON.parse(match[1]);
      }
    };
    try {
      const [own, foreign] = await Promise.all([open(agentToken, a.signal), open(foreignToken, b.signal)]);
      expect(own.status).toBe(200); expect(own.headers.get('x-accel-buffering')).toBe('no');
      const ownReader = own.body!.getReader(), foreignReader = foreign.body!.getReader();
      const first = await readEvent(ownReader, 'dashboard-change');
      await readEvent(foreignReader, 'dashboard-change');
      await db.lead.create({ data: { tenantId: 'b', firstName: 'Foreign', lastName: 'Event' } });
      const changed = await readEvent(foreignReader, 'dashboard-change');
      expect(changed.leads).toBe('1');
      expect((await db.dashboardRevision.findUniqueOrThrow({ where: { tenantId: 'a' } })).leads.toString()).toBe(first.leads);
      expect(await readEvent(ownReader, 'dashboard-heartbeat')).toEqual({});
      expect(Object.keys(first).sort()).toEqual(['access','actions','analytics','leads']);
      const { revokeSession } = await import('../../../core/auth/session.service');
      await revokeSession(agentToken);
      expect(await readEvent(ownReader, 'dashboard-access-changed')).toEqual({});
      expect((await http('/reporting/dashboard', agentToken)).status).toBe(401);
    } finally {
      a.abort(); b.abort();
    }
  }, 20000);
});
