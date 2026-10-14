import React from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ status: vi.fn(), count: vi.fn(), identity: { user: { id: 'user-a' }, tenant: { id: 'tenant-a' } } }));
vi.mock('@/features/tenant/inbox/services/gmail.service', () => ({ getGmailStatus: mocks.status, fetchGmailUnreadCount: mocks.count }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => mocks.identity }));
vi.mock('next/navigation', () => ({ usePathname: () => '/inbox' }));
vi.mock('../use-layout', () => ({ useLayout: () => ({ currentPath: 'inbox' }), NAV_ITEMS: [] }));
vi.mock('@/features/tenant/notifications/hooks/use-notifications', () => ({ useNotifications: () => ({ unreadCount: 0 }) }));
vi.mock('@/features/tenant/notifications/ui/notifications-dropdown', () => ({ default: () => null }));
vi.mock('@/shared/components/global-omnibox', () => ({ GlobalOmnibox: () => null }));
vi.mock('@/shared/components/mobile-search-overlay', () => ({ MobileSearchOverlay: () => null }));
vi.mock('../user-profile-dropdown', () => ({ UserProfileDropdown: () => null }));
import Topbar from '../topbar';

beforeEach(() => { vi.resetAllMocks(); mocks.identity.user.id = 'user-a'; mocks.status.mockResolvedValue({ isConnected: true }); });
afterEach(cleanup);
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
const props = { onOpenSidebar: vi.fn(), onOpenInbox: vi.fn() };

it.each([0, 2])('does not replace a confirmed count of %s with an older initial response', async count => {
  let finish!: (value: { unreadCount: number }) => void;
  mocks.count.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<Topbar {...props} />); await flush();
  act(() => window.dispatchEvent(new CustomEvent('mailbox-unread-change', { detail: count })));
  await act(async () => finish({ unreadCount: 9 }));
  const button = screen.getByRole('button', { name: 'Open Inbox' });
  expect(within(button).queryByText('9')).toBeNull();
  expect(button.textContent).toBe(count ? String(count) : '');
});

it('resets and refetches the count on identity changes and rejects the previous user response', async () => {
  let finish!: (value: { unreadCount: number }) => void;
  mocks.count.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce({ unreadCount: 3 });
  const view = render(<Topbar {...props} />); await flush();
  mocks.identity.user.id = 'user-b'; view.rerender(<Topbar {...props} />); await flush();
  await act(async () => finish({ unreadCount: 9 }));
  expect(screen.getByRole('button', { name: 'Open Inbox' }).textContent).toBe('3');
});
