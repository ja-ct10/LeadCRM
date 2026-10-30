import { beforeEach, expect, it, vi } from 'vitest';
import type { MailboxMessage } from '@prisma/client';
import { MailboxComposeContextSchema } from '@leadcrm/shared';
const db = vi.hoisted(() => ({ mailboxSendReceipt: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() }, mailboxMessage: { findFirst: vi.fn() } }));
vi.mock('../../config/database.config', () => ({ default: db }));
import { draftComposeContext, draftComposeContexts, resolveDraftOperationContext } from './mailbox-draft-context';
const account = { id: 'account', tenantId: 'tenant' };
const row = { providerMessageId: 'draft-message', draftId: 'draft-id', sourceMessageId: null, rfcInReplyTo: null } as MailboxMessage;
beforeEach(() => { vi.resetAllMocks(); db.mailboxSendReceipt.findFirst.mockResolvedValue(null); db.mailboxSendReceipt.findUnique.mockResolvedValue(null); db.mailboxMessage.findFirst.mockResolvedValue(row); });
it.each(['compose', 'reply', 'replyAll', 'forward'] as const)('restores exact acknowledged %s intent without choosing another message', async composeMode => {
  const context = { composeMode, ...(composeMode === 'forward' ? { forwardSourceMessageId: 'original-forward' } : composeMode !== 'compose' ? { replyToMessageId: 'original-reply' } : {}) };
  db.mailboxSendReceipt.findFirst.mockResolvedValue({ authorizationContext: { ...context, recipients: ['customer@example.test'] } });
  expect(await draftComposeContext(account, row)).toEqual(context);
  expect(db.mailboxSendReceipt.findFirst.mock.calls[0][0].where).toMatchObject({ accountId: account.id, tenantId: account.tenantId, providerMessageId: row.providerMessageId, providerDraftId: row.draftId });
  expect(await resolveDraftOperationContext(account, { requestId: 'operation', draftId: row.draftId! })).toEqual(context);
});
it('requires explicit source selection for unverified older reply drafts', async () => {
  db.mailboxMessage.findFirst.mockResolvedValue({ ...row, rfcInReplyTo: '<old@example.test>' });
  expect(await draftComposeContext(account, { ...row, rfcInReplyTo: '<old@example.test>' })).toEqual({ draftContextRequired: true });
  await expect(resolveDraftOperationContext(account, { requestId: 'operation', draftId: row.draftId! })).rejects.toMatchObject({ code: 'MAILBOX_DRAFT_CONTEXT_REQUIRED' });
  expect(await resolveDraftOperationContext(account, { requestId: 'operation', draftId: row.draftId!, composeMode: 'forward', forwardSourceMessageId: 'selected-original' })).toEqual({ composeMode: 'forward', forwardSourceMessageId: 'selected-original' });
});
it('removes CRM context from new and restored forwards while retaining Reply context', async () => {
  const linked = { recordContext: { recordModule: 'leads' as const, recordId: 'lead' }, dealId: 'deal' };
  const context = { ...linked, composeMode: 'forward' as const, forwardSourceMessageId: 'original' };
  expect(await resolveDraftOperationContext(account, { requestId: 'operation', ...context })).toEqual({ ...context, recordContext: undefined, dealId: undefined });
  db.mailboxSendReceipt.findFirst.mockResolvedValue({ authorizationContext: context });
  expect(await draftComposeContext(account, row)).toEqual({ ...context, recordContext: undefined, dealId: undefined });
  expect(MailboxComposeContextSchema.parse({ ...linked, composeMode: 'reply', replyToMessageId: 'original' })).toMatchObject(linked);
});
it('keeps exact acknowledged forward intent available after delivery was rejected', async () => {
  const context = { composeMode: 'forward', forwardSourceMessageId: 'authorized-original' };
  db.mailboxSendReceipt.findFirst.mockResolvedValue({ authorizationContext: context });
  expect(await draftComposeContext(account, row)).toEqual(context);
  expect(db.mailboxSendReceipt.findFirst.mock.calls[0][0].where.AND).toEqual(expect.arrayContaining([expect.objectContaining({ OR: expect.arrayContaining([
    { status: 'failed', authorizationContext: { path: ['composeMode'], equals: 'forward' } },
  ]) })]));
});
it('rejects conflicting contracts and refuses to infer Compose from source-free legacy headers', async () => {
  expect(MailboxComposeContextSchema.safeParse({ composeMode: 'forward', replyToMessageId: 'wrong-source' }).success).toBe(false);
  expect(MailboxComposeContextSchema.safeParse({ composeMode: 'compose', forwardSourceMessageId: 'wrong-source' }).success).toBe(false);
  expect(MailboxComposeContextSchema.safeParse({ composeMode: 'replyAll' }).success).toBe(false);
  expect(await draftComposeContext(account, row)).toEqual({ draftContextRequired: true });
  await expect(resolveDraftOperationContext(account, { requestId: 'operation', draftId: row.draftId! })).rejects.toMatchObject({ code: 'MAILBOX_DRAFT_CONTEXT_REQUIRED' });
  await expect(resolveDraftOperationContext(account, { requestId: 'operation', draftId: row.draftId!, composeMode: 'compose' })).rejects.toMatchObject({ code: 'MAILBOX_DRAFT_CONTEXT_REQUIRED' });
  db.mailboxSendReceipt.findMany.mockResolvedValue([]);
  expect((await draftComposeContexts(account, [{ ...row, id: 'legacy' }])).get('legacy')).toEqual({ draftContextRequired: true });
});
it('batches page restoration while refusing a receipt for a replaced provider message', async () => {
  db.mailboxSendReceipt.findMany.mockResolvedValue([{ providerDraftId: 'draft-id', providerMessageId: 'draft-message', authorizationContext: { composeMode: 'replyAll', replyToMessageId: 'original' } }]);
  const current = { ...row, id: 'current' }, replaced = { ...row, id: 'replaced', providerMessageId: 'replacement', sourceMessageId: 'original' };
  const contexts = await draftComposeContexts(account, [current, replaced]);
  expect(contexts.get('current')).toEqual({ composeMode: 'replyAll', replyToMessageId: 'original' });
  expect(contexts.get('replaced')).toEqual({ draftContextRequired: true });
  expect(db.mailboxSendReceipt.findMany).toHaveBeenCalledOnce();
  expect(db.mailboxSendReceipt.findMany.mock.calls[0][0].where).toMatchObject({ tenantId: account.tenantId, accountId: account.id, OR: [
    { providerDraftId: row.draftId, providerMessageId: row.providerMessageId }, { providerDraftId: row.draftId, providerMessageId: 'replacement' },
  ] });
});
