import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { defaultContactForm, getCrmFieldCatalog, type NotificationRecord, type NotificationRecordTarget, type UnreadNotificationRecord } from '@leadcrm/shared';
import { RolesPermissions } from '../roles-permissions';
import { FormsTab } from '../forms-tab';
import { UserPanel } from '../user-panel';
import { UnreadRecordDot } from '@/features/tenant/notifications/hooks/use-record-notifications';
import { useNotifications } from '@/features/tenant/notifications/hooks/use-notifications';
import { clearNotificationTracking } from '@/features/tenant/notifications/hooks/notification-requests';
import { clearPageCache } from '@/shared/cache/page-cache';
import { toast } from '@/shared/utils/toast';

const mocks = vi.hoisted(() => ({
  auth: { tenant: { id: 'tenant' }, user: { id: 'admin', tenantId: 'tenant', role: 'Client Admin' }, userCan: vi.fn() },
  counts: vi.fn(), list: vi.fn(), markAllRead: vi.fn(), markRead: vi.fn(), delete: vi.fn(), role: vi.fn(), forms: vi.fn(),
}));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ roles, permissions: [], rolesLoading: false, rolesError: '', refreshRoles: vi.fn() }) }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/shared/services/notifications.api', () => ({ notificationsApi: mocks }));
vi.mock('@/features/tenant/administration/roles/services/roles.service', () => ({ rolesService: { getById: mocks.role } }));
vi.mock('@/shared/utils/toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/shared/services/groups.api', () => ({ groupsApi: { getAll: async () => ({ data: [] }) } }));
vi.mock('@/shared/hooks/use-email-availability', () => ({ useEmailAvailability: () => ({}) }));
vi.mock('@/shared/hooks/use-product-interests', () => ({ useProductInterests: () => ({ products: [], categories: [] }) }));
vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: () => ({ data: getCrmFieldCatalog('leads'), isInitialLoad: false, error: null }) }));
vi.mock('@/features/tenant/marketing/forms/services/forms.service', () => ({ getFormsByTenant: mocks.forms,
  getLeadFormFieldCatalog: vi.fn(), getFormById: vi.fn(), updateForm: vi.fn(), publishForm: vi.fn(), unpublishForm: vi.fn(),
  createForm: vi.fn(), deleteForm: vi.fn(), duplicateForm: vi.fn(), getShareLink: () => '', getEmbedCode: () => '',
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
const roles = ids.map((id, index) => ({ id, tenantId: 'tenant', name: `Role ${index}`, isArchived: false, isSystemRole: false, permissions: [], userCount: 0, description: '' }));
const forms = ids.map((id, index) => ({ ...defaultContactForm(), id, tenantId: 'tenant', name: `Form ${index}`, publicId: id, revision: 0, publishedVersion: 0, publishedRevision: null, status: 'draft' as const, createdAt: '', updatedAt: '' }));
const users = ids.map((id, index) => ({ id, tenantId: 'tenant', firstName: 'User', lastName: String(index), email: `user${index}@camxian.com`, role: 'Staff', status: 'active' as const }));
let rows: NotificationRecord[];
const target = (entityType: NotificationRecordTarget['entityType'], index = 0) => ({ entityType, entityId: ids[index] });
const dotLabel = (entityType: string) => `Unread ${entityType === 'RoleDefinition' ? 'Role' : entityType} notifications`;
function summary() {
  const records = new Map<string, UnreadNotificationRecord>();
  for (const row of rows.filter(row => !row.isRead)) {
    const record = { entityType: row.entityType, entityId: row.entityId } as NotificationRecordTarget;
    const key = `${record.entityType}:${record.entityId}`;
    records.set(key, { ...record, count: (records.get(key)?.count ?? 0) + 1 });
  }
  return { success: true, totalCount: rows.length, unreadCount: rows.filter(row => !row.isRead).length, unreadRecords: [...records.values()],
    unreadBySettingsTab: { users: rows.filter(row => !row.isRead && row.entityType === 'User').length,
      roles: rows.filter(row => !row.isRead && row.entityType === 'RoleDefinition').length } };
}
function UserRecords() {
  const [open, setOpen] = React.useState(false);
  return <>{users.map((user, index) => <div key={user.id}><button onClick={() => setOpen(true)}>View User {index}</button><UnreadRecordDot entityType="User" entityId={user.id} /></div>)}
    {open && <UserPanel user={users[0]} roles={[]} canEdit={false} onSaved={vi.fn()} onClose={() => setOpen(false)} />}</>;
}
const modules = [
  { entityType: 'User' as const, render: () => <UserRecords />, open: 'View User 0', close: 'Close drawer' },
  { entityType: 'RoleDefinition' as const, render: () => <RolesPermissions />, open: 'View Role 0', close: 'Close role details' },
  { entityType: 'Form' as const, render: () => <FormsTab />, open: 'View Form 0', close: 'Back to Forms' },
];
beforeEach(() => {
  vi.clearAllMocks(); clearPageCache(); clearNotificationTracking();
  mocks.auth.user.id = 'admin'; mocks.auth.tenant.id = 'tenant'; mocks.auth.user.tenantId = 'tenant';
  mocks.auth.userCan.mockImplementation((_module, action) => action === 'canView');
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  rows = ['User', 'RoleDefinition', 'Form'].flatMap(entityType => [0, 0, 1].map((index, event) => ({
    id: `${entityType}-${event}`, tenantId: 'tenant', userId: 'admin', entityType, entityId: ids[index],
    type: entityType === 'User' ? 'user_status_changed' : entityType === 'RoleDefinition' ? 'role_permissions_changed' : 'form_processing_failed',
    title: 'Record event', isRead: false, createdAt: '2026-01-01T00:00:00Z',
  })));
  mocks.counts.mockReset().mockImplementation(async () => summary());
  mocks.list.mockReset().mockImplementation(async () => ({ ...summary(), data: rows.map(row => ({ ...row })), meta: { hasMore: false } }));
  mocks.markAllRead.mockReset().mockImplementation(async (before, record) => {
    rows = rows.map(row => row.entityType === record.entityType && row.entityId === record.entityId ? { ...row, isRead: true } : row);
    return { ...summary(), readBefore: before, readRecord: record };
  });
  mocks.role.mockReset().mockImplementation(async id => ({ ...roles.find(role => role.id === id), permissions: [], assignedUsers: [] }));
  mocks.forms.mockReset().mockResolvedValue(forms);
});
afterEach(() => { cleanup(); clearNotificationTracking(); clearPageCache(); vi.unstubAllGlobals(); });

it.each(modules)('reads only the opened $entityType and keeps server state across reopen and a fresh mount', async module => {
  const view = render(module.render());
  const feed = renderHook(() => useNotifications());
  await waitFor(() => expect(feed.result.current.unreadCount).toBe(9));
  expect(mocks.markAllRead).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button', { name: module.open }));
  await screen.findByRole('button', { name: module.close });
  await waitFor(() => expect(mocks.markAllRead).toHaveBeenCalledExactlyOnceWith(undefined, target(module.entityType)));
  await waitFor(() => expect(feed.result.current.unreadCount).toBe(7));
  expect(rows.filter(row => row.isRead)).toHaveLength(2);
  expect(rows.filter(row => row.isRead).every(row => row.entityType === module.entityType && row.entityId === ids[0])).toBe(true);
  expect(feed.result.current.notifications.filter(row => row.isRead)).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: module.close }));
  await waitFor(() => expect(screen.queryByRole('button', { name: module.close })).toBeNull());
  const label = dotLabel(module.entityType);
  expect(screen.getAllByRole('status', { name: label })).toHaveLength(1);
  fireEvent.click(await screen.findByRole('button', { name: module.open }));
  await screen.findByRole('button', { name: module.close });
  expect(mocks.markAllRead).toHaveBeenCalledTimes(1);
  view.unmount(); feed.unmount(); clearPageCache(); clearNotificationTracking();
  render(module.render());
  await screen.findByRole('button', { name: module.open });
  await waitFor(() => expect(screen.getAllByRole('status', { name: label })).toHaveLength(1));
  expect(mocks.markAllRead).toHaveBeenCalledTimes(1);
});

it.each(modules)('keeps $entityType unread on failure, reports the error once, and retries on a later opening', async module => {
  mocks.markAllRead.mockRejectedValueOnce(new Error('Unavailable'));
  render(module.render());
  const bell = renderHook(() => useNotifications('all', { countsOnly: true }));
  fireEvent.click(await screen.findByRole('button', { name: module.open }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledExactlyOnceWith('Failed to update notifications'));
  expect(bell.result.current.unreadCount).toBe(9);
  expect(rows.every(row => !row.isRead)).toBe(true);
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(mocks.markAllRead).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: module.close }));
  await waitFor(() => expect(screen.queryByRole('button', { name: module.close })).toBeNull());
  expect(screen.getAllByRole('status', { name: dotLabel(module.entityType) })).toHaveLength(2);
  fireEvent.click(await screen.findByRole('button', { name: module.open }));
  await waitFor(() => expect(bell.result.current.unreadCount).toBe(7));
  expect(mocks.markAllRead).toHaveBeenCalledTimes(2);
});

it('waits for role details, coalesces duplicate opens, and clears no dots before read success', async () => {
  let finishDetails!: () => void, finishRead!: () => void;
  mocks.role.mockImplementationOnce(() => new Promise(resolve => { finishDetails = () => resolve({ ...roles[0], assignedUsers: [] }); }));
  const read = mocks.markAllRead.getMockImplementation()!;
  mocks.markAllRead.mockImplementationOnce((before, record) => new Promise(resolve => { finishRead = () => resolve(read(before, record)); }));
  render(<RolesPermissions />);
  const button = await screen.findByRole('button', { name: 'View Role 0' });
  fireEvent.click(button); fireEvent.click(button);
  expect(mocks.role).toHaveBeenCalledExactlyOnceWith(ids[0]);
  expect(mocks.markAllRead).not.toHaveBeenCalled();
  await act(async () => finishDetails());
  await waitFor(() => expect(mocks.markAllRead).toHaveBeenCalledTimes(1));
  expect(screen.getAllByRole('status', { name: 'Unread Role notifications' })).toHaveLength(2);
  await act(async () => finishRead());
  await waitFor(() => expect(screen.getAllByRole('status', { name: 'Unread Role notifications' })).toHaveLength(1));
});

it('does not read a failed or unauthorized role detail request', async () => {
  mocks.role.mockRejectedValueOnce(new Error('Role unavailable'));
  const view = render(<RolesPermissions />);
  fireEvent.click(await screen.findByRole('button', { name: 'View Role 0' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Role unavailable'));
  expect(mocks.markAllRead).not.toHaveBeenCalled();
  let finish!: () => void;
  mocks.role.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ ...roles[0], assignedUsers: [] }); }));
  fireEvent.click(screen.getByRole('button', { name: 'View Role 0' }));
  mocks.auth.userCan.mockReturnValue(false); view.rerender(<RolesPermissions />);
  await act(async () => finish());
  expect(screen.queryByRole('button', { name: 'Close role details' })).toBeNull();
  expect(mocks.markAllRead).not.toHaveBeenCalled();
});

it('supports View Details for system roles without granting edit permission', async () => {
  mocks.auth.userCan.mockReturnValue(true);
  roles[0].isSystemRole = true;
  try {
    render(<RolesPermissions />);
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Role 0' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'View Details' }));
    await screen.findByRole('button', { name: 'Close role details' });
    await waitFor(() => expect(mocks.markAllRead).toHaveBeenCalledTimes(1));
    expect(screen.getByText('System roles cannot be modified.')).toBeTruthy();
  } finally { roles[0].isSystemRole = false; }
});

it('ignores a late role response after the user opens another record', async () => {
  let finish!: () => void;
  mocks.role.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ ...roles[0], assignedUsers: [] }); }));
  render(<RolesPermissions />);
  fireEvent.click(screen.getByRole('button', { name: 'View Role 0' }));
  fireEvent.click(screen.getByRole('button', { name: 'View Role 1' }));
  await waitFor(() => expect(mocks.markAllRead).toHaveBeenCalledExactlyOnceWith(undefined, target('RoleDefinition', 1)));
  await act(async () => finish());
  expect(mocks.markAllRead).toHaveBeenCalledTimes(1);
  expect(rows.filter(row => row.entityType === 'RoleDefinition' && row.entityId === ids[0]).every(row => !row.isRead)).toBe(true);
});
