import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { EmailAccount } from '@prisma/client';
import prisma from '../../config/database.config';
import app from '../../app';
import { tenantContext } from '../../core/tenant/tenant-context';
import { issueAuthSession } from '../../core/auth/auth-session';
import { encryptToken } from '../../core/encryption/crypto.service';
import { ingestMailboxMessages } from './mailbox-ingestion.service';
import { resolveMailboxScope, mailboxAddress, mailboxProviderQueries } from './mailbox-scope';
import { syncMailbox } from './mailbox-sync.service';
import { scheduleMailboxEmail, runScheduledMailboxEmails, scheduleMessageId } from './scheduled-mailbox.service';
import { fetchEmails, sendEmailWithToken } from './gmail.service';
import type { GmailEmail } from './gmail.types';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = url.hostname === '127.0.0.1' && /^\/leadcrm_mailbox_test_\d+$/.test(url.pathname);
const permissions = { leadsView: true, contactsView: true, leadsEdit: true, contactsEdit: true, dealsEdit: true, dealsView: true };
describe.skipIf(!disposable)('scoped persisted mailbox, incremental sync and scheduled delivery', () => {
  let tenantId: string, userId: string, otherId: string, token: string, account: EmailAccount, server: Server, base: string;
  let leadEmail: string, contactEmail: string, leadId: string;
  const realFetch = globalThis.fetch;
  const scope = <T>(fn: () => T) => tenantContext.run({ tenantId }, fn);
  const mail = (from: string, id = randomUUID().replaceAll('-', ''), labels = ['INBOX', 'UNREAD']): GmailEmail => ({ id, threadId: id, from, to: [account.email], subject: 'Electric Fence inquiry', body: '<p>Customer question</p>', snippet: 'Customer question', date: new Date(Date.now() - 1000).toISOString(), labels, isRead: !labels.includes('UNREAD') });
  const apiMail = (email: GmailEmail, extra: { name: string; value: string }[] = []) => ({ id: email.id, threadId: email.threadId, labelIds: email.labels, snippet: email.snippet, internalDate: String(Date.parse(email.date)), payload: { headers: [{ name: 'From', value: email.from }, { name: 'To', value: email.to.join(', ') }, { name: 'Subject', value: email.subject }, ...extra], mimeType: 'text/html', body: { data: Buffer.from(email.body).toString('base64url') } } });
  const call = async (path: string, method = 'GET', body?: unknown, authorization = `Bearer ${token}`) => {
    const response = await realFetch(base + path, { method, headers: { Authorization: authorization, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, cache: response.headers.get('cache-control'), body: response.status === 204 ? undefined : await response.json() };
  };
  beforeAll(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'Scoped mail tests', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
    otherId = (await prisma.user.create({ data: { tenantId, email: `other-${randomUUID()}@camxian.com`, firstName: 'Other', lastName: 'Agent', role: 'Client Admin', mustChangePassword: false, onboardingCompletedAt: new Date() } })).id;
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1/integrations/gmail`;
  });
  beforeEach(async () => {
    const user = await prisma.user.create({ data: { tenantId, email: `scope-${randomUUID()}@camxian.com`, firstName: 'Inbox', lastName: 'Agent', role: 'Client Admin', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    userId = user.id; token = (await issueAuthSession(user)).token;
    account = await prisma.emailAccount.create({ data: { tenantId, userId, email: user.email, accessToken: encryptToken(randomUUID()), tokenExpiresAt: new Date(Date.now() + 3600000), scopes: ['https://www.googleapis.com/auth/gmail.modify'] } });
    leadEmail = `lead-${randomUUID()}@example.test`; contactEmail = `contact-${randomUUID()}@example.test`;
    leadId = (await prisma.lead.create({ data: { tenantId, assignedUserId: userId, email: ` Customer <${leadEmail.toUpperCase()}> `, firstName: 'Lead', lastName: 'Customer', productInterest: [] } })).id;
    await prisma.contact.create({ data: { tenantId, assignedUserId: userId, email: contactEmail, firstName: 'Contact', lastName: 'Customer', activeProducts: [], productInterests: [] } });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
  afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); });

  it.each(['', '   '])('rejects an unconfigured legacy sender before contacting Gmail (%j)', async value => {
    vi.stubEnv('SMTP_FROM', value); vi.stubEnv('GMAIL_SYSTEM_SENDER_GMAIL_EMAIL', value);
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    await expect(sendEmailWithToken('test-token', leadEmail, 'Inquiry', '<p>Hello</p>')).rejects.toMatchObject({ message: 'Gmail sender is not configured.', statusCode: 503 });
    expect(provider).not.toHaveBeenCalled();
  });
  it.each(['SMTP_FROM', 'GMAIL_SYSTEM_SENDER_GMAIL_EMAIL'])('uses the explicitly configured Camxian sender from %s', async key => {
    vi.stubEnv('SMTP_FROM', ''); vi.stubEnv('GMAIL_SYSTEM_SENDER_GMAIL_EMAIL', '');
    vi.stubEnv(key, key === 'SMTP_FROM' ? 'Camxian Technologies <info@camxian.com>' : 'info@camxian.com');
    const provider = vi.fn(async () => Response.json({ id: 'system-sent', threadId: 'system-thread' })); vi.stubGlobal('fetch', provider);
    await sendEmailWithToken('test-token', leadEmail, 'Inquiry', '<p>Hello</p>');
    const [, init] = (provider.mock.calls as unknown as [string, RequestInit][])[0];
    const raw = Buffer.from(JSON.parse(String(init.body)).raw, 'base64url').toString();
    expect(raw.split('\r\n')[0]).toBe('From: Camxian Technologies <info@camxian.com>');
  });
  it('uses exact normalized fixed senders and current Lead/Contact assignments', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail), mail(contactEmail), mail('Info <INFO@CAMXIAN.COM>'), mail('reymarkjpanes@12066156.brevosend.com'), mail('other@camxian.com'), mail('other@12066156.brevosend.com'), mail('LinkedIn <jobs@linkedin.com>')], permissions));
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    const result = await call('/emails');
    expect(result.status).toBe(200); expect(result.body.emails).toHaveLength(4); expect(result.body.unreadCount).toBe(4); expect(result.cache).toBe('no-store');
    expect(provider).not.toHaveBeenCalled();
  });
  it('excludes historical unrelated mail without deleting it; search cannot expand scope', async () => {
    const unrelated = mail('bank@example.test', 'oldbank');
    await prisma.mailboxMessage.create({ data: { tenantId, accountId: account.id, providerMessageId: unrelated.id, threadId: unrelated.threadId, from: unrelated.from, fromAddress: unrelated.from, recipients: unrelated.to, recipientAddresses: unrelated.to, direction: 'inbound', subject: 'Electric Fence payment', snippet: 'private bank', body: 'private bank', sentAt: new Date(unrelated.date), labels: unrelated.labels } });
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail)], permissions));
    expect((await call('/emails?query=Electric%20Fence')).body.emails).toHaveLength(1);
    expect((await call('/emails?query=from%3Abank%40example.test%20OR%20in%3Aanywhere')).body.emails).toHaveLength(0);
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id } })).toBe(2);
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    for (const [path, method, body] of [['/threads/oldbank', 'GET', undefined], ['/archive', 'POST', { messageIds: ['oldbank'] }], ['/trash', 'POST', { messageIds: ['oldbank'] }]] as const) expect((await call(path, method, body)).status).toBe(404);
    expect(provider).not.toHaveBeenCalled();
  });
  it('revokes reassigned correspondence, even for Client Admin and direct thread IDs', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'reassigned')], permissions));
    expect((await call('/threads/reassigned')).status).toBe(200);
    await prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: otherId } });
    expect((await call('/emails')).body.emails).toHaveLength(0);
    expect((await call('/threads/reassigned')).status).toBe(404);
    expect((await call('/trash', 'POST', { messageIds: ['reassigned'] })).status).toBe(404);
  });
  it('filters Sent and Drafts inside CRM scope and sorts across persisted pages', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'received'), { ...mail(account.email, 'sent', ['SENT']), to: [leadEmail] }, { ...mail(account.email, 'draft', ['DRAFT']), draftId: 'draft-id', to: [contactEmail] }, { ...mail(account.email, 'personal', ['SENT']), to: ['personal@example.test'] }], permissions));
    expect((await call('/emails?filter=sent')).body.emails.map((row: GmailEmail) => row.id)).toEqual(['sent']);
    expect((await call('/emails?filter=drafts')).body.emails[0].draftId).toBe('draft-id');
    expect((await call('/emails?filter=unread')).body.emails.map((row: GmailEmail) => row.id)).toEqual(['received']);
    const first = await call('/emails?maxResults=1&sort=oldest');
    expect(first.body.nextPageToken).toBe('1');
    const second = await call('/emails?maxResults=1&sort=oldest&pageToken=1');
    expect(second.body.emails[0].id).not.toBe(first.body.emails[0].id);
  });
  it('updates and sends saved reply drafts with their existing thread, and deletes only authorized drafts', async () => {
    vi.stubEnv('SMTP_FROM', 'Camxian Technologies <info@camxian.com>');
    vi.stubEnv('GMAIL_SYSTEM_SENDER_GMAIL_EMAIL', 'info@camxian.com');
    const incoming = { ...mail(leadEmail, 'draft-reply'), rfcMessageId: '<customer-message@example.test>' };
    await scope(() => ingestMailboxMessages(account, [incoming], permissions));
    const writes: { path: string; data: any }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (init?.method) {
        writes.push({ path, data: JSON.parse(String(init.body)) });
        if (path.endsWith('/drafts/send')) return Response.json({ id: 'sent-draft', threadId: incoming.threadId });
        return Response.json({ id: 'saved-draft', message: { id: 'draft-message', threadId: incoming.threadId } });
      }
      return Response.json(apiMail({ ...mail(account.email, 'sent-draft', ['SENT']), threadId: incoming.threadId, to: [leadEmail] }));
    }));
    const draft = { to: leadEmail, subject: 'Re: Inquiry', body: '<p>Original</p>', replyToMessageId: incoming.id };
    expect((await call('/drafts', 'POST', draft)).status).toBe(200);
    expect((await call('/drafts', 'POST', { ...draft, replyToMessageId: undefined, draftId: 'saved-draft', body: '<p>Edited</p>' })).status).toBe(200);
    const saved = (await call('/emails?filter=drafts')).body.emails[0]; expect(saved.body).toBe('<p>Edited</p>');
    expect((await call('/send', 'POST', { to: leadEmail, subject: 'Re: Inquiry', body: saved.body, draftId: 'saved-draft' })).status).toBe(200);
    expect(writes.at(-1)?.path).toMatch(/drafts\/send$/);
    const update = writes.at(-2)!; expect(update.data.message.threadId).toBe(incoming.threadId);
    expect(Buffer.from(update.data.message.raw, 'base64url').toString().split('\r\n')[0]).toBe(`From: ${account.email}`);
    expect(Buffer.from(update.data.message.raw, 'base64url').toString()).toContain('In-Reply-To: <customer-message@example.test>');
    expect((await call('/emails?filter=drafts')).body.emails).toHaveLength(0);
    expect((await call('/drafts/personal-draft', 'DELETE')).status).toBe(404);
  });
  it('refreshes provider-edited draft bodies without creating engagement activities', async () => {
    const draft = { ...mail(account.email, 'edit-draft', ['DRAFT']), to: [leadEmail], draftId: 'draft-id' };
    await scope(() => ingestMailboxMessages(account, [draft], permissions));
    await scope(() => ingestMailboxMessages(account, [{ ...draft, body: '<p>Changed in Gmail</p>' }], permissions));
    expect((await call('/emails?filter=drafts')).body.emails[0].body).toBe('<p>Changed in Gmail</p>');
    expect(await prisma.activity.count({ where: { tenantId, leadId, type: 'email' } })).toBe(0);
  });
  it('bounds and validates provider queries for thousands of assigned addresses', async () => {
    const resolved = await resolveMailboxScope(account, permissions);
    const queries = mailboxProviderQueries({ ...resolved, addresses: Array.from({ length: 2000 }, (_, n) => `customer${n}@example.test`) });
    expect(queries.length).toBeGreaterThan(50);
    expect(queries.every(query => query.length < 3100 && query.includes('-in:spam -in:trash {'))).toBe(true);
    expect(mailboxAddress('bad@example.test OR from:bank@example.test')).toBeUndefined();
    expect(mailboxAddress('Name < INFO@CAMXIAN.COM >')).toBe('info@camxian.com');
  });
  it('single-flights history sync and never fetches unrelated bodies', async () => {
    const resolved = await resolveMailboxScope(account, permissions);
    await prisma.emailAccount.update({ where: { id: account.id }, data: { syncScopeHash: resolved.hash, syncCursor: '100', syncRequestedAt: new Date() } });
    const relevant = mail(leadEmail, 'customer'), unrelated = mail('bank@example.test', 'bank');
    const provider = vi.fn(async (input: string | URL) => {
      const path = String(input);
      if (path.includes('/history?')) return Response.json({ historyId: '110', history: [{ messagesAdded: [{ message: { id: 'customer' } }, { message: { id: 'bank' } }, { message: { id: 'customer' } }] }] });
      return Response.json(apiMail(path.includes('/customer?') ? relevant : unrelated));
    });
    vi.stubGlobal('fetch', provider);
    await Promise.all([scope(() => syncMailbox(tenantId, userId)), scope(() => syncMailbox(tenantId, userId))]);
    expect(provider.mock.calls.filter(([path]) => String(path).includes('/history?'))).toHaveLength(1);
    expect(provider.mock.calls.some(([path]) => String(path).includes('/bank?format=full'))).toBe(false);
    expect((await call('/emails')).body.emails.map((row: GmailEmail) => row.id)).toEqual(['customer']);
    expect((await prisma.emailAccount.findUniqueOrThrow({ where: { id: account.id } })).syncCursor).toBe('110');
  });
  it('persists Retry-After across calls and reloads continue reading saved mail', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail)], permissions));
    const provider = vi.fn(async () => Response.json({ error: { errors: [{ reason: 'userRateLimitExceeded' }] } }, { status: 429, headers: { 'Retry-After': '180' } }));
    vi.stubGlobal('fetch', provider);
    await expect(scope(() => syncMailbox(tenantId, userId))).rejects.toMatchObject({ code: 'GMAIL_RATE_LIMITED' });
    const retry = (await prisma.emailAccount.findUniqueOrThrow({ where: { id: account.id } })).syncRetryAt!;
    expect(+retry).toBeGreaterThan(Date.now() + 179000);
    await scope(() => syncMailbox(tenantId, userId));
    for (let n = 0; n < 3; n++) expect((await call('/emails')).body.emails).toHaveLength(1);
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it('recovers expired history through scoped bounded reconciliation', async () => {
    const resolved = await resolveMailboxScope(account, permissions);
    await prisma.emailAccount.update({ where: { id: account.id }, data: { syncScopeHash: resolved.hash, syncCursor: '100', syncRequestedAt: new Date() } });
    const provider = vi.fn(async (input: string | URL) => String(input).includes('/history?') ? Response.json({}, { status: 404 }) : String(input).endsWith('/profile') ? Response.json({ historyId: '200' }) : Response.json({}));
    vi.stubGlobal('fetch', provider);
    await scope(() => syncMailbox(tenantId, userId));
    expect((await prisma.emailAccount.findUniqueOrThrow({ where: { id: account.id } })).syncCursor).toBeNull();
    await scope(() => syncMailbox(tenantId, userId)); await scope(() => syncMailbox(tenantId, userId));
    const listings = provider.mock.calls.map(([path]) => String(path)).filter(path => /\/(messages|drafts)\?/.test(path));
    expect(listings.length).toBeGreaterThan(0); expect(listings.every(path => new URL(path).searchParams.get('q')?.includes(`from:${leadEmail}`))).toBe(true);
    expect((await prisma.emailAccount.findUniqueOrThrow({ where: { id: account.id } })).syncCursor).toBe('200');
  });

  async function queuedEmail() {
    let draftRfc = '', sends = 0;
    const outgoing = { ...mail(account.email, 'sent-schedule', ['SENT']), to: [leadEmail] };
    const provider = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const path = String(input);
      if (path.endsWith('/drafts') && init?.method === 'POST') {
        draftRfc = Buffer.from(JSON.parse(String(init.body)).message.raw, 'base64url').toString();
        return Response.json({ id: 'draft-schedule-' + userId, message: { id: 'draft-message', threadId: 'schedule-thread' } });
      }
      if (path.includes('/drafts/') && path.includes('?format=full')) return Response.json({ message: apiMail({ ...outgoing, id: 'draft-message', labels: ['DRAFT'] }, [{ name: 'Message-ID', value: draftRfc.match(/Message-ID: ([^\r\n]+)/)![1] }]) });
      if (path.endsWith('/drafts/send')) { sends++; return Response.json({ id: outgoing.id, threadId: outgoing.threadId }); }
      if (path.includes('/messages?')) return Response.json({ messages: [{ id: outgoing.id, threadId: outgoing.threadId }] });
      return Response.json(apiMail(outgoing));
    });
    vi.stubGlobal('fetch', provider);
    const input = { to: leadEmail, subject: 'Scheduled inquiry', body: '<p>Hello</p>', scheduledAt: new Date(Date.now() + 3600000).toISOString(), requestId: randomUUID() };
    const item = await scope(() => scheduleMailboxEmail(tenantId, userId, input));
    return { item, input, provider, sends: () => sends };
  }
  it('persists future delivery, deduplicates requests, claims once, and transitions Scheduled to Sent', async () => {
    const test = await queuedEmail();
    expect((await scope(() => scheduleMailboxEmail(tenantId, userId, test.input))).id).toBe(test.item.id);
    await runScheduledMailboxEmails(); expect(test.sends()).toBe(0);
    expect((await call('/emails?filter=scheduled')).body.emails).toHaveLength(1);
    expect((await call('/emails?filter=drafts')).body.emails).toHaveLength(0);
    await prisma.scheduledMailboxEmail.update({ where: { id: test.item.id }, data: { scheduledAt: new Date(Date.now() - 1000) } });
    await Promise.all([runScheduledMailboxEmails(), runScheduledMailboxEmails()]);
    expect(test.sends()).toBe(1);
    expect((await call('/emails?filter=scheduled')).body.emails).toHaveLength(0);
    expect((await call('/emails?filter=sent')).body.emails).toHaveLength(1);
    expect((await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: test.item.id } })).status).toBe('sent');
  });
  it('recovers an expired pre-send claim after restart and rechecks assignments', async () => {
    const test = await queuedEmail();
    await prisma.scheduledMailboxEmail.update({ where: { id: test.item.id }, data: { scheduledAt: new Date(0), status: 'claimed', leaseId: 'old-worker', leaseUntil: new Date(0) } });
    await prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: otherId } });
    await runScheduledMailboxEmails();
    expect(test.sends()).toBe(0);
    expect((await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: test.item.id } })).status).toBe('failed');
    expect((await call('/emails?filter=scheduled')).body.emails[0].scheduleError).toContain('assignment');
  });
  it('reconciles a send interrupted after provider acceptance without resending', async () => {
    const test = await queuedEmail();
    await prisma.scheduledMailboxEmail.update({ where: { id: test.item.id }, data: { scheduledAt: new Date(0), status: 'sending', leaseId: 'old-worker', leaseUntil: new Date(0) } });
    await runScheduledMailboxEmails();
    expect(test.sends()).toBe(0);
    expect((await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: test.item.id } })).status).toBe('sent');
    expect(test.provider.mock.calls.some(([path]) => decodeURIComponent(String(path)).includes(scheduleMessageId(test.item.id)))).toBe(true);
  });
  it('resumes a permitted expired claim once without browser state', async () => {
    const test = await queuedEmail();
    await prisma.scheduledMailboxEmail.update({ where: { id: test.item.id }, data: { scheduledAt: new Date(0), status: 'claimed', leaseId: 'terminated-worker', leaseUntil: new Date(0) } });
    await runScheduledMailboxEmails(); await runScheduledMailboxEmails();
    expect(test.sends()).toBe(1); expect((await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: test.item.id } })).status).toBe('sent');
  });
  it('bounds uncertain-delivery reconciliation and never blindly resends', async () => {
    const test = await queuedEmail();
    await prisma.scheduledMailboxEmail.update({ where: { id: test.item.id }, data: { scheduledAt: new Date(0), status: 'sending', leaseUntil: new Date(0) } });
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ messages: [] })));
    for (let n = 0; n < 6; n++) { await runScheduledMailboxEmails(); await prisma.scheduledMailboxEmail.update({ where: { id: test.item.id }, data: { retryAt: new Date(0) } }); }
    expect(test.sends()).toBe(0); expect((await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: test.item.id } })).status).toBe('failed');
    expect(vi.mocked(fetch).mock.calls.every(([url]) => String(url).includes('/messages?'))).toBe(true);
  });
  it('checks Gmail only when the server interval is due, without Pub/Sub or page-load sync', async () => {
    vi.stubEnv('GMAIL_SYNC_INTERVAL_SECONDS', '60');
    const resolved = await resolveMailboxScope(account, permissions);
    await prisma.emailAccount.update({ where: { id: account.id }, data: { syncScopeHash: resolved.hash, syncCursor: '100', lastSyncAt: new Date() } });
    const provider = vi.fn(async (_input: string | URL) => Response.json({ historyId: '120', history: [] })); vi.stubGlobal('fetch', provider);
    await scope(() => syncMailbox(tenantId, userId, 'worker'));
    await call('/emails'); await call('/emails');
    expect(provider).not.toHaveBeenCalled();
    await prisma.emailAccount.update({ where: { id: account.id }, data: { lastSyncAt: new Date(Date.now() - 61000) } });
    await Promise.all([scope(() => syncMailbox(tenantId, userId, 'worker')), scope(() => syncMailbox(tenantId, userId, 'worker'))]);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(String(provider.mock.calls[0]?.[0])).toContain('/history?');
    await scope(() => syncMailbox(tenantId, userId, 'worker')); expect(provider).toHaveBeenCalledTimes(1);
  });
});
