import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ModuleTableToolbar } from '../module-table-toolbar';
import { FilterButton } from '../filter-button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';

afterEach(cleanup);

it.each([false, true])('places an optional action immediately before Refresh (stacked search: %s)', stacked => {
  render(<ModuleTableToolbar stackSearchOnMobile={stacked} label="Records" search="" onSearch={vi.fn()} placeholder="Search records..." onRefresh={vi.fn()}
    beforeRefresh={<button type="button">Remove from list</button>} />);
  const remove = screen.getByRole('button', { name: 'Remove from list' });
  const refresh = screen.getByRole('button', { name: 'Refresh' });
  expect(remove.nextElementSibling).toBe(refresh);
  expect(remove.parentElement).toBe(refresh.parentElement);
  expect(refresh.parentElement?.className).toContain('ml-auto');
  expect(screen.getAllByRole('textbox')).toHaveLength(1);
  if (stacked) expect(screen.getByRole('group', { name: 'Records actions' }).contains(remove)).toBe(true);
});

it('forwards the existing Filter button ref, dropdown keyboard attributes, and disabled state', async () => {
  const ref = React.createRef<HTMLButtonElement>();
  const select = vi.fn();
  const view = render(<DropdownMenu><DropdownMenuTrigger asChild><FilterButton ref={ref} title="modules" /></DropdownMenuTrigger>
    <DropdownMenuContent><DropdownMenuItem onSelect={select}>All Modules</DropdownMenuItem></DropdownMenuContent></DropdownMenu>);
  const trigger = screen.getByRole('button', { name: 'Filter modules' });
  expect(ref.current).toBe(trigger);
  expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
  trigger.focus(); fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  const item = await screen.findByRole('menuitem', { name: 'All Modules' });
  await waitFor(() => expect(document.activeElement).toBe(item));
  fireEvent.keyDown(item, { key: 'Enter' });
  expect(select).toHaveBeenCalledOnce(); expect(document.activeElement).toBe(trigger);
  view.unmount();
  render(<FilterButton title="modules" disabled onClick={select} />);
  fireEvent.click(screen.getByRole('button', { name: 'Filter modules' }));
  expect(select).toHaveBeenCalledOnce();
});

it('keeps search and the existing refresh action together while secondary controls remain available', async () => {
  const search = vi.fn(), refresh = vi.fn(), filter = vi.fn(), columns = vi.fn();
  render(<ModuleTableToolbar label="Records" search="" onSearch={search} placeholder="Search records..." onRefresh={refresh}
    filter={<FilterButton title="Records" open={false} onClick={filter} />} onManageColumns={columns} />);
  const primary = screen.getByRole('group', { name: 'Records search and refresh' });
  expect(primary.className).toContain('flex-nowrap');
  const input = within(primary).getByRole('textbox', { name: 'Search records' });
  expect(input.parentElement?.parentElement?.className).toContain('min-w-0');
  expect(input.parentElement?.parentElement?.className).toContain('flex-1');
  fireEvent.change(input, { target: { value: 'CCTV' } });
  expect(search).toHaveBeenCalledExactlyOnceWith('CCTV');
  const button = within(primary).getByRole('button', { name: 'Refresh' });
  expect(button.parentElement?.className).toContain('shrink-0');
  expect(button.className).toContain('min-w-11');
  expect(button.className).toContain('min-h-11');
  fireEvent.click(button);
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', { name: 'Filter Records' }));
  expect(filter).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Table settings' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Manage Columns' }));
  expect(columns).toHaveBeenCalledOnce();
});

it('retains disabled and refreshing states without removing either primary control', () => {
  const search = vi.fn(), refresh = vi.fn();
  const view = render(<ModuleTableToolbar label="Records" search="saved" onSearch={search} placeholder="Search records..." onRefresh={refresh} disabled />);
  const input = screen.getByRole('textbox', { name: 'Search records' });
  const button = screen.getByRole('button', { name: 'Refresh' });
  expect(input).toHaveProperty('disabled', true);
  expect(button).toHaveProperty('disabled', true);
  fireEvent.click(button);
  expect(refresh).not.toHaveBeenCalled();
  view.rerender(<ModuleTableToolbar label="Records" search="saved" onSearch={search} placeholder="Search records..." onRefresh={refresh} refreshing />);
  expect(input).toHaveProperty('disabled', false);
  expect(input).toHaveProperty('value', 'saved');
  expect(button).toHaveProperty('disabled', true);
  expect(button.getAttribute('aria-busy')).toBe('true');
  expect(screen.getByRole('group', { name: 'Records search and refresh' }).contains(button)).toBe(true);
});

it('preserves single controls, callbacks and the refresh guard with stacked mobile search', async () => {
  const search = vi.fn(), filter = vi.fn(), columns = vi.fn();
  let finishRefresh: (() => void) | undefined;
  const refresh = vi.fn(() => new Promise<void>(resolve => { finishRefresh = resolve; }));
  const view = render(<ModuleTableToolbar stackSearchOnMobile label="Records" search="saved" onSearch={search} placeholder="Search records..." onRefresh={refresh}
    filter={<FilterButton title="Records" open={false} onClick={filter} />} onManageColumns={columns} />);
  expect(screen.getAllByRole('textbox', { name: 'Search records' })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'Refresh' })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'Table settings' })).toHaveLength(1);
  fireEvent.change(screen.getByRole('textbox', { name: 'Search records' }), { target: { value: 'CCTV' } });
  expect(search).toHaveBeenCalledExactlyOnceWith('CCTV');
  const actions = screen.getByRole('group', { name: 'Records actions' });
  fireEvent.click(within(actions).getByRole('button', { name: 'Filter Records' }));
  expect(filter).toHaveBeenCalledOnce();
  fireEvent.click(within(actions).getByRole('button', { name: 'Table settings' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Manage Columns' }));
  expect(columns).toHaveBeenCalledOnce();
  const button = within(actions).getByRole('button', { name: 'Refresh' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(refresh).toHaveBeenCalledOnce();
  expect(button).toHaveProperty('disabled', true);
  expect(button.getAttribute('aria-busy')).toBe('true');
  await act(async () => { finishRefresh?.(); });
  expect(button).toHaveProperty('disabled', false);

  view.rerender(<ModuleTableToolbar stackSearchOnMobile label="Records" search="saved" onSearch={search} placeholder="Search records..." onRefresh={refresh} disabled />);
  expect(screen.getByRole('textbox', { name: 'Search records' })).toHaveProperty('disabled', true);
  expect(screen.getByRole('button', { name: 'Refresh' })).toHaveProperty('disabled', true);
});
