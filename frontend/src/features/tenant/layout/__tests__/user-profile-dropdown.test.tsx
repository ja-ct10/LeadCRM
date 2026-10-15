import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UserProfileDropdown } from '../user-profile-dropdown';
import { NAVIGATION_INTENT_EVENT, type NavigationAction, type NavigationIntentEvent } from '@/shared/lib/navigation-intent';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), push: vi.fn(), logout: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({
  user: { firstName: 'Seeder', lastName: 'Admin', email: 'seeder@camxian.com', role: 'Client Admin' }, tenant: { name: 'Camxian Technologies' }, logout: mocks.logout,
}) }));
vi.mock('../use-layout', () => ({ useLayout: () => ({ navigate: mocks.navigate }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('sonner', () => ({ toast: mocks }));
vi.mock('motion/react', () => ({
  motion: { div: ({ initial, animate, exit, transition, ...props }: any) => <div {...props} /> }, AnimatePresence: ({ children }: any) => children,
}));

let triggerBottom: number;
let viewport: EventTarget & { width: number; height: number; offsetTop: number; offsetLeft: number };
const open = () => fireEvent.click(screen.getByRole('button', { name: 'User profile menu' }));
function App() { return <><header><UserProfileDropdown /></header><button>Outside</button></>; }
beforeEach(() => {
  vi.clearAllMocks(); triggerBottom = 94; mocks.logout.mockResolvedValue(undefined);
  vi.stubGlobal('innerWidth', 320); vi.stubGlobal('innerHeight', 642);
  viewport = Object.assign(new EventTarget(), { width: 320, height: 642, offsetTop: 0, offsetLeft: 0 });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ bottom: triggerBottom, right: viewport.width - 8 } as DOMRect));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.style.removeProperty('--pwa-banner-height'); });

it.each([320, 375, 390, 768, 1024, 1440])('bounds the portaled profile menu at %ipx without losing identity or actions', width => {
  vi.stubGlobal('innerWidth', width); viewport.width = width;
  render(<App />); open();
  const menu = screen.getByRole('menu'); const size = Number.parseFloat(menu.style.width); const left = Number.parseFloat(menu.style.left);
  expect(menu.closest('header')).toBeNull(); expect(menu.closest('[data-theme-portal]')).toBeTruthy();
  expect(size).toBe(width < 640 ? 280 : 310);
  expect(left).toBeGreaterThanOrEqual(width < 640 ? 16 : 8);
  expect(left + size).toBeLessThanOrEqual(width - (width < 640 ? 16 : 8));
  expect(Number.parseFloat(menu.style.maxHeight)).toBeCloseTo(width < 640 ? 449.4 : 532);
  expect(screen.getByText('Seeder Admin')).toBeTruthy(); expect(screen.getByText('seeder@camxian.com')).toBeTruthy();
  expect(screen.getByText('Camxian Technologies')).toBeTruthy(); expect(screen.getByText('Client Admin')).toBeTruthy();
  expect(screen.getAllByRole('menuitem').map(item => item.textContent?.trim())).toEqual(['My Account', 'Workspace Settings', 'Appearance', 'Help Center', 'Log out']);
});

it('repositions for a changed PWA banner and short visual viewport and cleans up on close', async () => {
  const rect = HTMLElement.prototype.getBoundingClientRect as ReturnType<typeof vi.fn>;
  render(<App />); open();
  triggerBottom = 150; act(() => document.documentElement.style.setProperty('--pwa-banner-height', '56px'));
  await waitFor(() => expect(screen.getByRole('menu').style.top).toBe('158px'));
  viewport.width = 260; viewport.height = 300; viewport.offsetTop = 20; viewport.offsetLeft = 10;
  act(() => viewport.dispatchEvent(new Event('resize')));
  const menu = screen.getByRole('menu');
  expect(menu.style.width).toBe('228px'); expect(menu.style.left).toBe('26px'); expect(menu.style.maxHeight).toBe('154px');
  triggerBottom = 130; act(() => viewport.dispatchEvent(new Event('scroll'))); expect(menu.style.top).toBe('138px');
  open(); rect.mockClear();
  act(() => { window.dispatchEvent(new Event('resize')); viewport.dispatchEvent(new Event('scroll')); document.documentElement.style.setProperty('--pwa-banner-height', '0px'); });
  await act(async () => {}); expect(rect).not.toHaveBeenCalled();
});

it('keeps portal clicks inside, closes outside and restores trigger focus on Escape', () => {
  render(<App />); open();
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'My Account' }));
  fireEvent.pointerDown(screen.getByText('Seeder Admin')); expect(screen.getByRole('menu')).toBeTruthy();
  fireEvent.keyDown(window, { key: 'Escape' }); expect(screen.queryByRole('menu')).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'User profile menu' }));
  open(); fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' })); expect(screen.queryByRole('menu')).toBeNull();
});

it('preserves account, workspace, appearance, help and logout actions', async () => {
  render(<App />);
  for (const label of ['My Account', 'Workspace Settings']) { open(); fireEvent.click(screen.getByRole('menuitem', { name: label })); expect(screen.queryByRole('menu')).toBeNull(); }
  expect(mocks.navigate.mock.calls).toEqual([['settings'], ['settings']]);
  open(); fireEvent.click(screen.getByRole('menuitem', { name: 'Appearance' })); expect(mocks.push).toHaveBeenCalledWith('/settings?tab=appearance');
  open(); const help = screen.getByRole('menuitem', { name: 'Help Center' }); expect(help.getAttribute('href')).toBe('/help');
  fireEvent.click(help); expect(screen.queryByRole('menu')).toBeNull();
  open(); fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
  await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Signed out successfully'));
  expect(mocks.logout).toHaveBeenCalledOnce(); expect(screen.queryByRole('menu')).toBeNull();
});

it.each(['My Account', 'Appearance', 'Log out'])('defers %s until the stored navigation action is confirmed', async label => {
  render(<App />); open(); let pending: NavigationAction | undefined;
  const guard = (event: Event) => { event.preventDefault(); pending = (event as NavigationIntentEvent).detail.navigate; };
  window.addEventListener(NAVIGATION_INTENT_EVENT, guard);
  try {
    fireEvent.click(screen.getByRole('menuitem', { name: label }));
    expect(mocks.navigate).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled(); expect(mocks.logout).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeTruthy(); pending = undefined;
    fireEvent.click(screen.getByRole('menuitem', { name: label }));
    // The originating dropdown can unmount while confirmation is displayed.
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' })); expect(screen.queryByRole('menu')).toBeNull();
    window.removeEventListener(NAVIGATION_INTENT_EVENT, guard); await act(async () => pending?.());
    if (label === 'My Account') expect(mocks.navigate).toHaveBeenCalledWith('settings');
    else if (label === 'Appearance') expect(mocks.push).toHaveBeenCalledWith('/settings?tab=appearance');
    else expect(mocks.logout).toHaveBeenCalledOnce();
  } finally { window.removeEventListener(NAVIGATION_INTENT_EVENT, guard); }
});
