import React, { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import EmailConversationView from './email-conversation-view';
import { forwardDraft, mailboxDate, replyDraft } from '../services/email-presentation';
import type { GmailEmail } from '../services/gmail.service';

const mocks = vi.hoisted(() => ({ content: vi.fn(), attachment: vi.fn(), thread: vi.fn(), read: vi.fn(), archive: vi.fn(), trash: vi.fn(), associate: vi.fn(), correspondent: vi.fn(), readMessage: vi.fn(), archiveGroups: vi.fn(), trashGroups: vi.fn(), restore: vi.fn(), send: vi.fn() }));
vi.mock('../services/gmail.service', () => ({ fetchGmailMessageContent: mocks.content, fetchGmailAttachment: mocks.attachment, fetchGmailThread: mocks.thread, fetchGmailCorrespondent: mocks.correspondent, setGmailMessageReadState: mocks.readMessage, archiveGmailConversations: mocks.archiveGroups, trashGmailConversations: mocks.trashGroups, restoreGmailConversations: mocks.restore, sendGmailEmail: mocks.send, setGmailThreadReadState: mocks.read, archiveGmailThread: mocks.archive, trashGmailThread: mocks.trash, associateThreadDeal: mocks.associate }));
vi.mock('motion/react', () => ({ motion: { div: ({ initial, animate, exit, transition, ...props }: any) => <div {...props} /> }, AnimatePresence: ({ children }: any) => children, useReducedMotion: () => true }));
const old: GmailEmail = { id: 'old', threadId: 'conversation', from: 'Staff <staff@camxian.com>', to: ['customer@example.test'], subject: 'Fire Detection Inquiry', snippet: 'Original question', body: '<p>Original question</p>', date: '2026-10-08T05:57:00Z', labels: ['SENT'], isRead: true, direction: 'outbound', leadId: 'lead' };
const latest: GmailEmail = { ...old, id: 'latest', from: 'Doris <customer@example.test>', to: ['staff@camxian.com'], cc: ['Sales <sales@example.test>'], replyToAddress: 'reply@example.test', snippet: 'Please send the catalog', body: '<p>Please send the catalog</p><div class="gmail_quote"><p>On Thursday, Staff wrote:</p><blockquote>Original question</blockquote></div>', date: '2026-10-08T05:58:00Z', labels: ['INBOX', 'UNREAD'], isRead: false, direction: 'inbound' };
const props = () => ({ email: latest, onBack: vi.fn(), onEmailsChanged: vi.fn() });
beforeEach(() => { vi.resetAllMocks(); mocks.content.mockImplementation(() => new Promise(() => {})); mocks.thread.mockResolvedValue({ emails: [latest, old], dealOptions: [], canAssociateDeal: false }); mocks.read.mockResolvedValue({ success: true }); mocks.archive.mockResolvedValue({ success: true }); mocks.trash.mockResolvedValue({ success: true }); });
afterEach(cleanup);
const loaded = () => waitFor(() => expect(screen.queryByText('Loading conversation…')).toBeNull());
const messageDocument = (element: ParentNode = document) => new DOMParser().parseFromString(element.querySelector('iframe[data-mailbox-body]')?.getAttribute('srcdoc') ?? '', 'text/html');

it('keeps only one bottom Reply and Forward area per expanded message, without Reply All or header reply icons', async () => {
  render(<EmailConversationView {...props()} mailboxEmail="staff@camxian.com" />); await loaded();
  expect(screen.queryByRole('button', { name: /Reply All|Reply all to/ })).toBeNull();
  expect(screen.getAllByRole('button', { name: 'Reply' })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'Forward' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Expand message from Staff' }));
  for (const article of screen.getAllByRole('article')) {
    const header = article.querySelector('[data-message-header]')!;
    expect(within(header as HTMLElement).queryByRole('button', { name: /Reply|Forward/ })).toBeNull();
    expect(within(article).getAllByRole('button', { name: 'Reply' })).toHaveLength(1);
    expect(within(article).getAllByRole('button', { name: 'Forward' })).toHaveLength(1);
    expect(article.querySelector('iframe')!.compareDocumentPosition(within(article).getByRole('button', { name: 'Reply' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
});
const correspondentId = 'c_' + 'a'.repeat(32);
const olderTopic: GmailEmail = { ...latest, id: 'older-topic-message', threadId: 'older-topic', subject: 'CCTV quotation', date: old.date, body: '<p>Older quotation</p>' };
const groupedEmail: GmailEmail = { ...latest, conversationId: correspondentId, participants: ['Doris', 'You'], correspondentAddresses: ['customer@example.test'], messageCount: 2 };
const groupResult = (emails = [olderTopic, latest]) => ({ emails, threads: [], messageCount: emails.length });
it('shows the compact toolbar, participant, total message count and address without the toolbar explanation', async () => {
  mocks.correspondent.mockResolvedValue({ ...groupResult([latest]), messageCount: 51, nextPageToken: 'next' });
  render(<EmailConversationView {...props()} email={{ ...groupedEmail, messageCount: 51 }} mailboxEmail="staff@camxian.com" />); await loaded();
  const toolbar = within(screen.getByRole('toolbar', { name: 'Conversation actions' }));
  expect(toolbar.getByText('Email Thread')).toBeTruthy();
  for (const name of ['Back to inbox', 'Archive conversation', 'Delete Permanently']) expect(toolbar.getByRole('button', { name })).toBeTruthy();
  expect(screen.getByRole('heading', { level: 1, name: 'Doris' })).toBeTruthy();
  expect(screen.getByLabelText('51 messages').textContent).toBe('51 messages');
  expect(screen.getByText('customer@example.test', { selector: 'header p' })).toBeTruthy();
  expect(screen.queryByText(/Toolbar actions apply/)).toBeNull();
});
it('shows the recipient and singular count for a legacy outbound thread', async () => {
  mocks.thread.mockResolvedValue({ emails: [old], dealOptions: [], canAssociateDeal: false });
  render(<EmailConversationView {...props()} email={old} mailboxEmail="staff@camxian.com" />); await loaded();
  expect(screen.getByRole('heading', { level: 1, name: 'customer' })).toBeTruthy();
  expect(screen.getByLabelText('1 message').textContent).toBe('1 message');
  expect(screen.getByText('customer@example.test', { selector: 'header p' })).toBeTruthy();
});
it('collapses older unread messages in legacy threads and expands only the latest', async () => {
  mocks.thread.mockResolvedValue({ emails: [latest, { ...old, isRead: false }], dealOptions: [], canAssociateDeal: false });
  render(<EmailConversationView {...props()} />); await loaded();
  expect(screen.getByRole('button', { name: 'Expand message from Staff' }).getAttribute('aria-expanded')).toBe('false');
  expect(screen.getByRole('button', { name: 'Collapse message from Doris' }).getAttribute('aria-expanded')).toBe('true');
});
it('preserves manual expansion and collapse on refresh while expanding a newly arrived latest message', async () => {
  const actions = props(), view = render(<EmailConversationView {...actions} />); await loaded();
  fireEvent.click(screen.getByRole('button', { name: 'Expand message from Staff' }));
  fireEvent.click(screen.getByRole('button', { name: 'Collapse message from Doris' }));
  const incoming = { ...latest, id: 'incoming', from: 'Adrian <adrian@example.test>', date: '2026-10-09T05:58:00Z' };
  mocks.thread.mockResolvedValue({ emails: [old, latest, incoming], dealOptions: [], canAssociateDeal: false });
  view.rerender(<EmailConversationView {...actions} revision={1} />);
  await screen.findByRole('button', { name: 'Collapse message from Adrian' });
  expect(screen.getByRole('button', { name: 'Collapse message from Staff' }).getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('button', { name: 'Expand message from Doris' }).getAttribute('aria-expanded')).toBe('false');
});
it('preserves existing toggles when paginated history repeats a message and exposes a new latest message', async () => {
  const incoming = { ...latest, id: 'incoming', from: 'Adrian <adrian@example.test>', date: '2026-10-09T05:58:00Z' };
  mocks.correspondent.mockResolvedValueOnce({ ...groupResult(), messageCount: 3, nextPageToken: 'next' }).mockResolvedValueOnce(groupResult([latest, incoming]));
  render(<EmailConversationView {...props()} email={groupedEmail} />); await loaded();
  const articles = screen.getAllByRole('article');
  fireEvent.click(within(articles[0]).getByRole('button', { name: 'Expand message from Doris' }));
  fireEvent.click(within(articles[1]).getByRole('button', { name: 'Collapse message from Doris' }));
  fireEvent.click(screen.getByRole('button', { name: 'Load more messages' }));
  await screen.findByRole('button', { name: 'Collapse message from Adrian' });
  expect(screen.getAllByRole('article')).toHaveLength(3);
  expect(within(articles[0]).getByRole('button', { name: 'Collapse message from Doris' }).getAttribute('aria-expanded')).toBe('true');
  expect(within(articles[1]).getByRole('button', { name: 'Expand message from Doris' }).getAttribute('aria-expanded')).toBe('false');
});
it.each([['Archive topic: CCTV quotation', 'archive'], ['Trash topic: CCTV quotation', 'trash']] as const)('keeps %s scoped to its original Gmail thread through the existing menu', async (label, action) => {
  mocks.correspondent.mockResolvedValue(groupResult());
  const actions = props(); render(<EmailConversationView {...actions} email={groupedEmail} />); await loaded();
  fireEvent.click(screen.getByRole('button', { name: 'Actions for topic: CCTV quotation' }));
  expect(within(screen.getAllByRole('article')[0]).getByRole('button', { name: 'Expand message from Doris' })).toBeTruthy();
  fireEvent.click(screen.getByRole('menuitem', { name: label }));
  if (action === 'trash') fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(mocks[action === 'archive' ? 'archiveGroups' : 'trashGroups']).toHaveBeenCalledWith([correspondentId]));
  expect(mocks.archive).not.toHaveBeenCalled(); expect(mocks.trash).not.toHaveBeenCalled();
  expect(actions.onEmailsChanged).toHaveBeenCalledOnce(); expect(actions.onBack).toHaveBeenCalledOnce();
});
it('keeps the existing topic Deal selector once inside the first eligible expanded message', async () => {
  const topic = { threadId: latest.threadId, canAssociateDeal: true, dealOptions: [{ id: 'deal', title: 'Alarm', stage: 'Proposal' }] };
  mocks.correspondent.mockResolvedValue({ ...groupResult([old, latest]), threads: [topic] });
  mocks.associate.mockResolvedValue({ success: true });
  render(<EmailConversationView {...props()} email={groupedEmail} />); await loaded();
  fireEvent.click(screen.getByRole('button', { name: 'Expand message from Staff' }));
  expect(screen.getAllByRole('combobox', { name: 'Associate conversation with Deal' })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: /Actions for topic:/ })).toHaveLength(1);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'deal' } });
  fireEvent.click(screen.getByRole('button', { name: 'Associate Deal' }));
  await waitFor(() => expect(mocks.associate).toHaveBeenCalledWith(latest.threadId, 'deal', { conversationId: correspondentId }));
});
it('forwards the selected older message with its existing source identity', async () => {
  mocks.correspondent.mockResolvedValue(groupResult()); mocks.send.mockResolvedValue({ success: true });
  render(<EmailConversationView {...props()} email={groupedEmail} />); await loaded();
  fireEvent.click(screen.getByRole('button', { name: 'Expand message from Doris' }));
  fireEvent.click(within(screen.getAllByRole('article')[0]).getByRole('button', { name: 'Forward' }));
  expect((screen.getByPlaceholderText('Subject') as HTMLInputElement).value).toBe('Fwd: CCTV quotation');
  fireEvent.change(screen.getByLabelText('To'), { target: { value: 'other@example.test' } });
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Email body' }).textContent).toContain('Older quotation'));
  fireEvent.click(screen.getByLabelText('Send email'));
  await waitFor(() => expect(mocks.send).toHaveBeenCalled());
  expect(mocks.send.mock.calls[0][5]).toBe(olderTopic.id);
});
it('keeps older messages collapsed and leaves automatic marking to the Inbox owner', async () => {
  mocks.correspondent.mockResolvedValue(groupResult()); mocks.readMessage.mockResolvedValue({ success: true });
  render(<EmailConversationView {...props()} email={groupedEmail} mailboxEmail="staff@camxian.com" />); await loaded();
  expect(mocks.correspondent).toHaveBeenCalledWith(correspondentId, undefined, expect.any(AbortSignal)); expect(mocks.thread).not.toHaveBeenCalled();
  expect(screen.queryByRole('heading', { name: 'CCTV quotation' })).toBeNull(); expect(screen.getByRole('heading', { name: 'Fire Detection Inquiry' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Expand message from Doris' })).toBeTruthy();
  expect(mocks.readMessage).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Expand message from Doris' }));
  expect(screen.getAllByRole('heading', { name: 'CCTV quotation' })).toHaveLength(1);
  expect(screen.getAllByRole('heading', { name: 'Fire Detection Inquiry' })).toHaveLength(1);
  expect(document.querySelector('[aria-label^="Original Gmail conversation:"]')).toBeNull();
  expect(mocks.readMessage).not.toHaveBeenCalled();
});
it('replies to an older selected message and preserves its own source identity in the composer', async () => {
  mocks.correspondent.mockResolvedValue(groupResult([{ ...olderTopic, isRead: true }, { ...latest, isRead: true }]));
  mocks.send.mockResolvedValue({ success: true });
  render(<EmailConversationView {...props()} email={groupedEmail} mailboxEmail="staff@camxian.com" />); await loaded();
  fireEvent.click(screen.getByRole('button', { name: 'Expand message from Doris' }));
  const olderArticle = screen.getAllByRole('article')[0];
  fireEvent.click(within(olderArticle).getByRole('button', { name: 'Reply' }));
  expect((screen.getByPlaceholderText('Subject') as HTMLInputElement).value).toBe('Re: CCTV quotation');
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Email body' }).textContent).toBe(''));
  screen.getByRole('textbox', { name: 'Email body' }).innerHTML = '<p>Quotation reply</p>';
  fireEvent.click(screen.getByLabelText('Send email'));
  await waitFor(() => expect(mocks.send).toHaveBeenCalled());
  expect(mocks.send.mock.calls[0][3]).toBe(olderTopic.id);
});
it('loads bounded history pages and keeps the message count and existing topic ordering', async () => {
  mocks.correspondent.mockResolvedValueOnce({ ...groupResult([{ ...olderTopic, isRead: true }]), messageCount: 2, nextPageToken: 'next-history' })
    .mockResolvedValueOnce({ ...groupResult([{ ...latest, isRead: true }]), messageCount: 2 });
  render(<EmailConversationView {...props()} email={groupedEmail} />); await loaded();
  fireEvent.click(screen.getByRole('button', { name: 'Load more messages' }));
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  expect(mocks.correspondent).toHaveBeenLastCalledWith(correspondentId, 'next-history', expect.any(AbortSignal));
  expect(screen.queryByRole('button', { name: 'Load more messages' })).toBeNull();
});
it.each([['Archive conversation', 'archiveGroups'], ['Delete Permanently', 'trashGroups']] as const)('applies %s to the correspondent identity across original Gmail topics', async (label, action) => {
  mocks.correspondent.mockResolvedValue(groupResult([{ ...olderTopic, isRead: true }, { ...latest, isRead: true }])); mocks[action].mockResolvedValue({ success: true });
  const actions = props(); render(<EmailConversationView {...actions} email={groupedEmail} />); await loaded();
  fireEvent.click(screen.getByRole('button', { name: label }));
  if (label === 'Delete Permanently') fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(mocks[action]).toHaveBeenCalledWith([correspondentId])); expect(actions.onBack).toHaveBeenCalledOnce();
});
it('clears correspondent bodies and a reply draft when authorization is revoked', async () => {
  mocks.correspondent.mockResolvedValue(groupResult([{ ...latest, isRead: true }]));
  const actions = props(), view = render(<EmailConversationView {...actions} email={groupedEmail} />); await loaded();
  fireEvent.click(screen.getByRole('button', { name: 'Reply' })); expect(screen.getByRole('dialog')).toBeTruthy();
  mocks.correspondent.mockRejectedValue(Object.assign(new Error('Access revoked'), { status: 404 }));
  view.rerender(<EmailConversationView {...actions} email={groupedEmail} revision={1} />);
  await waitFor(() => expect(actions.onBack).toHaveBeenCalledOnce());
  expect(screen.queryByRole('article')).toBeNull(); expect(screen.queryByRole('dialog')).toBeNull();
});

it('restores the selected archived group and returns to Archived Messages', async () => {
  mocks.correspondent.mockResolvedValue(groupResult([{ ...latest, dealId: 'deal', dealTitle: 'CCTV Installation' }]));
  mocks.restore.mockResolvedValue({ success: true, count: 1, completedMessageIds: [latest.id], completedConversationIds: [correspondentId] });
  const actions = props();
  render(<EmailConversationView {...actions} email={{ ...groupedEmail, isArchived: true }} originView="archived" />);
  await loaded();
  expect(screen.getByRole('button', { name: 'Back to Archived Messages' })).toBeTruthy();
  expect(screen.getByText('CCTV Installation')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Restore conversation' }));
  await waitFor(() => expect(mocks.restore).toHaveBeenCalledWith([correspondentId]));
  expect(mocks.archive).not.toHaveBeenCalled(); expect(mocks.archiveGroups).not.toHaveBeenCalled();
  expect(actions.onBack).toHaveBeenCalledOnce();
});
it('discards an in-flight history page after a later authorization failure', async () => {
  let finish!: (result: ReturnType<typeof groupResult>) => void;
  mocks.correspondent.mockResolvedValueOnce({ ...groupResult([{ ...olderTopic, isRead: true }]), nextPageToken: 'next' })
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockRejectedValueOnce(Object.assign(new Error('Access revoked'), { status: 404 }));
  const actions = props(), view = render(<EmailConversationView {...actions} email={groupedEmail} />); await loaded();
  fireEvent.click(screen.getByRole('button', { name: 'Load more messages' }));
  view.rerender(<EmailConversationView {...actions} email={groupedEmail} revision={1} />);
  await waitFor(() => expect(actions.onBack).toHaveBeenCalledOnce());
  await act(async () => finish(groupResult([{ ...latest, body: '<p>Revoked content</p>' }])));
  expect(screen.queryByRole('article')).toBeNull(); expect(screen.queryByText('Revoked content')).toBeNull();
});
it('renders attachments as escaped file labels with preview and download controls', async () => {
  mocks.thread.mockResolvedValue({ emails: [{ ...latest, attachments: [{ id: 'file-id', filename: '<script>proposal.pdf', mimeType: 'application/pdf', size: 4 }] }], dealOptions: [], canAssociateDeal: false });
  render(<EmailConversationView {...props()} />); await loaded();
  expect(screen.getByRole('button', { name: 'Download <script>proposal.pdf' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Preview <script>proposal.pdf' })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Message attachments' }).querySelector('script')).toBeNull();
});
it('keeps linked Contact and Deal navigation between the body and attachments', async () => {
  mocks.thread.mockResolvedValue({ emails: [{ ...latest, leadId: undefined, contactId: 'contact', dealId: 'deal', attachments: [{ id: 'pdf', filename: 'Quotation.pdf', mimeType: 'application/pdf' }] }], dealOptions: [], canAssociateDeal: false });
  render(<EmailConversationView {...props()} />); await loaded();
  const body = screen.getByTitle('Email message content'), files = screen.getByRole('region', { name: 'Message attachments' });
  for (const [label, href] of [['View linked Contact', '/crm/contacts/contact'], ['View related Deal', '/crm/deals/deal']]) {
    const link = screen.getByRole('link', { name: label }); expect(link.getAttribute('href')).toBe(href);
    expect(body.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(link.compareDocumentPosition(files) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
  expect(screen.getByText('1 attachment')).toBeTruthy();
});

it('renders chronological vertical messages, one subject, latest expanded, older collapsible with accessible controls', async () => {
  render(<EmailConversationView {...props()} />); await loaded();
  const articles = screen.getAllByRole('article');
  expect(articles.map(article => article.getAttribute('aria-label'))).toEqual(['Message from Staff', 'Message from Doris']);
  expect(screen.getAllByRole('heading', { name: old.subject })).toHaveLength(1); expect(screen.queryByRole('tablist')).toBeNull();
  expect(screen.getByRole('button', { name: 'Expand message from Staff' }).getAttribute('aria-expanded')).toBe('false');
  expect(screen.getByRole('button', { name: 'Collapse message from Doris' }).getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Expand message from Staff' }));
  expect(messageDocument(articles[0]).body.textContent).toContain('Original question');
  fireEvent.click(screen.getByRole('button', { name: 'Collapse message from Staff' }));
  expect(within(articles[0]).queryByText('Original question', { selector: 'p' })).toBeNull();
  expect(screen.getByText('Cc: Sales <sales@example.test>')).toBeTruthy();
  expect(screen.getByText(/1:58 PM/)).toBeTruthy();
  expect(within(screen.getByRole('toolbar')).queryByRole('button', { name: /Reply|Forward/ })).toBeNull();
});
it('folds only recognizable quotes and keeps complete sanitized content accessible', async () => {
  render(<EmailConversationView {...props()} />); await loaded();
  const quote = messageDocument().querySelector('details')!;
  expect(quote.open).toBe(false); expect(quote.textContent).toContain('Original question');
  expect(quote.querySelector('details')).toBeNull();
  quote.open = true; expect(quote.open).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Expand message from Staff' }));
  expect(quote.open).toBe(true);
  expect(latest.body).toContain('class="gmail_quote"');
});
it('does not issue read operations on Strict Mode or revision changes', async () => {
  const actions = props(), view = render(<StrictMode><EmailConversationView {...actions} /></StrictMode>);
  await loaded(); expect(mocks.read).not.toHaveBeenCalled();
  mocks.thread.mockResolvedValue({ emails: [{ ...latest, isRead: true }, old], dealOptions: [], canAssociateDeal: false });
  view.rerender(<StrictMode><EmailConversationView {...actions} revision={1} /></StrictMode>);
  await loaded(); expect(mocks.read).not.toHaveBeenCalled();
});
it('renders a single read message without a provider write', async () => {
  mocks.thread.mockResolvedValue({ emails: [old], dealOptions: [], canAssociateDeal: false });
  render(<EmailConversationView {...props()} email={old} />); await loaded();
  expect(screen.getAllByRole('article')).toHaveLength(1); expect(mocks.read).not.toHaveBeenCalled();
});
it.each([['Archive conversation', 'archive'], ['Delete Permanently', 'trash']] as const)('applies %s to the thread, then refreshes and returns', async (label, action) => {
  const actions = props(); render(<EmailConversationView {...actions} />); await loaded();
  fireEvent.click(screen.getByRole('button', { name: label }));
  if (label === 'Delete Permanently') fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(actions.onBack).toHaveBeenCalledOnce());
  expect(mocks[action]).toHaveBeenCalledWith('conversation'); expect(actions.onEmailsChanged).toHaveBeenCalled();
});
it('uses the existing composer with Reply-To and blank reply body, and forwards without repeated prefix', async () => {
  render(<EmailConversationView {...props()} />); await loaded();
  fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
  expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('reply@example.test');
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Email body' }).textContent).toBe(''));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull();
  expect(replyDraft({ ...latest, subject: 'Re: Inquiry' }).subject).toBe('Re: Inquiry');
  expect(replyDraft(old).to).toBe('customer@example.test');
  const forwarded = forwardDraft({ ...latest, subject: 'Fwd: Inquiry', body: '<p>Full body</p><script>bad()</script><img src="https://tracker.test">' });
  expect(forwarded.subject).toBe('Fwd: Inquiry'); expect(forwarded.to).toBe(''); expect(forwarded.body).toContain('Full body'); expect(forwarded.body).not.toMatch(/<script|<img/);
  expect(screen.queryByText('View related Deal')).toBeNull(); expect(screen.getByRole('link', { name: 'View linked Lead' }).getAttribute('href')).toBe('/crm/leads/lead');
});
it('prevents duplicate association submits and updates visible Deal context', async () => {
  mocks.thread.mockResolvedValue({ emails: [{ ...latest, needsDealAssociation: true }], dealOptions: [{ id: 'deal', title: 'Alarm', stage: 'Proposal' }], canAssociateDeal: true });
  let finish!: () => void; mocks.associate.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  render(<EmailConversationView {...props()} />); await loaded();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'deal' } });
  fireEvent.click(screen.getByRole('button', { name: 'Associate Deal' })); fireEvent.click(screen.getByRole('button', { name: 'Associate Deal' }));
  expect(mocks.associate).toHaveBeenCalledOnce();
  mocks.thread.mockResolvedValue({ emails: [{ ...latest, dealId: 'deal' }], dealOptions: [], canAssociateDeal: true }); finish();
  expect((await screen.findByRole('link', { name: 'View related Deal' })).getAttribute('href')).toBe('/crm/deals/deal');
});
it('keeps saved content on provider failure, reports error and respects retryAt', async () => {
  mocks.read.mockRejectedValue(Object.assign(new Error('Gmail updates paused'), { status: 429, retryAt: new Date(Date.now() + 60000).toISOString() }));
  render(<EmailConversationView {...props()} readError="Gmail updates paused" retryAt={Date.now() + 60000} />); await loaded();
  expect(messageDocument().body.textContent).toContain('Please send the catalog');
  expect((screen.getByRole('button', { name: 'Retry marking as read' }) as HTMLButtonElement).disabled).toBe(true);
  expect(mocks.read).not.toHaveBeenCalled();
});
it('uses Manila calendar dates across midnight regardless of browser timezone', () => {
  const now = new Date('2026-10-08T16:30:00Z');
  expect(mailboxDate('2026-10-08T15:59:00Z', false, now)).toBe('Yesterday');
  expect(mailboxDate('2026-10-08T16:01:00Z', false, now)).toMatch(/12:01 AM/);
  expect(mailboxDate('2026-10-08T16:01:00Z', true, now)).toContain('October 9, 2026');
});
