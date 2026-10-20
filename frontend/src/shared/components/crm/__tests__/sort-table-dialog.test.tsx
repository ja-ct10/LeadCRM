import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TableSettingsMenu } from '../table-settings-menu';
import { getTableSortFields } from '@/shared/constants/column-registries';

beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup(sort = { field: 'companyName', direction: 'asc' as 'asc' | 'desc' }) {
  const changed = vi.fn();
  render(<TableSettingsMenu sortFields={getTableSortFields('leads')} sort={sort} onSortChange={changed} onManageColumns={vi.fn()} />);
  const trigger = screen.getByRole('button', { name: 'Table settings' });
  const open = () => { trigger.focus(); fireEvent.click(trigger); fireEvent.click(screen.getByRole('menuitem', { name: 'Sort Table…' })); };
  return { changed, trigger, open };
}
it('has an isolated draft, displays the actual sort and cancels without changing it', async () => {
  const { open, changed, trigger } = setup(); open();
  expect(screen.getByRole('dialog', { name: 'Sort Table' })).toBeTruthy();
  expect(screen.getByText('Current: Company Name — Sort A–Z')).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort field' }), { target: { value: 'createdAt' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Direction' }), { target: { value: 'desc' } });
  expect(changed).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(changed).not.toHaveBeenCalled(); expect(document.activeElement).toBe(trigger);
  open(); expect((screen.getByRole('combobox', { name: 'Sort field' }) as HTMLSelectElement).value).toBe('companyName');
});
it('offers every existing supported field, including hidden fields, and applies once', () => {
  const { open, changed } = setup(); open();
  expect(Array.from(screen.getByRole('combobox', { name: 'Sort field' }).querySelectorAll('option'), option => option.value)).toEqual([
    'name', 'firstName', 'lastName', 'email', 'phone', 'companyName', 'status', 'source', 'createdAt', 'updatedAt', 'lastSalesActivityAt',
  ]);
  expect((screen.getByRole('option', { name: 'Most Recent Activity' }) as HTMLOptionElement).value).toBe('lastSalesActivityAt');
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort field' }), { target: { value: 'lastSalesActivityAt' } });
  expect(screen.getByRole('option', { name: 'Oldest first' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(changed).toHaveBeenCalledExactlyOnceWith({ field: 'lastSalesActivityAt', direction: 'asc' });
});
it('restores the module default through the existing null preference', () => {
  const { open, changed } = setup(); open(); fireEvent.click(screen.getByRole('button', { name: 'Restore default sorting' }));
  expect(changed).toHaveBeenCalledExactlyOnceWith(null);
});
it('prevents unchanged applies and unnecessary default resets', () => {
  const { open, changed } = setup({ field: 'createdAt', direction: 'desc' }); open();
  expect((screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'Restore default sorting' }) as HTMLButtonElement).disabled).toBe(true);
  expect(changed).not.toHaveBeenCalled();
});
it('closes with Escape and restores settings focus without applying', async () => {
  const { open, trigger, changed } = setup(); open();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(document.activeElement).toBe(trigger);
  expect(changed).not.toHaveBeenCalled();
});
