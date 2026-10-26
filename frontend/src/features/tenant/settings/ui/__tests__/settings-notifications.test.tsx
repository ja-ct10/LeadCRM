import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NotificationRecord, NotificationSettingsTab } from '@leadcrm/shared';
import { Settings } from 'lucide-react';
import SettingsPage from '../settings-page';
import SidebarNav from '@/features/tenant/layout/sidebar-nav';
import NotificationsPage from '@/features/tenant/notifications/ui/notifications-page';
import NotificationsDropdown from '@/features/tenant/notifications/ui/notifications-dropdown';
import { useNotifications } from '@/features/tenant/notifications/hooks/use-notifications';
import { clearNotificationTracking } from '@/features/tenant/notifications/hooks/notification-requests';
import { clearPageCache } from '@/shared/cache/page-cache';

const mocks = vi.hoisted(() => ({
  auth: { tenant: { id: 'tenant-a' }, user: { id: 'admin-a', tenantId: 'tenant-a', firstName: 'Test', lastName: 'Admin', role: 'Client Admin' }, userCan: vi.fn() },
  tab: 'profile', counts: vi.fn(), list: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn(), delete: vi.fn(), push: vi.fn(), replace: vi.fn(),
}));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/shared/services/notifications.api', () => ({ notificationsApi: mocks }));
vi.mock('next/navigation', () => {
  const router = { push: mocks.push, replace: mocks.replace };
  return { useSearchParams: () => new URLSearchParams({ tab: mocks.tab }), useRouter: () => router };
});
vi.mock('@/features/tenant/layout/use-layout', () => ({ useLayout: () => ({ currentPath: 'settings', filteredNav: [{ path: 'settings', name: 'Settings', icon: Settings, group: 'Settings' }] }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('../profile-form', () => ({ ProfileForm: () => <p>Profile content</p> }));
vi.mock('../security-settings', () => ({ SecuritySettings: () => null }));
vi.mock('../organization-settings-form', () => ({ OrganizationSettingsForm: () => <p>Organization content</p> }));
vi.mock('../team-management', () => ({ TeamManagement: () => <p>Team content</p> }));
vi.mock('../roles-permissions', () => ({ RolesPermissions: () => <p>Roles content</p> }));
vi.mock('../products-page', () => ({ ProductsPage: () => null }));
vi.mock('../product-interests-settings', () => ({ ProductInterestsSettings: () => null }));
vi.mock('../archived-data', () => ({ ArchivedData: () => null }));
vi.mock('../forms-tab', () => ({ FormsTab: () => null }));

type FixtureNotification = NotificationRecord & { tab?: NotificationSettingsTab; module: string };
let rows: FixtureNotification[];
const event = (id: string, type = 'user_status_changed', tab: NotificationSettingsTab | undefined = 'users', module = 'settings'): FixtureNotification => ({
  id, type, tab, module, tenantId: 'tenant-a', userId: 'admin-a', title: id, entityType: 'User', entityId: 'team-user',
  isRead: false, available: true, createdAt: '2026-01-01T00:00:00Z',
});
function summary() {
  const unread = rows.filter(row => !row.isRead);
  const unreadBySettingsTab: Partial<Record<NotificationSettingsTab, number>> = {};
  const unreadByModule: Record<string, number> = {};
  for (const row of unread) {
    unreadByModule[row.module] = (unreadByModule[row.module] ?? 0) + 1;
    if (row.tab) unreadBySettingsTab[row.tab] = (unreadBySettingsTab[row.tab] ?? 0) + 1;
  }
  return { success: true, totalCount: rows.length, unreadCount: unread.length, unreadBySettingsTab, unreadByModule };
}
const sidebarProps = { sidebarOpen: false, onCloseSidebar: vi.fn(), navigate: vi.fn(), isAccountDropdownOpen: false,
  onToggleAccountDropdown: vi.fn(), isCollapsed: false, onToggleCollapse: vi.fn() };
function Navigation({ collapsed = false }) {
  return <><SidebarNav {...sidebarProps} isCollapsed={collapsed} /><SettingsPage /></>;
}
const teamButton = () => screen.getByRole('button', { name: /^Team Management/ });
const teamDot = () => within(teamButton()).queryByRole('status', { name: 'Unread notifications in Team Management' });

beforeEach(() => {
  vi.clearAllMocks(); clearNotificationTracking(); clearPageCache();
  mocks.tab = 'profile'; mocks.auth.user.id = 'admin-a'; mocks.auth.tenant.id = 'tenant-a'; mocks.auth.user.tenantId = 'tenant-a';
  mocks.auth.userCan.mockReturnValue(true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  rows = [event('User Reactivated'), event('User Deactivated'), event('New Team Member', 'user_created')];
  mocks.counts.mockReset().mockImplementation(async () => summary());
  mocks.list.mockReset().mockImplementation(async () => ({ ...summary(), data: rows.map(row => ({ ...row })), meta: { hasMore: false, snapshot: '2026-01-02T00:00:00Z' } }));
  mocks.markRead.mockReset().mockImplementation(async (id: string) => { rows = rows.map(row => row.id === id ? { ...row, isRead: true } : row); return summary(); });
  mocks.markAllRead.mockReset().mockImplementation(async () => { rows = rows.map(row => ({ ...row, isRead: true })); return { ...summary(), readBefore: '2026-01-02T00:00:00Z' }; });
});
afterEach(() => { cleanup(); clearNotificationTracking(); clearPageCache(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each(['User Reactivated', 'User Deactivated', 'New Team Member'])('shows one Team Management dot for unread %s without marking navigation read', async title => {
  rows = rows.filter(row => row.title === title);
  render(<Navigation />);
  await waitFor(() => expect(teamDot()).toBeTruthy());
  expect(within(teamButton()).getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status', { name: 'Unread Settings notifications' })).toBeTruthy();
  fireEvent.click(teamButton()); await screen.findByText('Team content');
  expect(teamDot()).toBeTruthy();
  expect(screen.getByRole('option', { name: 'Team Management (unread)' }).textContent).toBe('Team Management');
  expect(mocks.markAllRead).not.toHaveBeenCalled(); expect(mocks.markRead).not.toHaveBeenCalled();
  expect(mocks.counts).toHaveBeenCalledTimes(1); expect(mocks.list).not.toHaveBeenCalled();
});

it('shows one dot for multiple team events and dots only on the other mapped submenus', async () => {
  rows.push(event('Role changed', 'role_permissions_changed', 'roles'), event('Password warning', 'password_expiring_soon', 'profile'));
  render(<Navigation />);
  await waitFor(() => expect(teamDot()).toBeTruthy());
  expect(within(teamButton()).getAllByRole('status')).toHaveLength(1);
  expect(within(screen.getByRole('button', { name: /^Roles & Permissions/ })).getByRole('status')).toBeTruthy();
  expect(within(screen.getByRole('button', { name: /^Profile Settings/ })).getByRole('status')).toBeTruthy();
  for (const name of ['General', 'Appearance', 'Customize Fields', 'Products', 'Archived Data', 'Forms']) {
    expect(within(screen.getByRole('button', { name })).queryByRole('status')).toBeNull();
  }
  expect(screen.getByRole('option', { name: 'Team Management (unread)' })).toBeTruthy();
});

it.each(['dropdown', 'page'])('synchronizes individual and all reads from the %s with both navigation levels', async surface => {
  render(<Navigation />);
  if (surface === 'page') render(<NotificationsPage />);
  else {
    const trigger = document.createElement('button'); document.body.appendChild(trigger);
    render(<NotificationsDropdown isOpen onClose={vi.fn()} triggerRef={{ current: trigger }} />);
    trigger.remove();
  }
  const feed = renderHook(() => useNotifications());
  await waitFor(() => expect(feed.result.current.notifications).toHaveLength(3));
  await act(async () => { await feed.result.current.markAsRead('User Reactivated'); });
  expect(teamDot()).toBeTruthy(); expect(feed.result.current.unreadCount).toBe(2);
  expect(screen.getByRole('status', { name: 'Unread Settings notifications' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Mark all notifications as read' }));
  await waitFor(() => expect(teamDot()).toBeNull());
  expect(screen.queryByRole('status', { name: 'Unread Settings notifications' })).toBeNull();
  await waitFor(() => expect(feed.result.current.unreadCount).toBe(0));
  await waitFor(() => expect(feed.result.current.notifications.every(row => row.isRead)).toBe(true));
  expect(mocks.counts).toHaveBeenCalledTimes(1);
});

it('clears the team dot only when its final unread notification is successfully read', async () => {
  render(<Navigation />);
  const feed = renderHook(() => useNotifications());
  await waitFor(() => expect(teamDot()).toBeTruthy());
  mocks.markRead.mockRejectedValueOnce(Error('Unavailable'));
  await act(async () => { expect(await feed.result.current.markAsRead(rows[0].id)).toBe(false); });
  expect(teamDot()).toBeTruthy();
  for (const row of rows.slice(0, 2)) await act(async () => { await feed.result.current.markAsRead(row.id); });
  expect(teamDot()).toBeTruthy();
  await act(async () => { await feed.result.current.markAsRead('New Team Member'); });
  expect(teamDot()).toBeNull();
});

it('refreshes the matching submenu through the existing timer even when global totals stay equal', async () => {
  vi.useFakeTimers(); rows = [event('Role changed', 'role_permissions_changed', 'roles')];
  render(<Navigation />);
  const feed = renderHook(() => useNotifications());
  await act(async () => {});
  expect(teamDot()).toBeNull();
  rows = [event('New team event')];
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(teamDot()).toBeTruthy();
  expect(within(screen.getByRole('button', { name: 'Roles & Permissions' })).queryByRole('status')).toBeNull();
  expect(feed.result.current.notifications[0].id).toBe('New team event');
  expect(mocks.counts).toHaveBeenCalledTimes(2);
  expect(mocks.markAllRead).not.toHaveBeenCalled();
});

it('keeps unrelated events out of submenus and preserves the global Settings fallback', async () => {
  rows = [{ ...event('Inbox event'), tab: undefined, module: 'inbox' }];
  const view = render(<Navigation />);
  await waitFor(() => expect(mocks.counts).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('status')).toBeNull();
  rows = [{ ...event('Unmapped Settings event'), tab: undefined }];
  act(() => window.dispatchEvent(new Event('focus')));
  await screen.findByRole('status', { name: 'Unread Settings notifications' });
  expect(teamDot()).toBeNull();
  view.rerender(<Navigation collapsed />);
  expect(screen.getByRole('status', { name: 'Unread Settings notifications' }).classList.contains('absolute')).toBe(true);
});

it('hides restricted submenus and discards old user and tenant summaries, including late responses', async () => {
  const view = render(<Navigation />);
  await waitFor(() => expect(teamDot()).toBeTruthy());
  mocks.auth.userCan.mockImplementation((module: string) => !['users', 'groups'].includes(module));
  view.rerender(<Navigation />);
  expect(screen.queryByRole('button', { name: /^Team Management/ })).toBeNull();
  expect(screen.queryByRole('option', { name: /^Team Management/ })).toBeNull();
  mocks.auth.userCan.mockReturnValue(true);
  let finish!: (value: ReturnType<typeof summary>) => void;
  mocks.counts.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  act(() => window.dispatchEvent(new Event('focus')));
  mocks.auth.user.id = 'admin-b'; mocks.auth.tenant.id = 'tenant-b'; mocks.auth.user.tenantId = 'tenant-b';
  mocks.counts.mockReturnValue(new Promise(() => {}));
  view.rerender(<Navigation />);
  expect(teamDot()).toBeNull();
  await act(async () => finish(summary()));
  expect(teamDot()).toBeNull();
  expect(screen.queryByRole('status')).toBeNull();
});
