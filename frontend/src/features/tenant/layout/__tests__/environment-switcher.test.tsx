import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const state = vi.hoisted(() => ({ user: { role: 'User', activeEnvironment: 'SANDBOX' }, switchEnvironment: vi.fn(), isSwitchingEnvironment: false }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => state }));
vi.mock('next/navigation', () => ({ usePathname: () => '/crm/leads', useRouter: () => ({ replace: vi.fn() }) }));
import { EnvironmentSwitcher } from '../environment-switcher';
beforeEach(() => { vi.clearAllMocks(); state.user = { role: 'User', activeEnvironment: 'SANDBOX' }; state.isSwitchingEnvironment = false; });
afterEach(cleanup);
it.each(['Client Admin', 'User', 'Sales Agent'])('requires confirmation for %s', async role => {
  state.user.role = role;
  render(<EnvironmentSwitcher />);
  fireEvent.click(screen.getByRole('button', { name: 'Environment: Sandbox' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: /Live/ }));
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  expect(state.switchEnvironment).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Switch to Live' }));
  await waitFor(() => expect(state.switchEnvironment).toHaveBeenCalledWith('PRODUCTION'));
});
it('cancels without changing the environment', async () => {
  render(<EnvironmentSwitcher />);
  fireEvent.click(screen.getByRole('button', { name: 'Environment: Sandbox' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: /Live/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(state.switchEnvironment).not.toHaveBeenCalled();
});
it('confirms returning from Live to Sandbox', async () => {
  state.user.activeEnvironment = 'PRODUCTION';
  render(<EnvironmentSwitcher />);
  fireEvent.click(screen.getByRole('button', { name: 'Environment: Live' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: /Sandbox/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Switch to Sandbox' }));
  await waitFor(() => expect(state.switchEnvironment).toHaveBeenCalledWith('SANDBOX'));
});
it('does nothing for the active selection', async () => {
  render(<EnvironmentSwitcher />);
  fireEvent.click(screen.getByRole('button', { name: 'Environment: Sandbox' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: /Sandbox/ }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(state.switchEnvironment).not.toHaveBeenCalled();
});
it('renders no environment UI for System Admin', () => {
  state.user.role = 'System Admin';
  const { container } = render(<EnvironmentSwitcher />);
  expect(container.innerHTML).toBe('');
});
