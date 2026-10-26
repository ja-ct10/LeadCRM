import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearPageCache, invalidatePageCache } from '@/shared/cache/page-cache';
import { ExportCsvButton } from '../export-csv-button';

const mocks = vi.hoisted(() => ({ get: vi.fn(), download: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get: mocks.get, download: mocks.download } }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ tenant: { id: 'tenant' }, user: { id: 'actor', role: 'Sales' }, isLoading: false }) }));
vi.mock('sonner', () => ({ toast: { error: mocks.error } }));

beforeEach(() => {
  clearPageCache(); vi.clearAllMocks();
  URL.createObjectURL = vi.fn().mockReturnValue('blob:csv');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  mocks.download.mockResolvedValue(new Blob(['populated CSV']));
  mocks.get.mockResolvedValue({ data: [], meta: { total: 0 } });
});
afterEach(() => { cleanup(); clearPageCache(); vi.restoreAllMocks(); });

it.each(['leads', 'contacts', 'accounts', 'deals'] as const)('disables empty %s exports with an accessible explanation and no request', module => {
  render(<ExportCsvButton module={module} params={{}} hasData={false} />);
  const button = screen.getByRole('button', { name: 'Export CSV' });
  expect(button).toHaveProperty('disabled', true);
  expect(button.getAttribute('title')).toBe('No data available to export.');
  expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toBe('No data available to export.');
  fireEvent.click(button);
  expect(mocks.download).not.toHaveBeenCalled(); expect(mocks.get).not.toHaveBeenCalled();
});

it('updates availability without affecting neighboring table actions', () => {
  const create = vi.fn(), refresh = vi.fn();
  const view = (hasData: boolean, disabled = false) => <>
    <button onClick={create}>Create record</button><button onClick={refresh}>Refresh table</button>
    <ExportCsvButton module="leads" params={{ search: 'match' }} hasData={hasData} disabled={disabled} />
  </>;
  const rendered = render(view(false));
  fireEvent.click(screen.getByRole('button', { name: 'Create record' }));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh table' }));
  expect(create).toHaveBeenCalledOnce(); expect(refresh).toHaveBeenCalledOnce();
  rendered.rerender(view(true)); expect(screen.getByRole('button', { name: 'Export CSV' })).toHaveProperty('disabled', false);
  rendered.rerender(view(true, true)); expect(screen.getByRole('button', { name: 'Export CSV' })).toHaveProperty('disabled', true);
  rendered.rerender(view(false)); expect(screen.getByRole('button', { name: 'Export CSV' })).toHaveProperty('disabled', true);
});

it('retains populated CSV downloading and ignores duplicate clicks', async () => {
  let finish!: (blob: Blob) => void;
  mocks.download.mockReturnValue(new Promise<Blob>(resolve => { finish = resolve; }));
  const params = { search: 'match', 'filter[scope]': 'equals:my', sort: 'createdAt:desc' };
  render(<ExportCsvButton module="contacts" params={params} hasData />);
  const button = screen.getByRole('button', { name: 'Export CSV' });
  fireEvent.click(button); fireEvent.click(button);
  expect(button).toHaveProperty('disabled', true); expect(mocks.download).toHaveBeenCalledExactlyOnceWith('/crm/contacts/export', params);
  await act(async () => finish(new Blob(['CSV'])));
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  expect(vi.mocked(HTMLAnchorElement.prototype.click).mock.instances[0]).toMatchObject({ download: expect.stringMatching(/^contacts-\d{4}-\d{2}-\d{2}\.csv$/) });
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:csv'); expect(button).toHaveProperty('disabled', false);
});

it.each(['leads', 'contacts', 'accounts'] as const)('checks the full filtered %s scope independently of a highlighted record', async module => {
  let finish!: (result: unknown) => void;
  mocks.get.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const params = { search: 'No matching record', 'filter[scope]': 'equals:my' };
  const view = render(<ExportCsvButton module={module} params={params} />);
  const button = screen.getByRole('button', { name: 'Export CSV' });
  expect(button).toHaveProperty('disabled', true);
  expect(mocks.get).toHaveBeenCalledWith(`/crm/${module}`, { params: { ...params, page: 1, limit: 1 }, signal: expect.any(AbortSignal) });
  await act(async () => finish({ data: [], meta: { total: 0 } }));
  expect(button.getAttribute('title')).toBe('No data available to export.'); expect(button).toHaveProperty('disabled', true);
  mocks.get.mockResolvedValueOnce({ data: [], meta: { total: 220 } });
  view.rerender(<ExportCsvButton module={module} params={{ ...params, search: '' }} />);
  expect(button).toHaveProperty('disabled', true);
  await waitFor(() => expect(button).toHaveProperty('disabled', false));
  fireEvent.click(button);
  await waitFor(() => expect(mocks.download).toHaveBeenCalledWith(`/crm/${module}/export`, { ...params, search: '' }));
});

it('disables during refresh and errors despite cached matches, then recovers on invalidation', async () => {
  mocks.get.mockResolvedValueOnce({ meta: { total: 3 } });
  render(<ExportCsvButton module="accounts" params={{}} />);
  const button = screen.getByRole('button', { name: 'Export CSV' });
  await waitFor(() => expect(button).toHaveProperty('disabled', false));
  let reject!: (error: Error) => void;
  mocks.get.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
  act(() => invalidatePageCache('accounts', 'tenant'));
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
  expect(button).toHaveProperty('disabled', true);
  await act(async () => reject(new Error('Unavailable')));
  expect(button).toHaveProperty('disabled', true); fireEvent.click(button); expect(mocks.download).not.toHaveBeenCalled();
  mocks.get.mockResolvedValueOnce({ meta: { total: 1 } });
  act(() => invalidatePageCache('accounts', 'tenant'));
  await waitFor(() => expect(button).toHaveProperty('disabled', false));
  mocks.get.mockResolvedValueOnce({ meta: { total: 0 } });
  act(() => invalidatePageCache('accounts', 'tenant'));
  await waitFor(() => expect(button.getAttribute('title')).toBe('No data available to export.'));
});

it('does not let an obsolete search response enable the current export', async () => {
  let finish!: (result: unknown) => void;
  mocks.get.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const view = render(<ExportCsvButton module="leads" params={{ search: 'old' }} />);
  view.rerender(<ExportCsvButton module="leads" params={{ search: 'new' }} />);
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
  await act(async () => finish({ meta: { total: 10 } }));
  expect(screen.getByRole('button', { name: 'Export CSV' })).toHaveProperty('disabled', true);
});

it('shows a server empty-result race without downloading and refreshes the module cache', async () => {
  mocks.get.mockResolvedValueOnce({ meta: { total: 1 } });
  mocks.download.mockRejectedValueOnce(Object.assign(new Error('No data available to export.'), { status: 404 }));
  render(<ExportCsvButton module="leads" params={{}} />);
  const button = screen.getByRole('button', { name: 'Export CSV' });
  await waitFor(() => expect(button).toHaveProperty('disabled', false));
  fireEvent.click(button);
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(button.getAttribute('title')).toBe('No data available to export.'));
  expect(mocks.error).toHaveBeenCalledWith('No data available to export.');
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled(); expect(URL.createObjectURL).not.toHaveBeenCalled();
});
