import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ColumnHeaderMenu } from '../column-header-menu';

beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup(overrides: Partial<React.ComponentProps<typeof ColumnHeaderMenu>> = {}) {
  const props = { columnId: 'name', columnLabel: 'Name', onSortAsc: vi.fn(), onSortDesc: vi.fn(), onSortReset: vi.fn(), onHideColumn: vi.fn(), ...overrides };
  render(<ColumnHeaderMenu {...props} />);
  const trigger = screen.getByRole('button', { name: `Column options for ${props.columnLabel}` });
  trigger.focus();
  return { props, trigger };
}
const items = () => Array.from(screen.getByRole('menu').querySelectorAll<HTMLElement>('[role^="menuitem"][aria-disabled="false"]'));

it.each(['Enter', ' ', 'ArrowDown'])('opens with %s, labels the menu and focuses its first enabled action', async key => {
  const { trigger } = setup(); fireEvent.keyDown(trigger, { key });
  expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('menu', { name: 'Options for Name' })).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(items()[0]));
  expect(items().filter(item => item.tabIndex === 0)).toHaveLength(1);
});
it('navigates, wraps, supports Home/End and skips a required hide action', async () => {
  const { trigger } = setup({ isRequired: true }); fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  await waitFor(() => expect(document.activeElement).toBe(items()[0]));
  const first = items()[0], second = items()[1], last = items().at(-1)!;
  fireEvent.keyDown(first, { key: 'ArrowDown' }); expect(document.activeElement).toBe(second);
  fireEvent.keyDown(second, { key: 'End' }); expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last, { key: 'ArrowDown' }); expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: 'ArrowUp' }); expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last, { key: 'Home' }); expect(document.activeElement).toBe(first);
  const hide = screen.getByRole('menuitem', { name: 'Hide Column' });
  expect(hide.getAttribute('aria-disabled')).toBe('true');
  expect(hide.tabIndex).toBe(-1);
});
it('sorts only the clicked column while another column is active', async () => {
  const { trigger, props } = setup({ columnId: 'firstName', columnLabel: 'First Name', sort: { field: 'companyName', direction: 'asc' },
    sortFields: [{ id: 'firstName', label: 'First Name' }, { id: 'companyName', label: 'Company Name' }] });
  fireEvent.click(trigger);
  expect(screen.queryByText(/Current:/)).toBeNull(); expect(screen.queryByText('Sort field')).toBeNull();
  expect(screen.queryByText('Company Name')).toBeNull();
  expect(screen.getByRole('menuitemradio', { name: 'Sort A–Z' }).getAttribute('aria-checked')).toBe('false');
  expect(screen.queryByRole('menuitem', { name: 'Restore default sorting' })).toBeNull();
  fireEvent.keyDown(screen.getByRole('menuitemradio', { name: 'Sort Z–A' }), { key: 'Enter' });
  expect(props.onSortDesc).toHaveBeenCalledWith('firstName');
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  expect(document.activeElement).toBe(trigger);
});
it('announces the active sort, restores default sorting and ignores disabled hide', async () => {
  const { trigger, props } = setup({ isRequired: true, sort: { field: 'name', direction: 'asc' } });
  fireEvent.click(trigger);
  expect(screen.getByRole('menuitemradio', { name: 'Sort A–Z' }).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('menuitem', { name: 'Hide Column' })); expect(props.onHideColumn).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Restore default sorting' }));
  expect(props.onSortReset).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
});
it.each([
  ['date', 'Oldest first', 'Newest first'], ['size', 'Smallest first', 'Largest first'],
  ['phone', 'Sort ascending', 'Sort descending'], ['number', 'Lowest first', 'Highest first'],
] as const)('uses %s direction labels without offering another field', (kind, asc, desc) => {
  const { trigger, props } = setup({ sortFields: [{ id: 'name', label: 'Name', kind }] });
  fireEvent.click(trigger); expect(screen.getAllByRole('menuitemradio')).toHaveLength(2);
  expect(screen.getByRole('menuitemradio', { name: asc })).toBeTruthy();
  fireEvent.click(screen.getByRole('menuitemradio', { name: desc })); expect(props.onSortDesc).toHaveBeenCalledWith('name');
});
it('does not borrow another field for a non-sortable column', () => {
  const { trigger, props } = setup({ isSortable: false, sortFields: [{ id: 'createdAt', label: 'Created', kind: 'date' }] });
  fireEvent.click(trigger); expect(screen.queryByRole('menuitemradio')).toBeNull();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Hide Column' }));
  expect(props.onHideColumn).toHaveBeenCalledWith('name'); expect(props.onSortAsc).not.toHaveBeenCalled();
});
it('omits a menu with no usable actions', () => {
  render(<ColumnHeaderMenu columnId="id" columnLabel="ID" isRequired isSortable={false} onSortAsc={vi.fn()} onSortDesc={vi.fn()} onHideColumn={vi.fn()} />);
  expect(screen.queryByRole('button')).toBeNull();
});
it.each(['Escape', 'Tab'])('closes with %s without activating an action', async key => {
  const { trigger, props } = setup(); fireEvent.click(trigger);
  await waitFor(() => expect(document.activeElement).toBe(items()[0]));
  fireEvent.keyDown(document.activeElement!, { key });
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  expect(props.onSortAsc).not.toHaveBeenCalled();
  if (key === 'Escape') expect(document.activeElement).toBe(trigger);
});
