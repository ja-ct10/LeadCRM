import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/errors/app-error';
import { scopedMessagesWhere, type MailboxScope } from '../../../integrations/gmail/mailbox-scope';
import type { EmailAccount } from '@prisma/client';

const state = vi.hoisted(() => ({
  actor: undefined as { tenantId: string; userId: string } | undefined,
  authorize: vi.fn(), policy: vi.fn(),
  db: {
    activity: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
    mailboxMessage: { findMany: vi.fn() },
    lead: { findFirst: vi.fn(), findMany: vi.fn() }, contact: { findFirst: vi.fn(), findMany: vi.fn() },
    account: { findFirst: vi.fn() }, deal: { findFirst: vi.fn(), findMany: vi.fn() },
    leadDeal: { findMany: vi.fn() }, contactDeal: { findMany: vi.fn() }, task: { findMany: vi.fn() },
  },
}));
vi.mock('../../../config/database.config', () => ({ default: state.db }));
vi.mock('../../../integrations/gmail/mailbox-store', () => ({ authorizedMailbox: state.authorize }));
vi.mock('../access/crm-record-access.service', () => ({
  crmActor: { getStore: () => state.actor }, resolveCrmActor: state.policy, assertCrmRecordMutation: vi.fn(),
}));
vi.mock('../leads/lead-automation.service', () => ({ salesTransaction: (work: (tx: unknown) => unknown) => work(state.db) }));

import { emailActivityVisibility, findActivityById, findAllActivities, withEmailContent } from './activities.repository';
import { getActivity } from './activities.service';
import { getAccountRelationships, getContactRelationships, getDealRelationships, getLeadRelationships } from '../relationships/relationships.service';

const account = { id: 'mailbox', tenantId: 'tenant', userId: 'actor', email: 'actor@example.test' } as EmailAccount;
const scope: MailboxScope = { userId: 'actor', addresses: ['own@example.test'], deniedAddresses: ['other@example.test'],
  identities: [], leadIds: ['lead'], contactIds: ['contact'], fixedThreadIds: [], threadRecipients: {}, draftSourceIds: [], hash: 'scope' };
const access = { account, scope };
const nonEmail = { type: { not: 'email' } };
const mailboxGate = () => ({ OR: [nonEmail, { mailboxMessage: { is: scopedMessagesWhere(account, scope, true) } }] });
const email = { id: 'activity', type: 'email', title: 'Private subject', leadId: 'lead', contactId: null,
  mailboxMessageId: 'canonical', metadata: { mailboxMessageId: 'forged', email: { body: 'old body' } }, createdAt: new Date('2026-10-01T00:00:00Z') };
const message = { id: 'canonical', leadId: null, contactId: 'contact', providerMessageId: 'provider', threadId: 'thread', accountId: account.id,
  direction: 'inbound', from: 'own@example.test', recipients: [account.email], subject: 'Current subject', sentAt: new Date('2026-10-01T00:00:00Z'), body: 'Current body' };

beforeEach(() => {
  vi.resetAllMocks(); state.actor = { tenantId: 'tenant', userId: 'actor' };
  state.policy.mockResolvedValue({ clientAdmin: true, permissions: {} });
  state.authorize.mockResolvedValue(access);
  state.db.activity.findMany.mockResolvedValue([]); state.db.activity.count.mockResolvedValue(0); state.db.activity.findFirst.mockResolvedValue(null);
  state.db.mailboxMessage.findMany.mockResolvedValue([]);
  for (const model of [state.db.lead, state.db.contact, state.db.account, state.db.deal]) model.findFirst.mockResolvedValue({ id: 'record', accountId: null, contactId: null });
  for (const model of [state.db.lead, state.db.contact, state.db.deal, state.db.leadDeal, state.db.contactDeal, state.db.task]) model.findMany.mockResolvedValue([]);
});

describe('Activity email authorization before reads', () => {
  it.each([undefined, { tenantId: 'other', userId: 'actor' }])('hides email without a matching request actor (%j)', async actor => {
    state.actor = actor;
    expect(await emailActivityVisibility('tenant')).toEqual(nonEmail);
    expect(state.authorize).not.toHaveBeenCalled();
    expect(await withEmailContent('tenant', [email])).toEqual([]);
  });

  it.each([401, 403, 404, 409])('does not let administrative identity bypass denied or unavailable mailbox access (%i)', async status => {
    state.authorize.mockRejectedValue(new AppError('Mailbox unavailable', status));
    expect(await emailActivityVisibility('tenant')).toEqual(nonEmail);
    await findAllActivities('tenant', { type: 'email', search: 'Private subject', page: 2, limit: 1 });
    expect(state.db.activity.findMany.mock.calls[0][0]).toMatchObject({ where: { type: { in: ['email'] }, AND: expect.arrayContaining([nonEmail]) }, skip: 1, take: 2 });
    expect(state.db.activity.count.mock.calls[0][0].where).toEqual(state.db.activity.findMany.mock.calls[0][0].where);
    expect(await withEmailContent('tenant', [email, { type: 'note', title: 'Allowed note' }])).toEqual([{ type: 'note', title: 'Allowed note' }]);
    expect(state.db.mailboxMessage.findMany).not.toHaveBeenCalled();
  });

  it.each([new AppError('Database unavailable', 503), new Error('Unexpected lookup failure')])('propagates service failures instead of returning misleading empty results', async error => {
    state.authorize.mockRejectedValue(error);
    await expect(findAllActivities('tenant', { search: 'subject' })).rejects.toBe(error);
    expect(state.db.activity.findMany).not.toHaveBeenCalled(); expect(state.db.activity.count).not.toHaveBeenCalled();
  });

  it('applies the strict mailbox participant veto to both search rows and totals before cursor paging', async () => {
    const cursor = Buffer.from(JSON.stringify({ id: 'previous', createdAt: '2026-10-02T00:00:00Z' })).toString('base64url');
    await findAllActivities('tenant', { contactId: 'contact', type: 'email,note', search: 'Private subject', cursor, limit: 1 });
    const list = state.db.activity.findMany.mock.calls[0][0], count = state.db.activity.count.mock.calls[0][0];
    expect(list.where.AND).toContainEqual(mailboxGate()); expect(count.where.AND).toContainEqual(mailboxGate());
    expect(list.where.AND).toContainEqual({ OR: [{ createdAt: { lt: new Date('2026-10-02T00:00:00Z') } }, { createdAt: new Date('2026-10-02T00:00:00Z'), id: { lt: 'previous' } }] });
    expect(count.where.AND).toHaveLength(list.where.AND.length - 1);
    expect(list).toMatchObject({ where: { tenantId: 'tenant' }, skip: 0, take: 2 });
  });

  it('gates direct IDs and returns not found when mailbox access is revoked before hydration', async () => {
    await findActivityById('known-email', 'tenant');
    expect(state.db.activity.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'known-email', tenantId: 'tenant', AND: expect.arrayContaining([mailboxGate()]) });
    state.authorize.mockReset().mockResolvedValueOnce(access).mockRejectedValueOnce(new AppError('Revoked', 403));
    state.db.activity.findFirst.mockResolvedValue(email);
    await expect(getActivity('known-email', 'tenant')).rejects.toMatchObject({ statusCode: 404 });
    expect(state.db.mailboxMessage.findMany).not.toHaveBeenCalled();
  });

  it('rejects a revoked list after hydration instead of returning its previous total and cursor', async () => {
    state.authorize.mockReset().mockResolvedValueOnce(access).mockRejectedValue(new AppError('Revoked', 403));
    state.db.activity.findMany.mockResolvedValue([email, { ...email, id: 'next' }]);
    state.db.activity.count.mockResolvedValue(2);
    await expect(findAllActivities('tenant', { type: 'email', limit: 1 })).rejects.toMatchObject({ statusCode: 409, code: 'MAILBOX_SCOPE_CHANGED' });
    expect(state.db.activity.count).toHaveBeenCalled();
    expect(state.db.mailboxMessage.findMany).not.toHaveBeenCalled();
  });

  it('invalidates totals on duplicate-identity scope change even when the page contains no email rows', async () => {
    state.authorize.mockReset().mockResolvedValueOnce(access).mockResolvedValue({ ...access, scope: { ...scope, hash: 'new-denied-duplicate' } });
    state.db.activity.findMany.mockResolvedValue([{ id: 'note', type: 'note', title: 'Allowed note' }]);
    state.db.activity.count.mockResolvedValue(7);
    await expect(findAllActivities('tenant', { limit: 1 })).rejects.toMatchObject({ statusCode: 409, code: 'MAILBOX_SCOPE_CHANGED' });
    expect(state.db.activity.count).toHaveBeenCalled();
  });

  it('hydrates the canonical FK and preserves converted Lead history instead of trusting metadata IDs', async () => {
    state.db.activity.findFirst.mockResolvedValue(email); state.db.mailboxMessage.findMany.mockResolvedValue([message]);
    const result = await getActivity(email.id, 'tenant');
    expect(state.db.mailboxMessage.findMany).toHaveBeenCalledWith({ where: { AND: [scopedMessagesWhere(account, scope, true), { id: { in: ['canonical'] } }] } });
    expect(result.metadata).toMatchObject({ mailboxMessageId: 'canonical', email: { id: 'canonical', body: 'Current body' } });
    expect((result.metadata as { email: { body: string } }).email.body).not.toBe('old body');
    expect(await withEmailContent('tenant', [{ ...email, mailboxMessageId: null }])).toEqual([]);
  });

  it('drops a body whose scope was revoked while the body query waited, including direct IDs', async () => {
    state.db.activity.findFirst.mockResolvedValue(email);
    state.db.mailboxMessage.findMany.mockImplementation(async () => {
      state.authorize.mockResolvedValue({ ...access, scope: { ...scope, hash: 'reassigned-during-body-read' } });
      return [message];
    });
    await expect(getActivity(email.id, 'tenant')).rejects.toMatchObject({ statusCode: 404 });
    expect(state.db.mailboxMessage.findMany).toHaveBeenCalled();
  });

  it.each([
    ['lead', getLeadRelationships], ['contact', getContactRelationships], ['account', getAccountRelationships], ['deal', getDealRelationships],
  ] as const)('gates %s relationship timeline before its limit and strips revoked email content', async (_kind, getRelationships) => {
    state.authorize.mockResolvedValueOnce(access).mockRejectedValueOnce(new AppError('Revoked', 403));
    state.db.activity.findMany.mockResolvedValue([email, { id: 'note', type: 'note', title: 'Allowed note' }]);
    const result = await getRelationships('record', 'tenant', 3);
    expect(state.db.activity.findMany.mock.calls[0][0]).toMatchObject({ where: { tenantId: 'tenant', AND: expect.arrayContaining([mailboxGate()]) }, take: 3, select: { mailboxMessageId: true } });
    expect(result.activities).toEqual([{ id: 'note', type: 'note', title: 'Allowed note' }]);
  });
});
