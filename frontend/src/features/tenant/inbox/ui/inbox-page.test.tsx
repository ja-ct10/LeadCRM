vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'actor', tenantId: 'tenant', role: 'Client Admin' }, tenant: { id: 'tenant' } }) }));
import React, { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InboxPage from './inbox-page';

const mocks = vi.hoisted(() => ({ status: vi.fn(), list: vi.fn(), sync: vi.fn(), disconnect: vi.fn(), read: vi.fn(), readThread: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('../services/gmail.service', () => ({ getGmailStatus: mocks.status, fetchGmailEmails: mocks.list, syncGmail: mocks.sync, disconnectGmail: mocks.disconnect, setGmailConversationReadState: mocks.read, setGmailThreadReadState: mocks.readThread }));
vi.mock('./inbox-current-empty', () => ({ default: () => <div>Connect email</div> }));
vi.mock('./inbox-done-empty', () => ({ default: () => <div>No done emails</div> }));
vi.mock('./inbox-future-empty', () => ({ default: () => <div>No future emails</div> }));
vi.mock('./email-conversation-view', () => ({ default: ({ onBack, readError, readPending, onRetryRead, retryAt }: any) => <div>Conversation<button onClick={() => onBack()}>Back to inbox</button>{readError && <div role="alert">{readError}<button disabled={readPending || retryAt > Date.now()} onClick={onRetryRead}>Retry marking as read</button></div>}</div> }));
vi.mock('./compose-modal', () => ({ default: () => null }));
vi.mock('motion/react', () => ({ motion: { div: ({ initial: _i, animate: _a, exit: _e, transition: _t, ...props }: any) => <div {...props} /> }, AnimatePresence: ({ children }: any) => children, useReducedMotion: () => true }));

const email = { id: 'm1', threadId: 't1', from: 'Customer <customer@example.test>', to: ['staff@example.test'], subject: 'Saved customer email', snippet: 'Customer update', body: 'Hello', date: '2026-10-01T10:00:00Z', isRead: false, labels: ['INBOX'] };
const throttle = (seconds = 60) => Object.assign(new Error('Provider limit'), { code: 'GMAIL_RATE_LIMITED', status: 429, retryAt: new Date(Date.now() + seconds * 1000).toISOString() });
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  mocks.status.mockResolvedValue({ isConnected: true, email: 'staff@example.test', connectedAt: '2026-10-01', lastSyncAt: '2026-10-01' });
  mocks.list.mockResolvedValue({ emails: [email] });
  mocks.sync.mockResolvedValue({ hasMore: false });
  mocks.read.mockResolvedValue({ count: 14, completedMessageIds: ['m1'], isRead: true, unreadCount: 0 });
  mocks.readThread.mockResolvedValue({ success: true, count: 1 });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });


describe('Persisted scoped Inbox', () => {
  it('places Archive before Filter and restores the previous Inbox filter, query and sort after toggling views', async () => {
    render(<InboxPage />); await flush();
    const archive = screen.getByRole('button', { name: 'Archived messages' });
    expect(archive.compareDocumentPosition(screen.getByRole('button', { name: 'Filter emails' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Filter emails' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Sent' })); await flush();
    fireEvent.change(screen.getByLabelText('Search email'), { target: { value: 'quotation' } }); await advance(400);
    fireEvent.click(screen.getByLabelText('Sort emails')); fireEvent.click(screen.getByText('Oldest first')); await flush();
    fireEvent.click(archive); await flush();
    expect(screen.getByRole('heading', { name: 'Archived Messages' })).toBeTruthy();
    expect(mocks.list.mock.calls.at(-1)![0]).toMatchObject({ view: 'archived', filter: 'all' });
    fireEvent.click(screen.getByRole('button', { name: 'Filter emails' }));
    expect(screen.queryByRole('menuitemradio', { name: 'Sent' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Search email'), { target: { value: 'archive query' } }); await advance(400);
    fireEvent.click(screen.getByLabelText('Sort emails')); fireEvent.click(screen.getByText('Newest first')); await flush();
    fireEvent.click(archive); await flush();
    expect(mocks.list.mock.calls.at(-1)![0]).toMatchObject({ view: 'inbox', filter: 'sent', query: 'quotation', sort: 'oldest' });
    expect((screen.getByLabelText('Search email') as HTMLInputElement).value).toBe('quotation');
  });
  const grouped = { ...email, conversationId: 'c_' + 'a'.repeat(32), messageCount: 14, participants: ['Customer'] };
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'Open email from Customer: Saved customer email' }));
  it('marks the whole conversation once under Strict Mode and finishes after immediate Back', async () => {
    let finish!: (value: unknown) => void;
    mocks.list.mockResolvedValue({ emails: [grouped], unreadCount: 1 });
    mocks.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const counts: number[] = [], listener = (event: Event) => counts.push((event as CustomEvent<number>).detail);
    window.addEventListener('mailbox-unread-change', listener);
    render(<StrictMode><InboxPage /></StrictMode>); await flush(); open(); await flush();
    expect(mocks.read).toHaveBeenCalledOnce(); expect(mocks.read).toHaveBeenCalledWith(grouped.conversationId, true, undefined);
    fireEvent.click(screen.getByText('Back to inbox')); await flush();
    expect(screen.getByText('Customer').parentElement!.className).toContain('font-bold');
    mocks.list.mockResolvedValue({ emails: [{ ...grouped, isRead: true }], unreadCount: 0 });
    await act(async () => finish({ count: 14, completedMessageIds: ['m1'], isRead: true, unreadCount: 0 })); await flush();
    expect(screen.getByText('Customer').parentElement!.className).toContain('font-normal'); expect(screen.getByText('0 unread conversations')).toBeTruthy();
    expect(counts.at(-1)).toBe(0); expect(mocks.read).toHaveBeenCalledOnce();
    window.removeEventListener('mailbox-unread-change', listener);
  });
  it('continues beyond the first mutation page without loading detail pages', async () => {
    mocks.list.mockResolvedValue({ emails: [grouped], unreadCount: 1 });
    mocks.read.mockResolvedValueOnce({ count: 25, completedMessageIds: [], nextPageToken: 'read-next', isRead: false, unreadCount: 1 });
    render(<InboxPage />); await flush(); open(); await flush();
    expect(mocks.read).toHaveBeenCalledTimes(2); expect(mocks.read).toHaveBeenLastCalledWith(grouped.conversationId, true, 'read-next');
  });
  it('rejects a pre-mutation list response and reconciles the badge with the fresh list', async () => {
    let events!: EventTarget, finishOld!: (value: unknown) => void;
    vi.stubGlobal('EventSource', class extends EventTarget { close = vi.fn(); constructor() { super(); events = this; } });
    mocks.list.mockResolvedValue({ emails: [grouped], unreadCount: 1 });
    render(<InboxPage />); await flush();
    mocks.list.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
    events.dispatchEvent(new Event('mailbox-change')); await advance(250);
    mocks.list.mockResolvedValue({ emails: [{ ...grouped, isRead: true }], unreadCount: 0 });
    open(); await flush(); fireEvent.click(screen.getByText('Back to inbox')); await flush();
    await act(async () => finishOld({ emails: [grouped], unreadCount: 1 }));
    expect(screen.getByText('Customer').parentElement!.className).toContain('font-normal'); expect(screen.getByText('0 unread conversations')).toBeTruthy();
  });
  it('does not auto-read new messages or a manual Unread state on subsequent revisions', async () => {
    let events!: EventTarget;
    vi.stubGlobal('EventSource', class extends EventTarget { close = vi.fn(); constructor() { super(); events = this; } });
    mocks.list.mockResolvedValue({ emails: [grouped], unreadCount: 1 });
    render(<InboxPage />); await flush(); open(); await flush();
    events.dispatchEvent(new Event('mailbox-change')); await advance(250);
    expect(mocks.read).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('Back to inbox')); await flush();
    expect(screen.getByText('1 unread conversation')).toBeTruthy(); expect(screen.getByText('Customer').parentElement!.className).toContain('font-bold');
    open(); await flush(); expect(mocks.read).toHaveBeenCalledTimes(2);
  });
  it('keeps an error and retry after Back, reconciles partial progress and honors rate limits', async () => {
    let fail!: (error: unknown) => void;
    mocks.list.mockResolvedValue({ emails: [grouped], unreadCount: 1 });
    mocks.read.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
    render(<InboxPage />); await flush(); open(); await flush(); fireEvent.click(screen.getByText('Back to inbox'));
    await act(async () => fail(throttle())); await flush();
    expect(screen.getByRole('alert').textContent).toContain('Could not mark all messages as read');
    expect((screen.getByText('Retry marking as read') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Customer').parentElement!.className).toContain('font-bold');
    await advance(60_001);
    mocks.list.mockResolvedValue({ emails: [{ ...grouped, isRead: true }], unreadCount: 0 });
    fireEvent.click(screen.getByText('Retry marking as read')); await flush();
    expect(screen.queryByRole('alert')).toBeNull(); expect(screen.getByText('Customer').parentElement!.className).toContain('font-normal');
  });
  it('marks a legacy single incoming message on opening and skips provider writes for read messages', async () => {
    render(<InboxPage />); await flush(); open(); await flush(); expect(mocks.readThread).toHaveBeenCalledWith('t1', true);
    fireEvent.click(screen.getByText('Back to inbox')); await flush();
    mocks.list.mockResolvedValue({ emails: [{ ...email, isRead: true }] }); fireEvent.click(screen.getByLabelText('Refresh')); await flush();
    open(); await flush(); expect(mocks.readThread).toHaveBeenCalledOnce();
  });
  it('discards read completion and continuations after mailbox access changes', async () => {
    let events!: EventTarget, finish!: (value: unknown) => void;
    vi.stubGlobal('EventSource', class extends EventTarget { close = vi.fn(); constructor() { super(); events = this; } });
    mocks.list.mockResolvedValue({ emails: [grouped], unreadCount: 1 });
    mocks.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<InboxPage />); await flush(); open(); await flush();
    mocks.list.mockResolvedValue({ emails: [], unreadCount: 0 });
    act(() => events.dispatchEvent(new Event('mailbox-access-changed'))); await flush();
    await act(async () => finish({ count: 25, completedMessageIds: [], nextPageToken: 'revoked-next', isRead: true, unreadCount: 0 })); await flush();
    expect(mocks.read).toHaveBeenCalledOnce(); expect(screen.queryByText('Conversation')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull(); expect(screen.getByText('0 unread conversations')).toBeTruthy();
  });
  it('reports an authorization failure while clearing the protected conversation', async () => {
    mocks.list.mockResolvedValue({ emails: [grouped], unreadCount: 1 });
    mocks.read.mockRejectedValueOnce(Object.assign(new Error('Mailbox access changed. Refresh your Inbox.'), { status: 409 }));
    render(<InboxPage />); await flush(); open(); await flush();
    expect(screen.queryByText('Conversation')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Mailbox access changed');
    expect(mocks.read).toHaveBeenCalledOnce();
  });
  it('aborts and rejects a stale page after authorization changes while hidden', async () => {
    let events: EventTarget;
    vi.stubGlobal('EventSource', class extends EventTarget { close = vi.fn(); constructor() { super(); events = this; } });
    mocks.list.mockResolvedValueOnce({ emails: [email], nextPageToken: 'old-page', unreadCount: 3 });
    render(<InboxPage />); await flush();
    let resolveOld: (value: unknown) => void;
    mocks.list.mockImplementationOnce(() => new Promise(done => { resolveOld = done; }));
    fireEvent.click(screen.getByLabelText('Next page')); await flush();
    const oldSignal = mocks.list.mock.lastCall?.[1] as AbortSignal;
    mocks.list.mockResolvedValueOnce({ emails: [], unreadCount: 0 });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => events!.dispatchEvent(new Event('mailbox-access-changed'))); await flush();
    expect(oldSignal.aborted).toBe(true); expect(mocks.list.mock.lastCall?.[0].pageToken).toBeUndefined();
    await act(async () => resolveOld!({ emails: [email], unreadCount: 3, nextPageToken: 'old-next' }));
    expect(screen.queryByText('Saved customer email')).toBeNull(); expect(screen.queryByText('3 unread conversations')).toBeNull();
  });
  it.each([false, true])('shows the list spinner during manual refresh and preserves the page chrome (failure=%s)', async fails => {
    mocks.list.mockResolvedValueOnce({ emails: [email], unreadCount: 1 });
    render(<InboxPage />); await flush();
    let resolve: (value: unknown) => void, reject: (error: Error) => void;
    mocks.list.mockImplementationOnce(() => new Promise((done, fail) => { resolve = done; reject = fail; }));
    fireEvent.click(screen.getByLabelText('Refresh')); fireEvent.click(screen.getByLabelText('Refresh')); await flush();
    const spinner = screen.getByRole('status', { name: 'Loading conversations' });
    expect(spinner.closest('[data-mailbox-list]')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Inbox' })).toBeTruthy();
    for (const label of ['Work email', 'Sync now', 'Disconnect', '1 unread conversation']) expect(screen.getByText(label)).toBeTruthy();
    for (const label of ['Search email', 'Filter emails', 'Sort emails', 'Email list actions']) expect(screen.getByLabelText(label)).toBeTruthy();
    expect(mocks.list).toHaveBeenCalledTimes(2); expect(mocks.sync).not.toHaveBeenCalled();
    await act(async () => { if (fails) reject!(new Error('Refresh failed')); else resolve!({ emails: [{ ...email, snippet: 'Updated preview' }], unreadCount: 1 }); });
    expect(screen.queryByRole('status', { name: 'Loading conversations' })).toBeNull();
    expect(screen.getByText('Saved customer email')).toBeTruthy(); expect(screen.queryByText('No emails found')).toBeNull();
    if (fails) { expect(screen.getByRole('alert').textContent).toContain('Refresh failed'); fireEvent.click(screen.getByLabelText('Refresh')); await flush(); expect(mocks.list).toHaveBeenCalledTimes(3); }
    else expect(screen.getByText('— Updated preview')).toBeTruthy();
  });
  it('keeps the toolbar on initial list load and avoids an empty-state claim on first-load failure', async () => {
    let reject: (error: Error) => void;
    mocks.list.mockImplementationOnce(() => new Promise((_done, fail) => { reject = fail; }));
    render(<InboxPage />); await flush();
    expect(screen.getByRole('toolbar', { name: 'Email list actions' })).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Loading conversations' })).toBeTruthy();
    await act(async () => reject!(new Error('List unavailable')));
    expect(screen.queryByText('No emails found')).toBeNull(); expect(screen.getByRole('alert').textContent).toContain('List unavailable');
  });
  it('preserves opaque conversation cursors for next and previous pages', async () => {
    mocks.list.mockResolvedValueOnce({ emails: [email], nextPageToken: 'cursor-2' })
      .mockResolvedValueOnce({ emails: [{ ...email, id: 'm2', threadId: 't2' }], nextPageToken: 'cursor-3' })
      .mockResolvedValueOnce({ emails: [{ ...email, id: 'm3', threadId: 't3' }] });
    render(<InboxPage />); await flush();
    fireEvent.click(screen.getByLabelText('Next page')); await flush();
    expect(mocks.list.mock.lastCall?.[0].pageToken).toBe('cursor-2');
    fireEvent.click(screen.getByLabelText('Next page')); await flush();
    expect(mocks.list.mock.lastCall?.[0].pageToken).toBe('cursor-3');
    fireEvent.click(screen.getByLabelText('Previous page')); await flush();
    expect(mocks.list.mock.lastCall?.[0].pageToken).toBe('cursor-2');
  });
  it('keeps Sync now feedback independent and prevents Refresh/Disconnect while provider sync runs', async () => {
    let reject: (error: Error) => void;
    mocks.sync.mockImplementationOnce(() => new Promise((_done, fail) => { reject = fail; }));
    render(<InboxPage />); await flush();
    fireEvent.click(screen.getByText('Sync now')); fireEvent.click(screen.getByText('Sync now')); await flush();
    expect(mocks.sync).toHaveBeenCalledTimes(1); expect(screen.getByText('Saved customer email')).toBeTruthy();
    expect((screen.getByLabelText('Refresh') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('Disconnect') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => reject!(new Error('Provider sync failed')));
    expect(screen.getByText('Provider sync failed')).toBeTruthy(); expect(screen.getByText('Saved customer email')).toBeTruthy();
    expect((screen.getByLabelText('Refresh') as HTMLButtonElement).disabled).toBe(false);
  });
  it('resets an expired assignment cursor to the first authorized page', async () => {
    mocks.list.mockResolvedValueOnce({ emails: [email], nextPageToken: 'old-scope-cursor' })
      .mockRejectedValueOnce(Object.assign(new Error('Page changed'), { status: 400, code: 'MAILBOX_PAGE_CHANGED' }))
      .mockResolvedValueOnce({ emails: [{ ...email, subject: 'Current assigned conversation' }] });
    render(<InboxPage />); await flush();
    fireEvent.click(screen.getByLabelText('Next page')); await flush();
    expect(mocks.list.mock.lastCall?.[0].pageToken).toBeUndefined();
    expect(screen.getByText('Current assigned conversation')).toBeTruthy(); expect(screen.queryByText('Saved customer email')).toBeNull();
    expect((screen.getByLabelText('Previous page') as HTMLButtonElement).disabled).toBe(true);
  });
  it('has only the final filters and no categories or title dropdown', async () => {
    render(<InboxPage />); await flush();
    for (const label of ['Current', 'Primary', 'Promotions', 'Social', 'Updates']) expect(screen.queryByText(label)).toBeNull();
    fireEvent.click(screen.getByLabelText('Filter emails'));
    expect(screen.getAllByRole('menuitemradio').map(item => item.textContent)).toEqual(['All emails', 'Unread only', 'Sent', 'Scheduled', 'Drafts only']);
    fireEvent.click(screen.getByText('Unread only')); await flush();
    expect(mocks.list.mock.lastCall?.[0]).toMatchObject({ filter: 'unread', sort: 'newest' });
  });
  it('debounces search and sends independent sort and filter values', async () => {
    render(<InboxPage />); await flush();
    fireEvent.change(screen.getByLabelText('Search email'), { target: { value: 'quo' } }); await advance(200);
    fireEvent.change(screen.getByLabelText('Search email'), { target: { value: 'quotation' } }); await advance(399);
    expect(mocks.list).toHaveBeenCalledTimes(1); await advance(1);
    expect(mocks.list.mock.lastCall?.[0].query).toBe('quotation');
    fireEvent.click(screen.getByLabelText('Sort emails')); fireEvent.click(screen.getByText('Oldest first')); await flush();
    expect(mocks.list.mock.lastCall?.[0]).toMatchObject({ filter: 'all', sort: 'oldest' });
  });
  it('never starts Gmail sync on mount, elapsed time, visibility or remount', async () => {
    const view = render(<InboxPage />); await flush(); await advance(600000);
    document.dispatchEvent(new Event('visibilitychange')); await advance(300);
    view.unmount(); render(<InboxPage />); await flush();
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it('refreshes silently from coalesced realtime events', async () => {
    let events: EventTarget;
    vi.stubGlobal('EventSource', class extends EventTarget { close = vi.fn(); constructor() { super(); events = this; } });
    render(<InboxPage />); await flush();
    let resolve: (value: unknown) => void;
    mocks.list.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    events!.dispatchEvent(new Event('mailbox-change')); events!.dispatchEvent(new Event('mailbox-change')); await advance(250);
    expect(mocks.list).toHaveBeenCalledTimes(2); expect(screen.getByText('Saved customer email')).toBeTruthy();
    expect(screen.queryByText('Loading emails...')).toBeNull();
    await act(async () => resolve!({ emails: [email, { ...email, id: 'new', subject: 'New customer reply' }] }));
    expect(screen.getByText('New customer reply')).toBeTruthy(); expect(mocks.sync).not.toHaveBeenCalled();
  });
  it('keeps mail during provider limits and still allows persisted refresh', async () => {
    render(<InboxPage />); await flush(); mocks.sync.mockRejectedValueOnce(throttle(120));
    fireEvent.click(screen.getByText('Sync now')); await flush();
    expect(screen.getByText('Saved customer email')).toBeTruthy();
    expect((screen.getByText('Sync now') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Refresh') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByLabelText('Refresh')); await flush();
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });
  it('bounds failed stream retries and cleans up streams and timers on unmount', async () => {
    const streams: Array<EventTarget & { close: ReturnType<typeof vi.fn> }> = [];
    vi.stubGlobal('EventSource', class extends EventTarget { close = vi.fn(); constructor() { super(); streams.push(this); } });
    const view = render(<InboxPage />); await flush();
    expect(streams).toHaveLength(1);
    streams[0].dispatchEvent(new Event('error')); await flush();
    expect(streams[0].close).toHaveBeenCalledOnce();
    await advance(4_999); expect(streams).toHaveLength(1);
    await advance(1); expect(streams).toHaveLength(2);
    streams[1].dispatchEvent(new Event('mailbox-change')); await advance(250);
    expect(mocks.list).toHaveBeenCalledTimes(2);
    view.unmount(); expect(streams[1].close).toHaveBeenCalledOnce();
    await advance(180_000); expect(streams).toHaveLength(2);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it('preserves the reconnect backoff when a filter change recreates the stream effect', async () => {
    const streams: Array<EventTarget & { close: ReturnType<typeof vi.fn> }> = [];
    vi.stubGlobal('EventSource', class extends EventTarget { close = vi.fn(); constructor() { super(); streams.push(this); } });
    render(<InboxPage />); await flush();
    streams[0].dispatchEvent(new Event('error')); await flush();
    fireEvent.click(screen.getByLabelText('Filter emails')); fireEvent.click(screen.getByText('Sent')); await flush();
    expect(streams).toHaveLength(1);
    await advance(4_999); expect(streams).toHaveLength(1);
    await advance(1); expect(streams).toHaveLength(2);
  });
  it('honors an API cooldown across refresh, sync and realtime connections', async () => {
    const streams: Array<EventTarget & { close: ReturnType<typeof vi.fn> }> = [];
    vi.stubGlobal('EventSource', class extends EventTarget { close = vi.fn(); constructor() { super(); streams.push(this); } });
    render(<InboxPage />); await flush();
    mocks.list.mockRejectedValueOnce(Object.assign(new Error('Too many requests'), { status: 429, retryAt: new Date(Date.now() + 120_000).toISOString() }));
    fireEvent.click(screen.getByLabelText('Refresh')); await flush();
    expect(screen.getByText('Saved customer email')).toBeTruthy();
    expect(streams[0].close).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByLabelText('Refresh')); fireEvent.click(screen.getByText('Sync now'));
    document.dispatchEvent(new Event('visibilitychange')); await advance(119_999);
    expect(mocks.list).toHaveBeenCalledTimes(2); expect(mocks.sync).not.toHaveBeenCalled(); expect(streams).toHaveLength(1);
    await advance(26); expect(mocks.list).toHaveBeenCalledTimes(3); expect(streams).toHaveLength(3);
  });
  it('stops status-request throttling and avoids fallback reads while hidden', async () => {
    const streams: EventTarget[] = [];
    vi.stubGlobal('EventSource', class extends EventTarget { close = vi.fn(); constructor() { super(); streams.push(this); } });
    render(<InboxPage />); await flush();
    mocks.status.mockRejectedValueOnce(Object.assign(new Error('Too many requests'), { status: 429 }));
    streams[0].dispatchEvent(new Event('mailbox-change')); await advance(250);
    expect(screen.getByRole('alert').textContent).toContain('Too many requests');
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await advance(180_000);
    expect(mocks.list).toHaveBeenCalledTimes(2); expect(streams).toHaveLength(1);
    visibility.mockReturnValue('visible'); document.dispatchEvent(new Event('visibilitychange')); await advance(250);
    expect(mocks.list).toHaveBeenCalledTimes(3); visibility.mockRestore();
  });
  it('rejects stale responses and deduplicates the same active list request', async () => {
    render(<InboxPage />); await flush();
    let resolve: (value: unknown) => void;
    mocks.list.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    fireEvent.click(screen.getByLabelText('Refresh')); await flush();
    fireEvent.click(screen.getByLabelText('Filter emails')); fireEvent.click(screen.getByText('Sent')); await flush();
    expect(mocks.list.mock.lastCall?.[0].filter).toBe('sent');
    await act(async () => resolve!({ emails: [{ ...email, subject: 'Stale response' }] }));
    expect(screen.queryByText('Stale response')).toBeNull();
  });
  it('clears cached rows on an authorization failure', async () => {
    render(<InboxPage />); await flush(); mocks.list.mockRejectedValueOnce(Object.assign(new Error('Mailbox access unavailable'), { status: 403 }));
    fireEvent.click(screen.getByLabelText('Refresh')); await flush();
    expect(screen.queryByText('Saved customer email')).toBeNull(); expect(screen.getByRole('alert').textContent).toContain('Mailbox access');
  });
  it('finishes initial load under Strict Mode', async () => {
    render(<StrictMode><InboxPage /></StrictMode>); await flush();
    expect(screen.getByText('Saved customer email')).toBeTruthy(); expect(screen.queryByText('Loading emails...')).toBeNull();
  });
});
