import { beforeEach, expect, it, vi } from 'vitest';
import type { EmailAccount } from '@prisma/client';
const db = vi.hoisted(() => ({ lead: { findMany: vi.fn() }, contact: { findMany: vi.fn() }, mailboxMessage: { findMany: vi.fn() } }));
vi.mock('../../config/database.config', () => ({ default: db }));
import { resolveMailboxScope, messageInScope, projectMailboxScope, scopedMessagesWhere, scopedMessagesSql, mailboxParticipants } from './mailbox-scope';
const account = { id: 'account', tenantId: 'tenant', userId: 'actor', email: 'actor@example.test' } as EmailAccount;
const permissions = { leadsView: true, contactsView: true, leadsEdit: true, contactsEdit: true, dealsEdit: false, dealsView: false };
const lead = (id: string, email: string, assignedUserId = 'actor', extra = {}) => ({ id, email, assignedUserId, isArchived: false, deletedAt: null, convertedAt: null, contactId: null, ...extra });
beforeEach(() => { vi.resetAllMocks(); db.lead.findMany.mockResolvedValue([lead('own', 'own@example.test')]); db.contact.findMany.mockResolvedValue([]); db.mailboxMessage.findMany.mockResolvedValue([]); });

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
