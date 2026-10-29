import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { GmailEmail } from '../services/gmail.service';
import { forwardDraft } from '../services/email-presentation';
import { forwardMailboxHtml } from '../services/email-html';
import ComposeModal from './compose-modal';
import EmailConversationView from './email-conversation-view';
import EmailDetailView from './email-detail-view';
import InboxEmailList from './inbox-email-list';

const mocks = vi.hoisted(() => ({ send: vi.fn(), save: vi.fn(), schedule: vi.fn(), content: vi.fn(), attachment: vi.fn(), thread: vi.fn(), success: vi.fn() }));
vi.mock('../services/gmail.service', () => ({ sendGmailEmail: mocks.send, saveGmailDraft: mocks.save, scheduleGmailEmail: mocks.schedule,
  fetchGmailMessageContent: mocks.content, fetchGmailAttachment: mocks.attachment, fetchGmailThread: mocks.thread,
  deleteGmailDraft: vi.fn(), associateThreadDeal: vi.fn(), archiveGmailConversations: vi.fn(), trashGmailConversations: vi.fn(), restoreGmailConversations: vi.fn() }));
vi.mock('@/shared/utils/toast', () => ({ toast: { success: mocks.success, error: vi.fn() } }));
vi.mock('motion/react', () => ({ motion: { div: ({ initial, animate, exit, transition, ...props }: any) => <div {...props} /> }, AnimatePresence: ({ children }: any) => children, useReducedMotion: () => true }));
const original: GmailEmail = { id: 'original', threadId: 'original-thread', from: 'Customer <customer@example.test>', to: ['owner@example.test'], cc: ['copy@example.test'], subject: 'Project & quote', snippet: 'Saved content', body: '<p>Saved content</p>', date: '2026-10-28T01:00:00Z', labels: ['INBOX'], isRead: true };
const pdf = { id: 'pdf', filename: 'Quote.pdf', mimeType: 'application/pdf', size: 18 };
const draft = () => ({ ...forwardDraft({ ...original, attachments: [] }), to: 'recipient@example.test' });
const ready = () => waitFor(() => expect(screen.getByLabelText('Send email')).toHaveProperty('disabled', false));
beforeEach(() => {
  vi.resetAllMocks(); mocks.send.mockResolvedValue({ success: true, messageId: 'sent', threadId: 'new-thread' });
  mocks.save.mockResolvedValue({ draftId: 'saved', messageId: 'saved-message' }); mocks.content.mockResolvedValue({ body: original.body, attachments: [] });
  mocks.thread.mockResolvedValue({ emails: [original], dealOptions: [], canAssociateDeal: false }); mocks.attachment.mockResolvedValue(new Blob(['%PDF-original-bytes']));
});
afterEach(cleanup);

it.each([null, 'lead'])('omits the match notice in list, collapsed and expanded views (lead=%s)', leadId => {
  const email = { ...original, leadId };
  const list = render(<InboxEmailList emails={[email]} totalCount={1} onEmailClick={vi.fn()} onEmailsChanged={vi.fn()} />);
  expect(screen.queryByText(/No unique CRM email match/)).toBeNull(); list.unmount();
  const props = { email, onToggle: vi.fn(), onReply: vi.fn(), onForward: vi.fn() };
  const view = render(<EmailDetailView {...props} expanded={false} />); expect(screen.queryByText(/No unique CRM email match/)).toBeNull();
  view.rerender(<EmailDetailView {...props} expanded />); expect(screen.queryByText(/No unique CRM email match/)).toBeNull();
  if (leadId) expect(screen.getByRole('link', { name: 'View linked Lead' }).getAttribute('href')).toBe('/crm/leads/lead');
});
it('loads the selected original before opening Forward and retains full readable content', async () => {
  mocks.content.mockResolvedValue({ body: '<p>Fresh &amp; readable <strong>content</strong></p><a href="https://example.test">Details</a><div class="gmail_quote">Prior message</div><script>bad()</script>', attachments: [pdf] });
  render(<EmailConversationView email={original} onBack={vi.fn()} onEmailsChanged={vi.fn()} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Forward' })).toHaveProperty('disabled', false)); fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
  const editor = await screen.findByRole('textbox', { name: 'Email body' });
  for (const value of ['Fresh & readable content', 'Prior message', 'From: Customer <customer@example.test>', 'Cc: copy@example.test']) expect(editor.textContent).toContain(value);
  expect(editor.textContent).not.toContain('Saved content'); expect(editor.querySelector('strong')).toBeTruthy(); expect(editor.querySelector('a')?.href).toBe('https://example.test/'); expect(editor.querySelector('script')).toBeNull();
  await screen.findByText('Quote.pdf'); expect(mocks.attachment).toHaveBeenCalledWith(original.id, pdf.id, expect.any(AbortSignal));
});
it('decodes plaintext entities while retaining lines, literal angle brackets and quote history', () => {
  const html = forwardMailboxHtml('<pre>Hello&amp;nbsp;world &amp;#39;yes&amp;#39;\n&lt;script&gt;literal&lt;/script&gt;\n&gt; Prior message</pre>');
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  expect(body.textContent).toBe("Hello world 'yes'\n<script>literal</script>\n> Prior message"); expect(body.querySelector('script')).toBeNull();
});
it.each(['recipient@example.test', 'first@example.test, second@example.test'])('validates and sends an edited forward to %s', async to => {
  render(<ComposeModal isOpen initialDraft={draft()} onClose={vi.fn()} onSent={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('To'), { target: { value: to } }); fireEvent.blur(screen.getByLabelText('To')); expect(screen.getByLabelText('To').getAttribute('aria-invalid')).toBe('false');
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Edited subject' } }); screen.getByRole('textbox', { name: 'Email body' }).innerHTML = '<p>My <strong>edited</strong> content &amp; details</p>';
  await ready(); fireEvent.click(screen.getByLabelText('Send email')); await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
  expect(mocks.send.mock.calls[0].slice(0, 6)).toEqual([to.split(',').map(value => value.trim()), 'Edited subject', '<p>My <strong>edited</strong> content &amp; details</p>', undefined, undefined, original.id]);
  expect(mocks.send.mock.calls[0][7]).toBe('forward'); expect(mocks.success).toHaveBeenCalledWith('Email sent.');
});
it.each(['invalid', 'ok@example.test, invalid', 'ok@example.test,'])('rejects invalid recipients before sending: %s', async to => {
  render(<ComposeModal isOpen initialDraft={draft()} onClose={vi.fn()} onSent={vi.fn()} />); fireEvent.change(screen.getByLabelText('To'), { target: { value: to } });
  await ready(); fireEvent.click(screen.getByLabelText('Send email')); expect(screen.getByRole('alert').textContent).toContain('valid email addresses'); expect(mocks.send).not.toHaveBeenCalled();
});
it.each(['MAILBOX_RECIPIENT_REJECTED', 'GMAIL_WRITE_REJECTED'])('keeps the editable draft and displays rejection (%s)', async code => {
  mocks.send.mockRejectedValue(Object.assign(new Error('Recipient or Gmail rejected this send.'), { status: 403, code }));
  const close = vi.fn(); render(<ComposeModal isOpen initialDraft={draft()} onClose={close} onSent={vi.fn()} />); await ready(); fireEvent.click(screen.getByLabelText('Send email'));
  expect((await screen.findByRole('alert')).textContent).toContain('rejected this send'); expect(close).not.toHaveBeenCalled(); expect(screen.getByRole('textbox', { name: 'Email body' }).textContent).toContain('Saved content');
});
it('blocks duplicate clicks and reuses the operation ID after a lost Gmail response', async () => {
  let reject!: (error: Error) => void; mocks.send.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  render(<ComposeModal isOpen initialDraft={draft()} onClose={vi.fn()} onSent={vi.fn()} />); await ready();
  fireEvent.click(screen.getByLabelText('Send email')); fireEvent.click(screen.getByLabelText('Send email')); expect(mocks.send).toHaveBeenCalledOnce(); expect(screen.getByText('Sending...')).toBeTruthy();
  await act(async () => reject(Object.assign(new Error('Verify delivery before retrying.'), { status: 503, code: 'GMAIL_OUTCOME_UNKNOWN' })));
  fireEvent.click(screen.getByLabelText('Send email')); await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2)); expect(mocks.send.mock.calls[1][6]).toBe(mocks.send.mock.calls[0][6]);
});
it('preserves bytes and explicit omissions through attachment retry and saving', async () => {
  const bad = { id: 'eml', filename: 'Original.eml', mimeType: 'message/rfc822' }, retry = { ...pdf, id: 'retry', filename: 'Retry.pdf' };
  mocks.attachment.mockImplementation(async (_message: string, id: string) => { if (id === 'retry' && mocks.attachment.mock.calls.filter(call => call[1] === id).length === 1) throw new Error('Download failed'); return new Blob(['%PDF-original-bytes']); });
  render(<ComposeModal isOpen initialDraft={{ ...draft(), sourceAttachments: [pdf, bad, retry] }} onClose={vi.fn()} onSent={vi.fn()} />);
  await screen.findByText(/Retry.pdf: Download failed/); expect(screen.getByLabelText('Send email')).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByLabelText('Remove attachment Quote.pdf')); fireEvent.click(screen.getByRole('button', { name: 'Remove Original.eml from forward' })); fireEvent.click(screen.getByRole('button', { name: 'Retry Retry.pdf' }));
  await waitFor(() => expect(screen.queryByLabelText('Attachments needing attention')).toBeNull()); fireEvent.click(screen.getByLabelText('Save as draft')); await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  expect(mocks.save.mock.calls[0][8].attachments).toEqual([{ filename: 'Retry.pdf', mimeType: 'application/pdf', content: btoa('%PDF-original-bytes') }]); expect(mocks.attachment.mock.calls.filter(call => call[1] === 'pdf')).toHaveLength(1);
});
it('identifies oversized files before download and explains image limitations', async () => {
  render(<ComposeModal isOpen initialDraft={{ ...draft(), forwardImageNotice: true, sourceAttachments: [{ ...pdf, size: 5 * 1024 * 1024 + 1 }] }} onClose={vi.fn()} onSent={vi.fn()} />);
  await screen.findByText(/Quote.pdf: Forwarded files/); expect(mocks.attachment).not.toHaveBeenCalled(); expect(screen.getByText(/Original image placement and remote images/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Quote.pdf from forward' })); expect(screen.getByLabelText('Send email')).toHaveProperty('disabled', false);
});

it('allows explicit omission of a missing attachment while retaining the message', async () => {
  mocks.attachment.mockRejectedValue(Object.assign(new Error('Attachment is no longer available.'), { status: 404, code: 'MAILBOX_ATTACHMENT_UNAVAILABLE' }));
  const close = vi.fn(); render(<ComposeModal isOpen initialDraft={{ ...draft(), sourceAttachments: [pdf] }} onClose={close} onSent={vi.fn()} />);
  await screen.findByText(/Quote.pdf: Attachment is no longer available/); expect(close).not.toHaveBeenCalled(); expect(screen.getByLabelText('Send email')).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Quote.pdf from forward' })); await ready();
});
it('pauses attachment retry and delivery for the provider cooldown', async () => {
  mocks.attachment.mockRejectedValue(Object.assign(new Error('Gmail paused downloads.'), { status: 429, code: 'GMAIL_RATE_LIMITED', retryAt: new Date(Date.now() + 60000).toISOString() }));
  render(<ComposeModal isOpen initialDraft={{ ...draft(), sourceAttachments: [pdf] }} onClose={vi.fn()} onSent={vi.fn()} />);
  await screen.findByText(/Quote.pdf: Gmail paused downloads/);
  for (const name of ['Send email', 'Save as draft', 'Schedule send options', 'Retry Quote.pdf']) expect(screen.getByRole('button', { name })).toHaveProperty('disabled', true);
});
it('clears the source draft when actual mailbox authorization is lost', async () => {
  mocks.send.mockRejectedValue(Object.assign(new Error('Source access revoked.'), { status: 404, code: 'MAILBOX_SCOPE_CHANGED' }));
  const close = vi.fn(); render(<ComposeModal isOpen initialDraft={draft()} onClose={close} onSent={vi.fn()} />);
  await ready(); fireEvent.click(screen.getByLabelText('Send email')); await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(screen.getByRole('textbox', { name: 'Email body' }).innerHTML).toBe('');
});
it('ignores late attachment downloads after authorization changes', async () => {
  let finish!: (blob: Blob) => void; mocks.attachment.mockReturnValue(new Promise<Blob>(resolve => { finish = resolve; }));
  const initialDraft = { ...draft(), sourceAttachments: [pdf] }, close = vi.fn();
  const view = render(<ComposeModal isOpen initialDraft={initialDraft} authorizationRevision={0} onClose={close} onSent={vi.fn()} />);
  await waitFor(() => expect(mocks.attachment).toHaveBeenCalledOnce());
  view.rerender(<ComposeModal isOpen initialDraft={initialDraft} authorizationRevision={1} onClose={close} onSent={vi.fn()} />);
  await act(async () => finish(new Blob(['%PDF-late'])));
  expect(close).toHaveBeenCalled(); expect(screen.queryByText('Quote.pdf')).toBeNull(); expect(screen.getByRole('textbox', { name: 'Email body' }).innerHTML).toBe('');
});
