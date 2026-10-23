import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NavigationMode } from '../use-responsive-navigation';

const route = vi.hoisted(() => ({ href: '/crm/deals', push: vi.fn(), permissions: ['*'] }));
vi.mock('next/navigation', () => ({
  usePathname: () => new URL(route.href, 'http://localhost').pathname,
  useRouter: () => ({ push: route.push }),
}));
vi.mock('@/shared/hooks/use-permissions', () => ({ usePermissions: () => route.permissions }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { firstName: 'Test', role: 'Sales' }, tenant: { name: 'Test' } }) }));
vi.mock('@/features/tenant/notifications/hooks/use-notifications', () => ({ useNotifications: () => ({ unreadByModule: { deals: 1 } }) }));

import SidebarNav from '../sidebar-nav';
import { useLayout } from '../use-layout';

function Navigation({ mode = 'desktop', collapsed = false, open = false }: { mode?: NavigationMode; collapsed?: boolean; open?: boolean }) {
  const { navigate } = useLayout();
  return <SidebarNav mode={mode} isCollapsed={collapsed} sidebarOpen={open} navigate={navigate}
    onCloseSidebar={() => {}} isAccountDropdownOpen={false} onToggleAccountDropdown={() => {}} onToggleCollapse={() => {}} />;
}

beforeEach(() => { route.href = '/crm/deals'; route.permissions = ['*']; route.push.mockReset(); });
afterEach(cleanup);

it.each([
  { mode: 'desktop' as const, collapsed: false, open: false },
  { mode: 'desktop' as const, collapsed: true, open: false },
  { mode: 'tablet' as const, collapsed: true, open: false },
  { mode: 'tablet' as const, collapsed: false, open: true },
  { mode: 'mobile' as const, collapsed: false, open: true },
])('highlights Deals across its routes in $mode, collapsed=$collapsed', props => {
  const view = render(<Navigation {...props} />);
  for (const href of ['/crm/deals', '/crm/deals?tab=my', '/crm/deals/record-id?tab=my', '/crm/pipeline?tab=my']) {
    route.href = href;
    view.rerender(<Navigation {...props} />);
    const deals = screen.getByRole('button', { name: 'Deals', current: 'page' });
    expect(deals.className).toContain('bg-[var(--sidebar-active-bg)]');
    expect(deals.className).toContain('text-[var(--sidebar-active-text)]');
    expect(Boolean(deals.querySelector('div.absolute.left-0'))).toBe(!props.collapsed);
    expect(screen.getByRole('status', { name: 'Unread Deals notifications' })).toBeTruthy();
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(route.push).not.toHaveBeenCalled();
    expect(route.href).toBe(href);
  }
});

it.each([
  ['/crm/accounts?tab=my', 'Accounts'], ['/crm/leads/record-id', 'Leads'],
  ['/crm/contacts', 'Contacts'], ['/dashboard', 'Dashboard'],
  ['/operations/taskboard', 'Tasks'], ['/marketing/campaigns', 'Campaigns'],
  ['/automation/workflows', 'Workflows'], ['/settings?tab=users', 'Settings'],
])('preserves the active item for %s', (href, name) => {
  route.href = href;
  render(<Navigation />);
  expect(screen.getByRole('button', { name, current: 'page' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Deals' }).hasAttribute('aria-current')).toBe(false);
});

it('navigates Deals to its canonical URL without changing permissions', () => {
  render(<Navigation />);
  fireEvent.click(screen.getByRole('button', { name: 'Deals' }));
  expect(route.push).toHaveBeenCalledExactlyOnceWith('/crm/deals');
  cleanup();
  route.permissions = ['accounts.view'];
  render(<Navigation />);
  expect(screen.queryByRole('button', { name: 'Deals' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Accounts' })).toBeTruthy();
});
