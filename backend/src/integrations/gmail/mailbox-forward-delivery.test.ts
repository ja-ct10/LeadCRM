import { expect, it } from 'vitest';
import type { EmailAccount } from '@prisma/client';
import { internalMailboxStates, nextInternalMailboxState, overlayInternalLabels } from './mailbox-forward-delivery';

const owner = { id: 'recipient-mailbox', userId: 'recipient' } as EmailAccount;
it('combines pending read and archive changes without changing other labels', () => {
  const read = nextInternalMailboxState(undefined, owner, 'read');
  const archived = nextInternalMailboxState(read, owner, 'archive');
  expect(archived.version).toBe(2);
  expect(overlayInternalLabels(['INBOX', 'UNREAD', 'IMPORTANT'], archived)).toEqual(['IMPORTANT']);
  expect(overlayInternalLabels(['IMPORTANT'], nextInternalMailboxState(archived, owner, 'restore'))).toEqual(['IMPORTANT', 'INBOX']);
});
it('does not replay acknowledged local intent after newer Gmail changes', () => {
  const acknowledged = { ...nextInternalMailboxState(undefined, owner, 'trash'), pending: false };
  const unread = nextInternalMailboxState(acknowledged, owner, 'unread');
  expect(unread).not.toHaveProperty('trash');
  expect(unread.version).toBe(2);
  expect(overlayInternalLabels(['INBOX'], unread)).toEqual(['INBOX', 'UNREAD']);
});
it('preserves the copy owner and bounds pending state to server receipt metadata', () => {
  const state = nextInternalMailboxState(undefined, owner, 'trash');
  expect(internalMailboxStates({ mailboxActions: { message: state } })).toEqual({ message: state });
  expect(overlayInternalLabels(['INBOX', 'UNREAD'], state)).toEqual(['UNREAD', 'TRASH']);
  expect(overlayInternalLabels(['INBOX'], { ...state, pending: false })).toEqual(['INBOX']);
});
