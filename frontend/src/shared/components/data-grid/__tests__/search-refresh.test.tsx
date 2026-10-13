import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DataGrid } from '../data-grid';
import type { DataGridColumnDef } from '../types';
import { ActionableEmptyState } from '@/shared/components/actionable-empty-state';
import { TableRefreshContext } from '@/shared/components/crm/data-view-states';
import { Inbox } from 'lucide-react';

type Row = { id: string; name: string };
const rows = [{ id: 'a', name: 'Same name' }, { id: 'b', name: 'Same name' }];
const columns: DataGridColumnDef<Row>[] = [
  { id: 'left-a', header: 'Left A', accessor: row => row.name, pinned: 'left', width: 160 },
  { id: 'left-b', header: 'Left B', accessor: row => row.id, pinned: 'left', width: 180 },
  { id: 'middle', header: 'Middle', accessor: row => row.id, width: 200 },
  { id: 'right-a', header: 'Right A', accessor: row => row.id, pinned: 'right', width: 140 },
  { id: 'right-b', header: 'Right B', accessor: row => row.id, pinned: 'right', width: 150 },
];
const scroll = vi.fn();
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  HTMLElement.prototype.scrollIntoView = scroll;
  scroll.mockClear();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('locates by stable ID, keeps selection independent, and switches targets without opening details', () => {
  const open = vi.fn();
  const props = { columns, data: rows, getRowId: (row: Row) => row.id, selectable: true, rowActions: () => [], onRowClick: open };
  const { rerender } = render(<DataGrid {...props} highlightRowId="b" selectedIds={new Set(['a'])} />);
  const target = document.querySelector('[data-row-id="b"]')!;
  expect(target.getAttribute('data-search-highlight')).toBe('true');
  expect(target.getAttribute('aria-selected')).toBe('false');
  expect(within(target as HTMLElement).getAllByRole('cell')).toHaveLength(7);
  expect(document.querySelector('[data-row-id="a"]')?.getAttribute('aria-selected')).toBe('true');
  expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  expect(open).not.toHaveBeenCalled();
  rerender(<DataGrid {...props} highlightRowId="a" />);
  expect(target.hasAttribute('data-search-highlight')).toBe(false);
  expect(document.querySelector('[data-row-id="a"]')?.getAttribute('data-search-highlight')).toBe('true');
  fireEvent.click(document.querySelector('[data-row-id="a"] td:nth-child(3)')!);
  expect(open).toHaveBeenCalledWith(rows[0]);
});
it('aligns multiple left and right offsets, including actions, selection and resized columns', () => {
  const { rerender } = render(<DataGrid columns={columns} data={rows} getRowId={row => row.id} selectable rowActions={() => []} />);
  expect(screen.getByRole('columnheader', { name: 'Left A' }).style.left).toBe('84px');
  expect(screen.getByRole('columnheader', { name: 'Left B' }).style.left).toBe('244px');
  expect(screen.getByRole('columnheader', { name: 'Right A' }).style.right).toBe('150px');
  expect(screen.getByRole('columnheader', { name: 'Right B' }).style.right).toBe('0px');
  rerender(<DataGrid columns={columns} data={rows} getRowId={row => row.id} columnWidths={{ 'right-b': 230 }} />);
  expect(screen.getByRole('columnheader', { name: 'Right A' }).style.right).toBe('230px');
  expect((document.querySelector('[data-row-id="a"] td:nth-last-child(2)') as HTMLElement).style.right).toBe('230px');
});
it('retains mounted rows while the shared spinner marks a busy table, then clears it', () => {
  const props = { columns, data: rows, getRowId: (row: Row) => row.id };
  const { rerender } = render(<DataGrid {...props} />);
  const row = document.querySelector('[data-row-id="a"]');
  rerender(<DataGrid {...props} isRefreshing />);
  expect(screen.getByRole('region').getAttribute('aria-busy')).toBe('true');
  expect(within(screen.getByRole('region')).getByRole('status', { name: 'Refreshing data...' })).toBeTruthy();
  expect(document.querySelector('[data-row-id="a"]')).toBe(row);
  rerender(<DataGrid {...props} />);
  expect(screen.queryByRole('status', { name: 'Refreshing data...' })).toBeNull();
  expect(screen.getByRole('region').getAttribute('aria-busy')).toBe('false');
});
it('reveals a target that arrives later and respects reduced motion', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
  const { rerender } = render(<DataGrid columns={columns} data={[]} getRowId={row => row.id} highlightRowId="b" />);
  expect(scroll).not.toHaveBeenCalled();
  rerender(<DataGrid columns={columns} data={rows} getRowId={row => row.id} highlightRowId="b" />);
  expect(scroll).toHaveBeenCalledWith({ behavior: 'instant', block: 'center', inline: 'nearest' });
});

it('shows the existing spinner instead of an empty result while retaining the empty grid dimensions', () => {
  const { rerender } = render(<DataGrid columns={columns} data={[]} getRowId={row => row.id} />);
  expect(screen.getByText('No records found.')).toBeTruthy();
  const emptyCell = screen.getByText('No records found.').closest('td');
  rerender(<DataGrid columns={columns} data={[]} getRowId={row => row.id} isRefreshing />);
  expect(screen.getByRole('status', { name: 'Refreshing data...' })).toBeTruthy();
  expect(screen.getByText('No records found.').closest('td')).toBe(emptyCell);
  expect(emptyCell?.getAttribute('aria-hidden')).toBe('true');
});

it('refreshes a module empty state without announcing it as empty or removing its contents', () => {
  const state = <ActionableEmptyState icon={Inbox} title="No contacts yet" description="Create a contact" />;
  const { rerender } = render(<TableRefreshContext.Provider value={false}>{state}</TableRefreshContext.Provider>);
  const heading = screen.getByRole('heading', { name: 'No contacts yet' });
  rerender(<TableRefreshContext.Provider value>{state}</TableRefreshContext.Provider>);
  expect(screen.getByRole('status', { name: 'Refreshing data...' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'No contacts yet' })).toBeNull();
  expect(screen.getByText('No contacts yet')).toBe(heading);
  rerender(<TableRefreshContext.Provider value={false}>{state}</TableRefreshContext.Provider>);
  expect(screen.getByRole('heading', { name: 'No contacts yet' })).toBe(heading);
  expect(screen.queryByRole('status')).toBeNull();
});
