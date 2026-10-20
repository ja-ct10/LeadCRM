import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { EmailAccount, Prisma } from '@prisma/client';
import prisma from '../../config/database.config';
import app from '../../app';
import { tenantContext } from '../../core/tenant/tenant-context';
import { issueAuthSession } from '../../core/auth/auth-session';
import { encryptToken } from '../../core/encryption/crypto.service';
import { ingestMailboxMessages } from './mailbox-ingestion.service';
import { resolveMailboxScope, mailboxAddress, mailboxProviderQueries, mailboxParticipants, MAILBOX_PARTICIPANT_POLICY_VERSION } from './mailbox-scope';
import { syncMailbox } from './mailbox-sync.service';
import { scheduleMailboxEmail, runScheduledMailboxEmails, scheduleMessageId } from './scheduled-mailbox.service';
import { fetchEmails, sendEmailWithToken, parseGmailMessage, ingestConfirmedMailboxSend } from './gmail.service';
import type { GmailEmail } from './gmail.types';
import { salesPipeline, salesTransaction } from '../../modules/crm/leads/lead-automation.service';
import { crmActor } from '../../modules/crm/access/crm-record-access.service';

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
  const persistHistorical = (email: GmailEmail, extra: Partial<Prisma.MailboxMessageUncheckedCreateInput> = {}) => prisma.mailboxMessage.create({ data: {
    tenantId, accountId: account.id, providerMessageId: email.id, threadId: email.threadId, from: email.from, fromAddress: mailboxAddress(email.from)!,
    recipients: email.to, recipientAddresses: email.to, direction: email.from === account.email ? 'outbound' : 'inbound', subject: email.subject,
    authorizationParticipants: mailboxParticipants(email) ?? [], participantPolicyVersion: MAILBOX_PARTICIPANT_POLICY_VERSION,
    body: email.body, snippet: email.snippet, sentAt: new Date(email.date), labels: email.labels, draftId: email.draftId, ...extra,
  } });
  const call = async (path: string, method = 'GET', body?: unknown, authorization = `Bearer ${token}`) => {
    // Authorized legacy fixtures now supply the mandatory operation UUID. Explicit undefined exercises denial.
    if (['/send', '/drafts'].includes(path) && method === 'POST' && body && typeof body === 'object' && !('requestId' in body)) body = { ...body, requestId: randomUUID() };
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
    await prisma.contact.create({ data: { tenantId, assignedUserId: userId, email: contactEmail, firstName: 'Contact', lastName: 'Customer', productInterests: [] } });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
  async function recordFiles(module: string, id: string, suffix = 'email-attachments', auth = token) {
    const response = await realFetch(base.replace('/integrations/gmail', '') + `/crm/${module}/${id}/${suffix}`, { headers: { Authorization: `Bearer ${auth}` } });
    return { status: response.status, body: await response.json() as any };
  }
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); });

  it('uploads, reloads and preserves draft attachments while sending an edited subject linked to its Deal', async () => {
    const pipeline = await scope(() => salesTransaction(tx => salesPipeline(tx, tenantId)));
    const deal = await prisma.deal.create({ data: { tenantId, title: 'Attachment Deal', pipelineId: pipeline.pipeline.id, stageId: pipeline.initial.id, assignedUserId: userId, leadDeals: { create: { leadId } } } });
    const bytes = Buffer.from('%PDF-1.4\nOriginal uploaded attachment');
    let draftMessage: ReturnType<typeof apiMail>, sentMessage: ReturnType<typeof apiMail>, writes = 0, sequence = 0;
    const rawMessages: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
      const path = new URL(input).pathname.split('/me/')[1];
      if ((path === 'drafts' || path === 'drafts/upload-draft') && ['POST', 'PUT'].includes(init?.method ?? '')) {
        writes++;
        const raw = Buffer.from(JSON.parse(String(init?.body)).message.raw, 'base64url').toString(); rawMessages.push(raw);
        const subject = Buffer.from(raw.match(/Subject: =\?UTF-8\?B\?([^?]+)\?=/)![1], 'base64').toString();
        draftMessage = apiMail({ ...mail(account.email, `upload-${++sequence}`, ['DRAFT']), to: [leadEmail], subject, body: '<p>Details</p>' }, [{ name: 'Message-ID', value: raw.match(/Message-ID: ([^\r\n]+)/)![1] }]);
        Object.assign(draftMessage.payload, { mimeType: 'multipart/mixed', parts: [{ mimeType: 'text/html', body: { data: Buffer.from('<p>Details</p>').toString('base64url') } }, { partId: '1', filename: 'Proposal.pdf', mimeType: 'application/pdf', body: { attachmentId: 'upload-file', size: bytes.length } }] });
        return Response.json({ id: 'upload-draft', message: draftMessage });
      }
      if (path === 'drafts/upload-draft') return Response.json({ id: 'upload-draft', message: draftMessage });
      if (path.endsWith('/attachments/upload-file')) return Response.json({ data: bytes.toString('base64url'), size: bytes.length });
      if (path === 'drafts/send') { writes++; sentMessage = { ...draftMessage!, id: 'upload-sent', labelIds: ['SENT'] }; return Response.json({ id: sentMessage.id, threadId: sentMessage.threadId }); }
      if (path === 'messages/upload-sent') return Response.json(sentMessage!);
      if (path.startsWith('messages/upload-')) return Response.json(draftMessage!);
      return Response.json({ messages: [] });
    }));
    const context = { composeMode: 'compose', recordContext: { recordModule: 'leads', recordId: leadId }, dealId: deal.id };
    const saved = await call('/drafts', 'POST', { to: leadEmail, subject: 'Initial subject', body: '<p>Details</p>', ...context, attachments: [{ filename: 'Proposal.pdf', mimeType: 'application/pdf', content: bytes.toString('base64') }] });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect((await call(`/messages/${saved.body.messageId}/content`)).body.attachments).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'upload-file', filename: 'Proposal.pdf' })]));
    const downloaded = await realFetch(`${base}/messages/${saved.body.messageId}/attachments/upload-file`, { headers: { Authorization: `Bearer ${token}` } });
    expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(bytes);
    const payload = { requestId: randomUUID(), to: leadEmail, subject: 'Edited subject', body: '<p>Details</p>', draftId: saved.body.draftId, ...context };
    const sent = await call('/send', 'POST', payload);
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    expect(rawMessages).toHaveLength(2);
    expect(rawMessages.every(raw => raw.includes(bytes.toString('base64')))).toBe(true);
    expect(await prisma.mailboxMessage.findFirstOrThrow({ where: { tenantId, accountId: account.id, providerMessageId: sent.body.messageId } })).toMatchObject({ subject: 'Edited subject', dealId: deal.id, leadId });
    expect(await prisma.activity.count({ where: { tenantId, dealId: deal.id, leadId, type: 'email' } })).toBe(1);
    expect((await call('/send', 'POST', payload)).status).toBe(200); expect(writes).toBe(3);
  });

  it.each(['/send', '/drafts'])('rejects missing or malformed operation IDs on %s before contacting Gmail', async path => {
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    const payload = { to: leadEmail, subject: 'Keyed operation', body: '<p>Hello</p>' };
    expect((await call(path, 'POST', { ...payload, requestId: undefined })).status).toBe(400);
    expect((await call(path, 'POST', { ...payload, requestId: 'bad-key' })).status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });

  it.each(['to', 'cc', 'bcc', 'replyToAddresses'] as const)('vetoes fixed sender mail with an unauthorized CRM participant in %s across lists, counts and IDs', async field => {
    const foreign = `foreign-${randomUUID()}@example.test`;
    await prisma.contact.create({ data: { tenantId, assignedUserId: otherId, email: foreign, firstName: 'Other', lastName: 'Customer', productInterests: [] } });
    const unauthorized = { ...mail('info@camxian.com', 'strict-' + field), [field]: [foreign] };
    await scope(() => ingestMailboxMessages(account, [unauthorized], permissions));
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id, providerMessageId: unauthorized.id } })).toBe(0);
    // A retained historical row must also be denied by both SQL aggregation and direct ORM reads.
    await persistHistorical(unauthorized, { authorizationParticipants: mailboxParticipants(unauthorized)! });
    const list = await call('/emails'); expect(list.status).toBe(200); expect(list.body.emails.some((row: GmailEmail) => row.id === unauthorized.id)).toBe(false);
    expect((await call('/unread-count')).body.unreadCount).toBe(0);
    expect((await call('/threads/' + unauthorized.threadId)).status).toBe(404);
  });

  it('revokes retained messages and scope cursors when an independent foreign duplicate is created', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'duplicate-scope')], permissions));
    const before = await scope(() => resolveMailboxScope(account, permissions));
    await prisma.contact.create({ data: { tenantId, assignedUserId: otherId, email: leadEmail.toUpperCase(), firstName: 'Duplicate', lastName: 'Foreign', productInterests: [] } });
    const after = await scope(() => resolveMailboxScope(account, permissions));
    expect(after.hash).not.toBe(before.hash); expect(after.deniedAddresses).toContain(leadEmail);
    expect((await call('/threads/duplicate-scope')).status).toBe(404);
  });

  it.each(['disconnect', 'reassignment'] as const)('rejects the entire mailbox list after %s during its decoration query', async revocation => {
    const privateBody = 'Confidential body awaiting mailbox decoration';
    await scope(() => ingestMailboxMessages(account, [{ ...mail(leadEmail, 'decoration-race'), body: `<p>${privateBody}</p>` }], permissions));
    const actualFindMany = prisma.mailboxMessage.findMany.bind(prisma.mailboxMessage);
    let release!: () => void, read!: () => void, delayed = false;
    const waiting = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { read = resolve; });
    const decoration = vi.spyOn(prisma.mailboxMessage, 'findMany').mockImplementation(args => {
      if (!args?.select?.needsDealAssociation || delayed) return actualFindMany(args);
      delayed = true;
      const pendingRead = (async () => {
        const rows = await actualFindMany(args);
        expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ providerMessageId: 'decoration-race' })]));
        read(); await waiting; return rows;
      })();
      return pendingRead as unknown as ReturnType<typeof prisma.mailboxMessage.findMany>;
    });
    const pending = call('/emails');
    try {
      await Promise.race([ready, pending.then(() => { throw new Error('Mailbox list completed before its delayed decoration query'); })]);
      if (revocation === 'disconnect') await prisma.emailAccount.update({ where: { id: account.id }, data: { isActive: false } });
      else await prisma.lead.update({ where: { id: leadId, tenantId }, data: { assignedUserId: otherId } });
      release();
      const response = await pending;
      expect(response.status).toBe(409); expect(response.cache).toBe('no-store'); expect(response.body.error.code).toBe('MAILBOX_SCOPE_CHANGED');
      expect(JSON.stringify(response.body)).not.toContain(privateBody);
      for (const key of ['emails', 'unreadCount', 'nextPageToken']) expect(response.body).not.toHaveProperty(key);
    } finally { release(); await pending; decoration.mockRestore(); }
  });

  it.each(['/send', '/drafts'])('recovers an accepted %s after a lost response without repeating the provider write', async path => {
    const requestId = randomUUID(), payload = { requestId, to: leadEmail, subject: 'Recover once', body: '<p>Retained body</p>' };
    let identity = '', writes = 0;
    const provider = vi.fn(async (target: string, init?: RequestInit) => {
      const endpoint = new URL(target);
      if (init?.method === 'POST') {
        writes++;
        const input = JSON.parse(String(init.body));
        const raw = Buffer.from(input.raw ?? input.message.raw, 'base64url').toString();
        identity = raw.match(/Message-ID: ([^\r\n]+)/)?.[1] ?? '';
        throw new TypeError('Lost acknowledgement after provider acceptance');
      }
      if (endpoint.pathname.endsWith('/drafts')) return Response.json({ drafts: [{ id: 'recovered-draft', message: { id: 'recovered-message' } }] });
      if (endpoint.pathname.endsWith('/messages')) return Response.json({ messages: [{ id: 'recovered-message', threadId: 'recovered-topic' }] });
      if (endpoint.pathname.endsWith('/messages/recovered-message')) return Response.json(apiMail({ ...mail(account.email, 'recovered-message', [path === '/send' ? 'SENT' : 'DRAFT']), threadId: 'recovered-topic', to: [leadEmail], subject: payload.subject, body: payload.body }, [{ name: 'Message-ID', value: identity }]));
      throw new Error('Unexpected provider endpoint');
    });
    vi.stubGlobal('fetch', provider);
    expect((await call(path, 'POST', payload)).status).toBe(503);
    const recovered = await call(path, 'POST', payload);
    expect(recovered.status).toBe(200); expect(writes).toBe(1); expect(identity).toContain(requestId);
    if (path === '/drafts') expect(recovered.body.draftId).toBe('recovered-draft');
    else expect(recovered.body.messageId).toBe('recovered-message');
    expect((await call(path, 'POST', { ...payload, subject: 'Changed intent' })).status).toBe(409);
  });

  it('keeps schedule intent immutable and serializes operations on its draft', async () => {
    const requestId = randomUUID();
    const draft = { ...mail(account.email, 'schedule-target', ['DRAFT']), to: [leadEmail], draftId: 'schedule-target-draft' };
    await persistHistorical(draft);
    // This concurrency fixture represents an acknowledged Compose save, not an
    // unverified historical provider draft.
    await prisma.mailboxSendReceipt.create({ data: { tenantId, accountId: account.id, requestId: randomUUID(),
      payloadHash: 'acknowledged-compose-fixture', operation: 'draft', status: 'saved', providerDraftId: draft.draftId,
      providerMessageId: draft.id, authorizationContext: { composeMode: 'compose', recipients: [leadEmail] } } });
    let writes = 0;
    vi.stubGlobal('fetch', vi.fn(async (_target: string, init?: RequestInit) => {
      if (init?.method === 'PUT') { writes++; return Response.json({ id: draft.draftId, message: { id: draft.id, threadId: draft.threadId } }); }
      if (String(_target).includes('/drafts/' + draft.draftId)) return Response.json({ id: draft.draftId, message: apiMail(draft) });
      throw new Error('Unexpected provider call');
    }));
    const payload = { requestId, to: leadEmail, subject: 'Schedule target', body: '<p>Body</p>', draftId: draft.draftId, scheduledAt: new Date(Date.now() + 3600000).toISOString() };
    expect((await call('/scheduled', 'POST', payload)).status).toBe(201);
    expect((await call('/scheduled', 'POST', { ...payload, subject: 'Different' })).status).toBe(409);
    expect((await call('/drafts', 'POST', { requestId: randomUUID(), to: leadEmail, subject: 'Change queued draft', body: '<p>Changed</p>', draftId: draft.draftId })).status).toBe(409);
    expect(writes).toBe(1);
  });

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
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail), mail(contactEmail), mail('Info <INFO@CAMXIAN.COM>'), mail('reymarkjpanes@12066156.brevosend.com'), mail('sales@camxian.com'), mail('admin@camxian.com'), mail('jobs@camxian.com'), mail('bank@example.com'), mail('other@camxian.com'), mail('other@12066156.brevosend.com'), mail('someoneelse@12066156.brevosend.com'), mail('LinkedIn <jobs@linkedin.com>')], permissions));
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    const result = await call('/emails');
    expect(result.status).toBe(200); expect(result.body.emails).toHaveLength(4); expect(result.body.unreadCount).toBe(4); expect(result.cache).toBe('no-store');
    expect(provider).not.toHaveBeenCalled();
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id } })).toBe(4);
  });
  it('keeps empty assignments restricted to the two exact fixed senders', async () => {
    await prisma.lead.updateMany({ where: { tenantId, assignedUserId: userId }, data: { assignedUserId: null } });
    await prisma.contact.updateMany({ where: { tenantId, assignedUserId: userId }, data: { assignedUserId: null } });
    await scope(() => ingestMailboxMessages(account, [mail('info@camxian.com', 'fixed-info'), mail('reymarkjpanes@12066156.brevosend.com', 'fixed-brevo'), mail(leadEmail), mail(contactEmail), mail('bank@example.com')], permissions));
    expect((await call('/emails')).body.emails.map((row: GmailEmail) => row.id).sort()).toEqual(['fixed-brevo', 'fixed-info']);
    expect((await call('/unread-count')).body.unreadCount).toBe(2);
    const resolved = await resolveMailboxScope(account, permissions);
    expect(resolved.addresses).toEqual([]);
    expect(mailboxProviderQueries(resolved)).toEqual(['-in:spam -in:trash {from:reymarkjpanes@12066156.brevosend.com from:info@camxian.com to:reymarkjpanes@12066156.brevosend.com to:info@camxian.com}']);
  });
  it('does not elevate historical CRM links or unrelated participants into provider or thread scope', async () => {
    await persistHistorical({ ...mail(account.email, 'legacy-bank', ['SENT']), to: ['bank@example.com'] }, { leadId });
    await persistHistorical(mail('bank@example.com', 'legacy-bank-reply'), { leadId });
    const resolved = await resolveMailboxScope(account, permissions);
    expect(resolved.threadRecipients).toEqual({});
    expect(mailboxProviderQueries(resolved).join(' ')).not.toContain('bank@example.com');
    for (const query of ['', '?filter=sent', '?query=Electric%20Fence']) expect((await call('/emails' + query)).body.emails).toHaveLength(0);
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    expect((await call('/threads/legacy-bank')).status).toBe(404);
    expect((await call('/archive', 'POST', { messageIds: ['legacy-bank'] })).status).toBe(404);
    expect((await call('/send', 'POST', { to: 'bank@example.com', subject: 'Reply', body: 'Hello', replyToMessageId: 'legacy-bank' })).status).toBe(404);
    expect(provider).not.toHaveBeenCalled();
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id } })).toBe(2);
  });
  it('does not ingest or expose personal drafts merely authored using a fixed sender alias', async () => {
    const draft = { ...mail('info@camxian.com', 'alias-draft', ['DRAFT']), to: ['bank@example.com'], draftId: 'alias-draft-id' };
    await scope(() => ingestMailboxMessages(account, [draft], permissions));
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id } })).toBe(0);
    await persistHistorical(draft);
    expect((await call('/emails?filter=drafts')).body.emails).toHaveLength(0);
    expect((await resolveMailboxScope(account, permissions)).fixedThreadIds).toEqual([]);
  });
  it.each(['lead', 'contact'] as const)('does not grant another mailbox access to an assigned %s, then honors reassignment', async module => {
    const email = module === 'lead' ? leadEmail : contactEmail;
    const otherUser = await prisma.user.findUniqueOrThrow({ where: { id: otherId } });
    const otherAccount = await prisma.emailAccount.upsert({ where: { tenantId_userId_provider: { tenantId, userId: otherId, provider: 'gmail' } }, update: {}, create: { tenantId, userId: otherId, email: otherUser.email, accessToken: encryptToken('test-only'), tokenExpiresAt: new Date(Date.now() + 3600000), scopes: ['https://www.googleapis.com/auth/gmail.modify'] } });
    const incoming = mail(email, randomUUID());
    const otherIncoming = { ...incoming, to: [otherAccount.email] };
    await scope(() => ingestMailboxMessages(account, [incoming], permissions));
    await scope(() => ingestMailboxMessages(otherAccount, [otherIncoming], permissions));
    const authorization = `Bearer ${(await issueAuthSession(otherUser)).token}`;
    expect((await call('/threads/' + incoming.threadId)).status).toBe(200);
    expect((await call('/threads/' + incoming.threadId, 'GET', undefined, authorization)).status).toBe(404);
    if (module === 'lead') await prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: otherId } });
    else await prisma.contact.updateMany({ where: { tenantId, assignedUserId: userId }, data: { assignedUserId: otherId } });
    await scope(() => ingestMailboxMessages(otherAccount, [otherIncoming], permissions));
    expect((await call('/threads/' + incoming.threadId)).status).toBe(404);
    expect((await call('/threads/' + incoming.threadId, 'GET', undefined, authorization)).status).toBe(200);
  });
  it.each(['lead', 'contact'] as const)('revokes %s correspondence after its email changes or becomes invalid', async module => {
    const email = module === 'lead' ? leadEmail : contactEmail;
    await scope(() => ingestMailboxMessages(account, [mail(email, 'old-address'), { ...mail(account.email, 'old-sent', ['SENT']), to: [email] }], permissions));
    for (const replacement of ['new-customer@example.com', 'not an email', '']) {
      if (module === 'lead') await prisma.lead.update({ where: { id: leadId }, data: { email: replacement } });
      else await prisma.contact.updateMany({ where: { tenantId, assignedUserId: userId }, data: { email: replacement } });
      expect((await call('/emails')).body.emails).toHaveLength(0);
      expect((await call('/threads/old-sent')).status).toBe(404);
      const resolved = await resolveMailboxScope(account, permissions);
      expect(mailboxProviderQueries(resolved).join(' ')).not.toContain(email);
      expect(resolved.threadRecipients).toEqual({});
      if (replacement !== 'new-customer@example.com') expect(module === 'lead' ? resolved.leadIds : resolved.contactIds).toEqual([]);
    }
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id } })).toBe(2);
  });
  it('rejects CRM Activity totals and cursors when real CRM assignment changes during the count read', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'activity-race-one'), mail(leadEmail, 'activity-race-two')], permissions));
    expect(await prisma.activity.count({ where: { tenantId, leadId, type: 'email' } })).toBe(2);
    const crmBase = base.replace(/\/integrations\/gmail$/, '');
    const request = (path = `/crm/activities?leadId=${leadId}&type=email&limit=1`) => realFetch(crmBase + path, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => ({ status: response.status, cache: response.headers.get('cache-control'), body: await response.json() }));
    const initial = await request();
    expect(initial.status).toBe(200); expect(initial.cache).toBe('no-store');
    expect(initial.body.total).toBe(2); expect(initial.body.nextCursor).toBeTruthy();
    const direct = await request('/crm/activities/' + initial.body.data[0].id);
    expect(direct.status).toBe(200); expect(direct.cache).toBe('no-store');
    const relationships = await request(`/crm/leads/${leadId}/relationships`);
    expect(relationships.status).toBe(200); expect(relationships.cache).toBe('no-store');
    const actualCount = prisma.activity.count.bind(prisma.activity);
    let release!: () => void, counted!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { counted = resolve; });
    const list = vi.spyOn(prisma.activity, 'findMany');
    const count = vi.spyOn(prisma.activity, 'count').mockImplementationOnce(args => {
      const delayed = (async () => {
        const total = await actualCount(args);
        expect(total).toBe(2); counted(); await waiting;
        return total;
      })();
      return delayed as unknown as ReturnType<typeof prisma.activity.count>;
    });
    const pending = request();
    try {
      await Promise.race([ready, pending.then(() => { throw new Error('Activity read completed before the delayed count boundary'); })]);
      expect(count.mock.calls[0][0]?.where).toEqual(list.mock.calls[0][0]?.where);
      await prisma.lead.update({ where: { id: leadId, tenantId }, data: { assignedUserId: otherId } });
      release();
      const response = await pending;
      expect(response.status).toBe(409); expect(response.cache).toBe('no-store'); expect(response.body.error.code).toBe('MAILBOX_SCOPE_CHANGED');
      for (const key of ['data', 'total', 'nextCursor', 'meta']) expect(response.body).not.toHaveProperty(key);
    } finally { release(); await pending; count.mockRestore(); list.mockRestore(); }
    const current = await request();
    expect(current.status).toBe(200); expect(current.cache).toBe('no-store'); expect(current.body).toMatchObject({ data: [], total: 0, nextCursor: null });
  });
  it.each(['direct Activity', 'Lead relationships'] as const)('drops revoked email from %s when real CRM assignment changes during the body query', async surface => {
    const privateBody = 'Confidential customer body at the delayed read boundary';
    await scope(() => ingestMailboxMessages(account, [{ ...mail(leadEmail, 'activity-body-race'), body: `<p>${privateBody}</p>` }], permissions));
    const activity = await prisma.activity.findFirstOrThrow({ where: { tenantId, leadId, type: 'email' } });
    const stored = await prisma.mailboxMessage.findUniqueOrThrow({ where: { id: activity.mailboxMessageId! } });
    const note = await prisma.activity.create({ data: { tenantId, leadId, createdById: userId, type: 'note', title: 'Allowed CRM note' } });
    const crmBase = base.replace(/\/integrations\/gmail$/, '');
    const path = surface === 'direct Activity' ? '/crm/activities/' + activity.id : `/crm/leads/${leadId}/relationships`;
    const request = () => realFetch(crmBase + path, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => ({ status: response.status, cache: response.headers.get('cache-control'), body: await response.json() }));
    const initial = await request();
    expect(initial.status).toBe(200); expect(JSON.stringify(initial.body)).toContain(privateBody);
    const actualFindMany = prisma.mailboxMessage.findMany.bind(prisma.mailboxMessage);
    let release!: () => void, read!: () => void, delayed = false;
    const waiting = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { read = resolve; });
    const bodyQuery = vi.spyOn(prisma.mailboxMessage, 'findMany').mockImplementation(args => {
      const constraints = (args?.where as { AND?: { id?: { in?: unknown } }[] } | undefined)?.AND;
      const readsBody = !args?.select && Array.isArray(constraints) && constraints.some(where => Array.isArray(where.id?.in) && where.id.in.includes(stored.id));
      if (!readsBody || delayed) return actualFindMany(args);
      delayed = true;
      const pendingRead = (async () => {
        const rows = await actualFindMany(args);
        expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ id: stored.id, body: expect.stringContaining(privateBody) })]));
        read(); await waiting;
        return rows;
      })();
      return pendingRead as unknown as ReturnType<typeof prisma.mailboxMessage.findMany>;
    });
    const pending = request();
    try {
      await Promise.race([ready, pending.then(() => { throw new Error('CRM read completed before the delayed body boundary'); })]);
      await prisma.lead.update({ where: { id: leadId, tenantId }, data: { assignedUserId: otherId } });
      release();
      const response = await pending;
      expect(response.cache).toBe('no-store'); expect(JSON.stringify(response.body)).not.toContain(privateBody);
      if (surface === 'direct Activity') { expect(response.status).toBe(404); expect(response.body).not.toHaveProperty('data'); }
      else {
        expect(response.status).toBe(200);
        expect(response.body.data.activities.every((row: { type: string }) => row.type !== 'email')).toBe(true);
        expect(response.body.data.activities).toEqual(expect.arrayContaining([expect.objectContaining({ id: note.id, title: 'Allowed CRM note' })]));
      }
    } finally { release(); await pending; bodyQuery.mockRestore(); }
  });
  it('does not retain mailbox access through a converted Lead after its Contact is reassigned', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'converted-customer')], permissions));
    const contact = await prisma.contact.findFirstOrThrow({ where: { tenantId, assignedUserId: userId } });
    await prisma.contact.update({ where: { id: contact.id }, data: { email: leadEmail } });
    await prisma.lead.update({ where: { id: leadId }, data: { convertedAt: new Date(), contactId: contact.id } });
    expect((await call('/threads/converted-customer')).status).toBe(200);
    await prisma.contact.update({ where: { id: contact.id }, data: { assignedUserId: otherId } });
    expect((await call('/threads/converted-customer')).status).toBe(404);
    expect((await call('/emails')).body.emails).toHaveLength(0);
    const resolved = await resolveMailboxScope(account, permissions);
    expect(resolved.leadIds).toEqual([]); expect(resolved.addresses).toEqual([]);
    expect(mailboxProviderQueries(resolved).join(' ')).not.toContain(leadEmail);
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id } })).toBe(1);
  });
  it.each(['unassigned', 'archived'])('removes %s Contacts from current read and mutation scope', async state => {
    await scope(() => ingestMailboxMessages(account, [mail(contactEmail, 'contact-revoked')], permissions));
    const before = await prisma.activity.count({ where: { tenantId, createdById: userId, type: 'email' } });
    await prisma.contact.updateMany({ where: { tenantId, assignedUserId: userId }, data: state === 'archived' ? { isArchived: true } : { assignedUserId: null } });
    expect((await call('/emails')).body.emails).toHaveLength(0);
    expect((await call('/unread-count')).body.unreadCount).toBe(0);
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    expect((await call('/threads/contact-revoked')).status).toBe(404);
    for (const action of ['archive', 'trash']) expect((await call('/threads/contact-revoked/' + action, 'POST', {})).status).toBe(404);
    expect((await call('/send', 'POST', { to: contactEmail, subject: 'Reply', body: 'Hello', replyToMessageId: 'contact-revoked' })).status).toBe(404);
    expect(provider).not.toHaveBeenCalled();
    expect(await prisma.activity.count({ where: { tenantId, createdById: userId, type: 'email' } })).toBe(before);
  });
  it.each(['assigned recipient', 'empty recipient'])('hides retained source drafts with an %s after source access is revoked', async kind => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'forward-source')], permissions));
    const draft = { ...mail(account.email, 'forward-draft', ['DRAFT']), to: kind === 'assigned recipient' ? [contactEmail] : [], draftId: 'forward-draft-id' };
    await persistHistorical(draft, { crmDraft: true, sourceMessageId: 'forward-source' });
    expect((await call('/emails?filter=drafts')).body.emails).toHaveLength(1);
    const scheduled = await prisma.scheduledMailboxEmail.create({ data: { tenantId, accountId: account.id, createdById: userId, requestId: randomUUID(), draftId: draft.draftId, recipients: draft.to, subject: 'Source content', scheduledAt: new Date(0), status: 'pending' } });
    expect((await call('/emails?filter=scheduled')).body.emails).toHaveLength(1);
    await prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: otherId } });
    expect((await call('/emails?filter=drafts')).body.emails).toHaveLength(0);
    expect((await call('/emails?filter=scheduled')).body.emails).toHaveLength(0);
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    expect((await call('/drafts/' + draft.draftId, 'DELETE')).status).toBe(404);
    expect((await call('/drafts', 'POST', { draftId: draft.draftId, to: contactEmail, subject: 'Forward', body: 'Hello' })).status).toBe(404);
    await runScheduledMailboxEmails(); expect(provider).not.toHaveBeenCalled();
    expect((await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: scheduled.id } })).status).toBe('failed');
    const resolved = await resolveMailboxScope(account, permissions);
    await prisma.emailAccount.update({ where: { id: account.id }, data: { syncScopeHash: resolved.hash, syncCursor: '100', syncRequestedAt: new Date() } });
    provider.mockImplementation(async (input: string | URL) => String(input).includes('/history?') ? Response.json({ historyId: '110', history: [{ messagesAdded: [{ message: { id: draft.id } }] }] }) : Response.json(apiMail(draft)));
    await scope(() => syncMailbox(tenantId, userId));
    expect(provider.mock.calls.some(([path]) => String(path).includes('format=full'))).toBe(false);
    if (kind === 'assigned recipient') {
      // A Gmail edit replaces the message ID but retains the actual draft ID.
      const replacement = { ...draft, id: 'replacement-draft-message' };
      await prisma.emailAccount.update({ where: { id: account.id }, data: { syncRequestedAt: new Date() } });
      provider.mockClear();
      provider.mockImplementation(async (input: string | URL) => {
        const path = String(input);
        if (path.includes('/history?')) return Response.json({ historyId: '120', history: [{ messagesAdded: [{ message: { id: replacement.id } }] }] });
        if (path.includes('/drafts?')) return Response.json({ drafts: [{ id: draft.draftId, message: { id: replacement.id } }] });
        return Response.json(apiMail(replacement, [{ name: 'Message-ID', value: '<replacement@example.test>' }]));
      });
      await scope(() => syncMailbox(tenantId, userId));
      expect(provider.mock.calls.some(([path]) => String(path).includes('format=full'))).toBe(false);
      expect(await prisma.mailboxMessage.count({ where: { accountId: account.id, providerMessageId: replacement.id } })).toBe(0);
    }
    await scope(() => ingestMailboxMessages(account, [{ ...draft, body: 'Replaced private source' }], permissions));
    expect((await prisma.mailboxMessage.findUniqueOrThrow({ where: { accountId_providerMessageId: { accountId: account.id, providerMessageId: draft.id } } })).body).toBe(draft.body);
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
    // A fixed sender cannot override an unauthorized canonical CRM participant.
    await prisma.mailboxMessage.updateMany({ where: { accountId: account.id, providerMessageId: 'reassigned' }, data: { fromAddress: 'info@camxian.com' } });
    expect((await call('/threads/reassigned')).status).toBe(404);
    expect((await call('/threads/reassigned/deal', 'PATCH', { dealId: randomUUID() })).status).toBe(409);
  });
  it('denies direct thread reads and mutations across mailbox owners and tenants', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'owner-private')], permissions));
    const foreignTenant = await prisma.tenant.create({ data: { name: 'Other tenant', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
    const foreignUser = await prisma.user.create({ data: { tenantId: foreignTenant.id, email: 'foreign@camxian.com', firstName: 'Other', lastName: 'Tenant', role: 'Client Admin', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    const sameTenantUser = await prisma.user.findUniqueOrThrow({ where: { id: otherId } });
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    for (const user of [sameTenantUser, foreignUser]) {
      await prisma.emailAccount.upsert({ where: { tenantId_userId_provider: { tenantId: user.tenantId, userId: user.id, provider: 'gmail' } }, update: {}, create: { tenantId: user.tenantId, userId: user.id, email: user.email, accessToken: encryptToken('test-only'), tokenExpiresAt: new Date(Date.now() + 3600000), scopes: ['https://www.googleapis.com/auth/gmail.modify'] } });
      const authorization = `Bearer ${(await issueAuthSession(user)).token}`;
      expect((await call('/threads/owner-private', 'GET', undefined, authorization)).status).toBe(404);
      expect((await call('/threads/owner-private/read-state', 'PATCH', { isRead: true }, authorization)).status).toBe(404);
      expect((await call('/threads/owner-private/archive', 'POST', undefined, authorization)).status).toBe(404);
      expect((await call('/threads/owner-private/trash', 'POST', undefined, authorization)).status).toBe(404);
    }
    expect(provider).not.toHaveBeenCalled();
  });
  it('keeps four incoming/outgoing messages in one verified conversation across historical replay', async () => {
    const first = { ...mail(`Doris <${leadEmail}>`, 'thread-first'), threadId: 'thread-one', date: '2026-10-01T01:00:00Z' };
    await scope(() => ingestMailboxMessages(account, [first], permissions));
    expect((await call('/emails')).body.emails[0].messageCount).toBe(1);
    const messages = [first, { ...mail(account.email, 'thread-send', ['SENT']), threadId: 'thread-one', to: [leadEmail], date: '2026-10-01T02:00:00Z' },
      { ...first, id: 'thread-reply', date: '2026-10-01T03:00:00Z' },
      { ...mail(account.email, 'thread-latest', ['SENT']), threadId: 'thread-one', to: [leadEmail], snippet: 'Latest follow-up', date: '2026-10-01T04:00:00Z' }];
    for (let i = 0; i < 2; i++) await scope(() => ingestMailboxMessages(account, [...messages].reverse(), permissions));
    const result = await call('/emails');
    expect(result.body.emails).toHaveLength(1);
    expect(result.body.emails[0]).toMatchObject({ id: 'thread-latest', threadId: 'thread-one', messageCount: 4, participants: ['Doris'], snippet: 'Latest follow-up', date: '2026-10-01T04:00:00.000Z', isRead: false, body: '' });
    expect(result.body.unreadCount).toBe(1); expect((await call('/unread-count')).body).toMatchObject({ unreadCount: 1, unreadCountUnit: 'conversations' });
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id } })).toBe(4);
    const detail = await call('/threads/thread-one');
    expect(detail.body.emails.map((row: GmailEmail) => row.id)).toEqual(['thread-first', 'thread-send', 'thread-reply', 'thread-latest']);
    expect(detail.body.emails[0].body).toBe(first.body);
  });
  it('keeps different provider threads separate for the same correspondent', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'separate-a'), mail(leadEmail, 'separate-b'), mail(contactEmail, 'separate-c')], permissions));
    const rows = (await call('/emails')).body.emails;
    expect(rows).toHaveLength(3); expect(rows.every((row: GmailEmail) => row.messageCount === 1)).toBe(true);
    expect(new Set(rows.map((row: GmailEmail) => row.conversationId)).size).toBe(3);
    for (const row of rows) {
      const history = await call('/conversations/' + row.conversationId);
      expect(history.body.emails).toHaveLength(1); expect(history.body.emails[0].threadId).toBe(row.threadId);
    }
  });

  it('keeps the same display name at two exact addresses separate', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(`John <${leadEmail}>`, 'john-one'), mail(`John <${contactEmail}>`, 'john-two')], permissions));
    const rows = (await call('/emails?query=John')).body.emails;
    expect(rows).toHaveLength(2); expect(new Set(rows.map((row: GmailEmail) => row.conversationId)).size).toBe(2);
    expect(rows.every((row: GmailEmail) => row.participants?.includes('John'))).toBe(true);
  });
  it('preserves separate Welcome/Reset Gmail threads and original subjects', async () => {
    await scope(() => ingestMailboxMessages(account, [
      { ...mail('Camxian Technologies <INFO@CAMXIAN.COM>', 'welcome'), subject: 'Welcome to LeadCRM' },
      { ...mail('Camxian Technologies <info@camxian.com>', 'reset-one'), subject: 'Reset your LeadCRM password' },
      { ...mail('info@camxian.com', 'reset-two'), subject: 'Reset your LeadCRM password' },
    ], permissions));
    const rows = (await call('/emails')).body.emails;
    expect(rows).toHaveLength(3); expect((await call('/unread-count')).body.unreadCount).toBe(3);
    expect(rows.map((row: GmailEmail) => row.subject)).toContain('Welcome to LeadCRM');
    expect(rows.every((row: GmailEmail) => row.messageCount === 1)).toBe(true);
  });

  it('isolates multi-participant topics from private histories and retains later replies within the group', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'personal-a'), mail(contactEmail, 'personal-b'),
      { ...mail(leadEmail, 'group-first'), cc: [`Contact Two <${contactEmail}>`], threadId: 'group-topic' },
      { ...mail(account.email, 'group-reply', ['SENT']), to: [leadEmail], threadId: 'group-topic' },
      { ...mail(leadEmail, 'other-group'), cc: [contactEmail], threadId: 'other-group-topic' },
    ], permissions));
    const rows = (await call('/emails')).body.emails; expect(rows).toHaveLength(4);
    const group = rows.find((row: GmailEmail) => row.messageCount === 2);
    expect(group.conversationKind).toBe('group'); expect(group.correspondentAddresses.sort()).toEqual([leadEmail, contactEmail].sort());
    expect(group.participants).toContain('Contact Two');
    expect((await call('/conversations/' + group.conversationId)).body.emails.map((row: GmailEmail) => row.id).sort()).toEqual(['group-first', 'group-reply']);
  });
  it('does not invent a CRM identity for duplicated email records and revokes a correspondent after assignment loss', async () => {
    await prisma.lead.create({ data: { tenantId, assignedUserId: userId, email: leadEmail, firstName: 'Duplicate', lastName: 'Record', productInterest: [] } });
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'ambiguous-one'), { ...mail(leadEmail, 'ambiguous-two'), threadId: 'ambiguous-one' }], permissions));
    const row = (await call('/emails')).body.emails[0]; expect(row.messageCount).toBe(2); expect(row.leadId).toBeUndefined();
    const history = (await call('/conversations/' + row.conversationId)).body;
    expect(history.emails.every((message: GmailEmail) => !message.leadId && !message.contactId && !message.dealId)).toBe(true);
    expect(history.threads.every((topic: any) => !topic.canAssociateDeal)).toBe(true);
    await prisma.lead.updateMany({ where: { tenantId, assignedUserId: userId, email: { in: [leadEmail, ` Customer <${leadEmail.toUpperCase()}> `] } }, data: { assignedUserId: otherId } });
    expect((await call('/conversations/' + row.conversationId)).status).toBe(404);
    expect((await call('/emails')).body.emails).toHaveLength(0); expect((await call('/unread-count')).body.unreadCount).toBe(0);
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id } })).toBe(2);
  });
  it('opens the latest page and retrieves older messages without duplication', async () => {
    for (let i = 0; i < 55; i++) await persistHistorical({ ...mail(leadEmail, `history-${String(i).padStart(2, '0')}`), threadId: 'history-topic', date: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString() });
    const row = (await call('/emails?maxResults=1')).body.emails[0]; expect(row.messageCount).toBe(55);
    const first = (await call('/conversations/' + row.conversationId)).body;
    expect(first.emails).toHaveLength(50); expect(first.emails.at(-1).id).toBe('history-54'); expect(first.nextPageToken).toBeTruthy();
    const second = (await call('/conversations/' + row.conversationId + '?pageToken=' + encodeURIComponent(first.nextPageToken))).body;
    expect(second.emails).toHaveLength(5); expect(second.nextPageToken).toBeUndefined();
    const all = [...second.emails, ...first.emails];
    expect(new Set(all.map((message: GmailEmail) => message.id)).size).toBe(55);
    const dates = all.map((message: GmailEmail) => Date.parse(message.date)); expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });

  it('marks only the opened message read and counts one unread correspondent across original topics', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'unread-topic-a'), { ...mail(leadEmail, 'unread-topic-b'), threadId: 'unread-topic-a' }, { ...mail(leadEmail, 'unread-topic-c'), threadId: 'unread-topic-a' }], permissions));
    const row = (await call('/emails')).body.emails[0]; expect(row.messageCount).toBe(3);
    expect((await call('/unread-count')).body.unreadCount).toBe(1);
    const provider = vi.fn(async () => Response.json({})); vi.stubGlobal('fetch', provider);
    expect((await call('/messages/unread-topic-a/read-state', 'PATCH', { isRead: true })).body.count).toBe(1);
    const history = (await call('/conversations/' + row.conversationId)).body.emails;
    expect(history.filter((message: GmailEmail) => !message.isRead)).toHaveLength(2); expect(provider).toHaveBeenCalledOnce();
    expect((await call('/unread-count')).body.unreadCount).toBe(1);
  });
  it.each(['archive', 'trash'])('applies correspondent %s only to authorized messages across its topics', async action => {
    await persistHistorical(mail(leadEmail, 'group-action-one'));
    await persistHistorical({ ...mail(leadEmail, 'group-action-two'), threadId: 'group-action-one' });
    await persistHistorical({ ...mail('bank@example.com', 'group-action-private'), threadId: 'group-action-one' });
    await persistHistorical({ ...mail(account.email, 'group-action-draft', ['DRAFT']), to: [leadEmail], draftId: 'draft-action' });
    const row = (await call('/emails')).body.emails[0];
    const provider = vi.fn(async () => Response.json({})); vi.stubGlobal('fetch', provider);
    expect((await call('/' + action, 'POST', { conversationIds: [row.conversationId, 'c_' + '0'.repeat(32)] })).status).toBe(404);
    expect(provider).not.toHaveBeenCalled();
    expect((await call('/' + action, 'POST', { conversationIds: [row.conversationId] })).body.count).toBe(2);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(provider.mock.calls.every(([path]) => !String(path).includes('private') && !String(path).includes('draft'))).toBe(true);
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id } })).toBe(4);
  });
  it('preserves separate Deal groups inside one Gmail thread and leaves ambiguity unassigned', async () => {
    const { pipeline, initial } = await scope(() => salesTransaction(tx => salesPipeline(tx, tenantId)));
    const deals = [];
    for (const title of ['CCTV topic', 'Telephone topic']) deals.push(await prisma.deal.create({ data: { tenantId, pipelineId: pipeline.id, stageId: initial.id, title, value: 100,
      leadDeals: { create: { leadId, position: 0 } }, productInterests: [], tags: [] } }));
    await persistHistorical({ ...mail(leadEmail, 'deal-topic-a'), threadId: 'shared-deal-thread' }, { leadId, dealId: deals[0].id });
    await persistHistorical({ ...mail(leadEmail, 'deal-topic-b'), threadId: 'shared-deal-thread' }, { leadId, dealId: deals[1].id });
    await persistHistorical({ ...mail(leadEmail, 'deal-topic-unknown'), threadId: 'shared-deal-thread' }, { leadId });
    const rows = (await call('/emails')).body.emails; expect(rows).toHaveLength(3);
    for (const [index, deal] of deals.entries()) {
      const row = rows.find((row: GmailEmail) => row.dealId === deal.id);
      expect(row.dealTitle).toBe(deal.title); expect(row.messageCount).toBe(1);
      expect((await call('/conversations/' + row.conversationId)).body.emails.map((message: GmailEmail) => message.id)).toEqual([index ? 'deal-topic-b' : 'deal-topic-a']);
    }
    expect(rows.find((row: GmailEmail) => !row.dealId).messageCount).toBe(1);
    const provider = vi.fn(async () => Response.json({})); vi.stubGlobal('fetch', provider);
    expect((await call('/archive', 'POST', { conversationIds: [rows.find((row: GmailEmail) => row.dealId === deals[0].id).conversationId] })).body.count).toBe(1);
    expect(String(provider.mock.calls[0][0])).toContain('/messages/deal-topic-a/modify');
    expect((await prisma.mailboxMessage.findFirstOrThrow({ where: { accountId: account.id, providerMessageId: 'deal-topic-b' } })).labels).toContain('INBOX');
  });

  it('denies correspondent details and mutations to other mailboxes and tenants', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'correspondent-private')], permissions));
    const row = (await call('/emails')).body.emails[0];
    const user = await prisma.user.findUniqueOrThrow({ where: { id: otherId } });
    await prisma.emailAccount.upsert({ where: { tenantId_userId_provider: { tenantId, userId: otherId, provider: 'gmail' } }, update: {}, create: { tenantId, userId: otherId, email: user.email, accessToken: encryptToken('test-only'), tokenExpiresAt: new Date(Date.now() + 3600000), scopes: ['https://www.googleapis.com/auth/gmail.modify'] } });
    const authorization = `Bearer ${(await issueAuthSession(user)).token}`;
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    expect((await call('/conversations/' + row.conversationId, 'GET', undefined, authorization)).status).toBe(404);
    expect((await call('/trash', 'POST', { conversationIds: [row.conversationId] }, authorization)).status).toBe(404);
    expect((await call('/messages/correspondent-private/read-state', 'PATCH', { isRead: true }, authorization)).status).toBe(404);
    expect((await call('/conversations/' + row.conversationId + '/read-state', 'PATCH', { isRead: true }, authorization)).status).toBe(404);
    expect(provider).not.toHaveBeenCalled();
    const tenant = await prisma.tenant.create({ data: { name: 'Isolated mailbox', slug: randomUUID(), onboardingCompletedAt: new Date() } });
    const foreign = await prisma.user.create({ data: { tenantId: tenant.id, email: `foreign-${randomUUID()}@camxian.com`, firstName: 'Other', lastName: 'Tenant', role: 'Client Admin', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    await prisma.emailAccount.create({ data: { tenantId: tenant.id, userId: foreign.id, email: foreign.email, accessToken: encryptToken('test-only'), tokenExpiresAt: new Date(Date.now() + 3600000), scopes: ['https://www.googleapis.com/auth/gmail.modify'] } });
    expect((await call('/conversations/' + row.conversationId, 'GET', undefined, `Bearer ${(await issueAuthSession(foreign)).token}`)).status).toBe(404);
    expect((await call('/conversations/' + row.conversationId + '/read-state', 'PATCH', { isRead: true }, `Bearer ${(await issueAuthSession(foreign)).token}`)).status).toBe(404);
    expect(provider).not.toHaveBeenCalled();
  });
  it('stops a correspondent bulk action if assignment is revoked between provider writes', async () => {
    await persistHistorical(mail(leadEmail, 'mid-action-a')); await persistHistorical({ ...mail(leadEmail, 'mid-action-b'), threadId: 'mid-action-a' });
    const row = (await call('/emails')).body.emails[0];
    // This models a separate administrator's committed write, not the Gmail
    // request actor performing a CRM reassignment from inside the provider mock.
    const provider = vi.fn(async () => { await crmActor.exit(async () => await prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: otherId } })); return Response.json({}); });
    vi.stubGlobal('fetch', provider);
    const partial = await call('/trash', 'POST', { conversationIds: [row.conversationId] });
    expect(partial.status).toBe(200);
    expect(partial.body).toMatchObject({ success: false, count: 1, completedMessageIds: ['mid-action-a'], completedConversationIds: [] });
    expect(partial.body.error).toContain('Mailbox access or Deal association changed');
    expect(provider).toHaveBeenCalledOnce();
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id, labels: { has: 'TRASH' } } })).toBe(1);
    expect((await prisma.emailAccount.findUniqueOrThrow({ where: { id: account.id } })).mailboxVersion).toBeGreaterThan(account.mailboxVersion);
  });
  it('trashes approved fixed-sender replies before removing their authorizing original messages', async () => {
    await scope(() => ingestMailboxMessages(account, [mail('info@camxian.com', 'fixed-original')], permissions));
    await scope(() => ingestMailboxMessages(account, [{ ...mail(account.email, 'fixed-reply', ['SENT']), to: ['info@camxian.com'], threadId: 'fixed-original' }], permissions));
    const row = (await call('/emails')).body.emails[0]; expect(row.messageCount).toBe(2);
    const provider = vi.fn(async () => Response.json({})); vi.stubGlobal('fetch', provider);
    expect((await call('/trash', 'POST', { conversationIds: [row.conversationId] })).body.count).toBe(2);
    expect(provider.mock.calls[0][0]).toContain('/messages/fixed-reply/trash');
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id, labels: { has: 'TRASH' } } })).toBe(2);
  });
  it('retains original RFC reply headers through authorized ingestion and replay', async () => {
    const email = parseGmailMessage(apiMail(mail(leadEmail, 'reply-header'), [
      { name: 'Message-ID', value: '<current@example.test>' }, { name: 'In-Reply-To', value: '<parent@example.test>' }, { name: 'References', value: '<first@example.test> <parent@example.test>' },
    ]));
    for (let i = 0; i < 2; i++) await scope(() => ingestMailboxMessages(account, [email], permissions));
    const row = (await call('/emails')).body.emails[0];
    expect((await call('/conversations/' + row.conversationId)).body.emails[0]).toMatchObject({ rfcMessageId: '<current@example.test>', rfcInReplyTo: '<parent@example.test>', rfcReferences: ['<first@example.test>', '<parent@example.test>'] });
    expect(parseGmailMessage(apiMail(email, [{ name: 'In-Reply-To', value: '<parent@example.test>\r\nBcc: bank@example.test' }])).rfcInReplyTo).toBeNull();
  });
  it.each([false, true])('replies to an older selected topic from consolidated history (Reply All=%s)', async all => {
    const source = { ...mail(leadEmail, 'selected-old'), date: '2026-10-01T01:00:00Z', subject: 'Older topic', rfcMessageId: '<older@example.test>' };
    await scope(() => ingestMailboxMessages(account, [source, { ...mail(leadEmail, 'newer-topic'), subject: 'Newer topic' }], permissions));
    const row = (await call('/emails')).body.emails.find((row: GmailEmail) => row.threadId === source.threadId); expect(row.messageCount).toBe(1);
    const selected = (await call('/conversations/' + row.conversationId)).body.emails.find((message: GmailEmail) => message.id === source.id);
    let write: any;
    const to = all ? [leadEmail, contactEmail] : [leadEmail];
    const sent = { ...mail(account.email, 'older-send', ['SENT']), threadId: source.threadId, to, subject: 'Re: Older topic' };
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (String(input).includes('/messages/send')) { write = JSON.parse(String(init?.body)); return Response.json({ id: sent.id, threadId: sent.threadId }); }
      return Response.json(apiMail(sent));
    }));
    expect((await call('/send', 'POST', { to, subject: sent.subject, body: '<p>Reply to older topic</p>', replyToMessageId: selected.id })).status).toBe(200);
    expect(write.threadId).toBe(source.threadId); expect(write.threadId).not.toBe(row.conversationId);
    expect(Buffer.from(write.raw, 'base64url').toString()).toContain('In-Reply-To: <older@example.test>');
    expect((await call('/threads/' + source.threadId)).body.emails).toHaveLength(2);
  });
  it('searches any eligible message and filters whole conversations using latest activity', async () => {
    await persistHistorical({ ...mail(leadEmail, 'search-old'), threadId: 'search-thread', body: 'Historical rare-needle text', date: '2026-10-01T01:00:00Z' });
    await persistHistorical({ ...mail(account.email, 'search-new', ['SENT']), threadId: 'search-thread', to: [leadEmail], snippet: 'Latest response', date: '2026-10-03T01:00:00Z' });
    await persistHistorical({ ...mail(contactEmail, 'search-other', ['INBOX']), date: '2026-10-02T01:00:00Z' });
    for (const filter of ['all', 'unread', 'sent']) {
      const rows = (await call(`/emails?filter=${filter}&query=rare-needle`)).body.emails;
      expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ id: 'search-new', messageCount: 2, isRead: false, snippet: 'Latest response' });
    }
    expect((await call('/emails?sort=oldest')).body.emails.map((row: GmailEmail) => row.threadId)).toEqual(['search-other', 'search-thread']);
    expect((await call('/emails?sort=newest')).body.emails.map((row: GmailEmail) => row.threadId)).toEqual(['search-thread', 'search-other']);
    expect((await call('/emails?sort=unread')).body.emails[0].threadId).toBe('search-thread');
    expect((await call('/emails?query=' + encodeURIComponent(account.email))).body.emails).toHaveLength(2);
  });
  it('counts unread incoming conversations and excludes outgoing UNREAD labels', async () => {
    await persistHistorical({ ...mail(account.email, 'unread-sent', ['SENT', 'UNREAD']), to: [leadEmail] });
    await persistHistorical(mail(leadEmail, 'unread-incoming'));
    await persistHistorical({ ...mail(leadEmail, 'unread-second'), threadId: 'unread-incoming' });
    expect((await call('/unread-count')).body.unreadCount).toBe(1);
    expect((await call('/emails?filter=unread')).body.emails).toHaveLength(1);
  });
  it('paginates correspondent groups with deterministic ties and invalidates cursors after mailbox changes', async () => {
    for (let i = 0; i < 5; i++) {
      const email = i === 0 ? leadEmail : `page-${i}@example.test`;
      if (i) await prisma.lead.create({ data: { tenantId, assignedUserId: userId, email, firstName: 'Page', lastName: String(i), productInterest: [] } });
      await persistHistorical({ ...mail(email, `page-${i}`), date: '2026-10-01T01:00:00Z' });
    }
    for (let i = 0; i < 10; i++) await persistHistorical({ ...mail(leadEmail, `page-reply-${i}`), threadId: 'page-0', date: '2026-10-01T01:00:00Z' });
    const first = (await call('/emails?maxResults=2')).body;
    expect(first.emails).toHaveLength(2);
    const second = (await call('/emails?maxResults=2&pageToken=' + encodeURIComponent(first.nextPageToken))).body;
    expect(second.emails).toHaveLength(2);
    const last = (await call('/emails?maxResults=2&pageToken=' + encodeURIComponent(second.nextPageToken))).body;
    expect(last.emails).toHaveLength(1); expect(last.nextPageToken).toBeUndefined();
    const groups = [...first.emails, ...second.emails, ...last.emails];
    expect(new Set(groups.map((row: GmailEmail) => row.conversationId)).size).toBe(5);
    expect(groups.find((row: GmailEmail) => row.correspondentAddresses?.includes(leadEmail)).messageCount).toBe(11);
    expect((await call('/emails?sort=oldest&pageToken=' + encodeURIComponent(first.nextPageToken))).status).toBe(400);
    expect((await call('/emails?pageToken=invalid')).status).toBe(400);
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'page-arrival')], permissions));
    await prisma.emailAccount.update({ where: { id: account.id }, data: { mailboxVersion: { increment: 1 } } });
    expect((await call('/emails?maxResults=2&pageToken=' + encodeURIComponent(first.nextPageToken))).status).toBe(400);
  });
  it('does not let a matching thread ID expose unauthorized participants, previews, search or counts', async () => {
    await persistHistorical(mail(leadEmail, 'shared-thread'));
    await persistHistorical({ ...mail('bank@example.com', 'private-reply'), threadId: 'shared-thread', subject: 'Secret matching subject', body: 'Secret matching body', date: new Date().toISOString() });
    const row = (await call('/emails')).body.emails[0];
    expect(row).toMatchObject({ id: 'shared-thread', messageCount: 1 }); expect(row.participants).not.toContain('bank');
    expect((await call('/emails?query=Secret')).body.emails).toHaveLength(0);
    expect((await call('/threads/shared-thread')).body.emails).toHaveLength(1);
    expect((await call('/unread-count')).body.unreadCount).toBe(1);
  });
  it('bulk conversation actions cover all applicable messages and validate every conversation before writing', async () => {
    await persistHistorical(mail(leadEmail, 'bulk-thread'));
    await persistHistorical({ ...mail(leadEmail, 'bulk-reply'), threadId: 'bulk-thread' });
    await persistHistorical({ ...mail(account.email, 'bulk-draft', ['DRAFT']), threadId: 'bulk-thread', to: [leadEmail], draftId: 'bulk-draft-id' });
    await persistHistorical({ ...mail('bank@example.com', 'bulk-private'), threadId: 'bulk-thread' });
    const provider = vi.fn(async () => Response.json({})); vi.stubGlobal('fetch', provider);
    expect((await call('/archive', 'POST', { threadIds: ['bulk-thread', 'unknown'] })).status).toBe(404); expect(provider).not.toHaveBeenCalled();
    expect((await call('/trash', 'POST', { threadIds: ['bulk-thread'] })).body.count).toBe(2);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(provider.mock.calls.every(([path]) => !String(path).includes('bulk-draft') && !String(path).includes('bulk-private'))).toBe(true);
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id } })).toBe(4);
  });
  it.each([false, true])('keeps provider-confirmed Reply/Reply All delivery in the same conversation (all=%s)', async all => {
    const incoming = { ...mail(leadEmail, 'send-source'), rfcMessageId: '<source@example.test>' };
    await scope(() => ingestMailboxMessages(account, [incoming], permissions));
    const recipients = all ? [leadEmail, contactEmail] : [leadEmail];
    const sent = { ...mail(account.email, 'confirmed-reply', ['SENT']), threadId: 'send-source', to: recipients };
    const writes: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (String(input).includes('/messages/send')) { writes.push(JSON.parse(String(init?.body))); return Response.json({ id: sent.id, threadId: sent.threadId }); }
      return Response.json(apiMail(sent));
    }));
    expect((await call('/send', 'POST', { to: recipients, subject: 'Re: ' + incoming.subject, body: '<p>Reply</p>', replyToMessageId: incoming.id, requestId: randomUUID() })).status).toBe(200);
    expect(writes[0].threadId).toBe(incoming.threadId);
    const raw = Buffer.from(writes[0].raw, 'base64url').toString();
    expect(raw).toContain('In-Reply-To: <source@example.test>'); expect(raw).toContain('References: <source@example.test>');
    const rows = (await call('/emails')).body.emails; expect(rows).toHaveLength(1); expect(rows[0].messageCount).toBe(2);
  });
  it('filters Sent and Drafts inside CRM scope and sorts across persisted pages', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'received'), { ...mail(account.email, 'sent', ['SENT']), threadId: 'received', to: [leadEmail] }, { ...mail(account.email, 'draft', ['DRAFT']), draftId: 'draft-id', to: [contactEmail] }, { ...mail(account.email, 'personal', ['SENT']), to: ['personal@example.test'] }], permissions));
    expect((await call('/emails?filter=sent')).body.emails.map((row: GmailEmail) => row.id)).toEqual(['sent']);
    expect((await call('/emails?filter=drafts')).body.emails[0].draftId).toBe('draft-id');
    expect((await call('/emails?filter=unread')).body.emails).toHaveLength(1);
    expect((await call('/emails?filter=unread')).body.emails[0].messageCount).toBe(2);
    const first = await call('/emails?maxResults=1&sort=oldest');
    expect(first.body.nextPageToken).toBeUndefined(); expect(first.body.emails[0].messageCount).toBe(2);
  });
  it.each(['leads', 'contacts'] as const)('lists sent and received %s attachments with uploads and stable original identities', async module => {
    const contact = await prisma.contact.findFirstOrThrow({ where: { tenantId, email: contactEmail } });
    const id = module === 'leads' ? leadId : contact.id, address = module === 'leads' ? leadEmail : contactEmail;
    const attachment = { id: 'quotation-original', filename: 'QT-2026-1275D500.pdf', mimeType: 'application/pdf', size: 20173 };
    const incoming = { ...mail(address, 'record-received'), attachments: [attachment, attachment, { ...attachment, id: 'another-original' }] };
    const outgoing = { ...mail(account.email, 'record-sent', ['SENT']), to: [address], attachments: [attachment] };
    await scope(() => ingestMailboxMessages(account, [incoming, outgoing], permissions));
    await prisma.recordFile.create({ data: { tenantId, [module === 'leads' ? 'leadId' : 'contactId']: id, uploadedById: userId,
      name: 'manual.pdf', type: 'application/pdf', size: 10, objectKey: 'untouched-test-object' } });
    const activities = await prisma.activity.findMany({ where: { tenantId, mailboxMessage: { accountId: account.id } }, orderBy: { id: 'asc' } });
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    const first = await recordFiles(module, id);
    expect(first.status).toBe(200); expect(first.body.data.attachments).toHaveLength(3);
    expect(first.body.data.attachments.map((file: any) => file.messageId).sort()).toEqual(['record-received', 'record-received', 'record-sent']);
    expect(first.body.data.attachments[0]).toMatchObject({ name: attachment.filename, size: 20173, accountId: account.id, type: 'application/pdf' });
    expect((await recordFiles(module, id, 'files')).body.data.map((file: any) => file.name)).toEqual(['manual.pdf']);
    await scope(() => ingestMailboxMessages(account, [incoming, outgoing], permissions));
    expect((await recordFiles(module, id)).body.data).toEqual(first.body.data);
    expect(await prisma.activity.findMany({ where: { tenantId, mailboxMessage: { accountId: account.id } }, orderBy: { id: 'asc' } })).toEqual(activities);
    expect(provider).not.toHaveBeenCalled();
  });

  it('includes converted Lead history once in Contact Files without rewriting messages or Activities', async () => {
    const attachment = { id: 'converted-part', filename: 'historical.pdf', mimeType: 'application/pdf' };
    await scope(() => ingestMailboxMessages(account, [{ ...mail(leadEmail, 'conversion-file'), attachments: [attachment] }], permissions));
    const contact = await prisma.contact.create({ data: { tenantId, assignedUserId: userId, email: leadEmail, firstName: 'Converted', lastName: 'Customer', productInterests: [] } });
    await prisma.lead.update({ where: { id: leadId }, data: { contactId: contact.id, convertedAt: new Date() } });
    await prisma.mailboxMessage.updateMany({ where: { accountId: account.id }, data: { contactId: contact.id } });
    const messages = await prisma.mailboxMessage.findMany({ where: { accountId: account.id } });
    const response = await recordFiles('contacts', contact.id);
    expect(response.status).toBe(200); expect(response.body.data.attachments).toHaveLength(1);
    expect(response.body.data.attachments[0]).toMatchObject({ messageId: 'conversion-file', attachmentId: attachment.id });
    expect(await prisma.mailboxMessage.findMany({ where: { accountId: account.id } })).toEqual(messages);
  });

  it('isolates Deal Files by saved message/thread associations and rejects unrelated or obsolete relationships', async () => {
    const { pipeline, initial } = await scope(() => salesTransaction(tx => salesPipeline(tx, tenantId)));
    const deals = [];
    for (const title of ['CCTV Installation', 'Network Infrastructure']) deals.push(await prisma.deal.create({ data: { tenantId, pipelineId: pipeline.id, stageId: initial.id, title, value: 100,
      leadDeals: { create: { leadId, position: 0 } }, productInterests: [], tags: [] } }));
    await prisma.recordFile.create({ data: { tenantId, dealId: deals[0].id, uploadedById: userId, name: 'existing-deal-upload.pdf', type: 'application/pdf', size: 10, objectKey: 'untouched-deal-object' } });
    const attachments = [{ id: 'quotation', filename: 'QT-2026-1275D500.pdf', mimeType: 'application/pdf', size: 5 }];
    await persistHistorical({ ...mail(leadEmail, 'quotation-a'), attachments }, { leadId, dealId: deals[0].id, attachments });
    await persistHistorical({ ...mail(leadEmail, 'unlinked-customer'), attachments }, { leadId, attachments });
    await persistHistorical({ ...mail(leadEmail, 'thread-b'), attachments }, { leadId, attachments });
    await prisma.mailboxThreadAssociation.create({ data: { tenantId, accountId: account.id, threadId: 'thread-b', dealId: deals[1].id } });
    expect((await recordFiles('deals', deals[0].id)).body.data.attachments.map((file: any) => file.messageId)).toEqual(['quotation-a']);
    expect((await recordFiles('deals', deals[0].id, 'files')).body.data.map((file: any) => file.name)).toEqual(['existing-deal-upload.pdf']);
    expect((await recordFiles('deals', deals[1].id)).body.data.attachments.map((file: any) => file.messageId)).toEqual(['thread-b']);
    const wrong = new URLSearchParams({ recordModule: 'deals', recordId: deals[1].id, accountId: account.id });
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    expect((await call('/messages/quotation-a/attachments/quotation?' + wrong)).status).toBe(404);
    expect(provider).not.toHaveBeenCalled();
    // A thread association cannot override a validated saved message link.
    await prisma.mailboxThreadAssociation.create({ data: { tenantId, accountId: account.id, threadId: 'quotation-a', dealId: deals[1].id } });
    expect((await recordFiles('deals', deals[0].id)).body.data.attachments.map((file: any) => file.messageId)).toEqual(['quotation-a']);
    await prisma.leadDeal.deleteMany({ where: { tenantId, dealId: deals[1].id } });
    expect((await recordFiles('deals', deals[1].id)).body.data.attachments).toEqual([]);
  });

  it.each([false, true])('recovers historical metadata only for linked messages, excludes inline images and leaves Activity unchanged (incomplete=%s)', async incomplete => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'missing-file-metadata')], permissions));
    if (incomplete) await prisma.mailboxMessage.updateMany({ where: { accountId: account.id }, data: { attachments: [{ id: 'part:2', filename: 'historical.pdf', mimeType: 'application/pdf' }] } });
    const before = await prisma.activity.findMany({ where: { tenantId, mailboxMessage: { accountId: account.id } } });
    const source = apiMail(mail(leadEmail, 'missing-file-metadata'));
    Object.assign(source.payload, { mimeType: 'multipart/mixed', parts: [
      { mimeType: 'text/html', body: { data: Buffer.from('<p>Original</p><img src="cid:logo">').toString('base64url') } },
      { filename: 'quotation.pdf', mimeType: 'application/pdf', body: { attachmentId: 'historical-pdf', size: 20 } },
      { filename: 'logo.png', mimeType: 'image/png', headers: [{ name: 'Content-ID', value: '<logo>' }], body: { attachmentId: 'inline-logo', size: 10 } },
    ] });
    const provider = vi.fn(async (_input: string | URL) => Response.json(source)); vi.stubGlobal('fetch', provider);
    const response = await recordFiles('leads', leadId);
    expect(response.status).toBe(200); expect(response.body.data.attachments.map((file: any) => file.name)).toEqual(['quotation.pdf']);
    expect(provider).toHaveBeenCalledOnce(); expect(String(provider.mock.calls[0][0])).toContain('messages/missing-file-metadata?format=full');
    expect(await prisma.activity.findMany({ where: { tenantId, mailboxMessage: { accountId: account.id } } })).toEqual(before);
    expect((await recordFiles('leads', leadId)).body.data).toEqual(response.body.data); expect(provider).toHaveBeenCalledOnce();
  });

  it('returns bounded pages without duplicates and recovers attachment-free messages without fabricating files', async () => {
    const attachment = { id: 'same-part', filename: 'same-name.pdf', mimeType: 'application/pdf' };
    for (let index = 0; index < 21; index++) await persistHistorical(mail(leadEmail, 'page-file-' + index), { leadId, attachments: [attachment] });
    const first = await recordFiles('leads', leadId), next = await recordFiles('leads', leadId, 'email-attachments?cursor=' + encodeURIComponent(first.body.data.nextCursor));
    expect(first.body.data.attachments).toHaveLength(20); expect(next.body.data.attachments).toHaveLength(1);
    expect(new Set([...first.body.data.attachments, ...next.body.data.attachments].map(file => file.id)).size).toBe(21);
    await prisma.mailboxMessage.deleteMany({ where: { accountId: account.id } });
    await persistHistorical(mail(leadEmail, 'without-files'), { leadId });
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(apiMail(mail(leadEmail, 'without-files')))));
    expect((await recordFiles('leads', leadId)).body.data.attachments).toEqual([]);
  });

  it('reauthorizes contextual bytes after provider I/O, keeps exact bytes and rejects disconnected/stale accounts', async () => {
    const pdf = Buffer.from('%PDF-original quotation'), attachment = { id: 'context-pdf', filename: 'quotation.pdf', mimeType: 'application/pdf', size: pdf.length };
    await persistHistorical(mail(leadEmail, 'context-message'), { leadId, attachments: [attachment] });
    const context = new URLSearchParams({ recordModule: 'leads', recordId: leadId, accountId: account.id });
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: pdf.toString('base64url'), size: pdf.length })));
    const response = await realFetch(base + '/messages/context-message/attachments/context-pdf?' + context, { headers: { Authorization: `Bearer ${token}` } });
    expect(response.status).toBe(200); expect(Buffer.from(await response.arrayBuffer())).toEqual(pdf);
    expect(response.headers.get('cache-control')).toContain('no-store'); expect(response.headers.get('content-disposition')).toContain('quotation.pdf');
    const staleContext = new URLSearchParams({ recordModule: 'leads', recordId: leadId, accountId: randomUUID() });
    expect((await call('/messages/context-message/attachments/context-pdf?' + staleContext)).status).toBe(409);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { message: 'Revoked grant' } }, { status: 401 })));
    expect((await call('/messages/context-message/attachments/context-pdf?' + context)).status).toBe(401);
    vi.stubGlobal('fetch', vi.fn(async () => {
      await prisma.mailboxMessage.updateMany({ where: { accountId: account.id }, data: { leadId: null } });
      return Response.json({ data: pdf.toString('base64url'), size: pdf.length });
    }));
    expect((await call('/messages/context-message/attachments/context-pdf?' + context)).status).toBe(404);
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    await prisma.emailAccount.update({ where: { id: account.id }, data: { isActive: false } });
    expect((await recordFiles('leads', leadId)).status).toBe(409);
    expect((await call('/messages/context-message/attachments/context-pdf?' + context)).status).toBe(409);
    expect(provider).not.toHaveBeenCalled();
  });

  it('hides another user’s attachment metadata and rejects missing CRM permission and cross-tenant records', async () => {
    await persistHistorical(mail(leadEmail, 'private-record-file'), { leadId, attachments: [{ id: 'private', filename: 'private.pdf', mimeType: 'application/pdf' }] });
    const other = await prisma.user.findUniqueOrThrow({ where: { id: otherId } });
    await prisma.emailAccount.upsert({ where: { tenantId_userId_provider: { tenantId, userId: other.id, provider: 'gmail' } }, create: { tenantId, userId: other.id, email: other.email, accessToken: encryptToken('other-token'), tokenExpiresAt: new Date(Date.now() + 3600000) }, update: { isActive: true } });
    const otherToken = (await issueAuthSession(other)).token, provider = vi.fn(); vi.stubGlobal('fetch', provider);
    const list = await recordFiles('leads', leadId, 'email-attachments', otherToken);
    expect(list.status).toBe(200); expect(list.body.data.attachments).toEqual([]);
    const context = new URLSearchParams({ recordModule: 'leads', recordId: leadId });
    expect((await call('/messages/private-record-file/attachments/private?' + context, 'GET', undefined, 'Bearer ' + otherToken)).status).toBe(404);
    const foreign = await prisma.tenant.create({ data: { name: 'Foreign files', slug: randomUUID() } });
    const foreignLead = await prisma.lead.create({ data: { tenantId: foreign.id, firstName: 'Foreign', lastName: 'Customer', productInterest: [] } });
    expect((await recordFiles('leads', foreignLead.id)).status).toBe(404);
    await prisma.user.update({ where: { id: userId }, data: { role: 'Staff' } });
    expect((await recordFiles('leads', leadId)).status).toBe(403);
    expect(provider).not.toHaveBeenCalled();
  });

  it('preserves nested attachment metadata through replay and authorizes downloads by message and mailbox', async () => {
    const payload = apiMail(mail(leadEmail, 'file-source'));
    const attachmentId = 'provider-attachment';
    Object.assign(payload.payload, { mimeType: 'multipart/mixed', parts: [
      { mimeType: 'text/html', body: payload.payload.body },
      { mimeType: 'multipart/mixed', parts: [{ filename: 'proposal.pdf', mimeType: 'application/pdf', body: { attachmentId, size: 4 } }] },
    ] });
    const parsed = parseGmailMessage(payload);
    await scope(() => ingestMailboxMessages(account, [parsed], permissions));
    await scope(() => ingestMailboxMessages(account, [parsed], permissions));
    const metadata = apiMail(mail(leadEmail, 'file-source'));
    delete (metadata.payload as { body?: unknown }).body;
    await scope(() => ingestMailboxMessages(account, [parseGmailMessage(metadata, 'metadata')], permissions));
    const detail = (await call('/threads/file-source')).body.emails[0];
    expect(detail.attachments).toEqual([{ id: attachmentId, filename: 'proposal.pdf', mimeType: 'application/pdf', size: 4 }]);
    expect(detail.body).toBe(parsed.body); expect(await prisma.mailboxMessage.count({ where: { accountId: account.id } })).toBe(1);
    const provider = vi.fn(async () => Response.json({ data: Buffer.from([0, 1, 2, 255]).toString('base64url'), size: 4 })); vi.stubGlobal('fetch', provider);
    const download = await realFetch(base + '/messages/file-source/attachments/' + attachmentId, { headers: { Authorization: `Bearer ${token}` } });
    expect(download.status).toBe(200); expect(download.headers.get('cache-control')).toBe('no-store');
    expect(download.headers.get('content-disposition')).toContain('proposal.pdf'); expect(download.headers.get('content-type')).toContain('application/octet-stream');
    expect([...new Uint8Array(await download.arrayBuffer())]).toEqual([0, 1, 2, 255]); expect(provider).toHaveBeenCalledOnce();
    expect((await call('/messages/file-source/attachments/unknown')).status).toBe(404); expect(provider).toHaveBeenCalledOnce();
    await prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: otherId } });
    expect((await call('/messages/file-source/attachments/' + attachmentId)).status).toBe(404); expect(provider).toHaveBeenCalledOnce();
  });
  it('rejects attachment access after reassignment during a provider read', async () => {
    await scope(() => ingestMailboxMessages(account, [{ ...mail(leadEmail, 'file-race'), attachments: [{ id: 'file-id', filename: 'private.pdf', mimeType: 'application/pdf', size: 1 }] }], permissions));
    vi.stubGlobal('fetch', vi.fn(async () => {
      await crmActor.exit(async () => await prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: otherId } }));
      return Response.json({ data: 'YQ', size: 1 });
    }));
    expect((await call('/messages/file-race/attachments/file-id')).status).toBe(404);
  });
  it('recovers original HTML and quotation attachments without replaying activities, and serves original preview bytes', async () => {
    const original = mail(leadEmail, 'original-content');
    await scope(() => ingestMailboxMessages(account, [original], permissions));
    await prisma.emailAccount.update({ where: { id: account.id }, data: { accessToken: encryptToken('original-mailbox-token') } });
    const payload = apiMail({ ...original, body: '<h1 style="color:blue">Original quotation</h1>' });
    const pdf = Buffer.from('%PDF-1.7\nOriginal quotation bytes\n%%EOF');
    Object.assign(payload.payload, { mimeType: 'multipart/mixed', parts: [{ mimeType: 'text/html', body: payload.payload.body }, { filename: 'QT-2026-00124.pdf', mimeType: 'application/pdf', body: { attachmentId: 'original-pdf', size: pdf.length } }, { partId: '2', filename: 'notes.txt', mimeType: 'text/plain', body: { data: Buffer.from('Exact notes').toString('base64url'), size: 11 } }] });
    const provider = vi.fn(async (input: string | URL, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer original-mailbox-token');
      return String(input).includes('/attachments/') ? Response.json({ data: pdf.toString('base64url'), size: pdf.length }) : Response.json(payload);
    }); vi.stubGlobal('fetch', provider);
    const activities = await prisma.activity.count({ where: { tenantId, mailboxMessage: { accountId: account.id } } });
    const recovered = await call('/messages/original-content/content');
    expect(recovered.status).toBe(200); expect(recovered.body.body).toContain('<h1 style="color:blue">');
    expect(recovered.body.attachments.map((file: { filename: string }) => file.filename)).toEqual(['QT-2026-00124.pdf', 'notes.txt']);
    expect(await prisma.activity.count({ where: { tenantId, mailboxMessage: { accountId: account.id } } })).toBe(activities);
    const response = await realFetch(base + '/messages/original-content/attachments/original-pdf', { headers: { Authorization: `Bearer ${token}` } });
    expect(response.headers.get('content-type')).toContain('application/pdf'); expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(pdf);
    const notes = await realFetch(base + '/messages/original-content/attachments/part%3A2', { headers: { Authorization: `Bearer ${token}` } });
    expect(await notes.text()).toBe('Exact notes'); expect(notes.headers.get('content-type')).toContain('application/octet-stream');
  });
  it('denies content and attachments across users and tenants before any provider read', async () => {
    await scope(() => ingestMailboxMessages(account, [{ ...mail(leadEmail, 'private-content'), attachments: [{ id: 'private-file', filename: 'private.pdf', mimeType: 'application/pdf' }] }], permissions));
    const other = await prisma.user.findUniqueOrThrow({ where: { id: otherId } });
    await prisma.emailAccount.upsert({ where: { tenantId_userId_provider: { tenantId, userId: other.id, provider: 'gmail' } }, create: { tenantId, userId: other.id, email: other.email, accessToken: encryptToken('other-token'), tokenExpiresAt: new Date(Date.now() + 3600000) }, update: { isActive: true } });
    const foreignTenant = await prisma.tenant.create({ data: { name: 'Foreign mailbox', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
    const foreign = await prisma.user.create({ data: { tenantId: foreignTenant.id, email: `${randomUUID()}@camxian.com`, firstName: 'Foreign', lastName: 'Agent', role: 'Client Admin', mustChangePassword: false, onboardingCompletedAt: new Date() } });
    await prisma.emailAccount.create({ data: { tenantId: foreignTenant.id, userId: foreign.id, email: foreign.email, accessToken: encryptToken('foreign-token'), tokenExpiresAt: new Date(Date.now() + 3600000) } });
    const otherToken = (await issueAuthSession(other)).token, foreignToken = (await issueAuthSession(foreign)).token;
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    for (const auth of [otherToken, foreignToken]) {
      expect((await call('/messages/private-content/content', 'GET', undefined, `Bearer ${auth}`)).status).toBe(404);
      expect((await call('/messages/private-content/attachments/private-file', 'GET', undefined, `Bearer ${auth}`)).status).toBe(404);
    }
    expect(provider).not.toHaveBeenCalled();
  });
  it('does not persist recovered content after assignment is revoked during the Gmail read', async () => {
    const original = mail(leadEmail, 'content-race');
    await scope(() => ingestMailboxMessages(account, [original], permissions));
    vi.stubGlobal('fetch', vi.fn(async () => {
      await crmActor.exit(async () => await prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: otherId } }));
      return Response.json(apiMail({ ...original, body: '<p>Revoked body</p>' }));
    }));
    expect((await call('/messages/content-race/content')).status).toBe(404);
    expect((await prisma.mailboxMessage.findUniqueOrThrow({ where: { accountId_providerMessageId: { accountId: account.id, providerMessageId: original.id } } })).body).toBe(original.body);
  });
  it('retains the References chain in authorized replies without unsafe header values', async () => {
    const incoming = { ...mail(leadEmail, 'references-source'), rfcMessageId: '<parent@example.test>', rfcReferences: ['<original@example.test>', '<previous@example.test>'] };
    await scope(() => ingestMailboxMessages(account, [incoming], permissions));
    const sent = { ...mail(account.email, 'references-sent', ['SENT']), threadId: incoming.threadId, to: [leadEmail] };
    let raw = '';
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (String(input).includes('/messages/send')) { raw = Buffer.from(JSON.parse(String(init?.body)).raw, 'base64url').toString(); return Response.json({ id: sent.id, threadId: sent.threadId }); }
      return Response.json(apiMail(sent));
    }));
    expect((await call('/send', 'POST', { to: leadEmail, subject: 'Re: ' + incoming.subject, body: '<p>Follow-up</p>', replyToMessageId: incoming.id })).status).toBe(200);
    expect(raw).toContain('References: <original@example.test>\r\n <previous@example.test>\r\n <parent@example.test>');
    expect(raw).toContain('In-Reply-To: <parent@example.test>');
    expect(parseGmailMessage(apiMail(incoming, [{ name: 'References', value: '<safe@example.test>\r\nBcc: bank@example.test' }])).rfcReferences).toEqual([]);
  });
  it('creates a separate row for a new Compose thread without altering older conversations', async () => {
    const incoming = { ...mail(leadEmail, 'compose-existing'), rfcMessageId: '<existing@example.test>' };
    await scope(() => ingestMailboxMessages(account, [incoming], permissions));
    let write: any;
    const sent = { ...mail(account.email, 'compose-new', ['SENT']), threadId: 'compose-new-thread', to: [leadEmail] };
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (String(input).includes('/messages/send')) { write = JSON.parse(String(init?.body)); return Response.json({ id: sent.id, threadId: sent.threadId }); }
      return Response.json(apiMail(sent));
    }));
    expect((await call('/send', 'POST', { to: leadEmail, subject: incoming.subject, body: '<p>New conversation</p>' })).status).toBe(200);
    expect(write.threadId).toBeUndefined(); expect(Buffer.from(write.raw, 'base64url').toString()).not.toContain('In-Reply-To:');
    const rows = (await call('/emails')).body.emails;
    expect(rows).toHaveLength(2); expect(rows.every((row: GmailEmail) => row.messageCount === 1)).toBe(true);
  });

  it('updates and sends saved reply drafts with their existing thread, and deletes only authorized drafts', async () => {
    // Provider threading requires the existing subject as well as reply headers.
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
      if (path.endsWith('/drafts/saved-draft')) return Response.json({ id: 'saved-draft', message: apiMail({ ...mail(account.email, 'draft-message', ['DRAFT']), threadId: incoming.threadId, to: [leadEmail] }) });
      return Response.json(apiMail({ ...mail(account.email, 'sent-draft', ['SENT']), threadId: incoming.threadId, to: [leadEmail] }));
    }));
    const draft = { to: leadEmail, subject: 'Re: ' + incoming.subject, body: '<p>Original</p>', replyToMessageId: incoming.id };
    expect((await call('/drafts', 'POST', draft)).status).toBe(200);
    expect((await call('/drafts', 'POST', { ...draft, replyToMessageId: undefined, draftId: 'saved-draft', body: '<p>Edited</p>' })).status).toBe(200);
    const saved = (await call('/emails?filter=drafts')).body.emails[0]; expect(saved.body).toBe('<p>Edited</p>');
    expect((await call('/send', 'POST', { to: leadEmail, subject: draft.subject, body: saved.body, draftId: 'saved-draft' })).status).toBe(200);
    expect(writes.at(-1)?.path).toMatch(/drafts\/send$/);
    const update = writes.at(-2)!; expect(update.data.message.threadId).toBe(incoming.threadId);
    expect(Buffer.from(update.data.message.raw, 'base64url').toString().split('\r\n')[0]).toBe(`From: ${account.email}`);
    expect(Buffer.from(update.data.message.raw, 'base64url').toString()).toContain('In-Reply-To: <customer-message@example.test>');
    expect((await call('/emails?filter=drafts')).body.emails).toHaveLength(0);
    expect((await call('/drafts/personal-draft', 'DELETE')).status).toBe(404);
  });
  it.each(['compose', 'reply', 'replyAll', 'forward'] as const)('roundtrips a saved %s draft without guessing its source from later thread activity', async composeMode => {
    const original = { ...mail(leadEmail, 'exact-original'), rfcMessageId: '<exact-original@example.test>' };
    await scope(() => ingestMailboxMessages(account, [original], permissions));
    const source = composeMode === 'forward' ? { forwardSourceMessageId: original.id } : composeMode === 'compose' ? {} : { replyToMessageId: original.id };
    const writes: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_path: string | URL, init?: RequestInit) => {
      if (!init?.method && String(_path).includes('/drafts/mode-draft')) return Response.json({ id: 'mode-draft', message: apiMail({ ...mail(account.email, 'mode-message', ['DRAFT']), to: [leadEmail] }) });
      writes.push(JSON.parse(String(init?.body)));
      return Response.json({ id: 'mode-draft', message: { id: 'mode-message', threadId: composeMode === 'reply' || composeMode === 'replyAll' ? original.threadId : 'new-topic' } });
    }));
    const payload = { to: leadEmail, subject: composeMode === 'compose' ? 'A new subject' : composeMode === 'forward' ? 'Fwd: ' + original.subject : 'Re: ' + original.subject, body: '<p>Authored draft</p>', composeMode, ...source, requestId: randomUUID() };
    expect((await call('/drafts', 'POST', payload)).status).toBe(200);
    const saved = (await call('/emails?filter=drafts')).body.emails.find((email: GmailEmail) => email.draftId === 'mode-draft');
    expect(saved).toMatchObject({ composeMode, ...source, body: payload.body });
    await scope(() => ingestMailboxMessages(account, [{ ...mail(leadEmail, 'later-original'), threadId: original.threadId, rfcMessageId: '<later@example.test>' }], permissions));
    expect((await call('/drafts', 'POST', { to: leadEmail, subject: payload.subject, body: '<p>Edited</p>', draftId: saved.draftId })).status).toBe(200);
    const raw = Buffer.from(writes.at(-1).message.raw, 'base64url').toString();
    if (composeMode === 'reply' || composeMode === 'replyAll') {
      expect(raw).toContain('In-Reply-To: <exact-original@example.test>'); expect(raw).not.toContain('In-Reply-To: <later@example.test>');
    } else { expect(raw).not.toContain('In-Reply-To:'); expect(writes.at(-1).message.threadId).toBeUndefined(); }
    expect((await call('/drafts', 'POST', { ...payload, composeMode: composeMode === 'reply' ? 'replyAll' : 'reply', replyToMessageId: original.id, forwardSourceMessageId: undefined })).status).toBe(409);
  });
  it('rejects changed reply subjects before a provider send can split the conversation', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'subject-source')], permissions));
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    const payload = { to: leadEmail, subject: 'Different inquiry', body: '<p>Hello</p>', replyToMessageId: 'subject-source' };
    expect((await call('/send', 'POST', payload)).body.error.code).toBe('MAILBOX_REPLY_SUBJECT_CHANGED');
    expect((await call('/drafts', 'POST', payload)).status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });
  it('requires explicit source selection for legacy drafts even when reply headers are absent', async () => {
    const draft = { ...mail(account.email, 'unverified-forward', ['DRAFT']), to: [leadEmail], draftId: 'unverified-forward-draft' };
    await scope(() => ingestMailboxMessages(account, [draft], permissions));
    const restored = (await call('/emails?filter=drafts')).body.emails[0];
    expect(restored).toMatchObject({ draftContextRequired: true });
    expect(restored.composeMode).toBeUndefined();
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    const data = { requestId: randomUUID(), to: leadEmail, subject: draft.subject, body: draft.body, draftId: draft.draftId };
    for (const path of ['/send', '/drafts', '/scheduled']) {
      const response = await call(path, 'POST', { ...data, ...(path === '/scheduled' ? { scheduledAt: new Date(Date.now() + 3600000).toISOString() } : {}) });
      expect(response.status).toBe(409);
      expect(JSON.stringify(response.body)).toContain('MAILBOX_DRAFT_CONTEXT_REQUIRED');
    }
    expect((await call('/send', 'POST', { ...data, composeMode: 'compose' })).status).toBe(409);
    expect(provider).not.toHaveBeenCalled();
    expect(await prisma.mailboxSendReceipt.count({ where: { accountId: account.id, requestId: data.requestId } })).toBe(0);
  });
  it('refreshes provider-edited draft bodies without creating engagement activities', async () => {
    const draft = { ...mail(account.email, 'edit-draft', ['DRAFT']), to: [leadEmail], draftId: 'draft-id' };
    await scope(() => ingestMailboxMessages(account, [draft], permissions));
    await scope(() => ingestMailboxMessages(account, [{ ...draft, body: '<p>Changed in Gmail</p>' }], permissions));
    expect((await call('/emails?filter=drafts')).body.emails[0].body).toBe('<p>Changed in Gmail</p>');
    expect(await prisma.activity.count({ where: { tenantId, leadId, type: 'email' } })).toBe(0);
  });
  it('retains CRM source authorization when Gmail replaces an authorized draft message ID', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'retained-source')], permissions));
    const oldDraft = { ...mail(account.email, 'old-draft-message', ['DELETED']), to: [contactEmail], draftId: 'retained-draft-id' };
    await persistHistorical(oldDraft, { crmDraft: true, sourceMessageId: 'retained-source' });
    const replacement = { ...oldDraft, id: 'new-draft-message', labels: ['DRAFT'] };
    await scope(() => ingestMailboxMessages(account, [replacement], permissions));
    const saved = await prisma.mailboxMessage.findUniqueOrThrow({ where: { accountId_providerMessageId: { accountId: account.id, providerMessageId: replacement.id } } });
    expect(saved.sourceMessageId).toBe('retained-source'); expect(saved.crmDraft).toBe(true);
    expect((await call('/emails?filter=drafts')).body.emails).toHaveLength(1);
    await prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: otherId } });
    expect((await call('/emails?filter=drafts')).body.emails).toHaveLength(0);
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
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id, providerMessageId: 'bank' } })).toBe(0);
    expect((await call('/emails')).body.emails.map((row: GmailEmail) => row.id)).toEqual(['customer']);
    expect((await prisma.emailAccount.findUniqueOrThrow({ where: { id: account.id } })).syncCursor).toBe('110');
  });
  it('pauses an HTTP 5xx sync episode after five provider attempts without multiplying read retries', async () => {
    const resolved = await resolveMailboxScope(account, permissions);
    await prisma.emailAccount.update({ where: { id: account.id }, data: { syncScopeHash: resolved.hash, syncCursor: '100', syncRequestedAt: new Date() } });
    const provider = vi.fn(async () => Response.json({}, { status: 503 })); vi.stubGlobal('fetch', provider);
    for (let attempt = 0; attempt < 7; attempt++) {
      await scope(() => syncMailbox(tenantId, userId, 'worker')).catch(() => undefined);
      await prisma.emailAccount.update({ where: { id: account.id }, data: { syncRetryAt: new Date(0) } });
    }
    expect(provider).toHaveBeenCalledTimes(5);
    const state = await prisma.emailAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(state.syncFailureCount).toBe(5); expect(state.syncPausedAt).not.toBeNull(); expect(state.syncError).toContain('paused'); expect(state.syncCursor).toBe('100');
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
      if (path.includes('/drafts/') && path.includes('?format=metadata')) return Response.json({ message: apiMail({ ...outgoing, id: 'draft-message', labels: ['DRAFT'] }, [{ name: 'Message-ID', value: draftRfc.match(/Message-ID: ([^\r\n]+)/)![1] }]) });
      if (path.endsWith('/drafts/send')) { sends++; return Response.json({ id: outgoing.id, threadId: outgoing.threadId }); }
      if (path.includes('/messages?')) return Response.json({ messages: [{ id: outgoing.id, threadId: outgoing.threadId }] });
      return Response.json(apiMail(outgoing, [{ name: 'Message-ID', value: draftRfc.match(/Message-ID: ([^\r\n]+)/)![1] }]));
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
  it.each(['reply source', 'forward content', 'compose content'])('blocks a provider replacement of scheduled %s even when its recipients and RFC operation ID stay unchanged', async change => {
    const queued = await queuedEmail();
    await prisma.scheduledMailboxEmail.update({ where: { id: queued.item.id }, data: { scheduledAt: new Date(0) } });
    const changed = apiMail({ ...mail(account.email, 'replacement-draft', ['DRAFT']), to: [leadEmail], subject: `Changed ${change}` }, [
      { name: 'Message-ID', value: scheduleMessageId(queued.item.id) },
      ...(change === 'reply source' ? [{ name: 'In-Reply-To', value: '<different-source@example.test>' }, { name: 'References', value: '<different-source@example.test>' }] : []),
    ]);
    const provider = vi.fn(async (input: string | URL, init?: RequestInit) => String(input).includes('?format=metadata') && String(input).includes('/drafts/')
      ? Response.json({ message: changed }) : queued.provider(input, init));
    vi.stubGlobal('fetch', provider);
    await runScheduledMailboxEmails();
    expect(provider).toHaveBeenCalledTimes(1); expect(queued.sends()).toBe(0);
    expect(await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: queued.item.id } })).toMatchObject({ status: 'failed', lastError: expect.stringContaining('edited in Gmail') });
    expect(await prisma.mailboxMessage.findFirstOrThrow({ where: { accountId: account.id, draftId: queued.item.draftId } })).toMatchObject({ labels: expect.arrayContaining(['DRAFT']) });
  });
  it('pauses a legacy scheduled receipt without known compose/source context before any provider call', async () => {
    const queued = await queuedEmail();
    await prisma.mailboxSendReceipt.update({ where: { accountId_requestId: { accountId: account.id, requestId: queued.input.requestId } }, data: { authorizationContext: { recipients: [leadEmail] } } });
    await prisma.scheduledMailboxEmail.update({ where: { id: queued.item.id }, data: { scheduledAt: new Date(0) } });
    queued.provider.mockClear();
    await runScheduledMailboxEmails();
    expect(queued.provider).not.toHaveBeenCalled(); expect(queued.sends()).toBe(0);
    expect(await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: queued.item.id } })).toMatchObject({ status: 'failed', lastError: expect.stringContaining('verified operation context') });
  });
  it('rechecks the receipt source when mutable draft metadata has lost its original source pointer', async () => {
    const queued = await queuedEmail();
    await scope(() => ingestMailboxMessages(account, [mail(contactEmail, 'saved-forward-source')], permissions));
    await prisma.mailboxSendReceipt.update({ where: { accountId_requestId: { accountId: account.id, requestId: queued.input.requestId } }, data: { authorizationContext: { recipients: [leadEmail], composeMode: 'forward', forwardSourceMessageId: 'saved-forward-source' } } });
    await prisma.mailboxMessage.updateMany({ where: { accountId: account.id, draftId: queued.item.draftId }, data: { sourceMessageId: null } });
    await prisma.contact.updateMany({ where: { tenantId, email: contactEmail }, data: { assignedUserId: null } });
    await prisma.scheduledMailboxEmail.update({ where: { id: queued.item.id }, data: { scheduledAt: new Date(0) } });
    queued.provider.mockClear();
    await runScheduledMailboxEmails();
    expect(queued.provider).not.toHaveBeenCalled(); expect(queued.sends()).toBe(0);
    expect((await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: queued.item.id } })).status).toBe('failed');
  });

  it.each([
    ['missing message ID', { threadId: 'sent-schedule' }],
    ['missing thread ID', { id: 'sent-schedule' }],
    ['invalid message ID', { id: 'invalid/message', threadId: 'sent-schedule' }],
    ['invalid thread ID', { id: 'sent-schedule', threadId: 'invalid/thread' }],
    ['null response', null],
  ])('keeps a malformed scheduled acknowledgement uncertain (%s) and recovers without resending', async (_case, acknowledgement) => {
    const queued = await queuedEmail();
    await prisma.scheduledMailboxEmail.update({ where: { id: queued.item.id }, data: { scheduledAt: new Date(0) } });
    let sends = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (String(input).endsWith('/drafts/send')) { sends++; return Response.json(acknowledgement); }
      return queued.provider(input, init);
    }));
    await runScheduledMailboxEmails();
    const unknown = await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: queued.item.id } });
    expect(unknown).toMatchObject({ status: 'uncertain', providerMessageId: null, providerThreadId: null, sentAt: null });
    expect(await prisma.mailboxSendReceipt.findUniqueOrThrow({ where: { accountId_requestId: { accountId: account.id, requestId: queued.input.requestId } } })).toMatchObject({ status: 'uncertain', providerMessageId: 'draft-message', providerThreadId: null });
    expect((await prisma.mailboxMessage.findFirstOrThrow({ where: { accountId: account.id, draftId: unknown.draftId } })).labels).toContain('DRAFT');
    await prisma.scheduledMailboxEmail.update({ where: { id: unknown.id }, data: { retryAt: new Date(0) } });
    await runScheduledMailboxEmails();
    expect(sends).toBe(1);
    expect(await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: unknown.id } })).toMatchObject({ status: 'sent', providerMessageId: 'sent-schedule', providerThreadId: 'sent-schedule' });
  });

  it('reviews a pending schedule from persisted data, cancels it once, and preserves its editable draft', async () => {
    const queued = await queuedEmail(); queued.provider.mockClear();
    const detail = await call('/scheduled/' + queued.item.id);
    expect(detail.status).toBe(200); expect(detail.body).toMatchObject({ id: queued.item.id, subject: 'Scheduled inquiry', recipients: [leadEmail], body: '<p>Hello</p>', canCancel: true });
    expect(queued.provider).not.toHaveBeenCalled();
    expect((await call('/scheduled/' + queued.item.id + '/cancel', 'POST', {})).status).toBe(200);
    expect((await call('/scheduled/' + queued.item.id + '/cancel', 'POST', {})).status).toBe(200);
    expect((await call('/emails?filter=scheduled')).body.emails).toHaveLength(0);
    expect((await call('/emails?filter=drafts')).body.emails).toHaveLength(1);
    await prisma.scheduledMailboxEmail.update({ where: { id: queued.item.id }, data: { scheduledAt: new Date(0) } });
    await runScheduledMailboxEmails(); expect(queued.sends()).toBe(0);
    expect((await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: queued.item.id } })).status).toBe('cancelled');
  });
  it('does not expose or cancel another employee schedule and rejects cancellation after sending begins', async () => {
    const queued = await queuedEmail();
    const other = await prisma.user.findUniqueOrThrow({ where: { id: otherId } });
    const otherToken = (await issueAuthSession(other)).token;
    await prisma.emailAccount.upsert({ where: { tenantId_userId_provider: { tenantId, userId: otherId, provider: 'gmail' } },
      create: { tenantId, userId: otherId, email: other.email, accessToken: encryptToken(randomUUID()), scopes: ['https://www.googleapis.com/auth/gmail.modify'] }, update: { isActive: true } });
    expect((await call('/scheduled/' + queued.item.id, 'GET', undefined, 'Bearer ' + otherToken)).status).toBe(404);
    expect((await call('/scheduled/' + queued.item.id + '/cancel', 'POST', {}, 'Bearer ' + otherToken)).status).toBe(404);
    await prisma.scheduledMailboxEmail.update({ where: { id: queued.item.id }, data: { status: 'sending' } });
    expect((await call('/scheduled/' + queued.item.id + '/cancel', 'POST', {})).status).toBe(409);
    expect((await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: queued.item.id } })).status).toBe('sending');
  });
  it('recovers an expired pre-send claim after restart and rechecks assignments', async () => {
    const test = await queuedEmail();
    await prisma.scheduledMailboxEmail.update({ where: { id: test.item.id }, data: { scheduledAt: new Date(0), status: 'claimed', leaseId: 'old-worker', leaseUntil: new Date(0) } });
    await prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: otherId } });
    await runScheduledMailboxEmails();
    expect(test.sends()).toBe(0);
    expect((await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: test.item.id } })).status).toBe('failed');
    expect((await call('/emails?filter=scheduled')).body.emails).toHaveLength(0);
    expect((await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: test.item.id } })).lastError).toContain('assignment');
  });
  it('reconciles a send interrupted after provider acceptance without resending', async () => {
    const test = await queuedEmail();
    await prisma.scheduledMailboxEmail.update({ where: { id: test.item.id }, data: { scheduledAt: new Date(0), status: 'sending', leaseId: 'old-worker', leaseUntil: new Date(0) } });
    await runScheduledMailboxEmails();
    expect(test.sends()).toBe(0);
    expect((await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: test.item.id } })).status).toBe('sent');
    expect(test.provider.mock.calls.some(([path]) => decodeURIComponent(String(path)).includes(scheduleMessageId(test.item.id)))).toBe(true);
  });
  it('does not fetch uncertain delivery content after recipient assignment is revoked', async () => {
    const queued = await queuedEmail();
    await prisma.scheduledMailboxEmail.update({ where: { id: queued.item.id }, data: { scheduledAt: new Date(0), status: 'uncertain' } });
    await prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: otherId } });
    queued.provider.mockClear(); await runScheduledMailboxEmails();
    expect(queued.provider).not.toHaveBeenCalled(); expect(queued.sends()).toBe(0);
    expect((await call('/emails?filter=scheduled')).body.emails).toHaveLength(0);
  });

  it.each(['From', 'Bcc'])('does not confirm a scheduled recovery with provider-edited %s metadata', async header => {
    const queued = await queuedEmail();
    await prisma.scheduledMailboxEmail.update({ where: { id: queued.item.id }, data: { scheduledAt: new Date(0), status: 'uncertain' } });
    const changed = apiMail({ ...mail(header === 'From' ? 'info@camxian.com' : account.email, 'edited-recovery', ['SENT']), to: [leadEmail] }, [
      { name: 'Message-ID', value: scheduleMessageId(queued.item.id) }, ...(header === 'Bcc' ? [{ name: 'Bcc', value: contactEmail }] : []),
    ]);
    const provider = vi.fn(async (input: string | URL) => String(input).includes('/messages?')
      ? Response.json({ messages: [{ id: changed.id, threadId: changed.threadId }] }) : Response.json(changed));
    vi.stubGlobal('fetch', provider);
    await runScheduledMailboxEmails();
    expect(provider).toHaveBeenCalledTimes(2);
    expect(provider.mock.calls.every(([input]) => /\/messages\?|format=metadata/.test(String(input)))).toBe(true);
    expect(await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: queued.item.id } })).toMatchObject({ status: 'uncertain', providerMessageId: null, providerThreadId: null });
    expect(await prisma.mailboxSendReceipt.findUniqueOrThrow({ where: { accountId_requestId: { accountId: account.id, requestId: queued.input.requestId } } })).toMatchObject({ status: 'uncertain', providerMessageId: 'draft-message' });
  });

  it('does not send a pending schedule after its provider From changes to an approved incoming sender', async () => {
    const queued = await queuedEmail();
    await prisma.scheduledMailboxEmail.update({ where: { id: queued.item.id }, data: { scheduledAt: new Date(0) } });
    const changed = apiMail({ ...mail('info@camxian.com', 'edited-sender', ['DRAFT']), to: [leadEmail] }, [
      { name: 'Message-ID', value: scheduleMessageId(queued.item.id) },
    ]);
    const provider = vi.fn(async () => Response.json({ message: changed })); vi.stubGlobal('fetch', provider);
    await runScheduledMailboxEmails();
    expect(provider).toHaveBeenCalledTimes(1); expect(queued.sends()).toBe(0);
    expect((await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: queued.item.id } })).status).toBe('failed');
  });

  it.each(['To', 'Cc', 'Bcc'])('rejects a provider-edited scheduled %s recipient using only metadata', async header => {
    const queued = await queuedEmail();
    await prisma.scheduledMailboxEmail.update({ where: { id: queued.item.id }, data: { scheduledAt: new Date(0) } });
    const changed = apiMail({ ...mail(account.email, 'changed-draft', ['DRAFT']), to: header === 'To' ? ['bank@example.com'] : [leadEmail] }, [
      { name: 'Message-ID', value: scheduleMessageId(queued.item.id) }, ...(header === 'To' ? [] : [{ name: header, value: 'bank@example.com' }]),
    ]);
    const { body: _body, ...headersOnly } = changed.payload;
    const provider = vi.fn(async () => Response.json({ message: { ...changed, payload: headersOnly } })); vi.stubGlobal('fetch', provider);
    await runScheduledMailboxEmails(); expect(provider).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('?format=metadata');
    expect((await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: queued.item.id } })).status).toBe('failed');
    expect(queued.sends()).toBe(0);
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
    expect(test.sends()).toBe(0);
    expect(await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: test.item.id } })).toMatchObject({ status: 'uncertain', attemptCount: 4 });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4);
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

  it('keeps customer and agent replies in one stable Deal row across ingestion replay', async () => {
    const { pipeline, initial } = await scope(() => salesTransaction(tx => salesPipeline(tx, tenantId)));
    const deal = await prisma.deal.create({ data: { tenantId, pipelineId: pipeline.id, stageId: initial.id, title: 'Historical automatic Deal',
      leadDeals: { create: { leadId, position: 0 } } } });
    const sent = { ...mail(account.email, 'dedup-original', ['SENT']), threadId: 'dedup-thread', to: [leadEmail], date: new Date(Date.now() - 9000).toISOString(), rfcMessageId: '<dedup-original@example.test>' };
    await scope(() => ingestMailboxMessages(account, [sent], permissions, { dealId: deal.id }));
    const first = (await call('/emails')).body.emails[0];
    expect(first.dealId).toBe(deal.id); expect(first.messageCount).toBe(1);
    const secondDeal = await prisma.deal.create({ data: { tenantId, pipelineId: pipeline.id, stageId: initial.id, title: 'Another Deal',
      leadDeals: { create: { leadId, position: 1 } } } });
    const received = { ...mail(leadEmail, 'dedup-customer'), threadId: sent.threadId, date: new Date(Date.now() - 6000).toISOString(),
      attachments: [{ id: 'original-file', filename: 'Reply.pdf', mimeType: 'application/pdf', size: 5 }] };
    const reply = { ...sent, id: 'dedup-agent', rfcMessageId: '<dedup-agent@example.test>', date: new Date(Date.now() - 3000).toISOString(), snippet: 'Latest agent reply' };
    for (let replay = 0; replay < 2; replay++) await scope(() => ingestMailboxMessages(account, [received, reply], permissions));
    const rows = (await call('/emails')).body.emails;
    expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ conversationId: first.conversationId, threadId: sent.threadId, dealId: deal.id, messageCount: 3, snippet: reply.snippet, isRead: false });
    expect((await call('/conversations/' + first.conversationId)).body.emails).toHaveLength(3);
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id } })).toBe(3);
    expect(await prisma.activity.count({ where: { tenantId, mailboxMessage: { accountId: account.id }, type: 'email' } })).toBe(3);
    vi.stubGlobal('fetch', vi.fn(async (path: string | URL) => Response.json(apiMail(String(path).includes(sent.id) ? sent : reply))));
    expect((await recordFiles('deals', deal.id)).body.data.attachments.map((file: any) => file.messageId)).toContain(received.id);
    expect((await recordFiles('deals', secondDeal.id)).body.data.attachments).toEqual([]);
    await persistHistorical({ ...mail(leadEmail, 'dedup-other-deal'), threadId: sent.threadId }, { leadId, dealId: secondDeal.id });
    const raced = { ...reply, id: 'dedup-confirmed-race', rfcMessageId: '<dedup-confirmed-race@example.test>' };
    await scope(() => ingestMailboxMessages(account, [raced], permissions));
    expect((await prisma.mailboxMessage.findFirstOrThrow({ where: { accountId: account.id, providerMessageId: raced.id } })).dealId).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(apiMail(raced))));
    await scope(() => ingestConfirmedMailboxSend(account, raced.id, { recipients: [leadEmail], replyToMessageId: sent.id }));
    expect((await prisma.mailboxMessage.findFirstOrThrow({ where: { accountId: account.id, providerMessageId: raced.id } })).dealId).toBe(deal.id);
    expect((await call('/emails')).body.emails.find((row: GmailEmail) => row.dealId === deal.id).messageCount).toBe(4);
    expect(await prisma.activity.count({ where: { tenantId, mailboxMessage: { accountId: account.id, providerMessageId: raced.id } } })).toBe(1);
    const customerReply = { ...received, id: 'dedup-customer-parent', rfcMessageId: '<dedup-customer-parent@example.test>', rfcInReplyTo: sent.rfcMessageId };
    for (let replay = 0; replay < 2; replay++) await scope(() => ingestMailboxMessages(account, [customerReply], permissions));
    expect((await prisma.mailboxMessage.findFirstOrThrow({ where: { accountId: account.id, providerMessageId: customerReply.id } })).dealId).toBe(deal.id);
    const finalRows = (await call('/emails')).body.emails;
    expect(finalRows).toHaveLength(2);
    expect(finalRows.find((row: GmailEmail) => row.dealId === deal.id)).toMatchObject({ conversationId: first.conversationId, messageCount: 5 });
  });

  it('classifies received archives without Sent-only or mixed Inbox duplicates and restores original IDs', async () => {
    const older = { ...mail(leadEmail, 'archive-old', ['UNREAD']), threadId: 'archive-mixed' };
    const incoming = { ...mail(leadEmail, 'archive-new'), threadId: older.threadId };
    const outgoing = { ...mail(account.email, 'archive-reply', ['SENT']), to: [leadEmail], threadId: older.threadId };
    await scope(() => ingestMailboxMessages(account, [older, incoming, outgoing, { ...outgoing, id: 'ordinary-sent', threadId: 'ordinary-sent-thread' }], permissions));
    expect((await call('/emails?view=archived')).body.emails).toEqual([]);
    const original = (await call('/emails')).body.emails.find((row: GmailEmail) => row.threadId === older.threadId);
    const activityCount = await prisma.activity.count({ where: { tenantId, mailboxMessage: { accountId: account.id } } });
    const provider = vi.fn(async () => Response.json({})); vi.stubGlobal('fetch', provider);
    expect((await call('/archive', 'POST', { conversationIds: [original.conversationId] })).body.count).toBe(1);
    const archived = (await call('/emails?view=archived&filter=unread&sort=oldest&query=Fence')).body.emails;
    expect(archived).toHaveLength(1); expect(archived[0]).toMatchObject({ conversationId: original.conversationId, messageCount: 3, isArchived: true, isRead: false });
    expect((await call('/emails')).body.emails.map((row: GmailEmail) => row.threadId)).toEqual(['ordinary-sent-thread']);
    expect((await call('/restore', 'POST', { conversationIds: [original.conversationId] })).body.count).toBe(2);
    expect((await call('/emails?view=archived')).body.emails).toEqual([]);
    expect((await call('/emails')).body.emails.find((row: GmailEmail) => row.threadId === older.threadId).conversationId).toBe(original.conversationId);
    expect(provider.mock.calls.every(([path]) => !String(path).includes('ordinary-sent') && !String(path).includes('archive-reply'))).toBe(true);
    expect(await prisma.activity.count({ where: { tenantId, mailboxMessage: { accountId: account.id } } })).toBe(activityCount);
    for (const label of ['DRAFT', 'SPAM', 'TRASH', 'DELETED']) await persistHistorical(mail(leadEmail, 'excluded-' + label, [label]));
    expect((await call('/emails?view=archived')).body.emails).toEqual([]);
  });

  it('moves selected mail to recoverable Gmail Trash while preserving authorized Activity and uploaded files', async () => {
    const email = { ...mail(leadEmail, 'recoverable-trash'), attachments: [{ id: 'original-pdf', filename: 'Original.pdf', mimeType: 'application/pdf', size: 5 }] };
    await scope(() => ingestMailboxMessages(account, [email], permissions));
    await prisma.recordFile.create({ data: { tenantId, leadId, uploadedById: userId, name: 'manual.pdf', type: 'application/pdf', size: 5, objectKey: 'preserved-upload' } });
    const row = (await call('/emails')).body.emails[0];
    const activities = await prisma.activity.findMany({ where: { tenantId, mailboxMessage: { accountId: account.id } } });
    const history = async () => (await realFetch(base.replace('/integrations/gmail', '') + '/crm/activities?leadId=' + leadId + '&type=email', { headers: { Authorization: 'Bearer ' + token } })).json();
    expect((await history()).data).toHaveLength(1);
    const provider = vi.fn(async () => Response.json({ labelIds: ['TRASH', 'UNREAD'] })); vi.stubGlobal('fetch', provider);
    expect((await call('/trash', 'POST', { conversationIds: [row.conversationId] })).body.success).toBe(true);
    expect(String(provider.mock.calls[0][0])).toContain('/messages/recoverable-trash/trash');
    expect((await call('/emails')).body.emails).toEqual([]); expect((await call('/emails?view=archived')).body.emails).toEqual([]);
    expect((await recordFiles('leads', leadId)).body.data.attachments).toEqual([]);
    expect((await recordFiles('leads', leadId, 'files')).body.data.map((file: any) => file.name)).toEqual(['manual.pdf']);
    expect((await history()).data).toHaveLength(1);
    expect(await prisma.activity.findMany({ where: { tenantId, mailboxMessage: { accountId: account.id } } })).toEqual(activities);
    expect((await call('/messages/recoverable-trash/attachments/original-pdf')).status).toBe(404);
    expect(provider).toHaveBeenCalledOnce();
    await scope(() => ingestMailboxMessages(account, [email], permissions));
    expect((await call('/emails')).body.emails[0].conversationId).toBe(row.conversationId);
    expect((await recordFiles('leads', leadId)).body.data.attachments).toHaveLength(1);
    await prisma.emailAccount.update({ where: { id: account.id }, data: { isActive: false } });
    expect((await history()).data).toEqual([]);
  });

  it('isolates Files, Activity and scoped writes when one thread contains two saved Deals', async () => {
    const { pipeline, initial } = await scope(() => salesTransaction(tx => salesPipeline(tx, tenantId)));
    const deals = [];
    for (const title of ['CCTV', 'Network']) deals.push(await prisma.deal.create({ data: { tenantId, pipelineId: pipeline.id, stageId: initial.id, title,
      leadDeals: { create: { leadId, position: 0 } } } }));
    const messages = ['a', 'b'].map(id => ({ ...mail(leadEmail, 'isolation-' + id), threadId: 'isolation-thread',
      attachments: [{ id: 'pdf-' + id, filename: id + '.pdf', mimeType: 'application/pdf', size: 5 }] }));
    for (let index = 0; index < messages.length; index++) await persistHistorical(messages[index], { leadId, dealId: deals[index].id });
    await scope(() => ingestMailboxMessages(account, messages, permissions));
    await prisma.mailboxThreadAssociation.create({ data: { tenantId, accountId: account.id, threadId: 'isolation-thread', dealId: deals[1].id } });
    for (let index = 0; index < deals.length; index++) {
      expect((await recordFiles('deals', deals[index].id)).body.data.attachments.map((file: any) => file.messageId)).toEqual([messages[index].id]);
      const activity = (await recordFiles('deals', deals[index].id, 'relationships')).body.data.activities.filter((activity: any) => activity.type === 'email');
      expect(activity).toHaveLength(1); expect(activity[0].metadata.email.providerMessageId).toBe(messages[index].id);
    }
    expect((await call('/threads/isolation-thread/deal', 'PATCH', { dealId: deals[0].id })).status).toBe(409);
    const unassigned = { ...mail(leadEmail, 'isolation-unassigned'), threadId: 'isolation-thread' };
    await scope(() => ingestMailboxMessages(account, [unassigned], permissions));
    const rows = (await call('/emails')).body.emails;
    const unknown = rows.find((row: GmailEmail) => !row.dealId);
    expect(unknown).toBeTruthy();
    expect((await call('/threads/isolation-thread/deal', 'PATCH', { dealId: deals[0].id, conversationId: unknown.conversationId })).status).toBe(200);
    expect((await prisma.mailboxMessage.findFirstOrThrow({ where: { accountId: account.id, providerMessageId: messages[1].id } })).dealId).toBe(deals[1].id);
    const provider = vi.fn(async () => Response.json({})); vi.stubGlobal('fetch', provider);
    const groupA = (await call('/emails')).body.emails.find((row: GmailEmail) => row.dealId === deals[0].id);
    expect((await call('/trash', 'POST', { conversationIds: [groupA.conversationId] })).body.count).toBe(2);
    expect((await recordFiles('deals', deals[0].id)).body.data.attachments).toEqual([]);
    expect((await recordFiles('deals', deals[1].id)).body.data.attachments.map((file: any) => file.messageId)).toEqual([messages[1].id]);
    expect((await recordFiles('deals', deals[0].id, 'relationships')).body.data.activities.filter((activity: any) => activity.type === 'email')).toHaveLength(2);
    expect(provider.mock.calls.every(([path]) => !String(path).includes('isolation-b'))).toBe(true);
  });

  it.each(['trash', 'archive', 'restore'] as const)('reports partial %s progress and retries only remaining messages', async action => {
    const initialLabels = action === 'restore' ? ['UNREAD'] : ['INBOX', 'UNREAD'];
    const finalLabels = action === 'trash' ? ['TRASH', 'UNREAD'] : action === 'restore' ? ['INBOX', 'UNREAD'] : ['UNREAD'];
    await persistHistorical(mail(leadEmail, 'trash-partial-a', initialLabels));
    await persistHistorical({ ...mail(leadEmail, 'trash-partial-b', initialLabels), threadId: 'trash-partial-a' });
    const view = action === 'restore' ? '/emails?view=archived' : '/emails';
    const row = (await call(view)).body.emails[0];
    let writes = 0;
    const provider = vi.fn(async () => ++writes === 1 ? Response.json({ labelIds: finalLabels }) : Response.json({}, { status: 503 }));
    vi.stubGlobal('fetch', provider);
    const partial = await call('/' + action, 'POST', { conversationIds: [row.conversationId] });
    expect(partial.body).toMatchObject({ success: false, count: 1, completedMessageIds: ['trash-partial-a'], completedConversationIds: [] });
    expect(await prisma.mailboxMessage.findFirstOrThrow({ where: { accountId: account.id, providerMessageId: 'trash-partial-a' } })).toMatchObject({ labels: finalLabels });
    expect(await prisma.mailboxMessage.findFirstOrThrow({ where: { accountId: account.id, providerMessageId: 'trash-partial-b' } })).toMatchObject({ labels: initialLabels });
    provider.mockImplementation(async () => Response.json({ labelIds: finalLabels }));
    const retry = await call('/' + action, 'POST', { conversationIds: [row.conversationId] });
    expect(retry.body).toMatchObject({ success: true, count: 1, completedConversationIds: [row.conversationId] });
    expect(provider).toHaveBeenCalledTimes(3);
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id, labels: { hasEvery: finalLabels } } })).toBe(2);
  });

  it.each([1, 14, 51, 1001])('reads all unread messages in a %s-message conversation through bounded pages', async size => {
    // Large histories also exercise skipping already-read messages without the old 1,000-message rejection.
    const unread = size === 1001 ? 26 : size;
    const createdAt = new Date(Date.now() - 10000);
    await prisma.mailboxMessage.createMany({ data: Array.from({ length: size }, (_, index) => ({
      tenantId, accountId: account.id, providerMessageId: `whole-${String(index).padStart(5, '0')}`, threadId: 'whole-topic',
      from: `Doris <${leadEmail}>`, fromAddress: leadEmail, recipients: [account.email], recipientAddresses: [account.email],
      authorizationParticipants: [leadEmail, account.email].sort(), participantPolicyVersion: MAILBOX_PARTICIPANT_POLICY_VERSION,
      direction: 'inbound', subject: 'Whole conversation', snippet: 'Message', body: 'Message', labels: index < size - unread ? ['INBOX'] : ['INBOX', 'UNREAD'], sentAt: createdAt, createdAt,
    })) });
    const row = (await call('/emails')).body.emails[0];
    expect(row.messageCount).toBe(size);
    const history = (await call('/conversations/' + row.conversationId)).body;
    expect(history.emails).toHaveLength(Math.min(size, 50));
    const activities = await prisma.activity.count({ where: { tenantId } });
    const provider = vi.fn(async () => Response.json({})); vi.stubGlobal('fetch', provider);
    let pageToken: string | undefined, changed = 0, pages = 0;
    do {
      const result = await call('/conversations/' + row.conversationId + '/read-state', 'PATCH', { isRead: true, pageToken });
      expect(result.status).toBe(200); expect(result.body.count).toBeLessThanOrEqual(25);
      expect(result.body.completedMessageIds.length).toBeLessThanOrEqual(25);
      changed += result.body.count; pageToken = result.body.nextPageToken; pages++;
      if (!pageToken) expect(result.body).toMatchObject({ isRead: true, unreadCount: 0 });
    } while (pageToken);
    expect(changed).toBe(unread); expect(provider).toHaveBeenCalledTimes(unread);
    expect(pages).toBeGreaterThanOrEqual(Math.ceil(unread / 25));
    expect(new Set(provider.mock.calls.map(args => String((args as unknown[])[0]))).size).toBe(unread);
    expect(provider.mock.calls.every(args => !String((args as unknown[])[0]).includes('/threads/'))).toBe(true);
    expect((await call('/emails')).body.emails[0]).toMatchObject({ isRead: true, messageCount: size, participants: ['Doris'] });
    expect((await call('/emails?filter=unread')).body.emails).toHaveLength(0);
    expect((await call('/unread-count')).body.unreadCount).toBe(0);
    expect((await call('/conversations/' + row.conversationId + '/read-state', 'PATCH', { isRead: true })).body.count).toBe(0);
    expect(provider).toHaveBeenCalledTimes(unread); expect(await prisma.activity.count({ where: { tenantId } })).toBe(activities);
  }, 120000);
  it('excludes drafts, outgoing UNREAD, unrelated correspondents and unauthorized messages within the same provider topic', async () => {
    await persistHistorical(mail(leadEmail, 'read-authorized'));
    await persistHistorical({ ...mail('bank@example.com', 'read-private'), threadId: 'read-authorized' });
    await persistHistorical({ ...mail(account.email, 'read-outgoing', ['SENT', 'UNREAD']), threadId: 'read-authorized', to: [leadEmail] });
    await persistHistorical({ ...mail(account.email, 'read-conv-draft', ['DRAFT', 'UNREAD']), threadId: 'read-authorized', to: [leadEmail] });
    await persistHistorical(mail(contactEmail, 'read-unrelated'));
    const row = (await call('/emails')).body.emails.find((item: GmailEmail) => item.correspondentAddresses?.includes(leadEmail));
    const provider = vi.fn(async () => Response.json({})); vi.stubGlobal('fetch', provider);
    const result = await call('/conversations/' + row.conversationId + '/read-state', 'PATCH', { isRead: true });
    expect(result.body).toMatchObject({ count: 1, completedMessageIds: ['read-authorized'], isRead: true, unreadCount: 1 });
    expect(provider).toHaveBeenCalledOnce();
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id, labels: { has: 'UNREAD' } } })).toBe(4);
  });
  it('retains partial progress, preserves concurrent labels and safely retries remaining unread messages', async () => {
    await persistHistorical(mail(leadEmail, 'partial-a')); await persistHistorical({ ...mail(leadEmail, 'partial-b'), threadId: 'partial-a' });
    const row = (await call('/emails')).body.emails[0];
    let writes = 0;
    const provider = vi.fn(async () => {
      if (++writes === 2) return Response.json({}, { status: 503 });
      await prisma.mailboxMessage.updateMany({ where: { accountId: account.id, providerMessageId: 'partial-a' }, data: { labels: ['INBOX', 'UNREAD', 'STARRED'] } });
      return Response.json({});
    }); vi.stubGlobal('fetch', provider);
    const failed = await call('/conversations/' + row.conversationId + '/read-state', 'PATCH', { isRead: true });
    expect(failed.status).toBe(503); expect(failed.body.error.code).toBe('GMAIL_OUTCOME_UNKNOWN');
    expect((await prisma.mailboxMessage.findUniqueOrThrow({ where: { accountId_providerMessageId: { accountId: account.id, providerMessageId: 'partial-a' } } })).labels).toEqual(['INBOX', 'STARRED']);
    expect((await call('/emails')).body.emails[0].isRead).toBe(false);
    expect((await prisma.emailAccount.findUniqueOrThrow({ where: { id: account.id } })).mailboxVersion).toBeGreaterThan(account.mailboxVersion);
    provider.mockImplementation(async () => Response.json({}));
    expect((await call('/conversations/' + row.conversationId + '/read-state', 'PATCH', { isRead: true })).body.count).toBe(1);
    expect(provider).toHaveBeenCalledTimes(3);
  });
  it('bounds slow processing, binds continuations to their action and scope, and excludes later arrivals', async () => {
    await persistHistorical(mail(leadEmail, 'bounded-a')); await persistHistorical({ ...mail(leadEmail, 'bounded-b'), threadId: 'bounded-a' });
    const row = (await call('/emails')).body.emails[0];
    let now = Date.now(); const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    const provider = vi.fn(async () => { now += 6000; return Response.json({}); }); vi.stubGlobal('fetch', provider);
    const first = await call('/conversations/' + row.conversationId + '/read-state', 'PATCH', { isRead: true });
    expect(first.body.count).toBe(1); expect(first.body.nextPageToken).toBeTruthy(); expect(provider).toHaveBeenCalledOnce();
    clock.mockRestore();
    await persistHistorical({ ...mail(leadEmail, 'bounded-new'), threadId: 'bounded-a' }, { createdAt: new Date(Date.now() + 1000) });
    expect((await call('/conversations/' + row.conversationId + '/read-state', 'PATCH', { isRead: false, pageToken: first.body.nextPageToken })).status).toBe(409);
    provider.mockImplementation(async () => Response.json({}));
    const last = await call('/conversations/' + row.conversationId + '/read-state', 'PATCH', { isRead: true, pageToken: first.body.nextPageToken });
    expect(last.body).toMatchObject({ count: 1, completedMessageIds: ['bounded-b'], isRead: false });
    expect(last.body.nextPageToken).toBeUndefined(); expect(provider).toHaveBeenCalledTimes(2);
    await crmActor.exit(async () => await prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: otherId } }));
    expect((await call('/conversations/' + row.conversationId + '/read-state', 'PATCH', { isRead: true, pageToken: first.body.nextPageToken })).status).toBe(409);
    expect(provider).toHaveBeenCalledTimes(2);
  });
  it('keeps failed provider updates unread and respects Gmail retryAt without duplicate attempts', async () => {
    await persistHistorical(mail(leadEmail, 'limited-a')); await persistHistorical({ ...mail(leadEmail, 'limited-b'), threadId: 'limited-a' });
    const row = (await call('/emails')).body.emails[0];
    let writes = 0;
    const provider = vi.fn(async () => ++writes === 1 ? Response.json({}) : Response.json({}, { status: 429, headers: { 'Retry-After': '120' } })); vi.stubGlobal('fetch', provider);
    const failed = await call('/conversations/' + row.conversationId + '/read-state', 'PATCH', { isRead: true });
    expect(failed.status).toBe(429); expect(failed.body.error.code).toBe('GMAIL_RATE_LIMITED');
    expect(Date.parse(failed.body.error.retryAt)).toBeGreaterThan(Date.now());
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id, labels: { has: 'UNREAD' } } })).toBe(1);
    expect((await call('/conversations/' + row.conversationId + '/read-state', 'PATCH', { isRead: true })).status).toBe(429);
    expect(provider).toHaveBeenCalledTimes(2);
  });
  it('stops subsequent writes and invalidates continuations when assignments change', async () => {
    await persistHistorical(mail(leadEmail, 'revoke-read-a')); await persistHistorical({ ...mail(leadEmail, 'revoke-read-b'), threadId: 'revoke-read-a' });
    const row = (await call('/emails')).body.emails[0];
    const provider = vi.fn(async () => {
      await crmActor.exit(async () => await prisma.lead.update({ where: { id: leadId }, data: { assignedUserId: otherId } }));
      return Response.json({});
    }); vi.stubGlobal('fetch', provider);
    expect((await call('/conversations/' + row.conversationId + '/read-state', 'PATCH', { isRead: true })).status).toBe(409);
    expect(provider).toHaveBeenCalledOnce();
    expect(await prisma.mailboxMessage.count({ where: { accountId: account.id, labels: { has: 'UNREAD' } } })).toBe(1);
  });
  it('does not consume incoming mail after the opening cutoff and retains manual Unread', async () => {
    await persistHistorical(mail(leadEmail, 'new-read-original'));
    const row = (await call('/emails')).body.emails[0];
    const provider = vi.fn(async () => {
      await persistHistorical({ ...mail(leadEmail, 'new-read-arrival'), threadId: 'new-read-original' }, { createdAt: new Date(Date.now() + 1000) });
      return Response.json({});
    }); vi.stubGlobal('fetch', provider);
    const result = await call('/conversations/' + row.conversationId + '/read-state', 'PATCH', { isRead: true });
    expect(result.body).toMatchObject({ count: 1, isRead: false, unreadCount: 1 });
    expect(result.body.nextPageToken).toBeUndefined(); expect(provider).toHaveBeenCalledOnce();
    provider.mockImplementation(async () => Response.json({}));
    expect((await call('/messages/new-read-original/read-state', 'PATCH', { isRead: false })).body.count).toBe(1);
    expect((await call('/emails')).body.emails[0].isRead).toBe(false);
  });
  it('preserves provider-confirmed Read after history sync and restores Unread for a new provider message', async () => {
    const original = mail(leadEmail, 'sync-read-original'); await scope(() => ingestMailboxMessages(account, [original], permissions));
    const row = (await call('/emails')).body.emails[0];
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({})));
    expect((await call('/conversations/' + row.conversationId + '/read-state', 'PATCH', { isRead: true })).body.isRead).toBe(true);
    await prisma.emailAccount.update({ where: { id: account.id }, data: { syncCursor: 'read-history', syncScopeHash: (await scope(() => resolveMailboxScope(account, permissions))).hash, lastSyncAt: new Date(Date.now() - 61000) } });
    const arrival = { ...mail(leadEmail, 'sync-read-new'), threadId: original.threadId };
    const provider = vi.fn(async (path: string | URL) => String(path).includes('/history?')
      ? Response.json({ history: [{ labelsRemoved: [{ message: { id: original.id } }], messagesAdded: [{ message: { id: arrival.id } }] }], historyId: 'read-history-next' })
      : Response.json(apiMail(String(path).includes(original.id) ? { ...original, labels: ['INBOX'], isRead: true } : arrival)));
    vi.stubGlobal('fetch', provider); await scope(() => syncMailbox(tenantId, userId, 'worker'));
    expect((await call('/threads/' + original.threadId)).body.emails[0].isRead).toBe(true);
    expect((await call('/emails')).body.emails[0]).toMatchObject({ isRead: false, messageCount: 2 });
    expect((await call('/unread-count')).body.unreadCount).toBe(1);
  });
  it('retains external You names and excludes the owner from group and outgoing summaries', async () => {
    await persistHistorical(mail(`You <${leadEmail}>`, 'named-you'));
    await persistHistorical({ ...mail(account.email, 'named-you-reply', ['SENT']), threadId: 'named-you', to: [`You <${leadEmail}>`] }, { recipientAddresses: [leadEmail] });
    await persistHistorical({ ...mail(`Doris <${leadEmail}>`, 'named-group'), to: [account.email, contactEmail] }, { recipientAddresses: [account.email, contactEmail], authorizationParticipants: [leadEmail, account.email, contactEmail].sort(), ccRecipients: [`Contact <${contactEmail}>`] });
    const rows = (await call('/emails')).body.emails;
    expect(rows.find((item: GmailEmail) => item.conversationKind === 'person').participants).toEqual(['You']);
    const group = rows.find((item: GmailEmail) => item.conversationKind === 'group');
    expect(group.participants.sort()).toEqual(['Contact', 'Doris']); expect(group.participants).not.toContain(account.email);
    const detail = (await call('/conversations/' + rows.find((item: GmailEmail) => item.conversationKind === 'person').conversationId)).body;
    expect(detail.emails.find((item: GmailEmail) => item.id === 'named-you-reply').from).toBe(account.email);
  });
  it('marks only authorized non-draft thread messages read, persists after success, increments revision and is idempotent', async () => {
    const incoming = mail(leadEmail, 'read-one');
    await scope(() => ingestMailboxMessages(account, [incoming, { ...mail(leadEmail, 'read-two'), threadId: incoming.threadId }, { ...mail(account.email, 'read-draft', ['DRAFT', 'UNREAD']), threadId: incoming.threadId, to: [leadEmail] }], permissions));
    const activities = await prisma.activity.count({ where: { tenantId, leadId } });
    const before = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    const provider = vi.fn(async () => Response.json({})); vi.stubGlobal('fetch', provider);
    const result = await call('/threads/read-one/read-state', 'PATCH', { isRead: true });
    expect(result.status).toBe(200); expect(result.body.count).toBe(2);
    expect(provider.mock.calls).toHaveLength(2);
    for (const [path, init] of provider.mock.calls as unknown as [string, RequestInit][]) {
      expect(path).not.toContain('read-draft'); expect(JSON.parse(String(init.body)).removeLabelIds).toEqual(['UNREAD']);
    }
    expect((await call('/unread-count')).body.unreadCount).toBe(0);
    expect((await call('/threads/read-one')).body.emails).toHaveLength(2);
    expect((await call('/threads/read-one/read-state', 'PATCH', { isRead: true })).body.count).toBe(0);
    expect(provider).toHaveBeenCalledTimes(2);
    expect((await prisma.emailAccount.findUniqueOrThrow({ where: { id: account.id } })).mailboxVersion).toBeGreaterThan(account.mailboxVersion);
    expect(await prisma.activity.count({ where: { tenantId, leadId } })).toBe(activities);
    const after = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(after.lastCustomerReplyAt).toEqual(before.lastCustomerReplyAt); expect(after.status).toBe(before.status);
    expect((await call('/threads/read-one/read-state', 'PATCH', { isRead: false })).body.count).toBe(2);
  });
  it('does not mark persisted email read when Google rejects the write', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'read-failed')], permissions));
    const provider = vi.fn(async () => Response.json({}, { status: 403 })); vi.stubGlobal('fetch', provider);
    expect((await call('/threads/read-failed/read-state', 'PATCH', { isRead: true })).status).toBe(403);
    expect((await call('/threads/read-failed')).body.emails[0].isRead).toBe(false);
    expect((await prisma.emailAccount.findUniqueOrThrow({ where: { id: account.id } })).mailboxVersion).toBe(account.mailboxVersion);
  });
  it.each(['archive', 'trash'])('applies %s to the authorized conversation without drafts or unrelated messages and preserves activity', async action => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'mutate-one'), { ...mail(leadEmail, 'mutate-two'), threadId: 'mutate-one' }, { ...mail(account.email, 'mutate-draft', ['DRAFT']), threadId: 'mutate-one', to: [leadEmail] }], permissions));
    await prisma.mailboxMessage.create({ data: { tenantId, accountId: account.id, providerMessageId: 'personal', threadId: 'mutate-one', direction: 'inbound', from: 'bank@example.com', fromAddress: 'bank@example.com', recipients: [account.email], recipientAddresses: [account.email], subject: 'Private', snippet: 'Private', body: 'Private', labels: ['INBOX'], sentAt: new Date() } });
    const activities = await prisma.activity.count({ where: { tenantId, leadId } });
    const provider = vi.fn(async () => Response.json({})); vi.stubGlobal('fetch', provider);
    expect((await call(`/threads/mutate-one/${action}`, 'POST', {})).body.count).toBe(2);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(provider.mock.calls.every(([path]) => !String(path).includes('personal') && !String(path).includes('mutate-draft'))).toBe(true);
    expect(await prisma.activity.count({ where: { tenantId, leadId } })).toBe(activities);
    expect((await call(`/${action}`, 'POST', { messageIds: ['mutate-draft'] })).status).toBe(404);
  });
  it('persists CC and normalized Reply-To on initial and repeated ingestion without rewriting the body', async () => {
    const original = apiMail(mail(leadEmail, 'headers'), [{ name: 'Cc', value: 'Sales <sales@example.test>, "Agent, One" <one@example.test>' }, { name: 'Reply-To', value: 'Reply <REPLY@example.test>' }]);
    const parsed = parseGmailMessage(original); await scope(() => ingestMailboxMessages(account, [parsed], permissions));
    expect((await call('/threads/headers')).body.emails[0]).toMatchObject({ cc: ['Sales <sales@example.test>', '"Agent, One" <one@example.test>'], replyToAddress: 'reply@example.test' });
    await scope(() => ingestMailboxMessages(account, [{ ...parsed, replyToAddress: 'updated@example.test', body: 'Do not replace history' }], permissions));
    const email = (await call('/threads/headers')).body.emails[0]; expect(email.replyToAddress).toBe('updated@example.test'); expect(email.body).toBe(parsed.body);
  });
  it.each(['broken', 'a@example.test, b@example.test', 'safe@example.test\r\nBcc: other@example.test', 'Reply <safe@example.test>\r\nBcc: other@example.test'])('rejects unsafe Reply-To as a delivery target: %j', value => {
    expect(parseGmailMessage(apiMail(mail(leadEmail), [{ name: 'Reply-To', value }])).replyToAddress).toBeNull();
  });
  it('blocks outside Reply-To, mixed recipients, and unauthorized forward sources before Gmail', async () => {
    await scope(() => ingestMailboxMessages(account, [{ ...mail(leadEmail, 'reply-source'), replyToAddress: 'bank@example.com' }], permissions));
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    const payload = { subject: 'Reply', body: '<p>Hello</p>' };
    expect((await call('/send', 'POST', { ...payload, to: 'bank@example.com', replyToMessageId: 'reply-source' })).status).toBe(403);
    expect((await call('/send', 'POST', { ...payload, to: [leadEmail, 'bank@example.com'] })).status).toBe(403);
    expect((await call('/drafts', 'POST', { ...payload, to: `${leadEmail}, bank@example.com` })).status).toBe(403);
    expect((await call('/send', 'POST', { ...payload, to: leadEmail, forwardSourceMessageId: 'personal-thread' })).status).toBe(404);
    expect(provider).not.toHaveBeenCalled();
  });
  async function setReadOnly(leadEdit = false, contactEdit = false) {
    const role = await prisma.roleDefinition.create({ data: { tenantId, name: 'Inbox access ' + randomUUID(), crmAssignmentRestricted: true } });
    await prisma.rolePermission.createMany({ data: [{ tenantId, roleId: role.id, module: 'leads', canView: true, canEdit: leadEdit }, { tenantId, roleId: role.id, module: 'contacts', canView: true, canEdit: contactEdit }] });
    await prisma.userRole.create({ data: { tenantId, roleId: role.id, userId } });
    await prisma.user.update({ where: { id: userId }, data: { role: role.name } });
  }
  it('allows scoped reading but rejects customer sends, drafts and scheduling for a read-only role', async () => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'read-only')], permissions)); await setReadOnly();
    const readable = await call('/threads/read-only');
    expect(readable.status, JSON.stringify(readable.body)).toBe(200);
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    const data = { to: leadEmail, subject: 'Inquiry', body: '<p>Hello</p>' };
    expect((await call('/send', 'POST', data)).status).toBe(403);
    expect((await call('/drafts', 'POST', data)).status).toBe(403);
    expect((await call('/scheduled', 'POST', { ...data, requestId: randomUUID(), scheduledAt: new Date(Date.now() + 3600000).toISOString() })).status).toBe(403);
    expect(provider).not.toHaveBeenCalled();
  });
  it('requires the specific customer module edit permission', async () => {
    await setReadOnly(true, false); const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    expect((await call('/send', 'POST', { to: contactEmail, subject: 'Inquiry', body: '<p>Hello</p>' })).status).toBe(403);
    expect(provider).not.toHaveBeenCalled();
  });
  it.each(['leads', 'contacts'])('requires current %s View permission for assigned email visibility', async module => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'lead-view'), mail(contactEmail, 'contact-view'), mail('info@camxian.com', 'fixed-view')], permissions));
    await setReadOnly();
    const userRole = await prisma.userRole.findFirstOrThrow({ where: { tenantId, userId } });
    await prisma.rolePermission.updateMany({ where: { tenantId, roleId: userRole.roleId, module }, data: { canView: false } });
    const result = await call('/emails');
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.emails.map((row: GmailEmail) => row.id).sort()).toEqual([module === 'leads' ? 'contact-view' : 'lead-view', 'fixed-view'].sort());
    expect((await call('/threads/' + (module === 'leads' ? 'lead-view' : 'contact-view'))).status).toBe(404);
  });
  it('rechecks revoked Edit permission at scheduled delivery', async () => {
    const queued = await queuedEmail(); await setReadOnly();
    await prisma.scheduledMailboxEmail.update({ where: { id: queued.item.id }, data: { scheduledAt: new Date(0) } });
    await runScheduledMailboxEmails(); expect(queued.sends()).toBe(0);
    expect((await prisma.scheduledMailboxEmail.findUniqueOrThrow({ where: { id: queued.item.id } })).status).toBe('failed');
  });
  it.each(['unassigned', 'archived', 'reassigned'])('removes %s records from every thread mutation scope', async state => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'revoked')], permissions));
    await prisma.lead.update({ where: { id: leadId }, data: state === 'archived' ? { isArchived: true } : { assignedUserId: state === 'unassigned' ? null : otherId } });
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    expect((await call('/emails')).body.emails).toHaveLength(0);
    expect((await call('/threads/revoked')).status).toBe(404);
    expect((await call('/threads/revoked/read-state', 'PATCH', { isRead: true })).status).toBe(404);
    for (const action of ['archive', 'trash']) expect((await call(`/threads/revoked/${action}`, 'POST', {})).status).toBe(404);
    expect((await call('/send', 'POST', { to: leadEmail, subject: 'Reply', body: 'Hello', replyToMessageId: 'revoked' })).status).toBe(404);
    expect(provider).not.toHaveBeenCalled();
  });
  it.each(['inactive', 'disconnected'])('rejects %s mailbox access before provider mutation', async state => {
    await scope(() => ingestMailboxMessages(account, [mail(leadEmail, 'disabled')], permissions));
    if (state === 'inactive') {
      await prisma.lead.updateMany({ where: { tenantId, assignedUserId: userId }, data: { assignedUserId: otherId } });
      await prisma.contact.updateMany({ where: { tenantId, assignedUserId: userId }, data: { assignedUserId: otherId } });
      await prisma.user.update({ where: { id: userId }, data: { status: 'INACTIVE' } });
    }
    else await prisma.emailAccount.update({ where: { id: account.id }, data: { isActive: false } });
    const provider = vi.fn(); vi.stubGlobal('fetch', provider);
    expect([401, 403, 409]).toContain((await call('/threads/disabled/read-state', 'PATCH', { isRead: true })).status);
    expect(provider).not.toHaveBeenCalled();
  });
  it('claims interactive sends once across concurrent retries and returns the saved receipt', async () => {
    const outgoing = { ...mail(account.email, 'once-sent', ['SENT']), to: [leadEmail] };
    let sends = 0;
    vi.stubGlobal('fetch', vi.fn(async (_path: string | URL, init?: RequestInit) => {
      if (init?.method === 'POST') { sends++; return Response.json({ id: outgoing.id, threadId: outgoing.threadId }); }
      return Response.json(apiMail(outgoing));
    }));
    const payload = { to: leadEmail, subject: 'One send', body: '<p>Details</p>', requestId: randomUUID() };
    const responses = await Promise.all([call('/send', 'POST', payload), call('/send', 'POST', payload)]);
    expect(responses.some(result => result.status === 200)).toBe(true);
    expect(responses.every(result => [200, 409].includes(result.status))).toBe(true);
    expect(sends).toBe(1);
    expect((await call('/send', 'POST', payload)).body.messageId).toBe(outgoing.id); expect(sends).toBe(1);
    expect((await call('/send', 'POST', { ...payload, body: 'Different content' })).status).toBe(409);
    expect(await prisma.mailboxSendReceipt.count({ where: { accountId: account.id } })).toBe(1);
  });
  it('does not replay an interactive send with an unknown provider outcome', async () => {
    const provider = vi.fn(async (_path: string | URL, init?: RequestInit) => {
      if (init?.method === 'POST') throw new Error('Connection lost after acceptance');
      return Response.json({ messages: [] });
    }); vi.stubGlobal('fetch', provider);
    const payload = { to: leadEmail, subject: 'Uncertain', body: '<p>Details</p>', requestId: randomUUID() };
    expect((await call('/send', 'POST', payload)).status).toBe(503);
    expect((await call('/send', 'POST', payload)).status).toBe(409);
    expect(provider.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    expect(provider.mock.calls.filter(([, init]) => init?.method !== 'POST')).toHaveLength(1);
    expect((await prisma.mailboxSendReceipt.findFirstOrThrow({ where: { accountId: account.id } })).status).toBe('uncertain');
  });
});
