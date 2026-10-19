import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { EmailAccount } from '@prisma/client';
import prisma from '../../config/database.config';
import app from '../../app';
import { tenantContext } from '../../core/tenant/tenant-context';
import { issueAuthSession } from '../../core/auth/auth-session';
import { encryptToken } from '../../core/encryption/crypto.service';
import { salesPipeline, salesTransaction } from '../../modules/crm/leads/lead-automation.service';
import { ingestMailboxMessages } from './mailbox-ingestion.service';
import { mailboxPermissions, mailboxSyncIntervalMs, startMailboxScheduler, syncMailbox } from './mailbox-sync.service';
import { resolveMailboxScope } from './mailbox-scope';
import type { GmailEmail } from './gmail.types';

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
const disposable = url.hostname === '127.0.0.1' && /^\/leadcrm_mailbox_test_\d+$/.test(url.pathname);
describe.skipIf(!disposable)('independent Sales-agent Gmail history', () => {
  type Agent = { id: string; account: EmailAccount; access: string; token?: string; leadId: string; contactId: string; dealId: string; email: string; contactEmail: string };
  let tenantId: string, roleId: string, agents: Agent[], server: Server, base: string;
  let messages: Map<string, Map<string, GmailEmail>>, reads: { userId: string; path: string }[], writes: number, loseAcknowledgement: boolean, failReads: boolean, historyDelayMs: number;
  const realFetch = globalThis.fetch;
  const scope = <T>(work: () => T) => tenantContext.run({ tenantId }, work);
  const permissions = { leadsView: true, contactsView: true, dealsView: true, leadsEdit: true, contactsEdit: true, dealsEdit: true };
  const mail = (agent: Agent, address = agent.email): GmailEmail => ({ id: randomUUID(), threadId: randomUUID(), from: address, to: [agent.account.email],
    subject: 'Agent history', body: '<p>Persisted agent reply</p>', snippet: 'Persisted agent reply', date: new Date(Date.now() - 1000).toISOString(), labels: ['INBOX'], isRead: true,
    rfcMessageId: `<${randomUUID()}@example.test>` });
  const apiMessage = (email: GmailEmail) => ({ id: email.id, threadId: email.threadId, labelIds: email.labels, snippet: email.snippet,
    internalDate: String(Date.parse(email.date)), payload: { mimeType: 'text/html', body: { data: Buffer.from(email.body).toString('base64url') },
      headers: [{ name: 'From', value: email.from }, { name: 'To', value: email.to.join(', ') }, { name: 'Subject', value: email.subject }, { name: 'Message-ID', value: email.rfcMessageId! }] } });
  async function call(agent: Agent, path: string, body?: unknown) {
    if (!agent.token) agent.token = (await issueAuthSession(await prisma.user.findUniqueOrThrow({ where: { id: agent.id } }))).token;
    const response = await realFetch(base + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${agent.token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  const send = (agent: Agent, requestId = randomUUID()) => call(agent, '/integrations/gmail/send', { requestId, to: agent.email, dealId: agent.dealId, subject: 'Agent history', body: '<p>Persisted agent send</p>' });
  beforeAll(async () => {
    server = app.listen(0, '127.0.0.1'); await new Promise<void>(done => server.once('listening', done));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  });
  beforeEach(async () => {
    tenantId = (await prisma.tenant.create({ data: { name: 'Two Sales mailboxes', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } })).id;
    roleId = (await prisma.roleDefinition.create({ data: { tenantId, name: 'Sales', crmAssignmentRestricted: true } })).id;
    await prisma.rolePermission.createMany({ data: ['leads', 'contacts', 'deals'].map(module => ({ tenantId, roleId, module, canView: true, canEdit: true, canCreate: true })) });
    const { pipeline, initial } = await scope(() => salesTransaction(tx => salesPipeline(tx, tenantId)));
    agents = []; messages = new Map(); reads = []; writes = 0; loseAcknowledgement = false; failReads = false; historyDelayMs = 0;
    for (const name of ['A', 'B']) {
      const user = await prisma.user.create({ data: { tenantId, email: `sales-${name}-${randomUUID()}@camxian.com`, firstName: name, lastName: 'Agent', role: 'Sales', mustChangePassword: false, onboardingCompletedAt: new Date() } });
      await prisma.userRole.create({ data: { tenantId, userId: user.id, roleId } });
      const access = 'isolated-' + user.id, email = randomUUID() + '@example.test', contactEmail = randomUUID() + '@example.test';
      const account = await prisma.emailAccount.create({ data: { tenantId, userId: user.id, email: user.email, accessToken: encryptToken(access), refreshToken: encryptToken('refresh-' + user.id), tokenExpiresAt: new Date(Date.now() + 3600000), scopes: ['https://www.googleapis.com/auth/gmail.modify'], syncCursor: 'cursor-' + name } });
      const lead = await prisma.lead.create({ data: { tenantId, assignedUserId: user.id, email, firstName: name, lastName: 'Lead', productInterest: [] } });
      const contact = await prisma.contact.create({ data: { tenantId, assignedUserId: user.id, email: contactEmail, firstName: name, lastName: 'Contact', productInterests: [] } });
      const deal = await prisma.deal.create({ data: { tenantId, pipelineId: pipeline.id, stageId: initial.id, assignedUserId: user.id, title: name + ' Deal', value: 0, productInterests: [], tags: [], leadDeals: { create: { leadId: lead.id } }, contactDeals: { create: { contactId: contact.id } } } });
      await scope(async () => prisma.emailAccount.update({ where: { id: account.id }, data: { syncScopeHash: (await resolveMailboxScope(account, permissions)).hash } }));
      agents.push({ id: user.id, account, access, leadId: lead.id, contactId: contact.id, dealId: deal.id, email, contactEmail });
      messages.set(user.id, new Map());
    }
    for (const agent of agents) await scope(async () => {
      const rights = await mailboxPermissions(tenantId, agent.id);
      await prisma.emailAccount.update({ where: { id: agent.account.id }, data: { syncScopeHash: (await resolveMailboxScope(agent.account, rights)).hash } });
    });
    vi.stubEnv('GMAIL_SYNC_INTERVAL_SECONDS', '10');
    vi.stubGlobal('fetch', vi.fn(async (target: string, init?: RequestInit) => {
      const endpoint = new URL(target);
      if (endpoint.hostname !== 'gmail.googleapis.com') throw new Error('Fixture attempted unexpected provider');
      const agent = agents.find(item => 'Bearer ' + item.access === new Headers(init?.headers).get('Authorization'));
      if (!agent) throw new Error('Wrong per-user Gmail token');
      const mailbox = messages.get(agent.id)!;
      if (init?.method === 'POST') {
        writes++;
        const raw = Buffer.from(JSON.parse(String(init.body)).raw, 'base64url').toString();
        const email = { ...mail(agent), from: agent.account.email, to: [raw.match(/To: ([^\r\n]+)/)![1]], labels: ['SENT'],
          body: raw.split('\r\n\r\n').slice(1).join('\r\n\r\n'), rfcMessageId: raw.match(/Message-ID: ([^\r\n]+)/)![1] };
        mailbox.set(email.id, email);
        if (loseAcknowledgement) throw new TypeError('Lost confirmed provider acknowledgement');
        return Response.json({ id: email.id, threadId: email.threadId });
      }
      reads.push({ userId: agent.id, path: endpoint.pathname + endpoint.search });
      if (failReads) return Response.json({ error: { message: 'Fixture failure' } }, { status: 400 });
      if (endpoint.pathname.endsWith('/profile')) return Response.json({ historyId: 'baseline-' + agent.id });
      if (endpoint.pathname.endsWith('/drafts')) return Response.json({ drafts: [] });
      if (endpoint.pathname.endsWith('/history')) {
        if (historyDelayMs) vi.setSystemTime(Date.now() + historyDelayMs);
        return Response.json({ historyId: 'history-' + agent.id, history: [{ messagesAdded: [...mailbox.values()].map(email => ({ message: { id: email.id } })) }] });
      }
      if (endpoint.pathname.endsWith('/messages')) return Response.json({ messages: [...mailbox.values()].map(email => ({ id: email.id, threadId: email.threadId })) });
      const email = mailbox.get(endpoint.pathname.split('/').at(-1)!);
      if (!email) return Response.json({}, { status: 404 });
      return Response.json(apiMessage(email));
    }));
  });
  afterEach(async () => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); await prisma.emailAccount.updateMany({ where: { tenantId }, data: { isActive: false } }); });
  afterAll(async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await prisma.$disconnect(); });

  it('persists B independently before A signs in, then isolates both sent and received histories and Deals', async () => {
    const [a, b] = agents, versionA = a.account.mailboxVersion;
    expect(a.account.accessToken).not.toBe(b.account.accessToken); expect(a.account.refreshToken).not.toBe(b.account.refreshToken);
    const sentB = await send(b); expect(sentB.status, JSON.stringify(sentB.body)).toBe(200);
    expect(a.token).toBeUndefined(); expect(await prisma.session.count({ where: { userId: a.id } })).toBe(0);
    expect(reads.every(read => read.userId === b.id)).toBe(true);
    expect((await prisma.emailAccount.findUniqueOrThrow({ where: { id: a.account.id } })).mailboxVersion).toBe(versionA);
    for (const agent of [b, a]) {
      if (agent === a) expect((await send(a)).status).toBe(200);
      const reply = mail(agent), contactReply = mail(agent, agent.contactEmail);
      messages.get(agent.id)!.set(reply.id, reply); messages.get(agent.id)!.set(contactReply.id, contactReply);
      await scope(() => syncMailbox(tenantId, agent.id, 'worker'));
      const lead = await call(agent, '/crm/activities?type=email&leadId=' + agent.leadId);
      expect(lead.status).toBe(200); expect(lead.body.total).toBe(2);
      expect(lead.body.data.every((row: { createdBy: { id: string } }) => row.createdBy.id === agent.id)).toBe(true);
      expect(lead.body.data[0].metadata.email.body).toContain('Persisted agent');
      expect(lead.body.data.every((row: { metadata: { mailboxOwnerId: string; email: { accountId: string } } }) => row.metadata.mailboxOwnerId === agent.id && row.metadata.email.accountId === agent.account.id)).toBe(true);
      expect((await call(agent, '/crm/activities?type=email&contactId=' + agent.contactId)).body.total).toBe(1);
      // New unrelated inbound threads have no Deal proof; only the explicitly linked send belongs here.
      expect((await call(agent, '/crm/activities?type=email&dealId=' + agent.dealId)).body.total).toBe(1);
      expect(await prisma.mailboxMessage.count({ where: { accountId: agent.account.id, dealId: null } })).toBe(2);
      expect(await prisma.mailboxMessage.count({ where: { accountId: agent.account.id } })).toBe(3);
      expect((await prisma.emailAccount.findUniqueOrThrow({ where: { id: agent.account.id } })).syncCursor).toBe('history-' + agent.id);
    }
    const denied = await call(a, '/crm/activities?type=email&leadId=' + b.leadId);
    expect([200, 403, 404]).toContain(denied.status); expect(denied.body.data ?? []).toEqual([]);
    const before = await prisma.activity.findMany({ where: { tenantId, type: 'email' }, orderBy: { id: 'asc' } });
    await scope(() => syncMailbox(tenantId, b.id));
    expect((await prisma.activity.findMany({ where: { tenantId, type: 'email' }, orderBy: { id: 'asc' } })).map(row => row.id)).toEqual(before.map(row => row.id));
  });

  it.each(['leads', 'contacts'] as const)('keeps an explicitly selected %s Deal when the subject changes and History recovers later', async recordModule => {
    const [agent, other] = agents;
    const recordId = recordModule === 'leads' ? agent.leadId : agent.contactId;
    const payload = { requestId: randomUUID(), to: recordModule === 'leads' ? agent.email : agent.contactEmail, subject: 'Manually edited subject', body: '<p>Details for the selected Deal</p>', composeMode: 'compose', recordContext: { recordModule, recordId }, dealId: agent.dealId };
    expect((await call(agent, '/integrations/gmail/send', { ...payload, dealId: other.dealId })).status).toBe(400);
    expect(writes).toBe(0);
    failReads = true;
    expect((await call(agent, '/integrations/gmail/send', payload)).status).toBe(200);
    failReads = false;
    await scope(() => syncMailbox(tenantId, agent.id, 'worker'));
    const stored = await prisma.mailboxMessage.findFirstOrThrow({ where: { tenantId, accountId: agent.account.id, direction: 'outbound' } });
    expect(stored.dealId).toBe(agent.dealId);
    expect(recordModule === 'leads' ? stored.leadId : stored.contactId).toBe(recordId);
    expect(await prisma.activity.count({ where: { tenantId, mailboxMessageId: stored.id, dealId: agent.dealId, type: 'email' } })).toBe(1);
    expect((await call(agent, '/integrations/gmail/send', payload)).status).toBe(200);
    expect(writes).toBe(1);
    expect((await call(other, '/integrations/gmail/send', { ...payload, requestId: randomUUID() })).status).toBe(403);
  });

  it('immediately ingests a recovered confirmed send and repairs a completed receipt without another write', async () => {
    const b = agents[1], requestId = randomUUID(); loseAcknowledgement = true;
    expect((await send(b, requestId)).status).toBe(503);
    loseAcknowledgement = false;
    const recovered = await send(b, requestId); expect(recovered.status).toBe(200); expect(writes).toBe(1);
    const activity = await prisma.activity.findFirstOrThrow({ where: { tenantId, leadId: b.leadId, type: 'email' } });
    expect(activity.createdById).toBe(b.id); expect(activity.dealId).toBe(b.dealId);
    await prisma.activity.delete({ where: { id: activity.id } });
    expect((await send(b, requestId)).status).toBe(200);
    expect((await prisma.activity.findUniqueOrThrow({ where: { id: activity.id } })).mailboxMessageId).toBe(activity.mailboxMessageId);
    expect(writes).toBe(1);
    await scope(() => syncMailbox(tenantId, b.id, 'worker'));
    expect(await prisma.activity.count({ where: { tenantId, leadId: b.leadId, type: 'email' } })).toBe(1);
  });

  it('keeps provider success and a sent receipt when ingestion fails, then recovers through History', async () => {
    const b = agents[1], requestId = randomUUID(); failReads = true;
    expect((await send(b, requestId)).status).toBe(200);
    expect(await prisma.mailboxMessage.count({ where: { accountId: b.account.id } })).toBe(0);
    expect((await prisma.mailboxSendReceipt.findUniqueOrThrow({ where: { accountId_requestId: { accountId: b.account.id, requestId } } })).status).toBe('sent');
    const pending = await prisma.emailAccount.findUniqueOrThrow({ where: { id: b.account.id } });
    expect(pending.syncRequestedAt).not.toBeNull(); expect(pending.syncError).toContain('Email was sent');
    failReads = false; await scope(() => syncMailbox(tenantId, b.id, 'worker'));
    expect((await call(b, '/crm/activities?type=email&leadId=' + b.leadId)).body.total).toBe(1);
    expect((await prisma.emailAccount.findUniqueOrThrow({ where: { id: b.account.id } })).syncError).toBeNull(); expect(writes).toBe(1);
  });

  it.each(['lead', 'contact'] as const)('captures View-only %s history, repairs replay and metadata sync, and retains Edit restrictions', async kind => {
    const b = agents[1];
    await prisma.rolePermission.updateMany({ where: { roleId }, data: { canEdit: false } });
    const rights = await scope(() => mailboxPermissions(tenantId, b.id));
    await scope(async () => prisma.emailAccount.update({ where: { id: b.account.id }, data: { syncScopeHash: (await resolveMailboxScope(b.account, rights)).hash } }));
    const email = mail(b, kind === 'lead' ? b.email : b.contactEmail);
    const customerWhere = kind === 'lead' ? { leadId: b.leadId } : { contactId: b.contactId };
    await scope(() => ingestMailboxMessages(b.account, [email], rights));
    const original = await prisma.activity.findFirstOrThrow({ where: { tenantId, type: 'email', ...customerWhere } });
    expect(original.createdById).toBe(b.id);
    const customer = kind === 'lead' ? await prisma.lead.findUniqueOrThrow({ where: { id: b.leadId } }) : await prisma.contact.findUniqueOrThrow({ where: { id: b.contactId } });
    expect(customer.lastCustomerReplyAt).toBeNull(); expect(customer.engagementEvaluatedAt).toBeNull();
    await prisma.activity.delete({ where: { id: original.id } });
    await scope(() => ingestMailboxMessages(b.account, [email], rights));
    expect((await prisma.activity.findUniqueOrThrow({ where: { id: original.id } })).createdAt).toEqual(new Date(email.date));
    await prisma.activity.delete({ where: { id: original.id } });
    messages.get(b.id)!.set(email.id, email);
    await scope(() => syncMailbox(tenantId, b.id, 'worker'));
    expect((await prisma.activity.findUniqueOrThrow({ where: { id: original.id } })).mailboxMessageId).toBe(original.mailboxMessageId);
    expect(reads.some(read => read.path.includes('format=full'))).toBe(false);
    expect((await send(b)).status).toBe(403); expect(writes).toBe(0);
    expect((await call(b, '/crm/activities?type=email&' + kind + 'Id=' + (kind === 'lead' ? b.leadId : b.contactId))).body.total).toBe(1);
  });

  it('honors a ten-second start-to-start cadence despite provider processing time', async () => {
    const b = agents[1], started = Date.now();
    historyDelayMs = 500;
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(started);
    await scope(() => syncMailbox(tenantId, b.id, 'worker'));
    expect((await prisma.emailAccount.findUniqueOrThrow({ where: { id: b.account.id } })).lastSyncAt).toEqual(new Date(started));
    vi.setSystemTime(started + 9999); await scope(() => syncMailbox(tenantId, b.id, 'worker'));
    expect(reads.filter(read => read.path.includes('/history'))).toHaveLength(1);
    vi.setSystemTime(started + 10000); await scope(() => syncMailbox(tenantId, b.id, 'worker'));
    expect(reads.filter(read => read.path.includes('/history'))).toHaveLength(2);
    vi.stubEnv('GMAIL_SYNC_INTERVAL_SECONDS', '60');
    vi.setSystemTime(started + 20000); await scope(() => syncMailbox(tenantId, b.id, 'worker'));
    expect(reads.filter(read => read.path.includes('/history'))).toHaveLength(2);
  });

  it('processes B in the existing scheduler even when A has invalid mailbox ownership', async () => {
    const [a, b] = agents, reply = mail(b); messages.get(b.id)!.set(reply.id, reply);
    await prisma.emailAccount.update({ where: { id: a.account.id }, data: { email: 'mismatch@example.test' } });
    const stop = startMailboxScheduler();
    try {
      await vi.waitFor(async () => expect(await prisma.activity.count({ where: { tenantId, createdById: b.id, type: 'email' } })).toBe(1), { timeout: 10000 });
      await vi.waitFor(async () => expect((await prisma.emailAccount.findUniqueOrThrow({ where: { id: b.account.id } })).syncLeaseId).toBeNull(), { timeout: 10000 });
      expect(reads.every(read => read.userId === b.id)).toBe(true);
      const status = await call(a, '/integrations/gmail/status');
      expect(status.body).toMatchObject({ isConnected: false, syncError: 'Mailbox ownership does not match, or temporary test access expired.' });
    } finally { await stop(); }
  });

  it('changes assignment scope without Gmail reconnection and hides the former agent history', async () => {
    const [a, b] = agents, reply = mail(b);
    await scope(() => ingestMailboxMessages(b.account, [reply], permissions));
    const previous = await scope(() => resolveMailboxScope(b.account, permissions));
    await prisma.lead.update({ where: { id: b.leadId }, data: { assignedUserId: a.id } });
    expect((await scope(() => resolveMailboxScope(b.account, permissions))).hash).not.toBe(previous.hash);
    expect((await scope(() => resolveMailboxScope(a.account, permissions))).leadIds).toContain(b.leadId);
    for (const agent of [a, b]) {
      const result = await call(agent, '/crm/activities?type=email&leadId=' + b.leadId);
      expect(result.body.data ?? []).toEqual([]);
    }
  });

  it('never rebinds another mailbox Activity when replay collides on its deterministic identity', async () => {
    const [a, b] = agents, email = mail(a);
    await scope(() => ingestMailboxMessages(a.account, [email], permissions));
    const original = await prisma.activity.findFirstOrThrow({ where: { tenantId, leadId: a.leadId, type: 'email' } });
    await prisma.lead.update({ where: { id: a.leadId }, data: { assignedUserId: b.id } });
    const replay = { ...email, id: randomUUID(), to: [b.account.email] };
    await scope(() => ingestMailboxMessages(b.account, [replay, replay], permissions));
    const retained = await prisma.activity.findUniqueOrThrow({ where: { id: original.id } });
    expect(retained.createdById).toBe(a.id); expect(retained.mailboxMessageId).toBe(original.mailboxMessageId);
    expect(await prisma.activity.count({ where: { tenantId, leadId: a.leadId, type: 'email' } })).toBe(1);
    expect((await call(b, '/crm/activities?type=email&leadId=' + a.leadId)).body.total).toBe(0);
  });

  it('keeps the existing Activity ID when a metadata replay recovers a missing RFC Message-ID', async () => {
    const b = agents[1], email = mail(b);
    await scope(() => ingestMailboxMessages(b.account, [{ ...email, rfcMessageId: undefined }], permissions));
    const original = await prisma.activity.findFirstOrThrow({ where: { tenantId, leadId: b.leadId, type: 'email' } });
    await scope(() => ingestMailboxMessages(b.account, [email, email], permissions));
    expect(await prisma.activity.count({ where: { mailboxMessageId: original.mailboxMessageId, type: 'email' } })).toBe(1);
    expect((await prisma.activity.findUniqueOrThrow({ where: { id: original.id } })).createdAt).toEqual(original.createdAt);
  });
});

it.each([undefined, '10', '60', '3600', '9', '3601', 'bad'])('uses the bounded sync default and override %s', seconds => {
  vi.stubEnv('GMAIL_SYNC_INTERVAL_SECONDS', seconds);
  expect(mailboxSyncIntervalMs()).toBe((seconds === '60' ? 60 : seconds === '3600' ? 3600 : 10) * 1000);
  vi.unstubAllEnvs();
});
