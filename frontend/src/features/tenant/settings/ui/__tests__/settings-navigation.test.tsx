import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const state = vi.hoisted(() => ({ tab: 'profile', canView: true, restricted: [] as string[], replace: vi.fn(), redirect: vi.fn() }));
vi.mock('next/navigation', () => {
  const router = { replace: state.replace };
  return { useSearchParams: () => new URLSearchParams({ tab: state.tab }), useRouter: () => router, redirect: state.redirect };
});
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ tenant: { id: 'tenant' }, userCan: (module: string) => state.canView && !state.restricted.includes(module) }) }));
vi.mock('../organization-settings-form', () => ({ OrganizationSettingsForm: () => <p>Authoritative organization</p> }));
vi.mock('../profile-form', () => ({ ProfileForm: () => <p>Personal profile</p> }));
vi.mock('../security-settings', () => ({ SecuritySettings: () => <p>Personal security</p> }));
vi.mock('../products-page', () => ({ ProductsPage: () => <p>Products content</p> }));
vi.mock('../product-interests-settings', () => ({ ProductInterestsSettings: () => <p>Custom fields content</p> }));
vi.mock('../archived-data', () => ({ ArchivedData: () => <p>Archived content</p> }));
vi.mock('../team-management', () => ({ TeamManagement: () => <p>Team content</p> }));
vi.mock('../roles-permissions', () => ({ RolesPermissions: () => <p>Roles content</p> }));
vi.mock('../forms-tab', () => ({ FormsTab: () => <p>Forms content</p> }));
import SettingsPage from '../settings-page';
import LegacyAccountPage from '../../../../../../app/(tenant)/settings/account/page';
import { PATH_TO_PATHNAME, resolveModulePath } from '@/lib/route-map';
import { NAVIGATION_INTENT_EVENT, type NavigationIntentEvent } from '@/shared/lib/navigation-intent';

beforeEach(() => { vi.clearAllMocks(); state.tab = 'profile'; state.canView = true; state.restricted = []; localStorage.clear(); });
afterEach(cleanup);

it.each(['desktop', 'mobile'])('defers the %s Settings destination without changing the current section', async mode => {
  state.tab = 'forms'; render(<SettingsPage />); await screen.findByText('Forms content');
  let pending: (() => void | Promise<void>) | undefined;
  const guard = (event: Event) => { event.preventDefault(); pending = (event as NavigationIntentEvent).detail.navigate; };
  window.addEventListener(NAVIGATION_INTENT_EVENT, guard);
  try {
    const select = screen.getByLabelText('Settings section') as HTMLSelectElement;
    const navigate = () => mode === 'mobile' ? fireEvent.change(select, { target: { value: 'products' } }) : fireEvent.click(screen.getByRole('button', { name: 'Products' }));
    navigate(); expect(pending).toBeTypeOf('function');
    expect(select.value).toBe('forms'); expect(screen.getByText('Forms content')).toBeTruthy(); expect(screen.queryByText('Products content')).toBeNull();
    pending = undefined; // Keep editing cancels the stored action.
    expect(select.value).toBe('forms'); navigate();
    window.removeEventListener(NAVIGATION_INTENT_EVENT, guard);
    await act(async () => pending?.());
    expect(screen.getByText('Products content')).toBeTruthy(); expect(select.value).toBe('products');
  } finally { window.removeEventListener(NAVIGATION_INTENT_EVENT, guard); }
});

it.each(['roles', 'org-general'])('denies direct %s access and hides both restricted sections from desktop and mobile navigation', async tab => {
  state.tab = tab; state.restricted = ['roles', 'settings'];
  render(<SettingsPage />);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('Roles content')).toBeNull();
  expect(screen.queryByText('Authoritative organization')).toBeNull();
  const select = screen.getByLabelText('Settings section') as HTMLSelectElement;
  expect([...select.options].map(option => option.value)).not.toContain('roles');
  expect([...select.options].map(option => option.value)).not.toContain('org-general');
  expect(screen.queryByRole('button', { name: 'Roles & Permissions' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'General' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Profile Settings' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Appearance' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Team Management' })).toBeTruthy();
});
it.each([['roles', 'Roles content', 'roles'], ['org-general', 'Authoritative organization', 'settings']])('removes the active %s section after revocation without logout', async (tab, content, module) => {
  state.tab = tab; const view = render(<SettingsPage />);
  await screen.findByText(content);
  state.restricted = [module]; view.rerender(<SettingsPage />);
  expect(screen.queryByText(content)).toBeNull();
  expect(screen.getByRole('alert')).toBeTruthy();
});

it('keeps the required groups and sections with no Account category or Details item', () => {
  render(<SettingsPage />);
  const select = screen.getByLabelText('Settings section') as HTMLSelectElement;
  expect([...select.querySelectorAll('optgroup')].map(group => group.label)).toEqual(['GENERAL', 'ORGANIZATION', 'CUSTOMIZATION', 'CONNECT']);
  expect([...select.options].map(option => option.text)).toEqual(['Profile Settings', 'Appearance', 'General', 'Team Management', 'Roles & Permissions', 'Customize Fields', 'Products', 'Archived Data', 'Forms']);
  expect(screen.queryByText('Account Details')).toBeNull(); expect(screen.queryByText('ACCOUNT')).toBeNull();
  fireEvent.change(select, { target: { value: 'org-general' } });
  expect(screen.getByText('Authoritative organization')).toBeTruthy();
});

it.each([true, false])('normalizes the legacy tab and enforces General view access (%s)', async canView => {
  state.tab = 'account-details'; state.canView = canView;
  const breadcrumbs: unknown[] = [];
  const listener = (event: Event) => breadcrumbs.push((event as CustomEvent).detail);
  window.addEventListener('settings-tab-change', listener);
  try {
    render(<SettingsPage />);
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith('/settings?tab=org-general'));
    expect(Boolean(screen.queryByText('Authoritative organization'))).toBe(canView);
    if (!canView) expect(screen.getByRole('alert')).toBeTruthy();
    expect(breadcrumbs).not.toContainEqual({ group: 'Account', tab: 'Account Details' });
    if (canView) expect(breadcrumbs).toContainEqual({ group: 'Organization', tab: 'General' });
  } finally { window.removeEventListener('settings-tab-change', listener); }
});

it('redirects the old route and navigation alias to General without an Account breadcrumb', () => {
  LegacyAccountPage();
  expect(state.redirect).toHaveBeenCalledWith('/settings?tab=org-general');
  expect(PATH_TO_PATHNAME['account-details']).toBe('/settings?tab=org-general');
  expect(resolveModulePath('/settings/account')).toBe('settings');
});

it.each([
  ['profile', 'Personal profile'], ['appearance', 'System Appearance'], ['users', 'Team content'],
  ['roles', 'Roles content'], ['custom-fields', 'Custom fields content'], ['products', 'Products content'],
  ['archived', 'Archived content'], ['forms', 'Forms content'],
])('retains the existing %s section', async (tab, content) => {
  state.tab = tab; render(<SettingsPage />); expect(await screen.findByText(content)).toBeTruthy();
});
