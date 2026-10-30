import { beforeEach, expect, it, vi } from 'vitest';
import type { EmailAccount } from '@prisma/client';
const db = vi.hoisted(() => ({ lead: { findMany: vi.fn() }, contact: { findMany: vi.fn() }, user: { findMany: vi.fn() }, mailboxSendReceipt: { findMany: vi.fn() }, mailboxMessage: { findMany: vi.fn() } }));
vi.mock('../../config/database.config', () => ({ default: db }));
import { resolveMailboxScope, messageInScope, projectMailboxScope, scopedMessagesWhere, scopedMessagesSql, mailboxParticipants } from './mailbox-scope';
const account = { id: 'account', tenantId: 'tenant', userId: 'actor', email: 'actor@example.test' } as EmailAccount;
const permissions = { leadsView: true, contactsView: true, leadsEdit: true, contactsEdit: true, dealsEdit: false, dealsView: false };
const lead = (id: string, email: string, assignedUserId = 'actor', extra = {}) => ({ id, email, assignedUserId, isArchived: false, deletedAt: null, convertedAt: null, contactId: null, ...extra });
it('allows Client Admin same-tenant recipients without assignment but keeps unavailable duplicate vetoes', async () => {
  db.lead.findMany.mockResolvedValue([lead('other', 'other@example.test', 'other-agent'), lead('archived', 'blocked@example.test', 'other-agent', { isArchived: true }), lead('duplicate', 'blocked@example.test')]);
  db.contact.findMany.mockResolvedValue([]); db.mailboxMessage.findMany.mockResolvedValue([]);
  const scope = await resolveMailboxScope(account, { ...permissions, clientAdmin: true });
  expect(scope.addresses).toContain('other@example.test');
  expect(scope.addresses).not.toContain('blocked@example.test');
  expect(db.lead.findMany.mock.calls[0][0].where.tenantId).toBe(account.tenantId);
});
beforeEach(() => { vi.resetAllMocks(); db.lead.findMany.mockResolvedValue([lead('own', 'own@example.test')]); db.contact.findMany.mockResolvedValue([]); db.user.findMany.mockResolvedValue([]); db.mailboxSendReceipt.findMany.mockResolvedValue([]); db.mailboxMessage.findMany.mockResolvedValue([]); });

it('normalizes omitted administrator flags and permission property order in scope revisions', async () => {
  const before = await resolveMailboxScope(account, permissions);
  const after = await resolveMailboxScope(account, { clientAdmin: false, ...permissions });
  expect(after.hash).toBe(before.hash);
});
it('invalidates forward eligibility when employee status changes and rejects CRM address collisions', async () => {
  const employee = { id: 'employee', tenantId: account.tenantId, email: 'employee@camxian.com', role: 'Client Admin', status: 'ACTIVE' };
  db.user.findMany.mockResolvedValue([employee]);
  const eligible = await resolveMailboxScope(account, permissions);
  expect(eligible.forwardRecipientEmails).toEqual([employee.email]);
  db.user.findMany.mockResolvedValue([{ ...employee, status: 'INACTIVE' }]);
  const inactive = await resolveMailboxScope(account, permissions);
  expect(inactive.hash).not.toBe(eligible.hash); expect(inactive.forwardRecipientEmails).toEqual([]);
  db.user.findMany.mockResolvedValue([employee]); db.contact.findMany.mockResolvedValue([{ id: 'customer', email: employee.email, assignedUserId: 'other', isArchived: true }]);
  expect((await resolveMailboxScope(account, permissions)).forwardRecipientEmails).toEqual([]);
});
it('admits only exact receipt-proven employee copies, with no subject or thread bypass', async () => {
  const scope = await resolveMailboxScope(account, permissions);
  scope.forwardProofs = [{ rfcMessageId: '<employee-forward@test>', providerMessageId: null, sender: 'employee@camxian.com', recipients: [account.email], participants: [account.email, 'employee@camxian.com'].sort(), sourceMessageId: 'authorized-original' }];
  const copy = { id: 'received', threadId: 'internal-thread', from: 'employee@camxian.com', to: [account.email], rfcMessageId: '<employee-forward@test>', labels: ['INBOX'] };
  expect(messageInScope(copy, account.email, scope)).toBe(true);
  expect(messageInScope({ ...copy, rfcMessageId: '<unproven@test>' }, account.email, scope)).toBe(false);
  expect(messageInScope({ ...copy, from: 'foreign@camxian.com' }, account.email, scope)).toBe(false);
  for (const field of ['cc', 'bcc', 'replyToAddresses']) expect(messageInScope({ ...copy, [field]: ['external@example.test'] }, account.email, scope)).toBe(false);
  expect(messageInScope({ ...copy, labels: ['DRAFT'] }, account.email, scope)).toBe(false);
  expect(scopedMessagesWhere(account, scope).OR?.[0]).toMatchObject({ NOT: { labels: { has: 'DRAFT' } } });
  expect(scopedMessagesWhere(account, scope).OR).toEqual(expect.arrayContaining([expect.objectContaining({ fromAddress: copy.from, recipientAddresses: { equals: copy.to }, authorizationParticipants: { equals: scope.forwardProofs[0].participants } })]));
  expect(scopedMessagesSql(account, scope).values).toContain(copy.rfcMessageId);
});

it.each(['from', 'to', 'cc', 'bcc', 'replyToAddresses'] as const)('an unauthorized CRM participant in %s vetoes fixed-sender mail', async field => {
  db.lead.findMany.mockResolvedValue([lead('own', 'own@example.test'), lead('foreign', 'foreign@example.test', 'other')]);
  const scope = await resolveMailboxScope(account, permissions);
  const message = { from: 'info@camxian.com', to: [account.email], threadId: 'topic', [field]: field === 'from' ? 'foreign@example.test' : ['foreign@example.test'] };
  expect(messageInScope(message, account.email, scope)).toBe(false);
  expect(messageInScope({ from: 'info@camxian.com', to: [account.email], threadId: 'system' }, account.email, scope)).toBe(true);
});

it('newly unauthorized duplicate identity changes the scope and denies an otherwise assigned address', async () => {
  const before = await resolveMailboxScope(account, permissions);
  db.contact.findMany.mockResolvedValue([lead('duplicate', 'OWN@example.test', 'other')]);
  const after = await resolveMailboxScope(account, permissions);
  expect(after.hash).not.toBe(before.hash); expect(after.addresses).toEqual([]); expect(after.deniedAddresses).toEqual(['own@example.test']);
  expect(messageInScope({ from: 'own@example.test', to: [account.email], threadId: 'topic' }, account.email, after)).toBe(false);
  expect(scopedMessagesWhere(account, after).NOT).toContainEqual({ authorizationParticipants: { hasSome: ['own@example.test'] } });
  expect(scopedMessagesSql(account, after).text).toContain('"authorizationParticipants"');
});
it('excludes the connected mailbox self-address from the participant veto without hiding identity changes from the hash', async () => {
  const before = await resolveMailboxScope(account, permissions);
  db.lead.findMany.mockResolvedValue([lead('own', 'own@example.test'), lead('self-record', account.email, 'other')]);
  const scope = await resolveMailboxScope(account, permissions);
  expect(scope.hash).not.toBe(before.hash); expect(scope.deniedAddresses).not.toContain(account.email);
  expect(messageInScope({ from: 'info@camxian.com', to: [account.email], threadId: 'system' }, account.email, scope)).toBe(true);
  expect(scopedMessagesWhere(account, { ...scope, deniedAddresses: [account.email] }).NOT).toContainEqual({ authorizationParticipants: { hasSome: [] } });
  db.lead.findMany.mockResolvedValue([lead('self-record', account.email)]);
  const onlySelf = await resolveMailboxScope(account, permissions);
  expect(onlySelf.addresses).toEqual([]);
  expect(messageInScope({ from: account.email, to: [account.email], threadId: 'personal-note' }, account.email, onlySelf)).toBe(false);
});
it('uses exposed Bcc for outgoing eligibility while keeping arbitrary empty provider drafts outside scope', async () => {
  const scope = await resolveMailboxScope(account, permissions);
  expect(messageInScope({ from: account.email, to: [], bcc: ['own@example.test'], threadId: 'bcc-only' }, account.email, scope)).toBe(true);
  expect(messageInScope({ from: account.email, to: [], labels: ['DRAFT'], threadId: 'empty' }, account.email, scope)).toBe(false);
  expect(messageInScope({ from: account.email, to: [], labels: ['DRAFT'], crmDraft: true, threadId: 'empty' }, account.email, scope)).toBe(true);
});

it('collapses converted same-address sources into the Contact without granting historical aliases', async () => {
  db.lead.findMany.mockResolvedValue([lead('source', 'own@example.test', 'old-owner', { convertedAt: new Date(), contactId: 'contact' }), lead('old-address', 'obsolete@example.test', 'actor', { convertedAt: new Date(), contactId: 'contact' })]);
  db.contact.findMany.mockResolvedValue([lead('contact', 'own@example.test')]);
  const scope = await resolveMailboxScope(account, permissions);
  expect(scope.contactIds).toEqual(['contact']); expect(scope.leadIds).toEqual([]); expect(scope.addresses).toEqual(['own@example.test']);
  expect(scope.deniedAddresses).toEqual(['obsolete@example.test']);
});

it('validated Workflow projections authorize their record but preserve independent duplicate vetoes', async () => {
  db.lead.findMany.mockResolvedValue([lead('own', 'own@example.test', 'other'), lead('independent', 'own@example.test', 'other')]);
  const scope = await resolveMailboxScope(account, permissions);
  const projected = projectMailboxScope(scope, permissions, { type: 'lead', id: 'own', email: 'own@example.test', assignedUserId: 'actor' });
  expect(projected.addresses).toEqual([]); expect(projected.deniedAddresses).toEqual(['own@example.test']);
});

it('archive, View loss and email edits invalidate scope without alias inference', async () => {
  const initial = await resolveMailboxScope(account, permissions);
  db.lead.findMany.mockResolvedValue([lead('own', 'own+new@example.test', 'actor', { isArchived: true })]);
  const archived = await resolveMailboxScope(account, permissions);
  expect(archived.hash).not.toBe(initial.hash); expect(archived.deniedAddresses).toEqual(['own+new@example.test']);
  expect((await resolveMailboxScope(account, { ...permissions, leadsView: false })).hash).not.toBe(archived.hash);
  expect(mailboxParticipants({ from: 'System <INFO@CAMXIAN.COM>', to: ['actor@example.test'], replyToAddresses: ['one@example.test', 'two@example.test'] })).toEqual(['actor@example.test', 'info@camxian.com', 'one@example.test', 'two@example.test']);
  expect(mailboxParticipants({ from: 'info@camxian.com', to: ['actor@example.test'], replyToAddresses: ['bad\r\nBcc: foreign@example.test'] })).toBeUndefined();
});
