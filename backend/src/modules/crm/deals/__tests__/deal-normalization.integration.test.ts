import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';
import { replayCrmMigrations } from '../../../../tests/replay-crm-migrations';
import { installTenantScoping } from '../../../../core/tenant/tenant-prisma';
import { tenantContext } from '../../../../core/tenant/tenant-context';

vi.mock('../../../../config/database.config', () => ({ default: new PrismaClient({ datasources: { db: { url: process.env.DEAL_NORMALIZATION_TEST_DATABASE_URL! } } }) }));
let pg: PGlite, socket: PGLiteSocketServer, db: PrismaClient;
let update: typeof import('../deals.repository').updateDeal;
beforeAll(async () => {
  pg = await PGlite.create(); await replayCrmMigrations(pg);
  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 }); await socket.start();
  process.env.DEAL_NORMALIZATION_TEST_DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1`;
  db = (await import('../../../../config/database.config')).default;
  installTenantScoping(db);
  update = (await import('../deals.repository')).updateDeal;
  await db.tenant.createMany({ data: [{ id: 'tenant-a', name: 'A', slug: 'a' }, { id: 'tenant-b', name: 'B', slug: 'b' }] });
  await db.user.create({ data: { id: 'actor', tenantId: 'tenant-a', email: 'actor@camxian.com', firstName: 'Actor', lastName: 'Test', role: 'Client Admin' } });
  await db.pipeline.create({ data: { id: 'pipeline', tenantId: 'tenant-a', name: 'Sales' } });
  await db.stage.create({ data: { id: 'stage', tenantId: 'tenant-a', pipelineId: 'pipeline', name: 'Lead', order: 0 } });
  await db.lead.createMany({ data: ['old-lead', 'new-lead'].map(id => ({ id, tenantId: 'tenant-a', firstName: id, lastName: 'Test' })) });
  await db.contact.createMany({ data: [
    { id: 'old-contact', tenantId: 'tenant-a', firstName: 'Old', lastName: 'Test' },
    { id: 'new-contact', tenantId: 'tenant-a', firstName: 'New', lastName: 'Test' },
    { id: 'foreign-contact', tenantId: 'tenant-b', firstName: 'Foreign', lastName: 'Test' },
  ] });
  await db.deal.create({ data: { id: 'deal', tenantId: 'tenant-a', title: 'Original', pipelineId: 'pipeline', stageId: 'stage', leadDeals: { create: { leadId: 'old-lead', position: 0 } }, contactDeals: { create: { contactId: 'old-contact', position: 0 } }, value: 12500 } });
}, 60000);
afterAll(async () => { await db?.$disconnect(); await socket?.stop(); await pg?.close(); });

describe('normalized Deal writes', () => {
  it('rolls back scalar and contact edits when a later lead association fails', async () => {
    const before = await db.deal.findUniqueOrThrow({ where: { id: 'deal' } });
    await expect(update('deal', 'tenant-a', { title: 'Must roll back', contactIds: ['new-contact'], leadIds: ['missing-lead'] }, 'actor')).rejects.toThrow();
    expect(await db.deal.findUniqueOrThrow({ where: { id: 'deal' } })).toEqual(before);
    expect((await db.contactDeal.findMany()).map(row => row.contactId)).toEqual(['old-contact']);
    expect((await db.leadDeal.findMany()).map(row => row.leadId)).toEqual(['old-lead']);
  });
  it('rejects cross-tenant associations without partially updating the Deal', async () => {
    await expect(update('deal', 'tenant-a', { title: 'Foreign', contactIds: ['foreign-contact'] }, 'actor')).rejects.toThrow();
    expect((await db.deal.findUniqueOrThrow({ where: { id: 'deal' } })).title).toBe('Original');
  });
  it('commits multi-person junctions and their compatibility projections together', async () => {
    const saved = await update('deal', 'tenant-a', { title: 'Changed', contactIds: ['new-contact', 'old-contact'], leadIds: ['new-lead'] }, 'actor');
    expect(saved).toMatchObject({ title: 'Changed', leadId: 'new-lead', contactId: 'new-contact', value: 12500 });
    expect(saved?.contactDeals.map(link => link.contactId).sort()).toEqual(['new-contact', 'old-contact']);
    expect(saved?.leadDeals.map(link => link.leadId)).toEqual(['new-lead']);
  });
  it('clears legacy references when all junction links are removed', async () => {
    const saved = await update('deal', 'tenant-a', { contactIds: [], leadIds: [] }, 'actor');
    expect(saved).toMatchObject({ leadId: null, contactId: null, leadDeals: [], contactDeals: [], value: 12500 });
  });
  it('inherits scoped tenant ownership during nested creation and rejects foreign connections', async () => {
    const nested = await tenantContext.run({ tenantId: 'tenant-a' }, async () => await db.pipeline.create({
      data: { tenantId: 'tenant-b', name: 'Nested', stages: { create: { name: 'Scoped stage', order: 0 } } },
      include: { stages: true },
    }));
    expect(nested.tenantId).toBe('tenant-a');
    expect(nested.stages).toHaveLength(1);
    expect(nested.stages[0].tenantId).toBe('tenant-a');
    const foreign = await db.pipeline.create({
      data: { tenantId: 'tenant-b', name: 'Foreign', stages: { create: { name: 'Foreign stage', order: 0 } } },
      include: { stages: true },
    });
    await expect(tenantContext.run({ tenantId: 'tenant-a' }, async () => await db.pipeline.update({
      where: { id: nested.id }, data: { stages: { connect: { id: foreign.stages[0].id } } },
    }))).rejects.toThrow();
    expect(await db.stage.findUniqueOrThrow({ where: { id: foreign.stages[0].id } })).toMatchObject({ tenantId: 'tenant-b', pipelineId: foreign.id });
  });
});
