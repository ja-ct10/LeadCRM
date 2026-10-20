import React, { useRef, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import NotificationsDropdown from './notifications-dropdown';
import { NAVIGATION_INTENT_EVENT, type NavigationAction, type NavigationIntentEvent } from '@/shared/lib/navigation-intent';

const mocks = vi.hoisted(() => ({
  markAsRead: vi.fn(), markAllAsRead: vi.fn(), destination: vi.fn(), push: vi.fn(), refresh: vi.fn(),
  mutating: false, assignment: false, record: false,
}));
vi.mock('../hooks/use-notifications', () => ({ useNotifications: () => ({
  notifications: Array.from({ length: 6 }, (_, index) => ({ id: String(index), title: `Workflow Failed ${index}`, type: 'workflow_failed', body: 'Follow-up encountered an execution failure.', isRead: index === 1, createdAt: '2026-10-13T10:00:00Z',
    ...(mocks.record && index === 0 ? { entityType: 'Deal', entityId: '23e0334f-f10b-4cf1-b67c-42984828890a' } : {}),
    ...(mocks.assignment && index === 0 ? { title: 'Assigned Agent changed to Next Agent', type: 'lead_assigned', body: 'Ownership transferred because Previous Agent was deactivated. The record is now assigned to Next Agent.' } : {}) })),
  unreadCount: 5, isLoading: false, hasError: false, isMutating: mocks.mutating, ...mocks,
}) }));
vi.mock('../notification-destination', async importOriginal => ({ ...await importOriginal<typeof import('../notification-destination')>(), resolveNotificationDestination: mocks.destination }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('motion/react', () => ({
  motion: { div: ({ initial, animate, exit, transition, ...props }: any) => <div {...props} /> },
  AnimatePresence: ({ children }: any) => children, useReducedMotion: () => true,
}));

let headerBottom: number;
let viewport: EventTarget & { width: number; height: number; offsetTop: number; offsetLeft: number };
function App() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null!);
  return <><header><button ref={trigger} onClick={() => setOpen(value => !value)}>Notifications trigger</button></header>
    <NotificationsDropdown isOpen={open} onClose={() => setOpen(false)} triggerRef={trigger} /><button>Outside</button></>;
}
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Notifications trigger' }));
beforeEach(() => {
  vi.clearAllMocks(); mocks.mutating = false; mocks.assignment = false; mocks.record = false; headerBottom = 104;
  mocks.markAsRead.mockResolvedValue(true); mocks.destination.mockResolvedValue('/workflows');
  vi.stubGlobal('innerWidth', 320); vi.stubGlobal('innerHeight', 642);
  viewport = Object.assign(new EventTarget(), { width: 320, height: 642, offsetTop: 0, offsetLeft: 0 });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return { bottom: this.tagName === 'HEADER' ? headerBottom : headerBottom - 10, right: viewport.width - 40 } as DOMRect;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.style.removeProperty('--pwa-banner-height'); });

it('renders the persisted new agent and reason in the topbar preview', () => {
  mocks.assignment = true; render(<App />); open();
  expect(screen.getByText('Assigned Agent changed to Next Agent')).toBeTruthy();
  expect(screen.getByText('Ownership transferred because Previous Agent was deactivated. The record is now assigned to Next Agent.')).toBeTruthy();
});

it.each([320, 375, 390, 768, 1024, 1440])('bounds the preview at %ipx and preserves its five-item limit', width => {
  vi.stubGlobal('innerWidth', width); viewport.width = width;
  render(<App />); open();
  const dialog = screen.getByRole('dialog', { name: 'Notifications' });
  const size = Number.parseFloat(dialog.style.width);
  const left = Number.parseFloat(dialog.style.left);
  expect(size).toBe(width < 640 ? Math.min(320, width - 32) : 448);
  expect(left).toBeGreaterThanOrEqual(width < 640 ? 16 : 8);
  expect(left + size).toBeLessThanOrEqual(width - (width < 640 ? 16 : 8));
  expect(Number.parseFloat(dialog.style.maxHeight)).toBeCloseTo(width < 640 ? 385.2 : 530);
  expect(screen.getAllByRole('button', { name: /Workflow Failed/ })).toHaveLength(5);
  expect(screen.getByRole('button', { name: 'View All Notifications' })).toBeTruthy();
});

it('tracks banner movement and visual viewport offsets and stops observing after closing', async () => {
  const rect = HTMLElement.prototype.getBoundingClientRect as ReturnType<typeof vi.fn>;
  render(<App />); open();
  headerBottom = 160;
  act(() => document.documentElement.style.setProperty('--pwa-banner-height', '56px'));
  await waitFor(() => expect(screen.getByRole('dialog').style.top).toBe('160px'));
  viewport.width = 280; viewport.height = 350; viewport.offsetLeft = 12; viewport.offsetTop = 20;
  act(() => viewport.dispatchEvent(new Event('resize')));
  const dialog = screen.getByRole('dialog');
  expect(dialog.style.width).toBe('248px'); expect(dialog.style.left).toBe('28px');
  expect(dialog.style.maxHeight).toBe('202px');
  headerBottom = 140; act(() => viewport.dispatchEvent(new Event('scroll')));
  expect(dialog.style.top).toBe('140px');
  open(); rect.mockClear();
  act(() => { window.dispatchEvent(new Event('resize')); viewport.dispatchEvent(new Event('scroll')); document.documentElement.style.setProperty('--pwa-banner-height', '0px'); });
  await act(async () => {});
  expect(rect).not.toHaveBeenCalled();
});

it('dismisses outside and with Escape, returns focus, and navigates through the footer', () => {
  render(<App />); open();
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Mark all notifications as read' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Notifications trigger' }));
  open(); fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  open(); fireEvent.click(screen.getByRole('button', { name: 'View All Notifications' }));
  expect(mocks.push).toHaveBeenCalledWith('/notifications'); expect(screen.queryByRole('dialog')).toBeNull();
});

it('preserves mark-all and unread navigation, and avoids navigation when marking read fails', async () => {
  render(<App />); open();
  fireEvent.click(screen.getByRole('button', { name: 'Mark all notifications as read' }));
  expect(mocks.markAllAsRead).toHaveBeenCalledOnce();
  mocks.markAsRead.mockResolvedValueOnce(false);
  fireEvent.click(screen.getByRole('button', { name: /Workflow Failed 0/ }));
  await act(async () => {}); expect(mocks.destination).not.toHaveBeenCalled(); expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Workflow Failed 0/ }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/workflows'));
  expect(mocks.markAsRead).toHaveBeenCalledWith('0'); expect(screen.queryByRole('dialog')).toBeNull();
  mocks.markAsRead.mockClear(); open();
  fireEvent.click(screen.getByRole('button', { name: /Workflow Failed 1/ }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(mocks.markAsRead).not.toHaveBeenCalled();
});

it('opens supported record notifications without marking read before the details load', async () => {
  mocks.record = true;
  mocks.destination.mockResolvedValueOnce(undefined);
  render(<App />); open();
  fireEvent.click(screen.getByRole('button', { name: /Workflow Failed 0/ }));
  await waitFor(() => expect(mocks.destination).toHaveBeenCalledWith('0'));
  expect(mocks.markAsRead).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
  mocks.destination.mockResolvedValueOnce('/crm/deals/23e0334f-f10b-4cf1-b67c-42984828890a');
  fireEvent.click(screen.getByRole('button', { name: /Workflow Failed 0/ }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledOnce());
  expect(mocks.markAsRead).not.toHaveBeenCalled();
});

it.each(['notification', 'footer'])('defers %s navigation and read-state actions until discard is confirmed', async target => {
  mocks.destination.mockResolvedValue('/automation/workflows?workflowId=workflow-7');
  render(<App />); open(); let pending: NavigationAction | undefined;
  const guard = (event: Event) => { event.preventDefault(); pending = (event as NavigationIntentEvent).detail.navigate; };
  window.addEventListener(NAVIGATION_INTENT_EVENT, guard);
  try {
    const click = () => fireEvent.click(screen.getByRole('button', { name: target === 'footer' ? 'View All Notifications' : /Workflow Failed 0/ }));
    click(); expect(mocks.markAsRead).not.toHaveBeenCalled(); expect(mocks.destination).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeTruthy(); pending = undefined; click();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    window.removeEventListener(NAVIGATION_INTENT_EVENT, guard); await act(async () => pending?.());
    expect(mocks.push).toHaveBeenCalledOnce(); expect(mocks.push).toHaveBeenCalledWith(target === 'footer' ? '/notifications' : '/automation/workflows?workflowId=workflow-7');
    if (target === 'notification') expect(mocks.markAsRead).toHaveBeenCalledWith('0');
    else expect(mocks.markAsRead).not.toHaveBeenCalled();
  } finally { window.removeEventListener(NAVIGATION_INTENT_EVENT, guard); }
});
