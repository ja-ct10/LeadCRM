import React, { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const fixture = vi.hoisted(() => ({
  options: vi.fn(), dealOptions: vi.fn(), onChange: vi.fn(),
  products: [{ id: 'p1', name: 'Setup', category: 'Services' }, { id: 'p2', name: 'Camera', category: 'Hardware' }],
  data: { users: [], contacts: [], deals: [], organizations: [] },
}));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/store/DataContext', () => ({ useData: () => fixture.data }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'agent' }, tenant: { id: 'tenant' } }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => true }));
vi.mock('@/shared/hooks/use-product-interests', () => ({ useProductInterests: () => ({ products: fixture.products }) }));
vi.mock('@/shared/services/tasks.api', () => ({ tasksApi: { options: fixture.options, dealOptions: fixture.dealOptions } }));
import { TaskSelector } from '../ui/task-selector';
const rows = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `deal-${i}`, label: `Deal ${i}` }));
function Form({ initial = [] }: { initial?: string[] }) {
  const [value, setValue] = useState(initial);
  return <TaskSelector kind="deal" label="Associated deals" multiple value={value} onChange={next => { fixture.onChange(next); setValue(next); }} />;
}
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  fixture.options.mockResolvedValue({ data: [{ id: 'account', label: 'Searchable Company' }] });
  fixture.dealOptions.mockImplementation(async ({ selectAll, page = 1 }) => ({ data: selectAll ? rows(50) : rows(50).slice((page - 1) * 25, page * 25), meta: { total: 50, hasMore: page === 1 } }));
});
it('selects all matching deals across pages and deduplicates overlapping selections', async () => {
  render(<Form initial={['deal-0']} />);
  fireEvent.click(screen.getByRole('button', { name: 'Associated deals' }));
  await screen.findByRole('checkbox', { name: 'Deal 24' });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('checkbox', { name: 'Deal 49' });
  fireEvent.click(screen.getByRole('button', { name: 'Select all matching deals' }));
  await waitFor(() => expect(fixture.onChange).toHaveBeenLastCalledWith(rows(50).map(row => row.id)));
  expect(screen.getByText('50 selected · 50 matching deals')).toBeTruthy();
  expect(screen.getAllByRole('checkbox')).toHaveLength(25);
  fireEvent.click(screen.getByText('Selected deals (50)'));
  fireEvent.click(screen.getByRole('button', { name: 'Remove Deal 49' }));
  expect(fixture.onChange).toHaveBeenLastCalledWith(rows(49).map(row => row.id));
});
it('combines account, category, product and search while preserving selections', async () => {
  render(<Form initial={['deal-0']} />);
  fireEvent.click(screen.getByRole('button', { name: 'Associated deals' }));
  await screen.findByRole('checkbox', { name: 'Deal 24' });
  fireEvent.click(screen.getByRole('button', { name: 'Account (Company)' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Search account' }), { target: { value: 'Searchable' } });
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Searchable Company' }));
  fireEvent.change(screen.getByLabelText('Filter deals by category'), { target: { value: 'Services' } });
  expect(screen.queryByRole('option', { name: 'Camera' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Filter deals by product'), { target: { value: 'p1' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Search deal' }), { target: { value: 'Renewal' } });
  await waitFor(() => expect(fixture.dealOptions).toHaveBeenLastCalledWith({ search: 'Renewal', accountId: 'account', category: 'Services', productInterestId: 'p1', page: 1 }, expect.any(AbortSignal)));
  expect(fixture.onChange).not.toHaveBeenCalled();
  expect(screen.getByText('1 selected · 50 matching deals')).toBeTruthy();
});
it('rejects a union over 50 without dropping the earlier selection', async () => {
  render(<Form initial={['other-deal']} />);
  fireEvent.click(screen.getByRole('button', { name: 'Associated deals' }));
  await screen.findByRole('checkbox', { name: 'Deal 24' });
  fireEvent.click(screen.getByRole('button', { name: 'Select all matching deals' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('More than 50'));
  expect(fixture.onChange).not.toHaveBeenCalled();
});
it('disables selection when no deals match', async () => {
  fixture.dealOptions.mockResolvedValue({ data: [], meta: { total: 0, hasMore: false } });
  render(<Form />);
  fireEvent.click(screen.getByRole('button', { name: 'Associated deals' }));
  await screen.findByText('No matching records.');
  expect(screen.getByRole('button', { name: 'Select all matching deals' })).toHaveProperty('disabled', true);
});
