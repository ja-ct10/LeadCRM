import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
vi.mock('../../../../shared/services/email.service', async importOriginal => ({ ...await importOriginal<object>(), sendMail: vi.fn() }));
import { sendMail } from '../../../../shared/services/email.service';
import prisma from '../../../../config/database.config';
import { environmentContext } from '../../../../core/environment/environment-context';
import { issueAuthSession } from '../../../../core/auth/auth-session';
import { createCampaign, getCampaignById, sendCampaign, updateCampaign } from '../campaigns.service';
import { createAudience, getAudiences, resolveAudience } from '../audiences.service';
import { createTemplate, getTemplates } from '../../templates/templates.service';
import { processBrevoEvent } from '../brevo-webhook';
import app from '../../../../app';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['localhost', '127.0.0.1'].includes(url.hostname) && /^\/leadcrm_campaign_test_\d+$/.test(url.pathname);
describe.skipIf(!disposable)('campaigns on disposable PostgreSQL and authenticated HTTP', () => {
  let tenantId: string, otherTenantId: string, userId: string, audienceId: string;
  let server: Server, base: string, token: string, deniedToken: string;
  const scoped = <T>(work: () => T, environment: 'PRODUCTION' | 'SANDBOX' = 'PRODUCTION', tenant = tenantId) => environmentContext.run({ tenantId: tenant, environment }, work);
  const draft = () => scoped(() => createCampaign(tenantId, userId, { name: 'September Campaign', type: 'EMAIL', subject: 'Hello {{first_name}}', body: '<p>Hi {{first_name}}, welcome to Camxian Technologies.</p>', targetAudienceId: audienceId }));
  async function request(path: string, method = 'GET', body?: unknown, auth = token, environment = 'PRODUCTION') {
    const result = await fetch(base + path, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json', 'X-CRM-Environment': environment }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: result.status, body: await result.json() };
  }
  beforeAll(async () => {
    vi.stubEnv('BREVO_API_KEY', 'xkeysib-test-only-not-a-real-key'); vi.stubEnv('BREVO_FROM_EMAIL', 'sender@example.com');
    vi.stubEnv('BREVO_SANDBOX_EMAILS', ''); vi.stubEnv('BREVO_DAILY_EMAIL_LIMIT', '300');
    const tenant = await prisma.tenant.create({ data: { name: 'Campaign tests', slug: `campaign-${randomUUID()}`, status: 'SANDBOX', onboardingStep: 3, onboardingCompletedAt: new Date() } });
    tenantId = tenant.id;
    otherTenantId = (await prisma.tenant.create({ data: { name: 'Other', slug: `other-${randomUUID()}` } })).id;
    const user = await prisma.user.create({ data: { tenantId, email: `seeder-${tenantId}@camxian.com`, firstName: 'Seeder', lastName: 'Admin', role: 'Client Admin', activeEnvironment: 'PRODUCTION', mustChangePassword: false, emailVerified: new Date() } });
    userId = user.id; token = (await issueAuthSession(user)).token;
    const denied = await prisma.user.create({ data: { tenantId, email: `denied-${tenantId}@camxian.com`, firstName: 'Denied', lastName: 'User', role: 'Sales', activeEnvironment: 'PRODUCTION', mustChangePassword: false, emailVerified: new Date() } });
    deniedToken = (await issueAuthSession(denied)).token;
    await scoped(async () => {
      await prisma.lead.create({ data: { tenantId, firstName: 'Juan', lastName: 'Dela Cruz', email: 'juan.customer@example.com', productInterest: ['CRM'] } });
      await prisma.contact.create({ data: { tenantId, firstName: 'Maria', lastName: 'Santos', email: 'maria.customer@example.com', productInterests: ['CRM'] } });
      audienceId = (await createAudience(tenantId, { name: 'All Leads & Contacts', source: 'ALL', conditions: [] })).id;
    });
    await prisma.lead.create({ data: { tenantId: otherTenantId, firstName: 'Other', lastName: 'Tenant', email: 'other@example.com', productInterest: [] } });
    server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  }, 30000);
  beforeEach(async () => {
    vi.mocked(sendMail).mockReset().mockImplementation(async () => ({ messageId: `<${randomUUID()}@brevo.test>`, submitted: true }));
    vi.stubEnv('BREVO_DAILY_EMAIL_LIMIT', '300'); vi.stubEnv('BREVO_SANDBOX_EMAILS', '');
    await prisma.campaignEmailQuota.deleteMany();
  });
  afterAll(async () => { vi.unstubAllEnvs(); if (server) await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); });

  it('persists drafts, templates and audiences, then sends Juan and Maria personalized messages', async () => {
    const campaign = await draft();
    expect(sendMail).not.toHaveBeenCalled();
    await scoped(async () => {
      await createTemplate(tenantId, userId, { name: 'Greeting', type: 'Email', subject: 'Hi', content: '<p>Safe</p><script>bad()</script>' });
      expect((await getTemplates(tenantId, {})).data[0].content).toBe('<p>Safe</p>');
      expect((await getAudiences(tenantId)).some(a => a.id === audienceId)).toBe(true);
      expect((await resolveAudience(tenantId, { source: 'ALL', conditions: [] })).breakdown.eligible).toBe(2);
      const result = await sendCampaign(campaign.id, tenantId, userId);
      expect(result).toMatchObject({ eligibleRecipients: 2, submittedRecipients: 2, failedRecipients: 0, status: 'SENT' });
      expect(vi.mocked(sendMail).mock.calls.map(([m]) => m.subject).sort()).toEqual(['Hello Juan', 'Hello Maria']);
      expect(await prisma.campaignContact.count({ where: { campaignId: campaign.id, status: 'sent', messageId: { not: null } } })).toBe(2);
      expect(await prisma.emailDeliveryLog.count({ where: { campaignId: campaign.id, brevoMessageId: { not: null } } })).toBe(2);
    });
    const reloaded = await request(`/marketing/campaigns/${campaign.id}`);
    expect(reloaded.status).toBe(200); expect(reloaded.body.data.status).toBe('SENT'); expect(reloaded.body.data.deliveredCount).toBe(0);
  });
  it('returns 202 before provider completion and persists results after the HTTP request closes', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    vi.mocked(sendMail).mockImplementation(async () => {
      await gate; return { submitted: true, messageId: `<${randomUUID()}@test>` };
    });
    const campaign = await draft();
    try {
      const accepted = await request(`/marketing/campaigns/${campaign.id}/send`, 'PATCH');
      expect(accepted.status).toBe(202);
      expect(accepted.body.data).toMatchObject({ status: 'SENDING', eligibleRecipients: 2, submittedRecipients: 0 });
      expect((await request(`/marketing/campaigns/${campaign.id}/send`, 'PATCH')).status).toBe(409);
    } finally { release(); }
    await vi.waitFor(async () => {
      expect((await request(`/marketing/campaigns/${campaign.id}`)).body.data).toMatchObject({ status: 'SENT', sentCount: 2, failedCount: 0 });
    });
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
  it('excludes a staff contact and a case-insensitive duplicate', async () => {
    await scoped(async () => {
      const staff = await prisma.contact.create({ data: { tenantId, firstName: 'Staff', lastName: 'Contact', email: ` SEEDER-${tenantId}@camxian.com ` } });
      const duplicate = await prisma.contact.create({ data: { tenantId, firstName: 'Duplicate', lastName: 'Juan', email: 'JUAN.CUSTOMER@example.com' } });
      try {
        const resolved = await resolveAudience(tenantId, { source: 'ALL', conditions: [] });
        expect(resolved.breakdown).toMatchObject({ eligible: 2, staffEmail: 1, duplicateEmail: 1 });
        const campaign = await draft(); await sendCampaign(campaign.id, tenantId, userId);
        expect(sendMail).toHaveBeenCalledTimes(2);
        expect(vi.mocked(sendMail).mock.calls.some(([m]) => m.to.includes('camxian'))).toBe(false);
        expect(await prisma.campaignContact.count({ where: { campaignId: campaign.id, failureReason: 'STAFF_EMAIL' } })).toBe(1);
      } finally { await prisma.contact.deleteMany({ where: { id: { in: [staff.id, duplicate.id] } } }); }
    });
  });
  it('atomically rejects a simultaneous second send', async () => {
    const campaign = await draft();
    const results = await Promise.allSettled([scoped(() => sendCampaign(campaign.id, tenantId, userId)), scoped(() => sendCampaign(campaign.id, tenantId, userId))]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { statusCode: 409 } });
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
  it('reserves the whole audience and serializes concurrent campaigns against the daily allowance', async () => {
    vi.stubEnv('BREVO_DAILY_EMAIL_LIMIT', '2');
    const first = await draft(), second = await draft();
    const results = await Promise.allSettled([scoped(() => sendCampaign(first.id, tenantId, userId)), scoped(() => sendCampaign(second.id, tenantId, userId))]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(sendMail).toHaveBeenCalledTimes(2);
    const unstarted = await prisma.campaign.findFirst({ where: { id: { in: [first.id, second.id] }, status: 'DRAFT' } });
    expect(unstarted).not.toBeNull();
    expect(await prisma.campaignContact.count({ where: { campaignId: unstarted!.id } })).toBe(0);
  });
  it('rolls back a zero-recipient or oversized preparation without any email calls', async () => {
    vi.stubEnv('BREVO_DAILY_EMAIL_LIMIT', '1');
    const campaign = await draft();
    await expect(scoped(() => sendCampaign(campaign.id, tenantId, userId))).rejects.toMatchObject({ statusCode: 409 });
    expect((await scoped(() => getCampaignById(campaign.id, tenantId))).status).toBe('DRAFT');
    expect(sendMail).not.toHaveBeenCalled();
  });
  it('blocks Sandbox on a production Node backend unless addresses are allowlisted', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await scoped(async () => {
      await prisma.lead.create({ data: { tenantId, firstName: 'Sandbox', lastName: 'Lead', email: 'sandbox@example.com', productInterest: [] } });
      const campaign = await createCampaign(tenantId, userId, { name: 'Sandbox', type: 'EMAIL', subject: 'Hi', body: 'Hello', audienceSource: 'ALL' });
      await expect(sendCampaign(campaign.id, tenantId, userId)).rejects.toMatchObject({ statusCode: 400 });
      expect(sendMail).not.toHaveBeenCalled();
      vi.stubEnv('BREVO_SANDBOX_EMAILS', 'sandbox@example.com');
      expect((await sendCampaign(campaign.id, tenantId, userId)).submittedRecipients).toBe(1);
    }, 'SANDBOX');
    vi.stubEnv('NODE_ENV', 'test');
  });
  it('blocks tenant/environment IDOR and missing permissions at HTTP endpoints', async () => {
    const foreign = await scoped(() => createCampaign(otherTenantId, userId, { name: 'Foreign', type: 'EMAIL' }), 'PRODUCTION', otherTenantId);
    expect((await request(`/marketing/campaigns/${foreign.id}/send`, 'PATCH')).status).toBe(404);
    const own = await draft();
    expect((await request(`/marketing/campaigns/${own.id}/send`, 'PATCH', undefined, deniedToken)).status).toBe(403);
    expect((await request(`/marketing/campaigns/${own.id}`, 'GET', undefined, token, 'SANDBOX')).status).toBe(409);
    await prisma.user.update({ where: { id: userId }, data: { activeEnvironment: 'SANDBOX' } });
    expect((await request(`/marketing/campaigns/${own.id}`, 'GET', undefined, token, 'SANDBOX')).status).toBe(404);
    await prisma.user.update({ where: { id: userId }, data: { activeEnvironment: 'PRODUCTION' } });
    expect((await request('/marketing/campaigns', 'POST', { name: 'Bad', type: 'EMAIL', tenantId: otherTenantId })).status).toBe(400);
    const foreignAudience = await scoped(() => createAudience(otherTenantId, { name: 'Foreign', source: 'ALL', conditions: [] }), 'PRODUCTION', otherTenantId);
    expect((await request('/marketing/campaigns', 'POST', { name: 'Bad', type: 'EMAIL', targetAudienceId: foreignAudience.id })).status).toBe(404);
  });
  it('records partial failures without treating acceptance as delivery or permitting resend', async () => {
    vi.mocked(sendMail).mockRejectedValueOnce(new Error('Provider unavailable'));
    const campaign = await draft();
    const result = await scoped(() => sendCampaign(campaign.id, tenantId, userId));
    expect(result).toMatchObject({ submittedRecipients: 1, failedRecipients: 1, status: 'PARTIALLY_SENT' });
    await expect(scoped(() => sendCampaign(campaign.id, tenantId, userId))).rejects.toMatchObject({ statusCode: 409 });
    await expect(scoped(() => updateCampaign(campaign.id, tenantId, userId, { name: 'Changed' }))).rejects.toMatchObject({ statusCode: 409 });
  });
  it('bounds concurrency at five and preserves recipient snapshots after CRM deletion', async () => {
    let active = 0, peak = 0;
    vi.mocked(sendMail).mockImplementation(async () => {
      active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 10)); active--;
      return { submitted: true, messageId: `<${randomUUID()}@test>` };
    });
    await scoped(async () => {
      const source = `batch-${randomUUID()}`;
      await prisma.lead.createMany({ data: Array.from({ length: 12 }, (_, i) => ({ tenantId, firstName: `Customer${i}`, lastName: 'Test', email: `${source}-${i}@example.com`, productInterest: [], source })) });
      const audience = await createAudience(tenantId, { name: 'Batch test', source: 'LEADS', conditions: [{ field: 'source', operator: 'equals', value: source }] });
      const campaign = await createCampaign(tenantId, userId, { name: 'Batch', type: 'EMAIL', targetAudienceId: audience.id, subject: 'Hi', body: 'Hello' });
      expect((await sendCampaign(campaign.id, tenantId, userId)).submittedRecipients).toBe(12);
      expect(peak).toBe(5);
      await prisma.lead.deleteMany({ where: { source } });
      expect(await prisma.campaignContact.count({ where: { campaignId: campaign.id, leadId: null, status: 'sent', email: { not: null } } })).toBe(12);
    });
  });
  it('uses real AND conditions and validates cross-tenant template references', async () => {
    await scoped(async () => {
      expect((await resolveAudience(tenantId, { source: 'ALL', conditions: [{ field: 'productInterest', operator: 'equals', value: 'CRM' }, { field: 'createdAt', operator: 'gte', value: '2020-01-01' }] })).breakdown.eligible).toBe(2);
      await expect(createAudience(tenantId, { name: 'Unsafe', source: 'ALL', conditions: [{ field: 'passwordHash', operator: 'contains', value: 'x' }] })).rejects.toThrow();
    });
    const foreign = await scoped(() => createTemplate(otherTenantId, userId, { name: 'Foreign', type: 'Email', subject: 'Hi', content: 'Hello' }), 'PRODUCTION', otherTenantId);
    await expect(scoped(() => createCampaign(tenantId, userId, { name: 'Invalid', type: 'EMAIL', emailTemplateId: foreign.id }))).rejects.toMatchObject({ statusCode: 404 });
  });
  it('authenticates webhooks, deduplicates events and suppresses unsubscribed emails', async () => {
    const campaign = await draft(); await scoped(() => sendCampaign(campaign.id, tenantId, userId));
    const log = await prisma.emailDeliveryLog.findFirstOrThrow({ where: { campaignId: campaign.id } });
    const payload = { event: 'opened', email: log.toEmail, 'message-id': log.brevoMessageId!, ts_event: Math.floor(Date.now() / 1000) };
    vi.stubEnv('BREVO_WEBHOOK_TOKEN', 'test-token-with-at-least-32-characters');
    expect((await request('/webhooks/brevo', 'POST', payload, 'invalid')).status).toBe(401);
    expect((await request('/webhooks/brevo', 'POST', payload, process.env.BREVO_WEBHOOK_TOKEN)).status).toBe(200);
    expect((await request('/webhooks/brevo/email', 'POST', payload, process.env.BREVO_WEBHOOK_TOKEN)).status).toBe(200);
    await processBrevoEvent(payload); await processBrevoEvent({ ...payload, event: 'unique_opened' });
    await processBrevoEvent({ ...payload, event: 'delivered' });
    await processBrevoEvent({ ...payload, event: 'click' });
    await processBrevoEvent({ ...payload, event: 'unsubscribed' });
    await processBrevoEvent({ ...payload, event: 'request' });
    expect((await prisma.emailDeliveryLog.findUniqueOrThrow({ where: { id: log.id } })).status).toBe('unsubscribed');
    const reloaded = await scoped(() => getCampaignById(campaign.id, tenantId));
    expect(reloaded).toMatchObject({ openedCount: 1, clickedCount: 1, deliveredCount: 1 });
    expect(await prisma.emailEvent.count({ where: { deliveryLogId: log.id, eventType: 'opened' } })).toBe(1);
    expect((await scoped(() => resolveAudience(tenantId, { source: 'ALL', conditions: [] }))).breakdown.unsubscribed).toBe(1);
    await expect(processBrevoEvent({ ...payload, 'message-id': 'unknown' })).rejects.toMatchObject({ statusCode: 503 });
  });
});
