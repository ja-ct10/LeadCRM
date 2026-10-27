import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { PrismaClient, type CampaignStatus } from '@prisma/client';
import { EMPTY_PERMISSION_FLAGS } from '@leadcrm/shared';
import prisma from '../../../../config/database.config';
import { tenantContext } from '../../../../core/tenant/tenant-context';
import { issueAuthSession } from '../../../../core/auth/auth-session';
import app from '../../../../app';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['127.0.0.1', 'localhost'].includes(url.hostname) && /^\/leadcrm_campaign_test_\d+$/.test(url.pathname);

describe.skipIf(!disposable)('target audience deletion through authenticated HTTP', () => {
  let tenantId: string, foreignTenantId: string, editorId: string, adminId: string;
  let token: string, deniedToken: string, base: string, server: Server;
  const raw = new PrismaClient();
  const scope = <T>(work: () => T) => tenantContext.run({ tenantId }, work);
  const call = async (id: string, auth = token) => {
    const response = await fetch(`${base}/marketing/audiences/${encodeURIComponent(id)}`, { method: 'DELETE', headers: auth ? { Authorization: `Bearer ${auth}` } : {} });
    return { status: response.status, body: await response.json() };
  };
  const audience = (name = 'Customers', tenant = tenantId) => prisma.targetAudience.create({ data: { tenantId: tenant, name, source: 'LEADS',
    conditions: { create: { field: 'status', operator: 'equals', value: '"Hot"' } } } });
  const campaign = (audienceId: string, status: CampaignStatus = 'DRAFT', archived = false) => prisma.campaign.create({ data: {
    tenantId, createdById: adminId, name: 'Another creator campaign', type: 'EMAIL', status, isArchived: archived,
    subject: 'Hello', body: 'Hello {{firstName}}', targetAudienceId: audienceId,
  } });
  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'Audience deletion', slug: randomUUID(), status: 'ACTIVE', onboardingCompletedAt: new Date(), onboardingStep: 3 } })).id;
    foreignTenantId = (await prisma.tenant.create({ data: { name: 'Other tenant', slug: randomUUID(), status: 'ACTIVE', onboardingCompletedAt: new Date(), onboardingStep: 3 } })).id;
    async function user(role: string) {
      return prisma.user.create({ data: { tenantId, role, firstName: 'Audience', lastName: role, email: `${randomUUID()}@camxian.com`,
        mustChangePassword: false, emailVerified: new Date(), onboardingCompletedAt: new Date() } });
    }
    const role = await scope(() => prisma.roleDefinition.create({ data: { tenantId, name: 'Audience editor', permissions: { create: {
      ...EMPTY_PERMISSION_FLAGS, module: 'campaigns', canView: true, canEdit: true,
    } } } }));
    const editor = await user(role.name); editorId = editor.id;
    await scope(() => prisma.userRole.create({ data: { tenantId, userId: editor.id, roleId: role.id } }));
    token = (await issueAuthSession(editor)).token;
    const denied = await user('Audience viewer'); deniedToken = (await issueAuthSession(denied)).token;
    const viewerRole = await scope(() => prisma.roleDefinition.create({ data: { tenantId, name: denied.role, permissions: { create: {
      ...EMPTY_PERMISSION_FLAGS, module: 'campaigns', canView: true,
    } } } }));
    await scope(() => prisma.userRole.create({ data: { tenantId, userId: denied.id, roleId: viewerRole.id } }));
    adminId = (await user('Client Admin')).id;
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  }, 30000);
  afterAll(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    await raw.$disconnect(); await prisma.$disconnect();
  });
  it('allows an editor without archive permission to delete only the requested ID and its conditions', async () => {
    const first = await audience(), sameName = await audience();
    const existing = await campaign(sameName.id, 'SENT');
    const recipient = await prisma.campaignContact.create({ data: { tenantId, campaignId: existing.id, email: 'recipient@example.test', status: 'delivered' } });
    const metrics = await prisma.campaignMetrics.create({ data: { tenantId, campaignId: existing.id, sentCount: 1, deliveredCount: 1 } });
    const delivery = await prisma.emailDeliveryLog.create({ data: { tenantId, campaignId: existing.id, fromEmail: 'sender@example.test', toEmail: 'recipient@example.test', subject: 'Hello', status: 'delivered' } });
    const before = await prisma.campaign.findUniqueOrThrow({ where: { id: existing.id } });
    expect(await call(first.id)).toEqual({ status: 200, body: { success: true } });
    expect(await prisma.targetAudience.findUnique({ where: { id: first.id } })).toBeNull();
    expect(await prisma.targetAudienceCondition.count({ where: { targetAudienceId: first.id } })).toBe(0);
    expect(await prisma.targetAudience.findUnique({ where: { id: sameName.id } })).toEqual(sameName);
    expect(await prisma.campaign.findUnique({ where: { id: existing.id } })).toEqual(before);
    expect(await prisma.campaignContact.findUnique({ where: { id: recipient.id } })).toEqual(recipient);
    expect(await prisma.campaignMetrics.findUnique({ where: { id: metrics.id } })).toEqual(metrics);
    expect(await prisma.emailDeliveryLog.findUnique({ where: { id: delivery.id } })).toEqual(delivery);
    const list = await fetch(`${base}/marketing/audiences`, { headers: { Authorization: `Bearer ${token}` } });
    expect((await list.json()).data.map((row: { id: string }) => row.id)).not.toContain(first.id);
    expect((await call(first.id)).status).toBe(404);
  });
  it('rejects unauthenticated, unauthorized, cross-tenant and unknown IDs without deleting records', async () => {
    const own = await audience(), foreign = await audience('Foreign audience', foreignTenantId);
    expect((await call(own.id, '')).status).toBe(401);
    expect((await call(own.id, deniedToken)).status).toBe(403);
    expect((await call(foreign.id)).status).toBe(404);
    expect((await call(randomUUID())).status).toBe(404);
    expect(await prisma.targetAudience.count({ where: { id: { in: [own.id, foreign.id] } } })).toBe(2);
    expect(await prisma.targetAudienceCondition.count({ where: { targetAudienceId: { in: [own.id, foreign.id] } } })).toBe(2);
  });
  it.each(['LEADS', 'CONTACTS', 'ALL'])('protects the built-in %s identity', async id => {
    const response = await call(id);
    expect(response.status).toBe(400); expect(response.body.error).toContain('Built-in');
  });
  it.each(['All Leads', 'All Contacts'])('uses identity rather than the custom display name %s', async name => {
    const custom = await audience(name);
    expect((await call(custom.id)).status).toBe(200);
  });
  it.each([
    ['DRAFT', false], ['SCHEDULED', false], ['SENT', false], ['DRAFT', true], ['SENT', true],
  ] as const)('blocks another creator’s %s campaign (archived=%s), preserving its reference and conditions', async (status, archived) => {
    const target = await audience();
    const linked = await campaign(target.id, status, archived);
    expect(linked.createdById).not.toBe(editorId);
    const response = await call(target.id);
    expect(response.status).toBe(409); expect(response.body.error).toContain('existing campaign');
    expect(await prisma.campaign.findUnique({ where: { id: linked.id } })).toEqual(linked);
    expect(await prisma.targetAudience.findUnique({ where: { id: target.id } })).toEqual(target);
    expect(await prisma.targetAudienceCondition.count({ where: { targetAudienceId: target.id } })).toBe(1);
  });
  it('waits for an in-flight campaign reference and rejects deletion after that campaign commits', async () => {
    const target = await audience();
    let inserted!: () => void, release!: () => void;
    const ready = new Promise<void>(resolve => { inserted = resolve; });
    const commit = new Promise<void>(resolve => { release = resolve; });
    const writing = raw.$transaction(async tx => {
      const linked = await tx.campaign.create({ data: { tenantId, createdById: adminId, name: 'Concurrent reference', type: 'EMAIL', targetAudienceId: target.id } });
      inserted(); await commit; return linked;
    }, { timeout: 15000 });
    await ready;
    const deleting = call(target.id);
    try {
      await vi.waitFor(async () => {
        const waiting = await raw.$queryRaw<{ waiting: bigint }[]>`SELECT count(*) AS waiting FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%TargetAudience%' AND query LIKE '%FOR UPDATE%'`;
        expect(Number(waiting[0].waiting)).toBeGreaterThan(0);
      }, { timeout: 3000, interval: 20 });
    } finally { release(); }
    const linked = await writing;
    expect((await deleting).status).toBe(409);
    expect(await prisma.campaign.findUnique({ where: { id: linked.id } })).toMatchObject({ targetAudienceId: target.id });
  });
  it('never leaves a newly linked campaign with a cleared audience when deletion wins the race', async () => {
    const target = await audience();
    // Hold the real deletion transaction immediately after its row lock, then start a competing FK write.
    let locked!: () => void, release!: () => void;
    const ready = new Promise<void>(resolve => { locked = resolve; });
    const proceed = new Promise<void>(resolve => { release = resolve; });
    const original = prisma.$transaction.bind(prisma);
    const spy = vi.spyOn(prisma, '$transaction').mockImplementation(((work: (tx: any) => Promise<unknown>, options: any) => original(async tx => {
      const query = tx.$queryRaw.bind(tx);
      tx.$queryRaw = (async (...args: any[]) => {
        const result = await (query as any)(...args);
        if (Array.isArray(args[0]) && args[0].join('').includes('TargetAudience') && args[0].join('').includes('FOR UPDATE')) { locked(); await proceed; }
        return result;
      }) as typeof tx.$queryRaw;
      return work(tx);
    }, options)) as typeof prisma.$transaction);
    const deleting = call(target.id);
    try {
      await ready;
      const writing = raw.campaign.create({ data: { tenantId, createdById: adminId, name: 'Losing reference', type: 'EMAIL', targetAudienceId: target.id } }).then(() => 'created', () => 'rejected');
      release();
      expect((await deleting).status).toBe(200);
      expect(await writing).toBe('rejected');
      expect(await prisma.campaign.count({ where: { tenantId, name: 'Losing reference' } })).toBe(0);
    } finally { release(); spy.mockRestore(); }
  });
});
