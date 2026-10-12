import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ColumnHeaderMenu } from '../column-header-menu';

beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup(overrides: Partial<React.ComponentProps<typeof ColumnHeaderMenu>> = {}) {
  const props = { columnId: 'name', columnLabel: 'Name', onSortAsc: vi.fn(), onSortDesc: vi.fn(), onSortReset: vi.fn(), onHideColumn: vi.fn(), ...overrides };
  render(<ColumnHeaderMenu {...props} />);
  const trigger = screen.getByRole('button', { name: 'Column options for Name' });
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
it('selects a hidden supported field and commits its direction using Enter', async () => {
  const { trigger, props } = setup({ sortFields: [{ id: 'name', label: 'Name' }, { id: 'createdAt', label: 'Created' }] });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Created' }));
  expect(props.onSortAsc).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole('menuitemradio', { name: 'Sort descending' }), { key: 'Enter' });
  expect(props.onSortDesc).toHaveBeenCalledWith('createdAt');
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  expect(document.activeElement).toBe(trigger);
});
it('announces the active sort, restores default sorting and ignores disabled hide', async () => {
  const { trigger, props } = setup({ isRequired: true, sort: { field: 'name', direction: 'asc' } });
  fireEvent.click(trigger);
  expect(screen.getByRole('menuitemradio', { name: 'Sort ascending' }).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('menuitem', { name: 'Hide Column' })); expect(props.onHideColumn).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Restore default sorting' }));
  expect(props.onSortReset).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
});
it.each(['Escape', 'Tab'])('closes with %s without activating an action', async key => {
  const { trigger, props } = setup(); fireEvent.click(trigger);
  await waitFor(() => expect(document.activeElement).toBe(items()[0]));
  fireEvent.keyDown(document.activeElement!, { key });
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  expect(props.onSortAsc).not.toHaveBeenCalled();
  if (key === 'Escape') expect(document.activeElement).toBe(trigger);
});
