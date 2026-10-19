import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';
import { MoveDealPipelineSchema } from '@leadcrm/shared';
import { replayCrmMigrations } from '../../../../tests/replay-crm-migrations';

const events = vi.hoisted(() => ({ stage: vi.fn(), update: vi.fn() }));
vi.mock('../../../../config/database.config', () => ({ default: new PrismaClient({ datasources: { db: { url: process.env.DEAL_PIPELINE_TEST_DATABASE_URL! } } }) }));
vi.mock('../../../automation/triggers/triggers.service', () => ({ fireDealCreated: vi.fn(), fireLeadCreated: vi.fn(), fireLeadStatusChanged: vi.fn(), fireContactStatusChanged: vi.fn(), fireDealStageChanged: events.stage, fireDealUpdated: events.update }));
let pg: PGlite, socket: PGLiteSocketServer, db: PrismaClient;
let transfer: typeof import('../deals.service').moveDealPipeline;
let moveStage: typeof import('../deals.repository').moveDealStage;
let presentDealResponse: typeof import('../deal-presentation').presentDealResponse;

beforeAll(async () => {
  pg = await PGlite.create(); await replayCrmMigrations(pg);
  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 }); await socket.start();
  process.env.DEAL_PIPELINE_TEST_DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1`;
  db = (await import('../../../../config/database.config')).default;
  transfer = (await import('../deals.service')).moveDealPipeline;
  moveStage = (await import('../deals.repository')).moveDealStage;
  presentDealResponse = (await import('../deal-presentation')).presentDealResponse;
  await db.tenant.createMany({ data: [{ id: 'a', name: 'A', slug: 'a' }, { id: 'b', name: 'B', slug: 'b' }] });
  await db.user.create({ data: { id: 'actor', tenantId: 'a', email: 'actor@example.test', firstName: 'Actor', lastName: 'Test', role: 'Client Admin' } });
  await db.pipeline.createMany({ data: [
    { id: 'source', tenantId: 'a', name: 'Sales' }, { id: 'target', tenantId: 'a', name: 'Follow up' },
    { id: 'archived', tenantId: 'a', name: 'Archived', isArchived: true }, { id: 'foreign', tenantId: 'b', name: 'Foreign' },
  ] });
  await db.stage.createMany({ data: [
    { id: 'lead', tenantId: 'a', pipelineId: 'source', name: 'Lead', order: 0 },
    { id: 'qualified', tenantId: 'a', pipelineId: 'source', name: 'Qualified', order: 1 },
    { id: 'won', tenantId: 'a', pipelineId: 'source', name: 'Won', order: 2, isWon: true },
    { id: 'lost', tenantId: 'a', pipelineId: 'source', name: 'Lost', order: 3, isLost: true },
    { id: 'target-open', tenantId: 'a', pipelineId: 'target', name: 'Lead', order: 0 },
    { id: 'required', tenantId: 'a', pipelineId: 'target', name: 'Ready', order: 1, requiredFields: ['expectedCloseDate'] },
    { id: 'participants-required', tenantId: 'a', pipelineId: 'target', name: 'Linked people', order: 3, requiredFields: ['leadId', 'contactId'] },
    { id: 'target-won', tenantId: 'a', pipelineId: 'target', name: 'Done', order: 2, isWon: true },
    { id: 'archived-stage', tenantId: 'a', pipelineId: 'archived', name: 'Lead', order: 0 },
    { id: 'foreign-stage', tenantId: 'b', pipelineId: 'foreign', name: 'Lead', order: 0 },
  ] });
  await db.lead.create({ data: { id: 'lead-person', tenantId: 'a', firstName: 'Customer', lastName: 'Lead' } });
  await db.contact.create({ data: { id: 'contact', tenantId: 'a', firstName: 'Customer', lastName: 'Contact' } });
  await db.account.create({ data: { id: 'account', tenantId: 'a', name: 'Customer account' } });
  await db.deal.create({ data: { id: 'deal', tenantId: 'a', title: 'Opportunity', pipelineId: 'source', stageId: 'lead',
    assignedUserId: 'actor', accountId: 'account', value: 12500, currency: 'PHP', hasEverBeenWon: false, wonHistoryVerified: true,
    closingValues: { 'reference-number': 'Retain evidence' }, leadDeals: { create: { leadId: 'lead-person' } }, contactDeals: { create: { contactId: 'contact' } } } });
  await db.activity.create({ data: { id: 'note', tenantId: 'a', dealId: 'deal', createdById: 'actor', type: 'note', title: 'Keep this note' } });
  await db.task.create({ data: { id: 'task', tenantId: 'a', createdById: 'actor', assignedUserId: 'actor', title: 'Keep task', dueDate: new Date('2026-12-01T09:00:00Z'), dealLinks: { create: { dealId: 'deal' } } } });
}, 60000);
afterAll(async () => { await db?.$disconnect(); await socket?.stop(); await pg?.close(); });
beforeEach(async () => {
  vi.clearAllMocks();
  await db.deal.update({ where: { id: 'deal' }, data: { pipelineId: 'source', stageId: 'lead', currentStageHistoryId: null, isArchived: false, deletedAt: null, closedAt: null } });
  await db.dealStageHistory.deleteMany(); await db.activity.deleteMany({ where: { type: 'stage_change' } }); await db.auditLog.deleteMany();
});

it('strictly rejects extraneous tenant, assignment, and outcome inputs', () => {
  expect(MoveDealPipelineSchema.safeParse({ pipelineId: 'target', stageId: 'target-open', tenantId: 'b' }).success).toBe(false);
  expect(MoveDealPipelineSchema.safeParse({ pipelineId: '', stageId: 'target-open' }).success).toBe(false);
});
it('commits pipeline/stage together, preserving identity, all child links and value/evidence', async () => {
  const before = await db.deal.findUniqueOrThrow({ where: { id: 'deal' } });
  const result = await transfer('deal', 'a', 'actor', { pipelineId: 'target', stageId: 'target-open' });
  expect(result.deal).toMatchObject({ id: 'deal', pipelineId: 'target', stageId: 'target-open', assignedUserId: 'actor', accountId: 'account', value: 12500, currency: 'PHP', closingValues: before.closingValues, hasEverBeenWon: false, wonHistoryVerified: true });
  expect(await db.taskDeal.count({ where: { dealId: 'deal' } })).toBe(1);
  expect(await db.activity.count({ where: { id: 'note' } })).toBe(1);
  expect(await db.leadDeal.count({ where: { dealId: 'deal' } })).toBe(1);
  expect(await db.contactDeal.count({ where: { dealId: 'deal' } })).toBe(1);
  expect(await db.dealStageHistory.count()).toBe(1); expect(await db.auditLog.count()).toBe(1);
  expect(await db.activity.findFirst({ where: { dealId: 'deal', type: 'stage_change' } })).toMatchObject({
    title: 'Moved from Sales / Lead to Follow up / Lead',
    metadata: { sourcePipelineId: 'source', sourceStageId: 'lead', targetPipelineId: 'target', targetStageId: 'target-open' },
  });
  expect(events.stage).toHaveBeenCalledOnce(); expect(events.update).toHaveBeenCalledOnce();
  const replay = await transfer('deal', 'a', 'actor', { pipelineId: 'target', stageId: 'target-open' });
  expect(replay.deal).toMatchObject({ organization: { name: 'Customer account' }, assignedUser: { firstName: 'Actor' }, leadDeals: [{ lead: { firstName: 'Customer' } }], contactDeals: [{ contact: { lastName: 'Contact' } }] });
  expect(await db.dealStageHistory.count()).toBe(1); expect(await db.auditLog.count()).toBe(1);
  expect(await db.activity.count({ where: { type: 'stage_change' } })).toBe(1);
  expect(events.stage).toHaveBeenCalledOnce(); expect(events.update).toHaveBeenCalledOnce();
});
it('resets stage entry only for an actual movement and preserves it for same-stage retries', async () => {
  const enteredAt = new Date('2020-01-01T04:23:45Z');
  await db.deal.update({ where: { id: 'deal' }, data: { stageChangedAt: enteredAt } });
  await moveStage('deal', 'a', 'lead', 'actor');
  expect((await db.deal.findUniqueOrThrow({ where: { id: 'deal' } })).stageChangedAt).toEqual(enteredAt);
  await moveStage('deal', 'a', 'qualified', 'actor');
  const moved = await db.deal.findUniqueOrThrow({ where: { id: 'deal' } });
  expect(moved.stageChangedAt!.getTime()).toBeGreaterThan(+enteredAt);
  await moveStage('deal', 'a', 'qualified', 'actor');
  expect((await db.deal.findUniqueOrThrow({ where: { id: 'deal' } })).stageChangedAt).toEqual(moved.stageChangedAt);
});
it('validates legacy singular participant requirements against canonical links', async () => {
  const result = await transfer('deal', 'a', 'actor', { pipelineId: 'target', stageId: 'participants-required' });
  expect(result.deal).toMatchObject({ leadId: 'lead-person', contactId: 'contact', pipelineId: 'target', stageId: 'participants-required' });
});
it('presents the latest persisted movement after stage re-entry without changing dates or history', async () => {
  const latest = new Date('2026-10-20T02:00:00Z');
  await db.deal.update({ where: { id: 'deal' }, data: { stageId: 'qualified',
    createdAt: new Date('2020-01-01T00:00:00Z'), stageChangedAt: new Date('2099-01-01T00:00:00Z'),
    updatedAt: new Date('2099-02-01T00:00:00Z') } });
  await db.dealStageHistory.createMany({ data: [
    { id: 're-entry', tenantId: 'a', dealId: 'deal', movedById: 'actor', previousStageId: 'lead', newStageId: 'qualified', movedAt: latest },
    { id: 'first-entry', tenantId: 'a', dealId: 'deal', movedById: 'actor', previousStageId: 'lead', newStageId: 'qualified', movedAt: new Date('2026-10-18T02:00:00Z') },
    { id: 'left-stage', tenantId: 'a', dealId: 'deal', movedById: 'actor', previousStageId: 'qualified', newStageId: 'lead', movedAt: new Date('2026-10-19T02:00:00Z') },
  ] });
  const row = await db.deal.findUniqueOrThrow({ where: { id: 'deal' }, include: { stageHistories: { orderBy: { id: 'asc' } } } });
  const before = structuredClone(row);
  type Presented = typeof row & { lastStageChangeDate: string };
  const response = await presentDealResponse('a', { data: [row], deal: row }) as { data: Presented[]; deal: Presented };
  expect(response.data[0].lastStageChangeDate).toBe(latest.toISOString());
  expect(response.deal.lastStageChangeDate).toBe(latest.toISOString());
  expect(response.deal.createdAt).toEqual(before.createdAt);
  expect(response.deal.stageHistories).toEqual(before.stageHistories);
  expect(row).toEqual(before);
  expect(await db.deal.findUniqueOrThrow({ where: { id: 'deal' }, include: { stageHistories: { orderBy: { id: 'asc' } } } })).toEqual(before);
});
it('falls back to creation without history and presents committed moves and same-stage retries consistently', async () => {
  const createdAt = new Date('2020-01-01T00:00:00Z');
  const row = await db.deal.update({ where: { id: 'deal' }, data: { createdAt,
    stageChangedAt: new Date('2099-01-01T00:00:00Z'), updatedAt: new Date('2099-02-01T00:00:00Z') } });
  const initial = await presentDealResponse('a', row) as typeof row & { lastStageChangeDate: string };
  expect(initial.lastStageChangeDate).toBe(createdAt.toISOString());
  expect(await db.dealStageHistory.count()).toBe(0);
  expect(await presentDealResponse('b', row)).not.toHaveProperty('lastStageChangeDate');
  const result = (await moveStage('deal', 'a', 'qualified', 'actor'))!;
  type Presented = typeof result & { deal: { lastStageChangeDate: string } };
  const moved = await presentDealResponse('a', result) as Presented;
  expect(moved.deal.lastStageChangeDate).toBe(result.stageHistory!.movedAt.toISOString());
  const retried = await presentDealResponse('a', (await moveStage('deal', 'a', 'qualified', 'actor'))!) as Presented;
  expect(retried.deal.lastStageChangeDate).toBe(moved.deal.lastStageChangeDate);
  expect(await db.dealStageHistory.count()).toBe(1);
  expect((await db.deal.findUniqueOrThrow({ where: { id: 'deal' } })).createdAt).toEqual(createdAt);
});
it.each([
  ['foreign', 'foreign-stage'], ['archived', 'archived-stage'], ['target', 'lead'], ['target', 'target-won'], ['target', 'required'], ['source', 'qualified'], ['missing', 'target-open'],
])('rejects invalid destination %s/%s without any partial write or history', async (pipelineId, stageId) => {
  const before = await db.deal.findUniqueOrThrow({ where: { id: 'deal' } });
  await expect(transfer('deal', 'a', 'actor', { pipelineId, stageId })).rejects.toThrow();
  expect(await db.deal.findUniqueOrThrow({ where: { id: 'deal' } })).toEqual(before);
  expect(await db.dealStageHistory.count()).toBe(0); expect(await db.auditLog.count()).toBe(0);
  expect(events.stage).not.toHaveBeenCalled();
});
it.each(['won', 'lost'])('cannot reopen a terminal %s source through transfer', async stageId => {
  await db.deal.update({ where: { id: 'deal' }, data: { stageId } });
  await expect(transfer('deal', 'a', 'actor', { pipelineId: 'target', stageId: 'target-open' })).rejects.toThrow('open Deals');
});
it.each([{ isArchived: true }, { deletedAt: new Date() }])('stale cards cannot move archived/deleted records: %j', async data => {
  await db.deal.update({ where: { id: 'deal' }, data });
  await expect(transfer('deal', 'a', 'actor', { pipelineId: 'target', stageId: 'target-open' })).rejects.toThrow('Deal');
  expect(await moveStage('deal', 'a', 'qualified', 'actor')).toBeNull();
  expect(await db.dealStageHistory.count()).toBe(0);
});
it('rejects another tenant source and retains ordinary same-pipeline validation', async () => {
  await expect(transfer('deal', 'b', 'actor', { pipelineId: 'foreign', stageId: 'foreign-stage' })).rejects.toThrow('Deal');
  await expect(moveStage('deal', 'a', 'target-open', 'actor')).rejects.toThrow('pipeline');
});
it('Lost requires a reason and a same-stage replay records the outcome once', async () => {
  await expect(moveStage('deal', 'a', 'lost', 'actor', undefined, undefined, '   ')).rejects.toThrow('reason');
  await moveStage('deal', 'a', 'lost', 'actor', undefined, undefined, 'Customer cancelled');
  await moveStage('deal', 'a', 'lost', 'actor', undefined, undefined, 'Customer cancelled');
  expect(await db.dealStageHistory.count()).toBe(1);
});
