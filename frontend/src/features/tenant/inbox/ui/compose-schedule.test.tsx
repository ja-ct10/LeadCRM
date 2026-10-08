import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ComposeModal from './compose-modal';
import EmailDetailView from './email-detail-view';
import EmailConversationView from './email-conversation-view';
import { ManilaDateTimePicker } from '@/shared/components/ui/manila-date-time-picker';

const mocks = vi.hoisted(() => ({ schedule: vi.fn(), send: vi.fn(), save: vi.fn(), remove: vi.fn(), thread: vi.fn() }));
vi.mock('../services/gmail.service', () => ({ scheduleGmailEmail: mocks.schedule, sendGmailEmail: mocks.send, saveGmailDraft: mocks.save, deleteGmailDraft: mocks.remove, fetchGmailThread: mocks.thread }));
vi.mock('motion/react', () => ({ motion: { div: ({ initial, animate, exit, transition, ...props }: any) => <div {...props} /> }, AnimatePresence: ({ children }: any) => children, useReducedMotion: () => true }));
const email = { id: 'message1', threadId: 'thread1', from: 'Customer <customer@example.test>', to: ['staff@camxian.com'], subject: 'Telephone inquiry', body: '<p>Question</p><script>bad()</script>', snippet: 'Question', date: '2026-10-07T00:00:00Z', labels: ['INBOX'], isRead: false, direction: 'inbound' as const };
beforeEach(() => { vi.clearAllMocks(); mocks.schedule.mockResolvedValue({ id: 'scheduled', status: 'pending' }); });
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
it('reuses the composer for Reply and sanitizes Forward', async () => {
  render(<EmailDetailView email={email} onBack={vi.fn()} onEmailsChanged={vi.fn()} />);
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
