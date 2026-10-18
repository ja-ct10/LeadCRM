import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { defaultQuotationContent, type QuotationDraft, type QuotationPreview } from '@leadcrm/shared';
vi.mock('../../../../integrations/gmail/gmail-read', () => ({ readGmailJson: vi.fn(async () => { throw new Error('Fixture: Gmail synchronization unavailable'); }), writeGmailJson: vi.fn(async () => ({ id: 'fixturemessage', threadId: 'fixturethread' })) }));
vi.mock('express-rate-limit', async importOriginal => { const actual = await importOriginal<typeof import('express-rate-limit')>(); return { ...actual, default: (options: Partial<import('express-rate-limit').Options>) => actual.default({ ...options, limit: 300 }) }; });
import prisma from '../../../../config/database.config';
import { tenantContext } from '../../../../core/tenant/tenant-context';
import { issueAuthSession } from '../../../../core/auth/auth-session';
import { encryptToken } from '../../../../core/encryption/crypto.service';
import { writeGmailJson } from '../../../../integrations/gmail/gmail-read';
import { createRawMessage } from '../../../../integrations/gmail/gmail.service';
import { renderQuotationPdf } from '../quotation-pdf';
import { AppError } from '../../../../shared/errors/app-error';
import { seedCampaignTemplates } from '../../templates/default-templates';
import { sendMailboxEmail } from '../../../../integrations/gmail/mailbox-send.service';
import app from '../../../../app';
const database = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = database.hostname === '127.0.0.1' && /^\/leadcrm_quotation_test_\d+$/.test(database.pathname);
describe.skipIf(!disposable)('quotation authenticated API on disposable PostgreSQL', () => {
  const seedDb = new PrismaClient();
  let tenantId: string, otherTenant: string, userId: string, token: string, denied: string, base: string, server: Server;
  let templateId: string, productId: string, leadId: string, contactId: string, accountId: string, dealId: string, pipelineId: string, stageId: string;
  const output = resolve(__dirname, '../../../../../../data/outputs/quotations');
  const scope = <T>(fn: () => T) => tenantContext.run({ tenantId }, fn);
  async function call(path: string, method = 'GET', body?: unknown, authorization = token) {
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${authorization}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  const draft = (recipientType: 'Lead' | 'Contact' = 'Lead'): QuotationDraft => ({ quotationId: randomUUID(), templateId, recipientType, recipientId: recipientType === 'Lead' ? leadId : contactId,
    dealId, products: [{ productId, quantity: 3 }], quotationDate: '2026-10-18', validUntil: '2026-11-18', notes: '{{fullName}} / {{organizationName}} / {{sender_email}} / {{total}}' });
  async function preview(value = draft()) { const result = await call('/marketing/campaigns/quotations/preview', 'POST', value); expect(result.status, JSON.stringify(result.data)).toBe(200); return result.data.data as QuotationPreview; }
  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'Quotation Issuer', slug: randomUUID(), status: 'SANDBOX', email: 'issuer@example.test', phone: '+639123456789', address: 'Issuer Address', onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
    otherTenant = (await prisma.tenant.create({ data: { name: 'Other', slug: randomUUID() } })).id;
    const user = await prisma.user.create({ data: { tenantId, firstName: 'Quotation', lastName: 'Sender', email: `quote-${randomUUID()}@camxian.com`, role: 'Client Admin', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    userId = user.id; token = (await issueAuthSession(user)).token;
    const blocked = await prisma.user.create({ data: { tenantId, firstName: 'Denied', lastName: 'Agent', email: `${randomUUID()}@camxian.com`, role: 'Sales', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    denied = (await issueAuthSession(blocked)).token;
    await scope(async () => {
      await prisma.template.create({ data: { tenantId, name: 'CCTV Quotation', type: 'Quotation', category: 'Custom', content: JSON.stringify({ ...defaultQuotationContent(), footer: 'CCTV terms {{sender_name}}' }) } });
      await seedCampaignTemplates(seedDb, tenantId, true);
      templateId = (await prisma.template.findFirstOrThrow({ where: { tenantId, type: 'Quotation', name: 'Standard Sales Quotation' } })).id;
      productId = (await prisma.productInterest.create({ data: { tenantId, name: 'Technical Service', category: 'Services', description: 'Professional setup', dealValue: '1234.56' } })).id;
      accountId = (await prisma.account.create({ data: { tenantId, name: 'Customer Account', address: 'Account Address' } })).id;
      leadId = (await prisma.lead.create({ data: { tenantId, firstName: 'Juan', lastName: 'Dela Cruz', email: 'juan@example.test', companyName: 'Lead Company', assignedUserId: userId, accountId } })).id;
      contactId = (await prisma.contact.create({ data: { tenantId, firstName: 'Maria', lastName: 'Santos', email: 'maria@example.test', companyName: 'Contact Company', assignedUserId: userId, accountId } })).id;
      pipelineId = (await prisma.pipeline.create({ data: { tenantId, name: 'Quotation pipeline' } })).id;
      stageId = (await prisma.stage.create({ data: { tenantId, pipelineId, name: 'Lead', order: 0, requiredFields: [] } })).id;
      dealId = (await prisma.deal.create({ data: { tenantId, pipelineId, stageId, title: 'Linked quotation Deal', productInterestId: productId, value: 99999,
        leadDeals: { create: { tenantId, leadId } }, contactDeals: { create: { tenantId, contactId } } } })).id;
      await prisma.emailAccount.create({ data: { tenantId, userId, email: user.email, accessToken: encryptToken('fixture-access-token'), tokenExpiresAt: new Date(Date.now() + 3600000), scopes: ['https://www.googleapis.com/auth/gmail.modify'] } });
    });
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(done => server.once('listening', done)); base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
    mkdirSync(output, { recursive: true });
  }, 30000);
  afterAll(async () => { if (server) await new Promise<void>(done => server.close(() => done())); await seedDb.$disconnect(); await prisma.$disconnect(); });
  it('lists all six starters plus CCTV across pages, searches, filters and renders every template', async () => {
    const all = [];
    for (let page = 1; page <= 4; page++) {
      const result = await call(`/marketing/templates?type=Quotation&limit=2&page=${page}`);
      expect(result.data.meta.total).toBe(7); all.push(...result.data.data);
    }
    expect(new Set(all.map(row => row.id)).size).toBe(7);
    for (const row of all) {
      expect((await call(`/marketing/templates?type=Quotation&search=${encodeURIComponent(row.name)}&category=${row.category}`)).data.data.map((item: { id: string }) => item.id)).toContain(row.id);
      const response = await fetch(base + `/marketing/templates/${row.id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('application/pdf');
      const pdf = Buffer.from(await response.arrayBuffer()); expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect((await preview({ ...draft(), templateId: row.id })).document.products[0].name).toBe('Technical Service');
    }
    expect((await call('/marketing/templates?type=Quotation')).data.meta.total).toBe(7);
  });
  it('persists six starters idempotently and retains edited/archived content', async () => {
    const listed = await call('/marketing/templates?type=Quotation');
    expect(listed.status).toBe(200); expect(listed.data.meta.total).toBe(7); expect(listed.data.data).toHaveLength(7);
    await scope(async () => {
      const saved = await prisma.template.findFirstOrThrow({ where: { tenantId, type: 'Quotation', name: 'Annual Maintenance' } });
      await prisma.template.update({ where: { id: saved.id }, data: { content: JSON.stringify({ ...defaultQuotationContent(), footer: 'User terms' }), isArchived: true } });
      expect(await seedCampaignTemplates(seedDb, tenantId, true)).toBe(0);
      expect(await prisma.template.count({ where: { tenantId, type: 'Quotation' } })).toBe(7);
      expect(await prisma.template.findUnique({ where: { id: saved.id } })).toMatchObject({ isArchived: true, content: expect.stringContaining('User terms') });
    });
  });
  it('seeds quotations only for the explicit tenant and leaves messaging/custom/archived templates unchanged', async () => {
    const target = await prisma.tenant.create({ data: { name: 'Explicit quotation seed', slug: randomUUID() } });
    await tenantContext.run({ tenantId: target.id }, async () => {
      const messages = await prisma.template.createMany({ data: [
        { tenantId: target.id, name: 'Lead Inquiry Acknowledgment', type: 'Email', category: 'Sales', subject: 'Old {{first_name}}', content: 'Keep {{company_name}}' },
        { tenantId: target.id, name: 'Inquiry Received', type: 'SMS', category: 'Sales', content: 'Keep this message' },
      ] });
      expect(messages.count).toBe(2);
      const custom = await prisma.template.create({ data: { tenantId: target.id, name: 'CCTV Quotation', type: 'Quotation', category: 'Custom', content: JSON.stringify({ ...defaultQuotationContent(), footer: 'Custom CCTV terms' }) } });
      const archived = await prisma.template.create({ data: { tenantId: target.id, name: 'Annual Maintenance', type: 'Quotation', category: 'Maintenance', isArchived: true, content: JSON.stringify({ ...defaultQuotationContent(), footer: 'Archived custom terms' }) } });
      const before = await prisma.template.findMany({ where: { tenantId: target.id }, orderBy: { id: 'asc' } });
      expect(await seedCampaignTemplates(seedDb, target.id, true, { quotationsOnly: true })).toBe(5);
      expect(await seedCampaignTemplates(seedDb, target.id, true, { quotationsOnly: true })).toBe(0);
      expect(await prisma.template.findMany({ where: { tenantId: target.id, id: { in: before.map(row => row.id) } }, orderBy: { id: 'asc' } })).toEqual(before);
      expect(await prisma.template.count({ where: { tenantId: target.id, type: 'Quotation' } })).toBe(7);
      expect(await prisma.template.findUnique({ where: { id: custom.id } })).toMatchObject({ content: custom.content, isArchived: false });
      expect(await prisma.template.findUnique({ where: { id: archived.id } })).toMatchObject({ content: archived.content, isArchived: true });
    });
    expect(await tenantContext.run({ tenantId: otherTenant }, () => prisma.template.count({ where: { tenantId: otherTenant } }))).toBe(0);
  });
  it('creates, edits, searches by category and reloads a quotation template', async () => {
    const created = await call('/marketing/templates', 'POST', { name: 'Custom Terms', type: 'Quotation', category: 'Custom', content: JSON.stringify(defaultQuotationContent()) });
    expect(created.status).toBe(201); const id = created.data.data.id;
    expect((await call(`/marketing/templates/${id}`, 'PUT', { content: JSON.stringify({ ...defaultQuotationContent(), footer: 'Edited terms {{sender_name}}' }) })).status).toBe(200);
    expect((await call(`/marketing/templates/${id}`)).data.data.content).toContain('Edited terms');
    expect((await call('/marketing/templates?type=Quotation&search=Custom&category=Custom')).data.data.some((row: { id: string }) => row.id === id)).toBe(true);
    const response = await fetch(base + `/marketing/templates/${id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/pdf');
    const savedPdf = Buffer.from(await response.arrayBuffer());
    expect(savedPdf.subarray(0, 5).toString()).toBe('%PDF-');
    writeFileSync(resolve(output, 'new-template.pdf'), savedPdf);
  });
  it.each(['Lead', 'Contact'] as const)('resolves %s, authenticated Sender, Organization and authoritative decimal totals', async type => {
    const result = await preview(draft(type));
    expect(result.document.recipient.companyName).toBe(type === 'Lead' ? 'Lead Company' : 'Contact Company');
    expect(result.document.header).toContain('Quotation Issuer'); expect(result.document.header).toContain('Issuer Address');
    expect(result.document.footer).toContain('Quotation Sender');
    expect(result.document.notes).toContain('Quotation Issuer'); expect(result.document.notes).toContain('₱3,703.68');
    expect(result.document.products[0]).toMatchObject({ name: 'Technical Service', description: 'Professional setup', unitPrice: '1234.56', quantity: 3, total: '3703.68' });
    const pdf = Buffer.from(result.pdfBase64, 'base64'); expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    writeFileSync(resolve(output, `${type.toLowerCase()}.pdf`), pdf);
  });
  it('downloads a reusable PDF with placeholders and no recipient/products', async () => {
    const response = await fetch(base + `/marketing/templates/${templateId}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
    expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('application/pdf');
    writeFileSync(resolve(output, 'template.pdf'), Buffer.from(await response.arrayBuffer()));
  });
  it('returns PDF errors without exposing other tenants, archived records or internal errors', async () => {
    const foreign = await tenantContext.run({ tenantId: otherTenant }, () => prisma.template.create({ data: { tenantId: otherTenant, name: 'Private template', type: 'Quotation', content: JSON.stringify(defaultQuotationContent()) } }));
    const archived = await scope(() => prisma.template.findFirstOrThrow({ where: { tenantId, type: 'Quotation', isArchived: true } }));
    for (const id of [foreign.id, archived.id, randomUUID(), 'invalid-template-id']) {
      const response = await fetch(base + `/marketing/templates/${id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      expect(response.status).toBe(404); expect(response.headers.get('content-type')).toContain('application/json');
    }
    expect((await fetch(base + `/marketing/templates/${templateId}/pdf`)).status).toBe(401);
    expect((await fetch(base + `/marketing/templates/${templateId}/pdf`, { headers: { Authorization: `Bearer ${denied}` } })).status).toBe(403);
  });
  it('blocks invalid quantities, dates, unknown variables and client-supplied totals', async () => {
    const value = draft();
    for (const invalid of [{ ...value, total: 1 }, { ...value, products: [{ productId, quantity: 0 }] }, { ...value, validUntil: '2026-10-17' }, { ...value, notes: '{{accountPhone}}' }]) expect((await call('/marketing/campaigns/quotations/preview', 'POST', invalid)).status).toBe(400);
  });
  it('blocks foreign tenant records, missing permissions and inactive products', async () => {
    const foreign = await tenantContext.run({ tenantId: otherTenant }, () => prisma.productInterest.create({ data: { tenantId: otherTenant, name: 'Private', dealValue: 5 } }));
    expect((await call('/marketing/campaigns/quotations/preview', 'POST', { ...draft(), products: [{ productId: foreign.id, quantity: 1 }] })).status).toBe(400);
    expect((await call('/marketing/campaigns/quotations/preview', 'POST', draft(), denied)).status).toBe(403);
    await scope(() => prisma.productInterest.update({ where: { id: productId }, data: { active: false } }));
    expect((await call('/marketing/campaigns/quotations/preview', 'POST', draft())).status).toBe(400);
    await scope(() => prisma.productInterest.update({ where: { id: productId }, data: { active: true } }));
  });
  it('requires the authorized Account relationship only when referenced', async () => {
    const value = draft(); value.notes = '{{accountName}} / {{accountAddress}}'; expect((await preview(value)).document.notes).toBe('Customer Account / Account Address');
    await scope(() => prisma.lead.update({ where: { id: leadId }, data: { accountId: null } }));
    expect((await call('/marketing/campaigns/quotations/preview', 'POST', value)).status).toBe(400);
    await scope(() => prisma.lead.update({ where: { id: leadId }, data: { accountId } }));
  });
  it('requires a related Deal and rejects forged, unrelated and archived Deal/Product combinations', async () => {
    expect((await call('/marketing/campaigns/quotations/preview', 'POST', { ...draft(), dealId: undefined })).status).toBe(400);
    expect((await call('/marketing/campaigns/quotations/preview', 'POST', { ...draft(), dealId: randomUUID() })).status).toBe(400);
    const unrelated = await scope(() => prisma.deal.create({ data: { tenantId, pipelineId, stageId, title: 'Unrelated', productInterestId: productId } }));
    expect((await call('/marketing/campaigns/quotations/preview', 'POST', { ...draft(), dealId: unrelated.id })).status).toBe(400);
    const otherProduct = await scope(() => prisma.productInterest.create({ data: { tenantId, name: 'Other catalog Product', dealValue: 5 } }));
    expect((await call('/marketing/campaigns/quotations/preview', 'POST', { ...draft(), products: [{ productId: otherProduct.id, quantity: 1 }] })).status).toBe(400);
    await scope(() => prisma.deal.update({ where: { id: dealId }, data: { isArchived: true } }));
    expect((await call('/marketing/campaigns/quotations/preview', 'POST', draft())).status).toBe(400);
    await scope(() => prisma.deal.update({ where: { id: dealId }, data: { isArchived: false, productInterestId: null } }));
    const missing = await call('/marketing/campaigns/quotations/preview', 'POST', draft());
    expect(missing.status).toBe(400); expect(JSON.stringify(missing.data)).toContain('No product is associated with this Deal. Please select a Deal with an assigned product.');
    await scope(() => prisma.deal.update({ where: { id: dealId }, data: { productInterestId: productId } }));
  });
  it('accepts a converted Lead relationship for a Contact and permits a real zero-priced Product', async () => {
    const converted = await scope(() => prisma.lead.create({ data: { tenantId, firstName: 'Converted', lastName: 'Customer', convertedAt: new Date(), contactId } }));
    const free = await scope(() => prisma.productInterest.create({ data: { tenantId, name: 'Included Service', dealValue: 0 } }));
    const linked = await scope(() => prisma.deal.create({ data: { tenantId, pipelineId, stageId, title: 'Converted relationship', productInterestId: free.id } }));
    await scope(() => prisma.leadDeal.create({ data: { tenantId, leadId: converted.id, dealId: linked.id } }));
    expect((await preview({ ...draft('Contact'), dealId: linked.id, products: [{ productId: free.id, quantity: 2 }] })).document.total).toBe('0.00');
  });
  it('requires a new preview if the canonical Product changes before first send', async () => {
    const value = draft(), prepared = await preview(value), before = vi.mocked(writeGmailJson).mock.calls.length;
    await scope(() => prisma.deal.update({ where: { id: dealId }, data: { productInterestId: null } }));
    const result = await call('/marketing/campaigns/quotations/send', 'POST', { draft: value, fingerprint: prepared.fingerprint, requestId: randomUUID() });
    expect(result.status).toBe(409); expect(JSON.stringify(result.data)).toContain('QUOTATION_PREVIEW_CHANGED');
    expect(vi.mocked(writeGmailJson).mock.calls.length).toBe(before);
    await scope(() => prisma.deal.update({ where: { id: dealId }, data: { productInterestId: productId } }));
  });
  it('revalidates a reserved receipt that never attempted delivery', async () => {
    const value = draft(), prepared = await preview(value), requestId = randomUUID(), before = vi.mocked(writeGmailJson).mock.calls.length;
    const account = await scope(() => prisma.emailAccount.findFirstOrThrow({ where: { tenantId, userId } }));
    await scope(() => prisma.mailboxSendReceipt.create({ data: { tenantId, accountId: account.id, requestId, status: 'reserved', payloadHash: 'fixture-reservation',
      authorizationContext: { quotation: { draft: value, document: prepared.document, fingerprint: prepared.fingerprint, subject: 'Reserved', body: '<p>Quotation</p>' } } } }));
    await scope(() => prisma.productInterest.update({ where: { id: productId }, data: { description: 'Updated setup' } }));
    const result = await call('/marketing/campaigns/quotations/send', 'POST', { draft: value, requestId, fingerprint: prepared.fingerprint });
    expect(result.status).toBe(409); expect(JSON.stringify(result.data)).toContain('QUOTATION_PREVIEW_CHANGED');
    expect(vi.mocked(writeGmailJson).mock.calls.length).toBe(before);
    await scope(() => prisma.productInterest.update({ where: { id: productId }, data: { description: 'Professional setup' } }));
  });
  it('rejects a cross-tenant Deal and a user who lacks only Deals View', async () => {
    const foreignDeal = await tenantContext.run({ tenantId: otherTenant }, async () => {
      const pipeline = await prisma.pipeline.create({ data: { tenantId: otherTenant, name: 'Private pipeline' } });
      const stage = await prisma.stage.create({ data: { tenantId: otherTenant, pipelineId: pipeline.id, name: 'Lead', order: 0, requiredFields: [] } });
      return prisma.deal.create({ data: { tenantId: otherTenant, pipelineId: pipeline.id, stageId: stage.id, title: 'Private Deal' } });
    });
    expect((await call('/marketing/campaigns/quotations/preview', 'POST', { ...draft(), dealId: foreignDeal.id })).status).toBe(400);
    const role = await scope(() => prisma.roleDefinition.create({ data: { tenantId, name: `No Deals ${randomUUID()}` } }));
    await scope(() => prisma.rolePermission.createMany({ data: ['campaigns', 'products', 'leads'].map(module => ({ tenantId, roleId: role.id, module, canView: true })) }));
    const user = await scope(() => prisma.user.create({ data: { tenantId, email: `${randomUUID()}@camxian.com`, firstName: 'No', lastName: 'Deals', role: role.name, mustChangePassword: false, onboardingCompletedAt: new Date() } }));
    await scope(() => prisma.userRole.create({ data: { tenantId, userId: user.id, roleId: role.id } }));
    expect((await call('/marketing/campaigns/quotations/preview', 'POST', draft(), (await issueAuthSession(user)).token)).status).toBe(403);
  });
  it('rejects changed previews before Gmail is called', async () => {
    const value = draft(), prepared = await preview(value); const before = vi.mocked(writeGmailJson).mock.calls.length;
    await scope(() => prisma.productInterest.update({ where: { id: productId }, data: { dealValue: '1234.57' } }));
    const result = await call('/marketing/campaigns/quotations/send', 'POST', { draft: value, fingerprint: prepared.fingerprint, requestId: randomUUID() });
    expect(result.status).toBe(409); expect(vi.mocked(writeGmailJson).mock.calls.length).toBe(before);
  });
  it('preserves exact recipient assignment for Client Admin', async () => {
    const value = draft(), prepared = await preview(value);
    await scope(() => prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: null } }));
    const updated = await preview(value);
    expect((await call('/marketing/campaigns/quotations/send', 'POST', { draft: value, fingerprint: updated.fingerprint, requestId: randomUUID() })).status).toBe(403);
    await scope(() => prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: userId } }));
    expect(prepared.fingerprint).not.toBe(updated.fingerprint);
  });
  it('attaches the preview PDF and replays one confirmed send after source data changes', async () => {
    const value = draft(), prepared = await preview(value), requestId = randomUUID();
    const before = vi.mocked(writeGmailJson).mock.calls.length;
    const result = await call('/marketing/campaigns/quotations/send', 'POST', { draft: value, fingerprint: prepared.fingerprint, requestId });
    expect(result.status, JSON.stringify(result.data)).toBe(200);
    const payload = vi.mocked(writeGmailJson).mock.calls.at(-1)![3] as { raw: string };
    const mime = Buffer.from(payload.raw, 'base64url').toString(); expect(mime).toContain('multipart/mixed'); expect(mime).toContain('Content-Type: application/pdf');
    const encoded = mime.split('Content-Type: application/pdf')[1].split('\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, '');
    expect(createHash('sha256').update(Buffer.from(encoded, 'base64')).digest('hex')).toBe(createHash('sha256').update(Buffer.from(prepared.pdfBase64, 'base64')).digest('hex'));
    await scope(() => prisma.productInterest.update({ where: { id: productId }, data: { dealValue: '1250' } }));
    expect((await call('/marketing/campaigns/quotations/send', 'POST', { draft: value, fingerprint: prepared.fingerprint, requestId })).status).toBe(200);
    expect(vi.mocked(writeGmailJson).mock.calls.length).toBe(before + 1);
  });
  it('keeps old HTML MIME unchanged and rejects unsafe attachment filenames', () => {
    expect(Buffer.from(createRawMessage('to@example.test', 'Subject', '<p>Body</p>', 'from@example.test'), 'base64url').toString()).toContain('Content-Type: text/html; charset=utf-8\r\n\r\n<p>Body</p>');
    expect(() => createRawMessage('to@example.test', 'Subject', 'Body', 'from@example.test', undefined, undefined, [], [{ filename: 'bad\r\nheader.pdf', mimeType: 'application/pdf', data: Buffer.from('%PDF-') }])).toThrow('Invalid generated PDF attachment');
  });
  it('recovers a previously attempted legacy quotation without a Deal using its frozen attachment', async () => {
    const value = draft(), prepared = await preview(value), requestId = randomUUID();
    const { dealId: _dealId, ...legacy } = value;
    // Match the canonical JSON used by the pre-Deal quotation sender, rather
    // than seeding a receipt with a different mailbox intent key order.
    const quotation = JSON.parse(JSON.stringify({ draft: legacy, document: prepared.document, fingerprint: prepared.fingerprint, subject: 'Legacy quotation', body: '<p>Frozen quotation</p>' },
      (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value));
    const before = vi.mocked(writeGmailJson).mock.calls.length;
    await scope(() => sendMailboxEmail(tenantId, userId, { requestId, to: prepared.document.recipient.email, subject: quotation.subject, body: quotation.body },
      { quotation, attachments: [{ filename: `${prepared.document.number}.pdf`, mimeType: 'application/pdf', data: Buffer.from(prepared.pdfBase64, 'base64') }] }));
    await scope(() => prisma.productInterest.update({ where: { id: productId }, data: { dealValue: '1300' } }));
    expect((await call('/marketing/campaigns/quotations/send', 'POST', { draft: legacy, fingerprint: prepared.fingerprint, requestId })).status).toBe(200);
    expect(vi.mocked(writeGmailJson).mock.calls.length).toBe(before + 1);
    expect((await call('/marketing/campaigns/quotations/send', 'POST', { draft: legacy, fingerprint: prepared.fingerprint, requestId: randomUUID() })).status).toBe(400);
  });
  it('blocks foreign tenant recipients/templates and Account data without Accounts View', async () => {
    const foreign = await tenantContext.run({ tenantId: otherTenant }, () => prisma.lead.create({ data: { tenantId: otherTenant, firstName: 'Private', lastName: 'Recipient' } }));
    expect((await call('/marketing/campaigns/quotations/preview', 'POST', { ...draft(), recipientId: foreign.id })).status).toBe(404);
    expect((await call('/marketing/campaigns/quotations/preview', 'POST', { ...draft(), templateId: randomUUID() })).status).toBe(404);
    const role = await scope(() => prisma.roleDefinition.create({ data: { tenantId, name: `Quote Reader ${randomUUID()}` } }));
    await scope(() => prisma.rolePermission.createMany({ data: ['campaigns', 'products', 'leads', 'deals'].map(module => ({ tenantId, roleId: role.id, module, canView: true })) }));
    const user = await scope(() => prisma.user.create({ data: { tenantId, email: `${randomUUID()}@camxian.com`, firstName: 'Limited', lastName: 'Reader', role: role.name, mustChangePassword: false, onboardingCompletedAt: new Date() } }));
    await scope(() => prisma.userRole.create({ data: { tenantId, userId: user.id, roleId: role.id } }));
    const limitedToken = (await issueAuthSession(user)).token;
    expect((await call('/marketing/campaigns/quotations/preview', 'POST', { ...draft(), notes: '{{accountName}}' }, limitedToken)).status).toBe(400);
    expect((await call('/marketing/campaigns/quotations/preview', 'POST', { ...draft(), recipientType: 'Contact', recipientId: contactId }, limitedToken)).status).toBe(403);
  });
  it('claims simultaneous clicks once and never resubmits an uncertain provider outcome', async () => {
    const value = draft(), prepared = await preview(value), input = { draft: value, fingerprint: prepared.fingerprint, requestId: randomUUID() };
    const before = vi.mocked(writeGmailJson).mock.calls.length;
    const results = await Promise.all([call('/marketing/campaigns/quotations/send', 'POST', input), call('/marketing/campaigns/quotations/send', 'POST', input)]);
    expect(results.some(result => result.status === 200)).toBe(true); expect(results.every(result => [200, 409].includes(result.status))).toBe(true);
    expect(vi.mocked(writeGmailJson).mock.calls.length).toBe(before + 1);
    const uncertain = { ...input, requestId: randomUUID() };
    vi.mocked(writeGmailJson).mockRejectedValueOnce(new AppError('Fixture provider outcome unknown', 503, 'GMAIL_OUTCOME_UNKNOWN'));
    expect((await call('/marketing/campaigns/quotations/send', 'POST', uncertain)).status).toBe(503);
    const attempts = vi.mocked(writeGmailJson).mock.calls.length;
    expect((await call('/marketing/campaigns/quotations/send', 'POST', uncertain)).status).toBeGreaterThanOrEqual(400);
    expect(vi.mocked(writeGmailJson).mock.calls.length).toBe(attempts);
  });
  it('renders long tables and terms through the same PDF renderer', async () => {
    const value = (await preview()).document;
    const pdf = await renderQuotationPdf({ ...value, products: Array.from({ length: 35 }, (_, index) => ({ ...value.products[0], name: `Product ${index + 1}`, description: 'A longer product description with configuration and support. '.repeat(6) })), footer: 'Extended terms and conditions for this quotation. '.repeat(300) });
    writeFileSync(resolve(output, 'long.pdf'), pdf); expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
