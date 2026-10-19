import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ComposeModal from './compose-modal';
import EmailConversationView from './email-conversation-view';
import { ManilaDateTimePicker } from '@/shared/components/ui/manila-date-time-picker';

const mocks = vi.hoisted(() => ({ schedule: vi.fn(), send: vi.fn(), save: vi.fn(), remove: vi.fn(), thread: vi.fn(), read: vi.fn(), associate: vi.fn() }));
vi.mock('../services/gmail.service', () => ({ fetchGmailMessageContent: () => new Promise(() => {}), fetchGmailAttachment: vi.fn(), associateThreadDeal: mocks.associate, scheduleGmailEmail: mocks.schedule, sendGmailEmail: mocks.send, saveGmailDraft: mocks.save, deleteGmailDraft: mocks.remove, fetchGmailThread: mocks.thread, setGmailThreadReadState: mocks.read }));
vi.mock('motion/react', () => ({ motion: { div: ({ initial, animate, exit, transition, ...props }: any) => <div {...props} /> }, AnimatePresence: ({ children }: any) => children, useReducedMotion: () => true }));
const email = { id: 'message1', threadId: 'thread1', from: 'Customer <customer@example.test>', to: ['staff@camxian.com'], subject: 'Telephone inquiry', body: '<p>Question</p><script>bad()</script>', snippet: 'Question', date: '2026-10-07T00:00:00Z', labels: ['INBOX'], isRead: false, direction: 'inbound' as const };
beforeEach(() => { vi.clearAllMocks(); mocks.schedule.mockResolvedValue({ id: 'scheduled', status: 'pending' }); mocks.read.mockResolvedValue({ success: true }); mocks.thread.mockResolvedValue({ emails: [email], dealOptions: [], canAssociateDeal: false }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
async function composer() {
  const onClose = vi.fn(), onSent = vi.fn();
  render(<ComposeModal isOpen onClose={onClose} onSent={onSent} initialDraft={{ to: 'customer@example.test', subject: 'Inquiry', body: '<p>Details</p>', replyToMessageId: email.id }} />);
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Email body' }).textContent).toBe('Details'));
  return { onClose, onSent };
}
it('Cancel leaves the message open without scheduling or sending', async () => {
  await composer(); fireEvent.click(screen.getByLabelText('Schedule send options')); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('group', { name: 'Choose scheduled date and time' })).toBeNull();
  expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('customer@example.test');
  expect(mocks.schedule).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
});
it('Done queues a future UTC instant through the server and never sends immediately', async () => {
  const { onClose, onSent } = await composer();
  fireEvent.click(screen.getByLabelText('Schedule send options')); fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  const payload = mocks.schedule.mock.calls[0][0];
  expect(payload).toMatchObject({ to: ['customer@example.test'], subject: 'Inquiry', body: '<p>Details</p>', replyToMessageId: email.id });
  expect(Date.parse(payload.scheduledAt)).toBeGreaterThan(Date.now()); expect(payload.scheduledAt).toMatch(/Z$/); expect(payload.requestId).toMatch(/^[\da-f-]{36}$/);
  expect(mocks.send).not.toHaveBeenCalled(); expect(onSent).toHaveBeenCalledOnce();
});
it('retains the idempotency key when retrying an unchanged schedule after a lost response', async () => {
  mocks.schedule.mockRejectedValueOnce(new Error('Connection lost'));
  await composer(); fireEvent.click(screen.getByLabelText('Schedule send options')); fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  await screen.findByText('Connection lost'); fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(mocks.schedule).toHaveBeenCalledTimes(2));
  expect(mocks.schedule.mock.calls[1][0].requestId).toBe(mocks.schedule.mock.calls[0][0].requestId);
});
it('rejects elapsed Manila time without rolling email delivery to tomorrow', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T05:30:00Z'));
  const done = vi.fn(); render(<ManilaDateTimePicker value="2026-10-08T13:29" onDone={done} onCancel={vi.fn()} />);
  expect((screen.getByRole('button', { name: 'Done' }) as HTMLButtonElement).disabled).toBe(true); expect(done).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Schedule minute'), { target: { value: '31' } });
  fireEvent.click(screen.getByRole('button', { name: 'Done' })); expect(done).toHaveBeenCalledWith('2026-10-08T13:31');
});
it('preserves edited body, subject and recipient through minimize and fullscreen', async () => {
  await composer();
  screen.getByRole('textbox', { name: 'Email body' }).innerHTML = '<p>Keep my <strong>edited</strong> draft</p>';
  fireEvent.click(screen.getByLabelText('Minimize'));
  expect(screen.queryByRole('textbox', { name: 'Email body' })).toBeNull();
  fireEvent.click(screen.getByLabelText('Maximize'));
  expect(screen.getByRole('textbox', { name: 'Email body' }).innerHTML).toBe('<p>Keep my <strong>edited</strong> draft</p>');
  expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('customer@example.test');
  expect((screen.getByPlaceholderText('Subject') as HTMLInputElement).value).toBe('Inquiry');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(mocks.send).not.toHaveBeenCalled();
});
it('reuses the immediate send key after a lost response and blocks simultaneous submits', async () => {
  mocks.send.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({ messageId: 'sent', threadId: 'thread' });
  await composer();
  fireEvent.click(screen.getByLabelText('Send email')); fireEvent.click(screen.getByLabelText('Send email'));
  await screen.findByRole('alert'); expect(mocks.send).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByLabelText('Send email'));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
  expect(mocks.send.mock.calls[1][6]).toBe(mocks.send.mock.calls[0][6]);
  expect(mocks.send.mock.calls[0][6]).toMatch(/^[\da-f-]{36}$/);
});
it('preserves independently authored work and its draft-save key through close and scope refresh', async () => {
  mocks.save.mockRejectedValueOnce(new Error('Draft response lost')).mockResolvedValueOnce({ draftId: 'saved', messageId: 'saved-message' });
  const onClose = vi.fn(), onSent = vi.fn();
  const view = render(<ComposeModal isOpen onClose={onClose} onSent={onSent} authorizationRevision={0} />);
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Email body' }).innerHTML).toBe(''));
  fireEvent.change(screen.getByLabelText('To'), { target: { value: 'customer@example.test' } });
  fireEvent.change(screen.getByPlaceholderText('Subject'), { target: { value: 'My authored message' } });
  screen.getByRole('textbox', { name: 'Email body' }).innerHTML = '<p>Keep my work</p>';
  fireEvent.click(screen.getByLabelText('Save as draft'));
  await screen.findByText('Draft response lost');
  const requestId = mocks.save.mock.calls[0][6];
  fireEvent.click(screen.getByLabelText('Close'));
  view.rerender(<ComposeModal isOpen={false} onClose={onClose} onSent={onSent} authorizationRevision={0} />);
  view.rerender(<ComposeModal isOpen onClose={onClose} onSent={onSent} authorizationRevision={1} />);
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Email body' }).innerHTML).toBe('<p>Keep my work</p>'));
  expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('customer@example.test');
  expect((screen.getByPlaceholderText('Subject') as HTMLInputElement).value).toBe('My authored message');
  fireEvent.click(screen.getByLabelText('Save as draft'));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
  expect(mocks.save.mock.calls[1][6]).toBe(requestId);
});
it('clears a newly saved provider draft when mailbox authorization changes', async () => {
  mocks.save.mockResolvedValue({ draftId: 'saved', messageId: 'saved-message' });
  const onClose = vi.fn(), onSent = vi.fn();
  const view = render(<ComposeModal isOpen onClose={onClose} onSent={onSent} authorizationRevision={0} />);
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Email body' }).innerHTML).toBe(''));
  fireEvent.change(screen.getByLabelText('To'), { target: { value: 'customer@example.test' } });
  screen.getByRole('textbox', { name: 'Email body' }).innerHTML = '<p>Provider draft</p>';
  fireEvent.click(screen.getByLabelText('Save as draft'));
  await screen.findByText('Draft saved');
  view.rerender(<ComposeModal isOpen onClose={onClose} onSent={onSent} authorizationRevision={1} />);
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('');
  expect(screen.getByRole('textbox', { name: 'Email body' }).innerHTML).toBe('');
});
it.each(['reply', 'replyAll', 'forward'] as const)('restores saved %s draft with its exact original source', async composeMode => {
  mocks.save.mockResolvedValue({ draftId: 'saved', messageId: 'saved-message' });
  const source = composeMode === 'forward' ? { forwardSourceMessageId: 'older-topic' } : { replyToMessageId: 'older-topic' };
  render(<ComposeModal isOpen onClose={vi.fn()} onSent={vi.fn()} initialDraft={{ to: 'customer@example.test', subject: composeMode === 'forward' ? 'Fwd: Inquiry' : 'Re: Inquiry', body: '<p>Authored details</p>', draftId: 'saved', composeMode, ...source }} />);
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Email body' }).textContent).toBe('Authored details'));
  fireEvent.click(screen.getByLabelText('Save as draft'));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  expect(mocks.save.mock.calls[0][4]).toBe(source.replyToMessageId);
  expect(mocks.save.mock.calls[0][5]).toBe(source.forwardSourceMessageId);
  expect(mocks.save.mock.calls[0][7]).toBe(composeMode);
});
it('requires explicit authorized original message and action for legacy drafts without changing authored text', async () => {
  mocks.save.mockResolvedValue({ draftId: 'saved', messageId: 'saved-message' });
  render(<ComposeModal isOpen onClose={vi.fn()} onSent={vi.fn()} initialDraft={{ to: 'customer@example.test', subject: 'Fwd: Inquiry', body: '<p>Keep legacy authored details</p>', draftId: 'saved', draftContextRequired: true, draftThreadId: email.threadId }} />);
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Email body' }).textContent).toBe('Keep legacy authored details'));
  await waitFor(() => expect(screen.getByLabelText('Original message for draft').querySelectorAll('option')).toHaveLength(2));
  for (const label of ['Send email', 'Schedule send options', 'Save as draft']) expect((screen.getByLabelText(label) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Draft action'), { target: { value: 'forward' } });
  fireEvent.change(screen.getByLabelText('Original message for draft'), { target: { value: email.id } });
  fireEvent.click(screen.getByLabelText('Save as draft'));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  expect(mocks.save.mock.calls[0][2]).toBe('<p>Keep legacy authored details</p>');
  expect(mocks.save.mock.calls[0][4]).toBeUndefined(); expect(mocks.save.mock.calls[0][5]).toBe(email.id); expect(mocks.save.mock.calls[0][7]).toBe('forward');
});
it('keeps the draft open and pauses send, schedule and save until provider retryAt', async () => {
  mocks.send.mockRejectedValueOnce(Object.assign(new Error('Gmail updates are temporarily paused.'), { status: 429, retryAt: new Date(Date.now() + 60000).toISOString() }));
  await composer(); fireEvent.click(screen.getByLabelText('Send email'));
  await screen.findByRole('alert');
  for (const label of ['Send email', 'Schedule send options', 'Save as draft']) expect((screen.getByLabelText(label) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('textbox', { name: 'Email body' }).textContent).toBe('Details');
  fireEvent.click(screen.getByLabelText('Send email')); expect(mocks.send).toHaveBeenCalledOnce();
});
it('reuses the composer for Reply and sanitizes Forward', async () => {
  render(<EmailConversationView email={email} onBack={vi.fn()} onEmailsChanged={vi.fn()} />);
  await waitFor(() => expect(screen.queryByText('Loading conversation…')).toBeNull());
  fireEvent.click(screen.getAllByRole('button', { name: 'Reply' })[0]);
  expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('customer@example.test'); expect((screen.getByPlaceholderText('Subject') as HTMLInputElement).value).toBe('Re: Telephone inquiry');
  fireEvent.click(screen.getByLabelText('Close')); fireEvent.click(screen.getAllByRole('button', { name: 'Forward' })[0]);
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Email body' }).textContent).toContain('Forwarded message'));
  expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe(''); expect(document.querySelector('[contenteditable] script')).toBeNull();
});
it('removes a formerly selected message when the authorized thread changes', async () => {
  mocks.thread.mockResolvedValueOnce({ emails: [email], dealOptions: [], canAssociateDeal: false }).mockResolvedValueOnce({ emails: [{ ...email, id: 'message2', subject: 'Still authorized' }], dealOptions: [], canAssociateDeal: false });
  const props = { email, onBack: vi.fn(), onEmailsChanged: vi.fn() };
  const view = render(<EmailConversationView {...props} revision={0} />);
  await waitFor(() => expect(screen.queryByText('Loading conversation…')).toBeNull());
  view.rerender(<EmailConversationView {...props} revision={1} />);
  await screen.findByRole('heading', { name: 'Still authorized' }); expect(screen.queryByRole('heading', { name: email.subject })).toBeNull();
});

it('retains the originating Deal and retries failed association without delivering a second email', async () => {
  mocks.send.mockResolvedValue({ messageId: 'sent', threadId: 'thread-for-source' });
  mocks.associate.mockRejectedValueOnce(new Error('Link unavailable')).mockResolvedValueOnce({ success: true });
  const close = vi.fn(), sent = vi.fn(), linkResult = vi.fn();
  render(<ComposeModal isOpen onClose={close} onSent={sent} onDealLinkResult={linkResult} initialDraft={{ to: 'customer@example.test', subject: 'Inquiry', body: '<p>Details</p>', sourceDealId: 'originating-deal' }} />);
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Email body' }).textContent).toBe('Details'));
  expect((screen.getByLabelText('Schedule send options') as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText('Send email'));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Email sent, but linking to the Deal failed.');
  expect(mocks.associate).toHaveBeenCalledWith('thread-for-source', 'originating-deal', { messageId: 'sent' });
  expect(close).not.toHaveBeenCalled(); expect(sent).toHaveBeenCalledOnce(); expect(mocks.send).toHaveBeenCalledOnce();
  expect(linkResult).toHaveBeenCalledWith({ threadId: 'thread-for-source', sourceDealId: 'originating-deal', messageId: 'sent' }, false);
  fireEvent.click(screen.getByLabelText('Retry deal link'));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(mocks.associate).toHaveBeenCalledTimes(2); expect(mocks.send).toHaveBeenCalledOnce(); expect(sent).toHaveBeenCalledOnce();
});
