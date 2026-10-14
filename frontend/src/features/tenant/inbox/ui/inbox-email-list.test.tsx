import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import InboxEmailList from './inbox-email-list';
import type { GmailEmail } from '../services/gmail.service';

const mocks = vi.hoisted(() => ({ archive: vi.fn(), trash: vi.fn() }));
vi.mock('../services/gmail.service', () => ({ archiveGmailConversations: mocks.archive, trashGmailConversations: mocks.trash }));
const row: GmailEmail = { id: 'latest', threadId: 'thread', from: 'Doris <doris@example.test>', to: ['staff@example.test'], subject: 'Inquiry', snippet: 'Latest reply', body: '', date: '2026-10-08T01:00:00Z', isRead: false, labels: ['INBOX'], participants: ['Doris', 'You'], messageCount: 4 };
const props = () => ({ emails: [row], mailboxEmail: 'staff@example.test', totalCount: 1, onEmailsChanged: vi.fn().mockResolvedValue(undefined), onEmailClick: vi.fn() });
beforeEach(() => { vi.resetAllMocks(); mocks.archive.mockResolvedValue({}); mocks.trash.mockResolvedValue({}); });
afterEach(cleanup);

it('renders participant names, count and latest preview without changing the row layout', () => {
  const options = props(); render(<InboxEmailList {...options} />);
  expect(screen.getByText('Doris')).toBeTruthy(); expect(screen.queryByText(/Doris, You/)).toBeNull(); expect(screen.getByLabelText('4 messages')).toBeTruthy();
  expect(screen.getByText('— Latest reply')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Open email from Doris/ })); expect(options.onEmailClick).toHaveBeenCalledWith(row);
});
it('keeps the external name and count when the owner replies', () => {
  const conversationId = 'c_' + 'b'.repeat(32), options = props();
  const view = render(<InboxEmailList {...options} emails={[{ ...row, conversationId, participants: ['Doris'] }]} />);
  view.rerender(<InboxEmailList {...options} emails={[{ ...row, conversationId, participants: ['Doris'], from: 'Owner <staff@example.test>', to: ['Doris <doris@example.test>'], direction: 'outbound', messageCount: 5 }]} />);
  expect(screen.getByText('Doris')).toBeTruthy(); expect(screen.getByLabelText('5 messages')).toBeTruthy();
  expect(screen.queryByText(/You|Owner/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Open email from Doris: Inquiry' })).toBeTruthy();
});
it('excludes only the mailbox address from outgoing fallbacks, including external You names', () => {
  render(<InboxEmailList {...props()} emails={[{ ...row, participants: undefined, from: 'Owner <staff@example.test>', direction: 'outbound', to: ['Doris <doris@example.test>', 'You <real-you@example.test>'], cc: ['OWNER <STAFF@example.test>', 'missing-name@example.test'] }]} />);
  expect(screen.getByText('Doris, You, missing-name')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Open email from Doris, You, missing-name: Inquiry' })).toBeTruthy();
  expect(screen.queryByText(/You →|OWNER/)).toBeNull();
});
it('preserves an external correspondent whose actual display name is You', () => {
  render(<InboxEmailList {...props()} emails={[{ ...row, conversationId: 'c_' + 'c'.repeat(32), participants: ['You'], correspondentAddresses: ['real-you@example.test'] }]} />);
  expect(screen.getByText('You')).toBeTruthy(); expect(screen.getByLabelText('4 messages')).toBeTruthy();
});
it('retains correspondent selection when a different Gmail topic becomes the latest message', async () => {
  const conversationId = 'c_' + 'a'.repeat(32), options = { ...props(), emails: [{ ...row, conversationId }] };
  const view = render(<InboxEmailList {...options} />);
  fireEvent.click(screen.getByLabelText('Select all emails'));
  view.rerender(<InboxEmailList {...options} emails={[{ ...row, id: 'topic-new', threadId: 'different-thread', conversationId, messageCount: 7 }]} />);
  expect((screen.getByLabelText('Select all emails') as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByLabelText('Archive'));
  await waitFor(() => expect(mocks.archive).toHaveBeenCalledWith([conversationId]));
});
it.each(['Archive', 'Delete'])('selects visible conversations and sends stable thread IDs for %s', async action => {
  const options = props(), view = render(<InboxEmailList {...options} />);
  fireEvent.click(screen.getByLabelText('Select all emails'));
  view.rerender(<InboxEmailList {...options} emails={[{ ...row, id: 'new-latest', messageCount: 5 }]} />);
  expect((screen.getByLabelText('Select all emails') as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByLabelText(action));
  await waitFor(() => expect(action === 'Archive' ? mocks.archive : mocks.trash).toHaveBeenCalledWith(['thread']));
  expect(options.onEmailsChanged).toHaveBeenCalledOnce();
});
it('does not select drafts or scheduled entries', () => {
  render(<InboxEmailList {...props()} emails={[{ ...row, messageCount: undefined, labels: ['DRAFT'] }, { ...row, id: 'schedule', threadId: '', scheduledStatus: 'pending' }]} />);
  expect((screen.getByLabelText('Select all emails') as HTMLInputElement).disabled).toBe(true);
  expect(screen.getAllByRole('checkbox').every(input => (input as HTMLInputElement).disabled)).toBe(true);
});
it('clears a failed refresh spinner, reports the failure and restores cached conversations', async () => {
  let reject: (error: Error) => void;
  const refresh = vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
  render(<InboxEmailList {...props()} onEmailsChanged={refresh} />);
  fireEvent.click(screen.getByLabelText('Refresh')); fireEvent.click(screen.getByLabelText('Refresh'));
  expect(screen.getByRole('status', { name: 'Loading conversations' })).toBeTruthy(); expect(refresh).toHaveBeenCalledOnce();
  await act(async () => reject!(new Error('Try refresh again')));
  expect(screen.queryByRole('status', { name: 'Loading conversations' })).toBeNull(); expect(screen.getByText('Inquiry')).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toBe('Try refresh again');
});
