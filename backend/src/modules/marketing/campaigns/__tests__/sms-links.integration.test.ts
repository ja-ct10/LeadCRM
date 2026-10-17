import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { SMS_MAX_LENGTH } from '@leadcrm/shared';
import type { Server } from 'node:http';
vi.mock('../../../../shared/services/sms.service', async original => ({ ...await original<object>(), sendSms: vi.fn(), getSmsDeviceId: vi.fn(async () => 'test-device') }));
vi.mock('../../../notifications/notification-events.service', async original => ({ ...await original<object>(), requestNotificationDispatch: vi.fn() }));
import prisma from '../../../../config/database.config';
import { tenantContext } from '../../../../core/tenant/tenant-context';
import { issueAuthSession } from '../../../../core/auth/auth-session';
import { createCampaign, sendCampaign, getCampaignReport, getCampaignMetrics } from '../campaigns.service';
import { createAudience } from '../audiences.service';
import { sendSms, SmsSubmissionError } from '../../../../shared/services/sms.service';
import { applyTextBeeEvidence } from '../textbee-webhook';
import app from '../../../../app';

const database = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = database.hostname === '127.0.0.1' && /^\/leadcrm_campaign_test_\d+$/.test(database.pathname);
describe.skipIf(!disposable)('SMS links through public HTTP and native PostgreSQL', () => {
  let tenantId: string, otherTenant: string, userId: string, audienceId: string, base: string, auth: string, server: Server;
  const scoped = <T>(work: () => T, tenant = tenantId) => tenantContext.run({ tenantId: tenant }, async () => await work());
  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'SMS links QA', slug: randomUUID(), status: 'SANDBOX', onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
    otherTenant = (await prisma.tenant.create({ data: { name: 'Other link tenant', slug: randomUUID() } })).id;
    const user = await prisma.user.create({ data: { tenantId, email: `${randomUUID()}@camxian.com`, firstName: 'Links', lastName: 'Tester', role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, emailVerified: new Date(), onboardingCompletedAt: new Date() } });
    userId = user.id; auth = (await issueAuthSession(user)).token;
    await scoped(async () => {
      await prisma.contact.create({ data: { tenantId, firstName: 'Link', lastName: 'Recipient', phone: '+639171234567' } });
      audienceId = (await createAudience(tenantId, { name: 'SMS recipient', source: 'CONTACTS', conditions: [] })).id;
    });
    server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  });
  beforeEach(() => {
    vi.stubEnv('APP_URL', 'https://crm.example.test'); vi.stubEnv('TEXTBEE_API_KEY', 'mock-only');
    vi.mocked(sendSms).mockReset().mockImplementation(async () => ({ messageId: `batch-${randomUUID()}`, submitted: true, status: 'pending' }));
  });
  afterAll(async () => { vi.unstubAllEnvs(); if (server) await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); });
  const draft = (body = 'Visit https://example.test/products?a=1&b=2#section and https://example.test/about. https://example.test/products?a=1&b=2#section') => scoped(() => createCampaign(tenantId, userId, { name: randomUUID(), type: 'SMS', body, targetAudienceId: audienceId }));
  async function sent(body?: string) {
    const campaign = await draft(body); await scoped(() => sendCampaign(campaign.id, tenantId, userId));
    const links = await scoped(() => prisma.smsCampaignLink.findMany({ where: { campaignContact: { campaignId: campaign.id } }, orderBy: { url: 'asc' } }));
    return { campaign, links };
  }
  const visit = (token: string, method = 'GET', headers: Record<string, string> = {}) => fetch(`${base}/public/sms-links/${token}`, { method, redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (Android)', ...headers } });

  it('sends opaque personalized links and atomically records unique clicks, preserving submission and delivery facts', async () => {
    const { campaign, links } = await sent();
    expect(links).toHaveLength(2);
    const body = vi.mocked(sendSms).mock.calls[0][1];
    for (const link of links) expect(body).toContain(`https://crm.example.test/s/${link.id}`);
    expect(body).not.toContain('https://example.test'); expect(body).not.toContain(tenantId);
    const before = await scoped(() => getCampaignMetrics(tenantId));
    const responses = await Promise.all(Array.from({ length: 5 }, () => visit(links[0].id)));
    expect(responses.every(response => response.status === 302 && response.headers.get('location') === links[0].url)).toBe(true);
    expect(responses[0].headers.get('cache-control')).toContain('no-store');
    expect((await visit(links[1].id)).headers.get('location')).toBe(links[1].url);
    const report = await scoped(() => getCampaignReport(campaign.id, tenantId));
    expect(report).toMatchObject({ status: 'SENDING', sentCount: 1, openedCount: 0, clickedCount: 1, deliveredCount: 0,
      totalClicks: 6, uniqueClicks: 1, totalOpens: null, uniqueOpens: null, ctr: 100, ctor: null, trackingStatus: 'recorded', smsTrackingVersion: 1 });
    expect(report.recipients[0]).toMatchObject({ deliveryStatus: 'Submitted', opened: false, clicked: true });
    const visits = await scoped(() => prisma.smsCampaignLink.findMany({ where: { campaignContactId: report.recipients[0].id } }));
    expect(report.recipients[0].lastActivity).toBe(new Date(Math.max(...visits.map(link => link.lastClickedAt!.getTime()))).toISOString());
    expect(report.topLinks.map(link => link.uniqueClicks)).toEqual([1, 1]);
    expect(JSON.stringify(report)).not.toContain(links[0].id);
    const metrics = await scoped(() => getCampaignMetrics(tenantId));
    expect(metrics).toMatchObject({ sent: before.sent, opened: before.opened, clicked: before.clicked + 1 });
    const liveReport = await fetch(`${base}/marketing/campaigns/${campaign.id}/report`, { headers: { Authorization: `Bearer ${auth}` } });
    expect(liveReport.status).toBe(200); expect((await liveReport.json()).data.clickedCount).toBe(1);
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it('redirects known preview/HEAD requests without recording engagement and rejects non-read methods', async () => {
    const { campaign, links } = await sent();
    for (const [method, headers] of [['HEAD', {}], ['GET', { Purpose: 'prefetch' }], ['GET', { 'Sec-Purpose': 'prefetch' }], ['GET', { 'User-Agent': 'WhatsApp/2.0' }]] as const) {
      expect((await visit(links[0].id, method, headers)).status).toBe(302);
    }
    expect((await visit(links[0].id, 'POST')).status).toBe(405);
    expect((await scoped(() => getCampaignReport(campaign.id, tenantId))).clickedCount).toBe(0);
  });

  it('keeps links tenant-scoped and rejects malformed, unknown, or tampered tokens', async () => {
    const { campaign, links } = await sent();
    expect(await scoped(() => prisma.smsCampaignLink.count(), otherTenant)).toBe(0);
    await expect(scoped(() => getCampaignReport(campaign.id, otherTenant), otherTenant)).rejects.toThrow('not found');
    for (const token of ['bad-token', 'z'.repeat(24), links[0].id.slice(0, 23) + (links[0].id.endsWith('a') ? 'b' : 'a')]) expect((await visit(token)).status).toBe(404);
    expect((await visit(links[0].id)).status).toBe(302);
    expect((await scoped(() => getCampaignMetrics(otherTenant), otherTenant)).clicked).toBe(0);
  });

  it('preserves archived destinations without changing historical metrics', async () => {
    const { campaign, links } = await sent();
    await scoped(() => prisma.campaign.update({ where: { id: campaign.id }, data: { isArchived: true } }));
    expect((await visit(links[0].id)).status).toBe(302);
    expect((await scoped(() => getCampaignReport(campaign.id, tenantId))).clickedCount).toBe(0);
  });

  it('uses separate tokens and counts each recipient once for a shared destination', async () => {
    const person = await scoped(() => prisma.contact.create({ data: { tenantId, firstName: 'Second', lastName: 'Recipient', phone: '+639181234567' } }));
    try {
      const { campaign, links } = await sent('Visit https://example.test/products');
      expect(links).toHaveLength(2); expect(new Set(links.map(link => link.id)).size).toBe(2);
      await Promise.all(links.flatMap(link => [visit(link.id), visit(link.id)]));
      const report = await scoped(() => getCampaignReport(campaign.id, tenantId));
      expect(report).toMatchObject({ recipientCount: 2, sentCount: 2, clickedCount: 2, openedCount: 0, ctr: 100 });
      expect(report.topLinks).toHaveLength(1); expect(report.topLinks[0]).toMatchObject({ uniqueClicks: 2, totalClicks: 4 });
      expect(sendSms).toHaveBeenCalledTimes(2);
    } finally { await scoped(() => prisma.contact.delete({ where: { id: person.id } })); }
  });

  it('retains Failed delivery after a click instead of inventing successful delivery', async () => {
    const { campaign, links } = await sent('https://example.test/products');
    const row = await scoped(() => prisma.campaignContact.findFirstOrThrow({ where: { campaignId: campaign.id } }));
    await applyTextBeeEvidence({ smsId: 'failed-test-sms', smsBatchId: row.messageId!, deviceId: 'test-device', recipient: row.phone!, status: 'failed', failedAt: new Date() });
    expect((await visit(links[0].id)).status).toBe(302);
    const report = await scoped(() => getCampaignReport(campaign.id, tenantId));
    expect(report).toMatchObject({ status: 'FAILED', failedCount: 1, deliveredCount: 0, clickedCount: 1, openedCount: 0 });
    expect(report.recipients[0]).toMatchObject({ deliveryStatus: 'Failed', clicked: true });
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it('retains an unconfirmed submission after a click and leaves its rate unavailable', async () => {
    vi.mocked(sendSms).mockRejectedValueOnce(new SmsSubmissionError('unconfirmed'));
    const { campaign, links } = await sent('https://example.test/products');
    expect((await visit(links[0].id)).status).toBe(302);
    const report = await scoped(() => getCampaignReport(campaign.id, tenantId));
    expect(report).toMatchObject({ status: 'SENDING', sentCount: 0, reviewRequired: true, deliveredCount: 0, clickedCount: 1, openedCount: 0, ctr: null });
    expect(report.recipients[0]).toMatchObject({ deliveryStatus: 'Unknown', clicked: true });
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it('keeps older raw SMS explicitly untracked and link-free new SMS measurable at zero', async () => {
    const old = await scoped(() => prisma.campaign.create({ data: { tenantId, name: 'Historical SMS', type: 'SMS', status: 'SENT', recipientCount: 1, sentCount: 1, body: 'https://example.test/', submissionStartedAt: new Date() } }));
    expect(await scoped(() => getCampaignReport(old.id, tenantId))).toMatchObject({ smsTrackingVersion: null, trackingStatus: 'historical_unavailable', totalClicks: null, totalOpens: null });
    const current = await sent('Plain message without any web links.');
    expect(current.links).toHaveLength(0);
    expect(await scoped(() => getCampaignReport(current.campaign.id, tenantId))).toMatchObject({ smsTrackingVersion: 1, trackingStatus: 'no_links', clickedCount: 0, totalClicks: 0 });
  });

  it('rolls back preparation when rewritten recipient messages exceed the SMS limit', async () => {
    vi.stubEnv('APP_URL', `https://${'a'.repeat(60)}.${'b'.repeat(60)}.${'c'.repeat(60)}.test`);
    const campaign = await draft(Array.from({ length: Math.ceil(SMS_MAX_LENGTH / 150) }, (_, index) => `https://e.test/${index}`).join(' '));
    await expect(scoped(() => sendCampaign(campaign.id, tenantId, userId))).rejects.toThrow('SMS limit');
    expect(await scoped(() => prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } }))).toMatchObject({ status: 'DRAFT', submissionStartedAt: null, smsTrackingVersion: null });
    expect(await scoped(() => prisma.campaignContact.count({ where: { campaignId: campaign.id } }))).toBe(0);
    expect(sendSms).not.toHaveBeenCalled();
  });
});
