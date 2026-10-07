import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
// A send must resolve its audience on the transaction's existing connection.
vi.hoisted(() => {
  const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
  if (['localhost', '127.0.0.1'].includes(url.hostname) && /^\/leadcrm_campaign_test_\d+$/.test(url.pathname)) {
    url.searchParams.set('connection_limit', '1');
    url.searchParams.set('pool_timeout', '2');
    process.env.DATABASE_URL = url.toString();
  }
});
vi.mock('../../../../shared/services/email.service', async importOriginal => ({ ...await importOriginal<object>(), sendMail: vi.fn() }));
vi.mock('../../../../shared/services/sms.service', async importOriginal => ({ ...await importOriginal<object>(), sendSms: vi.fn() }));
import { sendSms, SmsSubmissionError } from '../../../../shared/services/sms.service';
import { processTextBeeEvent } from '../textbee-webhook';
import { seedCampaignTemplates } from '../../templates/default-templates';
import { previewAudience } from '../audiences.service';
import { sendMail, EmailSubmissionError } from '../../../../shared/services/email.service';
import prisma from '../../../../config/database.config';
import { tenantContext } from '../../../../core/tenant/tenant-context';
import { issueAuthSession } from '../../../../core/auth/auth-session';
import { createCampaign, getCampaignById, sendCampaign, updateCampaign } from '../campaigns.service';
import { createAudience, getAudiences, resolveAudience } from '../audiences.service';
import { createTemplate, getTemplates } from '../../templates/templates.service';
import { processBrevoEvent } from '../brevo-webhook';
import app from '../../../../app';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = ['localhost', '127.0.0.1'].includes(url.hostname) && /^\/leadcrm_campaign_test_\d+$/.test(url.pathname);
describe.skipIf(!disposable)('campaigns on disposable PostgreSQL and authenticated HTTP', () => {
  let tenantId: string, otherTenantId: string, userId: string, audienceId: string, productId: string;
  let server: Server, base: string, token: string, deniedToken: string;
  const scoped = <T>(work: () => T, tenant = tenantId) => tenantContext.run({ tenantId: tenant }, work);
  const draft = () => scoped(() => createCampaign(tenantId, userId, { name: 'September Campaign', type: 'EMAIL', subject: 'Hello {{first_name}}', body: '<p>Hi {{first_name}}, welcome to Camxian Technologies.</p>', targetAudienceId: audienceId }));
  async function request(path: string, method = 'GET', body?: unknown, auth = token) {
    const result = await fetch(base + path, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: result.status, body: await result.json() };
  }
  beforeAll(async () => {
    vi.stubEnv('BREVO_API_KEY', 'xkeysib-test-only-not-a-real-key'); vi.stubEnv('BREVO_FROM_EMAIL', 'sender@example.com');
    vi.stubEnv('BREVO_SANDBOX_EMAILS', ''); vi.stubEnv('BREVO_DAILY_EMAIL_LIMIT', '300');
    const tenant = await prisma.tenant.create({ data: { name: 'Campaign tests', slug: `campaign-${randomUUID()}`, status: 'SANDBOX', onboardingStep: 3, onboardingCompletedAt: new Date() } });
    tenantId = tenant.id;
    otherTenantId = (await prisma.tenant.create({ data: { name: 'Other', slug: `other-${randomUUID()}` } })).id;
    const user = await prisma.user.create({ data: { tenantId, email: `seeder-${tenantId}@camxian.com`, firstName: 'Seeder', lastName: 'Admin', role: 'Client Admin', mustChangePassword: false, emailVerified: new Date(), onboardingCompletedAt: new Date() } });
    userId = user.id; token = (await issueAuthSession(user)).token;
    const denied = await prisma.user.create({ data: { tenantId, email: `denied-${tenantId}@camxian.com`, firstName: 'Denied', lastName: 'User', role: 'Sales', mustChangePassword: false, emailVerified: new Date(), onboardingCompletedAt: new Date() } });
    deniedToken = (await issueAuthSession(denied)).token;
    await scoped(async () => {
      productId = (await prisma.productInterest.create({ data: { tenantId, name: 'CRM', dealValue: 100 } })).id;
      await prisma.lead.create({ data: { tenantId, firstName: 'Juan', lastName: 'Dela Cruz', email: 'juan.customer@example.com', productsNormalized: true, productLinks: { create: { tenantId, productInterestId: productId } } } });
      await prisma.contact.create({ data: { tenantId, firstName: 'Maria', lastName: 'Santos', email: 'maria.customer@example.com', productsNormalized: true, productLinks: { create: { tenantId, productInterestId: productId, interested: true } } } });
      audienceId = (await createAudience(tenantId, { name: 'All Leads & Contacts', source: 'ALL', conditions: [] })).id;
    });
    await prisma.lead.create({ data: { tenantId: otherTenantId, firstName: 'Other', lastName: 'Tenant', email: 'other@example.com', productInterest: [] } });
    server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  }, 30000);
  beforeEach(async () => {
    vi.stubEnv('TEXTBEE_API_KEY', 'fixture-key'); vi.stubEnv('TEXTBEE_DEVICE_ID', '');
    vi.stubEnv('TEXTBEE_WEBHOOK_SECRET', 'test-webhook-signature-only');
    vi.mocked(sendSms).mockReset().mockImplementation(async () => ({ messageId: `msg_${randomUUID()}`, submitted: true, status: 'pending' }));
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
      const recipients = await prisma.campaignContact.findMany({ where: { campaignId: campaign.id } });
      expect(recipients.find(r => r.email === 'juan.customer@example.com')).toMatchObject({ leadId: expect.any(String), contactId: null });
      expect(recipients.find(r => r.email === 'maria.customer@example.com')).toMatchObject({ leadId: null, contactId: expect.any(String) });
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
  it('blocks tenant IDOR and missing permissions at HTTP endpoints', async () => {
    const foreign = await scoped(() => createCampaign(otherTenantId, userId, { name: 'Foreign', type: 'EMAIL' }), otherTenantId);
    expect((await request(`/marketing/campaigns/${foreign.id}/send`, 'PATCH')).status).toBe(404);
    const own = await draft();
    expect((await request(`/marketing/campaigns/${own.id}/send`, 'PATCH', undefined, deniedToken)).status).toBe(403);
    const invalid = await request('/marketing/campaigns', 'POST', { name: 'Bad', type: 'EMAIL', tenantId: otherTenantId });
    expect(invalid.status).toBe(400);
    expect(invalid.body).toMatchObject({ success: false, error: expect.stringContaining('tenantId'), fieldErrors: {} });
    expect(await prisma.campaign.count({ where: { tenantId, name: 'Bad' } })).toBe(0);
    const foreignAudience = await scoped(() => createAudience(otherTenantId, { name: 'Foreign', source: 'ALL', conditions: [] }), otherTenantId);
    expect((await request('/marketing/campaigns', 'POST', { name: 'Bad', type: 'EMAIL', targetAudienceId: foreignAudience.id })).status).toBe(404);
  });
  it('records partial failures without treating acceptance as delivery or permitting resend', async () => {
    vi.mocked(sendMail).mockRejectedValueOnce(new EmailSubmissionError('rejected', 429));
    const campaign = await draft();
    const result = await scoped(() => sendCampaign(campaign.id, tenantId, userId));
    expect(result).toMatchObject({ submittedRecipients: 1, failedRecipients: 1, status: 'PARTIALLY_SENT' });
    await expect(scoped(() => sendCampaign(campaign.id, tenantId, userId))).rejects.toMatchObject({ statusCode: 409 });
    await expect(scoped(() => updateCampaign(campaign.id, tenantId, userId, { name: 'Changed' }))).rejects.toMatchObject({ statusCode: 409 });
  });
  it.each([
    { total: 1, rejected: 0, unconfirmed: 0, status: 'SENT' },
    { total: 4, rejected: 0, unconfirmed: 0, status: 'SENT' },
    { total: 4, rejected: 1, unconfirmed: 0, status: 'PARTIALLY_SENT' },
    { total: 4, rejected: 4, unconfirmed: 0, status: 'FAILED' },
    { total: 4, rejected: 0, unconfirmed: 1, status: 'PAUSED' },
  ])('persists real transport outcomes: $total recipients, $rejected rejected, $unconfirmed unknown', async ({ total, rejected, unconfirmed, status }) => {
    const transport = await vi.importActual<typeof import('../../../../shared/services/email.service')>('../../../../shared/services/email.service');
    vi.mocked(sendMail).mockImplementation(transport.sendMail);
    const nativeFetch = globalThis.fetch;
    let providerRequests = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (input !== 'https://api.brevo.com/v3/smtp/email') return nativeFetch(input, init);
      const attempt = providerRequests++;
      if (attempt < rejected) return new Response('{"code":"unauthorized"}', { status: 401 });
      if (attempt < rejected + unconfirmed) throw new TypeError('network result lost');
      return new Response(JSON.stringify({ messageId: `<${randomUUID()}@brevo.test>` }), { status: 201 });
    });
    const source = `transport-${randomUUID()}`;
    try {
      await scoped(async () => {
        await prisma.lead.createMany({ data: Array.from({ length: total }, (_, i) => ({ tenantId, firstName: `Recipient${i}`, lastName: 'Test', email: `${source}-${i}@example.com`, productInterest: [], source, companyName: source })) });
        const audience = await createAudience(tenantId, { name: source, source: 'LEADS', conditions: [{ field: 'company', operator: 'equals', value: source }] });
        const campaign = await createCampaign(tenantId, userId, { name: source, type: 'EMAIL', targetAudienceId: audience.id, subject: 'Hello', body: 'Hello' });
        const result = await sendCampaign(campaign.id, tenantId, userId);
        expect(result).toEqual({ campaignId: campaign.id, eligibleRecipients: total, submittedRecipients: total - rejected - unconfirmed, failedRecipients: rejected, status });
        const response = await request(`/marketing/campaigns/${campaign.id}`);
        expect(response.body.data.sendResult).toEqual(result);
        expect(response.body.data).toMatchObject({ status, sentCount: total - rejected - unconfirmed, failedCount: rejected, openedCount: 0, clickedCount: 0, deliveredCount: 0 });
        expect(await prisma.emailDeliveryLog.count({ where: { campaignId: campaign.id, sentAt: { not: null }, brevoMessageId: { not: null } } })).toBe(total - rejected - unconfirmed);
        await expect(sendCampaign(campaign.id, tenantId, userId)).rejects.toMatchObject({ statusCode: 409 });
        expect(providerRequests).toBe(total);
      });
    } finally {
      fetchSpy.mockRestore();
      await scoped(() => prisma.lead.deleteMany({ where: { source } }));
    }
  });
  it.each(['delivered', 'opened', 'click', 'soft_bounce', 'hard_bounce', 'blocked', 'invalid_email', 'unsubscribed'] as const)('persists and deduplicates %s without changing submitted totals', async event => {
    const campaign = await draft();
    await scoped(() => sendCampaign(campaign.id, tenantId, userId));
    const log = await prisma.emailDeliveryLog.findFirstOrThrow({ where: { campaignId: campaign.id } });
    const payload = { event, email: log.toEmail, 'message-id': log.brevoMessageId!, ts_event: Math.floor(Date.now() / 1000) };
    try {
      await processBrevoEvent(payload); await processBrevoEvent(payload);
      const recipient = await prisma.campaignContact.findFirstOrThrow({ where: { campaignId: campaign.id, messageId: log.brevoMessageId } });
      expect(recipient.status).toBe(event === 'click' ? 'clicked' : event);
      const field = event === 'delivered' ? 'deliveredAt' : event === 'opened' ? 'openedAt' : event === 'click' ? 'clickedAt' : event === 'unsubscribed' ? 'unsubscribed' : 'bouncedAt';
      expect(recipient[field]).toBeTruthy();
      expect(await prisma.emailEvent.count({ where: { deliveryLogId: log.id } })).toBe(1);
      const result = await scoped(() => getCampaignById(campaign.id, tenantId));
      expect(result).toMatchObject({ status: 'SENT', sentCount: 2, failedCount: 0, openedCount: event === 'opened' ? 1 : 0, clickedCount: event === 'click' ? 1 : 0 });
      expect(result.deliveredCount).toBe(event === 'delivered' ? 1 : 0);
      expect(result.bouncedCount).toBe(['soft_bounce', 'hard_bounce', 'blocked', 'invalid_email'].includes(event) ? 1 : 0);
      const metrics = await prisma.campaignMetrics.findFirstOrThrow({ where: { campaignId: campaign.id }, orderBy: { snapshotAt: 'desc' } });
      expect(metrics.deliveryRate).toBe(event === 'delivered' ? 50 : 0);
      expect(metrics.bounceRate).toBe(result.bouncedCount * 50);
      expect(sendMail).toHaveBeenCalledTimes(2);
    } finally {
      // Remove only this test's suppression history so the shared fixture is unchanged.
      await prisma.campaign.delete({ where: { id: campaign.id } });
      await prisma.emailDeliveryLog.delete({ where: { id: log.id } });
    }
  });
  it('preserves webhook rates when delivery and bounce arrive before the batch finishes', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    vi.mocked(sendMail).mockResolvedValueOnce({ submitted: true, messageId: `<${randomUUID()}@brevo.test>` })
      .mockImplementationOnce(async () => { await gate; return { submitted: true, messageId: `<${randomUUID()}@brevo.test>` }; });
    const campaign = await draft();
    const sending = scoped(() => sendCampaign(campaign.id, tenantId, userId));
    try {
      await vi.waitFor(async () => {
        expect(await prisma.emailDeliveryLog.count({ where: { campaignId: campaign.id, sentAt: { not: null } } })).toBe(1);
      });
      const log = await prisma.emailDeliveryLog.findFirstOrThrow({ where: { campaignId: campaign.id, sentAt: { not: null } } });
      const payload = { email: log.toEmail, 'message-id': log.brevoMessageId!, ts_event: Math.floor(Date.now() / 1000) };
      await processBrevoEvent({ ...payload, event: 'soft_bounce' });
      await processBrevoEvent({ ...payload, event: 'delivered' });
    } finally { release(); await sending; }
    const metrics = await prisma.campaignMetrics.findFirstOrThrow({ where: { campaignId: campaign.id }, orderBy: { snapshotAt: 'desc' } });
    expect(metrics).toMatchObject({ sentCount: 2, deliveredCount: 1, bouncedCount: 1, deliveryRate: 50, bounceRate: 50 });
    expect(await scoped(() => getCampaignById(campaign.id, tenantId))).toMatchObject({ status: 'SENT', sentCount: 2, deliveredCount: 1, bouncedCount: 1 });
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
  it.each(['opened', 'unique_opened'])('reports one recipient through authenticated delivery, %s and click webhooks', async openEvent => {
    const campaign = await scoped(() => createCampaign(tenantId, userId, {
      name: 'Tracking lifecycle', type: 'EMAIL', audienceSource: 'LEADS',
      subject: 'Tracking test', body: '<p><a href="https://example.com">Visit website</a></p>',
    }));
    await scoped(() => sendCampaign(campaign.id, tenantId, userId));
    const log = await prisma.emailDeliveryLog.findFirstOrThrow({ where: { campaignId: campaign.id } });
    const started = Math.floor(Date.now() / 1000) - 60;
    vi.stubEnv('BREVO_WEBHOOK_TOKEN', 'test-token-with-at-least-32-characters');
    const payload = { email: log.toEmail, 'message-id': log.brevoMessageId!.replace(/^<|>$/g, '') };
    expect((await request(`/marketing/campaigns/${campaign.id}`)).body.data).toMatchObject({ sentCount: 1, deliveredCount: 0, openedCount: 0, clickedCount: 0, bouncedCount: 0 });
    for (const [index, event] of ['delivered', openEvent, 'click'].entries()) {
      expect((await request('/webhooks/brevo', 'POST', { ...payload, event, ts_event: started + index }, process.env.BREVO_WEBHOOK_TOKEN)).status).toBe(200);
      expect((await request('/webhooks/brevo', 'POST', { ...payload, event, ts_event: started + index + 30 }, process.env.BREVO_WEBHOOK_TOKEN)).status).toBe(200);
      expect((await request(`/marketing/campaigns/${campaign.id}`)).body.data).toMatchObject({ sentCount: 1, deliveredCount: 1, openedCount: index >= 1 ? 1 : 0, clickedCount: index >= 2 ? 1 : 0, bouncedCount: 0 });
    }
    await processBrevoEvent({ ...payload, event: openEvent === 'opened' ? 'unique_opened' : 'opened', ts_event: started + 40 });
    const recipient = await prisma.campaignContact.findFirstOrThrow({ where: { campaignId: campaign.id } });
    expect(recipient).toMatchObject({ status: 'clicked', deliveredAt: new Date(started * 1000), openedAt: new Date((started + 1) * 1000), clickedAt: new Date((started + 2) * 1000) });
    const metrics = await prisma.campaignMetrics.findFirstOrThrow({ where: { campaignId: campaign.id }, orderBy: { snapshotAt: 'desc' } });
    expect(metrics).toMatchObject({ sentCount: 1, deliveredCount: 1, openedCount: 1, clickedCount: 1, bouncedCount: 0, openRate: 100, clickRate: 100, deliveryRate: 100, bounceRate: 0 });
    expect(await prisma.emailEvent.count({ where: { deliveryLogId: log.id } })).toBe(3);
    await expect(processBrevoEvent({ ...payload, event: 'opened', 'message-id': 'unknown-message' })).rejects.toMatchObject({ statusCode: 503 });
    await expect(processBrevoEvent({ ...payload, event: 'opened', email: 'other@example.com' })).rejects.toMatchObject({ statusCode: 503 });
    expect(sendMail).toHaveBeenCalledTimes(1);
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
      await prisma.lead.createMany({ data: Array.from({ length: 12 }, (_, i) => ({ tenantId, firstName: `Customer${i}`, lastName: 'Test', email: `${source}-${i}@example.com`, productInterest: [], source, companyName: source })) });
      const audience = await createAudience(tenantId, { name: 'Batch test', source: 'LEADS', conditions: [{ field: 'company', operator: 'equals', value: source }] });
      const campaign = await createCampaign(tenantId, userId, { name: 'Batch', type: 'EMAIL', targetAudienceId: audience.id, subject: 'Hi', body: 'Hello' });
      expect((await sendCampaign(campaign.id, tenantId, userId)).submittedRecipients).toBe(12);
      expect(peak).toBe(5);
      await prisma.lead.deleteMany({ where: { source } });
      expect(await prisma.campaignContact.count({ where: { campaignId: campaign.id, leadId: null, status: 'sent', email: { not: null } } })).toBe(12);
    });
  });
  it('uses real AND conditions and validates cross-tenant template references', async () => {
    await scoped(async () => {
      expect((await resolveAudience(tenantId, { source: 'ALL', conditions: [{ field: 'productInterest', operator: 'equals', value: [productId] }, { field: 'createdAt', operator: 'gte', value: '2020-01-01' }] })).breakdown.eligible).toBe(2);
      await expect(createAudience(tenantId, { name: 'Unsafe', source: 'ALL', conditions: [{ field: 'passwordHash', operator: 'contains', value: 'x' }] })).rejects.toThrow();
    });
    const foreign = await scoped(() => createTemplate(otherTenantId, userId, { name: 'Foreign', type: 'Email', subject: 'Hi', content: 'Hello' }), otherTenantId);
    await expect(scoped(() => createCampaign(tenantId, userId, { name: 'Invalid', type: 'EMAIL', emailTemplateId: foreign.id }))).rejects.toMatchObject({ statusCode: 404 });
  });
  it('returns scoped recipients, saved audience, distinct links and repeat-click totals through the report route', async () => {
    const campaign = await draft(); await scoped(() => sendCampaign(campaign.id, tenantId, userId));
    const logs = await prisma.emailDeliveryLog.findMany({ where: { campaignId: campaign.id }, orderBy: { toEmail: 'asc' } });
    const started = Math.floor(Date.now() / 1000) - 120;
    await scoped(() => prisma.campaignContact.updateMany({ where: { campaignId: campaign.id, tenantId }, data: { sentAt: new Date((started - 10) * 1000) } }));
    const payload = { email: logs[0].toEmail, 'message-id': logs[0].brevoMessageId!, ts_event: started };
    await processBrevoEvent({ ...payload, event: 'delivered' });
    await processBrevoEvent({ ...payload, event: 'opened', ts_event: started + 1 });
    const click = { ...payload, event: 'click', link: 'https://camxian.com/cctv', ts_event: started + 2 };
    await processBrevoEvent(click); await processBrevoEvent(click);
    await processBrevoEvent({ ...click, ts_event: started + 3 });
    await processBrevoEvent({ ...click, link: 'https://camxian.com/security', ts_event: started + 4 });
    await processBrevoEvent({ ...click, link: 'javascript:alert(1)', ts_event: started + 5 });
    await processBrevoEvent({ email: logs[1].toEmail, 'message-id': logs[1].brevoMessageId!, event: 'hard_bounce', ts_event: started + 6 });
    const result = await request(`/marketing/campaigns/${campaign.id}/report`);
    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({ recipientCount: 2, deliveredCount: 1, bouncedCount: 1, openedCount: 1, clickedCount: 1, targetAudience: { name: 'All Leads & Contacts' } });
    expect(result.body.data.recipients).toHaveLength(2);
    expect(result.body.data.recipients.find((row: { email: string }) => row.email === logs[0].toEmail)).toMatchObject({ name: expect.any(String), deliveryStatus: 'Delivered', opened: true, clicked: true, lastActivity: new Date((started + 5) * 1000).toISOString() });
    expect(result.body.data.recipients.find((row: { email: string }) => row.email === logs[1].toEmail)).toMatchObject({ deliveryStatus: 'Bounced', opened: false, clicked: false });
    expect(result.body.data.topLinks).toEqual([
      { url: 'https://camxian.com/cctv', uniqueClicks: 1, totalClicks: 2, clickRate: 50, lastClicked: new Date((started + 3) * 1000).toISOString() },
      { url: 'https://camxian.com/security', uniqueClicks: 1, totalClicks: 1, clickRate: 50, lastClicked: new Date((started + 4) * 1000).toISOString() },
    ]);
    expect((await request(`/marketing/campaigns/${campaign.id}/report`, 'GET', undefined, deniedToken)).status).toBe(403);
    const foreign = await scoped(() => createCampaign(otherTenantId, userId, { name: 'Private report', type: 'EMAIL' }), otherTenantId);
    expect((await request(`/marketing/campaigns/${foreign.id}/report`)).status).toBe(404);
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
  it('saves typed audience values, filters normalized products and reuses Manila calendar days for both record types', async () => {
    await scoped(async () => {
      const product = await prisma.productInterest.create({ data: { tenantId, name: 'Audience catalog test', dealValue: 100 } });
      const agent = await prisma.user.create({ data: { tenantId, email: `agent-${randomUUID()}@example.test`, firstName: 'Valid', lastName: 'Agent', role: 'Sales', status: 'ACTIVE' } });
      const createdAt = new Date('2026-10-06T16:00:00Z');
      const lead = await prisma.lead.create({ data: { tenantId, firstName: 'Typed', lastName: 'Lead', companyName: 'Matching COMPANY', source: 'Website', status: 'Hot', assignedUserId: agent.id, createdAt, email: 'typed-lead@example.test', productsNormalized: true, productLinks: { create: { tenantId, productInterestId: product.id } } } });
      const contact = await prisma.contact.create({ data: { tenantId, firstName: 'Typed', lastName: 'Contact', company: 'Matching COMPANY', source: 'Website', status: 'HOT', assignedUserId: agent.id, createdAt, email: 'typed-contact@example.test', productsNormalized: true, productLinks: { create: { tenantId, productInterestId: product.id, interested: true } } } });
      const definition = { source: 'ALL', conditions: [
        { field: 'status', operator: 'equals', value: 'Hot' }, { field: 'source', operator: 'equals', value: 'Website' },
        { field: 'company', operator: 'contains', value: ' matching ' }, { field: 'productInterest', operator: 'equals', value: [product.id] },
        { field: 'assignedUserId', operator: 'equals', value: agent.id }, { field: 'createdAt', operator: 'between', value: { from: '2026-10-07', to: '2026-10-07' } },
      ] };
      const audience = await createAudience(tenantId, { name: 'Typed audience', ...definition });
      expect((await getAudiences(tenantId)).find(a => a.id === audience.id)?.conditions).toEqual(audience.conditions);
      const preview = await previewAudience(tenantId, { ...definition, limit: 1 });
      expect(preview).toMatchObject({ eligible: 2, recipients: [{ id: contact.id, recordType: 'Contact' }], meta: { total: 2, limit: 1, hasMore: true } });
      expect((await previewAudience(tenantId, { ...definition, page: 2, limit: 1 })).recipients[0].id).toBe(lead.id);
      for (const source of ['LEADS', 'CONTACTS']) expect((await previewAudience(tenantId, { ...definition, source })).eligible).toBe(1);
      const notEquals = { ...definition, conditions: [{ field: 'company', operator: 'not_equals', value: 'matching company' }] };
      expect((await previewAudience(tenantId, notEquals)).recipients.some(r => [lead.id, contact.id].includes(r.id))).toBe(false);
      await prisma.lead.update({ where: { id: lead.id }, data: { createdAt: new Date('2026-10-07T16:00:00Z') } });
      expect((await previewAudience(tenantId, definition)).eligible).toBe(1);
      await prisma.lead.delete({ where: { id: lead.id } }); await prisma.contact.delete({ where: { id: contact.id } });
    });
  });
  it('rejects foreign or nonassignable relations and invalid date ranges', async () => {
    await scoped(async () => {
      for (const value of [userId, randomUUID()]) await expect(createAudience(tenantId, { name: 'Invalid', source: 'ALL', conditions: [{ field: 'assignedUserId', operator: 'equals', value }] })).rejects.toThrow('Assigned Agent');
      await expect(previewAudience(tenantId, { source: 'ALL', conditions: [{ field: 'productInterest', operator: 'equals', value: [randomUUID()] }] })).rejects.toThrow('Product Interests');
      await expect(previewAudience(tenantId, { source: 'ALL', conditions: [{ field: 'createdAt', operator: 'between', value: { from: '2026-10-08', to: '2026-10-07' } }] })).rejects.toThrow();
    });
  });
  it('SMS eligibility uses normalized phones, Contact priority and do-not-contact suppression without requiring email', async () => {
    await scoped(async () => {
      const contact = await prisma.contact.create({ data: { tenantId, firstName: 'SMS', lastName: 'Contact', phone: '+639171234567', email: null } });
      const duplicate = await prisma.lead.create({ data: { tenantId, firstName: 'SMS', lastName: 'Duplicate', phone: '09171234567', email: null } });
      const bad = await prisma.lead.create({ data: { tenantId, firstName: 'SMS', lastName: 'Invalid', phone: '123' } });
      try {
        const result = await previewAudience(tenantId, { source: 'ALL', conditions: [], channel: 'SMS' });
        expect(result).toMatchObject({ eligible: 1, duplicatePhone: 1, invalidPhone: 1 });
        expect(result.recipients[0]).toMatchObject({ id: contact.id, phone: '+639171234567', email: null });
        await prisma.contact.update({ where: { id: contact.id }, data: { doNotContact: true } });
        expect((await previewAudience(tenantId, { source: 'ALL', conditions: [], channel: 'SMS' })).eligible).toBe(0);
      } finally { await prisma.lead.deleteMany({ where: { id: { in: [duplicate.id, bad.id] } } }); await prisma.contact.delete({ where: { id: contact.id } }); }
    });
  });
  it('SMS preflight blocks missing organization email and any oversized personalized recipient before provider requests', async () => {
    await scoped(async () => {
      const person = await prisma.contact.create({ data: { tenantId, firstName: 'A'.repeat(49900), lastName: 'Long', phone: '+639171234567' } });
      const campaign = await createCampaign(tenantId, userId, { name: 'SMS preflight', type: 'SMS', audienceSource: 'CONTACTS', body: 'Hi {{first_name}}' });
      await prisma.tenant.update({ where: { id: tenantId }, data: { email: null } });
      await expect(sendCampaign(campaign.id, tenantId, userId)).rejects.toThrow('Configure the organization email');
      await prisma.tenant.update({ where: { id: tenantId }, data: { email: 'info@example.test' } });
      await expect(sendCampaign(campaign.id, tenantId, userId)).rejects.toThrow('1 recipient message exceeds the 50000-character');
      expect(sendSms).not.toHaveBeenCalled();
      expect((await getCampaignById(campaign.id, tenantId)).status).toBe('DRAFT');
      expect(await prisma.campaignContact.count({ where: { campaignId: campaign.id } })).toBe(0);
      await prisma.contact.delete({ where: { id: person.id } });
    });
  });
  it('submits personalized SMS once, persists its reference and phone, and authenticates idempotent webhook transitions', async () => {
    const person = await scoped(() => prisma.contact.create({ data: { tenantId, firstName: 'SMS', lastName: 'Customer', phone: '+639171234567', email: null } }));
    const campaign = await scoped(() => createCampaign(tenantId, userId, { name: 'SMS send', type: 'SMS', audienceSource: 'CONTACTS', body: 'Hi {{first_name}}, your proposal is ready.' }));
    const sends = await Promise.allSettled([scoped(() => sendCampaign(campaign.id, tenantId, userId)), scoped(() => sendCampaign(campaign.id, tenantId, userId))]);
    expect(sends.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(sendSms).toHaveBeenCalledOnce();
    expect(vi.mocked(sendSms).mock.calls[0]).toEqual(['+639171234567', 'Hi SMS, your proposal is ready.\n\nFor inquiries regarding our products and services, contact Camxian Technologies:\ninfo@example.test\n\nThis is a no-reply message.', { organizationEmail: 'info@example.test' }]);
    const row = await prisma.campaignContact.findFirstOrThrow({ where: { campaignId: campaign.id, contactId: person.id } });
    expect(row).toMatchObject({ email: null, phone: '+639171234567', status: 'submitted', sentAt: null, submittedAt: expect.any(Date), messageId: expect.stringContaining('msg_') });
    expect(await prisma.emailDeliveryLog.count({ where: { campaignId: campaign.id } })).toBe(0);
    const event = (status: 'sent' | 'delivered' | 'failed' | 'unknown', key = status as string) => ({
      smsId: 'sms-fixture', smsBatchId: row.messageId, recipient: row.phone, deviceId: 'device-fixture', webhookSubscriptionId: 'subscription-fixture',
      idempotencyKey: row.id + key, webhookEvent: status === 'unknown' ? 'UNKNOWN_STATE' : 'MESSAGE_' + status.toUpperCase(), status,
      sentAt: '2026-10-07T01:00:00.000Z', deliveredAt: '2026-10-07T01:01:00.000Z', failedAt: '2026-10-07T01:02:00.000Z',
    });
    const post = (body: string, secret = 'test-webhook-signature-only') => fetch(base + '/webhooks/textbee', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': createHmac('sha256', secret).update(body).digest('hex') }, body });
    expect((await post(JSON.stringify(event('failed')), 'wrong')).status).toBe(401);
    expect((await fetch(base + '/webhooks/textbee', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event('failed')) })).status).toBe(401);
    await expect(processTextBeeEvent({ ...event('sent'), webhookEvent: 'MESSAGE_OPENED' })).rejects.toThrow();
    await expect(processTextBeeEvent({ ...event('sent'), recipient: '+639191234567' })).rejects.toMatchObject({ statusCode: 400 });
    for (const status of ['unknown', 'sent', 'delivered'] as const) {
      // Sign intentionally formatted bytes, not JSON reserialized by the server.
      expect((await post(JSON.stringify(event(status), null, 2))).status).toBe(200);
      const before = await prisma.campaignMetrics.count({ where: { campaignId: campaign.id } });
      await processTextBeeEvent(event(status));
      await processTextBeeEvent(event(status, status + '-duplicate'));
      expect(await prisma.campaignMetrics.count({ where: { campaignId: campaign.id } })).toBe(before);
      expect((await prisma.campaignContact.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(status);
    }
    await processTextBeeEvent(event('sent', 'late-sent'));
    await processTextBeeEvent(event('failed', 'conflicting-failed'));
    await processTextBeeEvent(event('unknown', 'late-unknown'));
    expect((await prisma.campaignContact.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('delivered');
    expect(await prisma.smsWebhookReceipt.count({ where: { campaignContactId: row.id } })).toBe(9);
    expect((await post(JSON.stringify({ webhookEvent: 'MESSAGE_RECEIVED', message: 'Ignored' }))).status).toBe(200);
    const report = await request(`/marketing/campaigns/${campaign.id}/report`);
    expect(report.body.data).toMatchObject({ sentCount: 1, failedCount: 0, openedCount: 0, clickedCount: 0 });
    expect(report.body.data.recipients.find((r: { id: string }) => r.id === row.id)).toMatchObject({ phone: row.phone, email: null, deliveryStatus: 'Delivered' });
    const metrics = await request('/marketing/campaigns/metrics');
    const emailOnly = await prisma.campaign.aggregate({ where: { tenantId, type: 'EMAIL', isArchived: false }, _sum: { sentCount: true } });
    expect(metrics.body.data.emailSent).toBe(emailOnly._sum.sentCount || 0);
    expect(metrics.body.data.sent).toBeGreaterThan(metrics.body.data.emailSent);
    await scoped(() => prisma.contact.delete({ where: { id: person.id } }));
  });
  it('keeps failed SMS final and counts repeated failure callbacks only once within its tenant', async () => {
    const person = await scoped(() => prisma.contact.create({ data: { tenantId, firstName: 'Failed', lastName: 'SMS', phone: '+639171234568' } }));
    const campaign = await scoped(() => createCampaign(tenantId, userId, { name: 'SMS failure callback', type: 'SMS', audienceSource: 'CONTACTS', body: 'Hello' }));
    await scoped(() => sendCampaign(campaign.id, tenantId, userId));
    const row = await prisma.campaignContact.findFirstOrThrow({ where: { campaignId: campaign.id, contactId: person.id } });
    const event = { smsId: 'failed-fixture', smsBatchId: row.messageId, recipient: row.phone, deviceId: 'device-fixture', webhookSubscriptionId: 'subscription-fixture', idempotencyKey: row.id, webhookEvent: 'MESSAGE_FAILED', status: 'failed', failedAt: '2026-10-07T01:02:00Z' };
    await processTextBeeEvent(event);
    const metrics = await prisma.campaignMetrics.count({ where: { campaignId: campaign.id } });
    await processTextBeeEvent(event);
    await processTextBeeEvent({ ...event, idempotencyKey: row.id + '-repeated' });
    await processTextBeeEvent({ ...event, idempotencyKey: row.id + '-late-sent', webhookEvent: 'MESSAGE_SENT', status: 'sent', sentAt: '2026-10-07T01:00:00Z' });
    expect((await prisma.campaignContact.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('failed');
    expect(await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).toMatchObject({ failedCount: 1, status: 'FAILED' });
    expect(await prisma.campaignMetrics.count({ where: { campaignId: campaign.id } })).toBe(metrics);
    expect(await scoped(async () => await prisma.smsWebhookReceipt.count({ where: { campaignContactId: row.id } }), otherTenantId)).toBe(0);
    await scoped(() => prisma.contact.delete({ where: { id: person.id } }));
  });
  it('keeps uncertain SMS submissions paused for review and rejects deterministic errors without retry', async () => {
    await scoped(async () => {
      const person = await prisma.contact.create({ data: { tenantId, firstName: 'Uncertain', lastName: 'SMS', phone: '+639181234567' } });
      for (const outcome of ['unconfirmed', 'rejected'] as const) {
        vi.mocked(sendSms).mockRejectedValueOnce(new SmsSubmissionError(outcome, outcome === 'rejected' ? 429 : undefined));
        const campaign = await createCampaign(tenantId, userId, { name: 'SMS ' + outcome, type: 'SMS', audienceSource: 'CONTACTS', body: 'Hello' });
        expect((await sendCampaign(campaign.id, tenantId, userId)).status).toBe(outcome === 'unconfirmed' ? 'PAUSED' : 'FAILED');
        await expect(sendCampaign(campaign.id, tenantId, userId)).rejects.toMatchObject({ statusCode: 409 });
      }
      expect(sendSms).toHaveBeenCalledTimes(2);
      await prisma.contact.delete({ where: { id: person.id } });
    });
  });
  it('seeds six persisted sample templates idempotently while preserving edited and archived templates', async () => {
    const first = await seedCampaignTemplates(prisma, tenantId);
    expect(first).toBe(6);
    const sample = await prisma.template.findFirstOrThrow({ where: { tenantId, name: 'Inquiry Received' } });
    await prisma.template.update({ where: { id: sample.id }, data: { content: 'User edited', isArchived: true } });
    expect(await seedCampaignTemplates(prisma, tenantId)).toBe(0);
    expect(await seedCampaignTemplates(prisma, tenantId)).toBe(0);
    expect((await prisma.template.findUniqueOrThrow({ where: { id: sample.id } }))).toMatchObject({ content: 'User edited', isArchived: true });
    expect(await prisma.template.count({ where: { tenantId, category: 'Sales' } })).toBe(6);
  });

});
