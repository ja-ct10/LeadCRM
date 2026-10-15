import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { mapImportCsv, type CrmImportModule, type ImportReviewRow } from '@leadcrm/shared';
import { getImportConfig } from '../configs';
import type { ImportSummary } from '../types/import.types';
import { finalImportNotice, summarizeReview } from '../utils/import-outcome';
import { clearPageCache, getPageCache, setPageCache } from '@/shared/cache/page-cache';

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn(), push: vi.fn(), refresh: vi.fn(),
  success: vi.fn(), warning: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: { post: mocks.post, get: mocks.get } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => true }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ refreshDeals: mocks.refresh, refreshContacts: mocks.refresh, refreshOrganizations: mocks.refresh }) }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, warning: mocks.warning, error: mocks.error } }));
import ImportPage from './import-page';
import ImportDetailsPage from './import-details-page';

const scenarios = [
  [10, 0, 0, 'success', 'Import Succeeded'], [7, 3, 0, 'warning', 'Import Partially Succeeded'],
  [8, 0, 2, 'warning', 'Import Partially Succeeded'], [6, 2, 2, 'warning', 'Import Partially Succeeded'],
  [0, 10, 0, 'error', 'No Records Imported'], [0, 0, 10, 'error', 'Import Failed'],
  [0, 6, 4, 'error', 'No Records Imported'],
] as const;
const job = (module: CrmImportModule, valid = 6, duplicate = 2, invalid = 2): ImportSummary => ({
  id: 'job', module: ({ leads: 'LEAD', contacts: 'CONTACT', accounts: 'ACCOUNT' } as const)[module],
  fileName: 'test.csv', status: valid === 10 ? 'completed' : valid ? 'completed_with_errors' : 'failed',
  totalRecords: 10, successfulRecords: valid, duplicateRecords: duplicate, failedRecords: invalid,
  createdAt: '2026-10-11T00:00:00Z', completedAt: '2026-10-11T00:01:00Z',
});
function source(module: CrmImportModule, length = 10) {
  const fields = [...getImportConfig(module).requiredFields, ...getImportConfig(module).optionalFields];
  const headers = fields.map(f => f.label);
  const values: Record<string, string> = { firstName: 'Test', lastName: 'Person', email: 'test@example.com', phone: '9123456789',
    companyName: 'Company', address: 'Manila', name: 'Company', productInterest: 'Biometrics' };
  const csvText = [headers.join(','), ...Array.from({ length }, () => fields.map(f => values[f.key] ?? '').join(','))].join('\n');
  return { fileName: 'test.csv', csvText, mappings: Object.fromEntries(fields.map((f, i) => [f.key, i])), idempotencyKey: crypto.randomUUID() };
}
async function review(module: CrmImportModule, valid: number, duplicate: number, invalid: number) {
  const input = source(module, valid + duplicate + invalid);
  const rows: ImportReviewRow[] = mapImportCsv(module, input).map((r, i) => ({ ...r, isValid: i < valid,
    status: i < valid ? 'valid' : i < valid + duplicate ? 'duplicate' : 'invalid',
    errors: i < valid ? [] : ['Specific row explanation'],
  }));
  mocks.post.mockImplementation(async (path: string) => path.includes('/preview') ? { data: rows } : { data: job(module, valid, duplicate, invalid) });
  const view = render(<ImportPage moduleKey={module} />);
  fireEvent.change(view.container.querySelector('input[type=file]')!, { target: { files: [new File([input.csvText], 'test.csv', { type: 'text/csv' })] } });
  await screen.findByRole('heading', { name: 'Map your columns' });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByRole('heading', { name: 'Review & validate' });
  return { view, rows, input };
}
beforeEach(() => { vi.resetAllMocks(); window.history.replaceState(null, '', '/crm/leads/import'); mocks.refresh.mockResolvedValue(undefined); });
afterEach(cleanup);

it('downloads the Accounts template with exactly five supported headers', async () => {
  const create = vi.fn((_blob: Blob) => 'blob:accounts-template');
  const revoke = vi.fn();
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = create; URL.revokeObjectURL = revoke;
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  try {
    render(<ImportPage moduleKey="accounts" />);
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV template' }));
    expect(click.mock.instances[0]).toMatchObject({ download: 'account-import-template.csv' });
    const reader = new FileReader();
    const content = await new Promise(resolve => { reader.onload = () => resolve(reader.result); reader.readAsText(create.mock.calls[0][0]); });
    expect(content).toBe('Company Name,Industry,Website,Full Address,Company Size\n');
    expect(revoke).toHaveBeenCalledWith('blob:accounts-template');
  } finally { URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; click.mockRestore(); }
});

it('shows a consolidated legacy Account address without retired mapping destinations', async () => {
  const csvText = 'Company Name,Full Address,City,Province / State,Country\nLegacy Company,10 Street,Toronto,Ontario,Canada';
  mocks.post.mockResolvedValue({ data: [] });
  const view = render(<ImportPage moduleKey="accounts" />);
  fireEvent.change(view.container.querySelector('input[type=file]')!, { target: { files: [new File([csvText], 'old-template.csv')] } });
  await screen.findByRole('heading', { name: 'Map your columns' });
  expect(screen.getAllByRole('combobox')).toHaveLength(5);
  for (const label of ['City', 'Province / State', 'Country']) expect(screen.queryByRole('combobox', { name: `Map CSV column for ${label}` })).toBeNull();
  expect(screen.getByText('10 Street, Toronto, Ontario, Canada')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalled());
  const request = mocks.post.mock.calls[0][1];
  expect(request.csvText).toBe(csvText);
  expect(request.mappings).toEqual({ name: 0, address: 1 });
});

it('invalidates Contact and automatic Deal caches after a completed Contact import', async () => {
  clearPageCache();
  const affected = ['contacts', 'counts-contacts', 'deals', 'counts-deals', 'pipeline', 'activities', 'dashboard', 'reports'];
  affected.forEach(module => setPageCache(module, 'tenant', {}, ['stale']));
  await review('contacts', 10, 0, 0);
  fireEvent.click(screen.getByRole('button', { name: /^Import 10 / }));
  await waitFor(() => expect(mocks.success).toHaveBeenCalled());
  affected.forEach(module => expect(getPageCache(module, 'tenant', {})).toBeNull());
  expect(mocks.refresh).toHaveBeenCalledTimes(2);
  clearPageCache();
});

describe.each<CrmImportModule>(['leads', 'contacts', 'accounts'])('%s import UI', module => {
  it.each(scenarios)('handles %i valid / %i duplicate / %i invalid', async (valid, duplicate, invalid, type, title) => {
    await review(module, valid, duplicate, invalid);
    const button = screen.getByRole('button', { name: new RegExp(`^Import ${valid} `) }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button); if (valid) fireEvent.click(button);
    await waitFor(() => expect(mocks[type]).toHaveBeenCalledWith(title, expect.objectContaining({ description: expect.any(String) })));
    expect(mocks[type]).toHaveBeenCalledTimes(1);
    const executions = mocks.post.mock.calls.filter(([path]) => !String(path).includes('/preview'));
    expect(executions).toHaveLength(valid ? 1 : 0);
    if (!valid) {
      expect(screen.getByRole('heading', { name: 'Review & validate' })).toBeTruthy();
      expect(screen.getAllByText('Specific row explanation')).toHaveLength(10);
      expect(mocks.success).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(screen.getByRole('heading', { name: 'Map your columns' })).toBeTruthy();
      expect((screen.getByRole('combobox', { name: `Map CSV column for ${getImportConfig(module).requiredFields[0].label}` }) as HTMLSelectElement).value).toBe('0');
    }
  });
  it('keeps failed history accessible with no Failed filter', async () => {
    mocks.get.mockResolvedValue({ data: [job(module, 0, 0, 10), { ...job(module), id: 'partial' }, { ...job(module), id: 'running', status: 'importing', completedAt: null }], meta: { total: 23 } });
    render(<ImportPage moduleKey={module} />);
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    const table = await screen.findByRole('table', { name: 'Import history' });
    expect(within(table).getByText('Failed')).toBeTruthy();
    expect(within(table).getByText('In Progress')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Failed' })).toBeNull();
    expect(screen.getByText('23 total imports')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith(getImportConfig(module).importApiPath, expect.objectContaining({ params: expect.objectContaining({ page: 2, status: undefined }) })));
    await screen.findByRole('table', { name: 'Import history' });
    expect(screen.getByText('Page 2 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Partially Succeeded' }));
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith(getImportConfig(module).importApiPath, expect.objectContaining({ params: expect.objectContaining({ page: 1, status: 'completed_with_errors' }) })));
    await screen.findByRole('table', { name: 'Import history' });
    fireEvent.click(screen.getByRole('button', { name: 'Succeeded' }));
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith(getImportConfig(module).importApiPath, expect.objectContaining({ params: expect.objectContaining({ page: 1, status: 'completed' }) })));
    await screen.findByRole('table', { name: 'Import history' });
    fireEvent.click(screen.getByRole('button', { name: 'All Imports' }));
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith(getImportConfig(module).importApiPath, expect.objectContaining({ params: expect.objectContaining({ page: 1, status: undefined }) })));
  });
  it('preserves Failed row results and the linked imported record in Details', async () => {
    mocks.get.mockImplementation(async (path: string) => path.endsWith('/results') ? { data: [{ id: 'failed', rowNumber: 4, status: 'failed', remarks: 'Row 4: Invalid email address.' },
      { id: 'saved', rowNumber: 5, status: 'imported', recordId: 'created-record' }], meta: { total: 2 } } : { data: job(module) });
    render(<ImportDetailsPage moduleKey={module} importId="job" />);
    await screen.findByText('Row 4: Invalid email address.');
    expect(screen.getByRole('link', { name: `View ${getImportConfig(module).moduleSingular}` }).getAttribute('href')).toBe(`/crm/${module}/created-record`);
    fireEvent.click(screen.getByRole('button', { name: 'Failed' }));
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith(`${getImportConfig(module).importApiPath}/job/results`, expect.objectContaining({ params: expect.objectContaining({ status: 'failed' }) })));
  });
});

it('rejects incomplete or inconsistent review and final result counts', () => {
  expect(() => summarizeReview([], [2])).toThrow('incomplete');
  expect(() => summarizeReview([{ rowNumber: 3, data: {}, status: 'valid', isValid: true, errors: [] }], [2])).toThrow('incomplete');
  expect(finalImportNotice({ ...job('leads'), completedAt: null })).toBeNull();
  expect(finalImportNotice({ ...job('leads'), successfulRecords: 10 })).toBeNull();
  expect(finalImportNotice({ ...job('leads'), status: 'completed' })).toBeNull();
});
it('keeps incomplete preview on Mapping and permits a complete retry', async () => {
  const input = source('leads', 26), mapped = mapImportCsv('leads', input);
  mocks.post.mockResolvedValue({ data: mapped.slice(0, 24).map(r => ({ ...r, status: 'valid', isValid: true, errors: [] })) });
  const view = render(<ImportPage moduleKey="leads" />);
  fireEvent.change(view.container.querySelector('input[type=file]')!, { target: { files: [new File([input.csvText], 'test.csv')] } });
  await screen.findByRole('heading', { name: 'Map your columns' });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('incomplete')));
  expect(screen.queryByRole('heading', { name: 'Review & validate' })).toBeNull();
  mocks.post.mockImplementation(async (path: string) => ({ data: mapped.slice(path.endsWith('25') ? 25 : 0, path.endsWith('25') ? 26 : 25).map(r => ({ ...r, status: 'valid', isValid: true, errors: [] })) }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByRole('heading', { name: 'Review & validate' });
});
it('resumes an interrupted import with the original request and emits one final toast', async () => {
  await review('leads', 10, 0, 0);
  const final = job('leads', 10, 0, 0);
  mocks.post.mockRejectedValueOnce(new Error('Network unavailable'));
  fireEvent.click(screen.getByRole('button', { name: /^Import 10 / }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Import Interrupted', expect.objectContaining({ description: expect.stringContaining('resume the same import') })));
  const first = mocks.post.mock.calls.at(-1)![1];
  mocks.post.mockResolvedValue({ data: final }); mocks.refresh.mockRejectedValue(new Error('List unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Resume import' }));
  await screen.findByRole('heading', { name: 'Import Succeeded' });
  expect(mocks.post.mock.calls.at(-1)![1]).toEqual(first);
  expect(mocks.success).toHaveBeenCalledTimes(1); expect(mocks.error).toHaveBeenCalledTimes(1);
});
it('falls back from the old Failed URL to All Imports', async () => {
  window.history.replaceState(null, '', '/crm/leads/import?status=failed');
  mocks.get.mockResolvedValue({ data: [job('leads', 0, 0, 10)], meta: { total: 1 } });
  render(<ImportPage moduleKey="leads" />);
  await screen.findByRole('table', { name: 'Import history' });
  expect(window.location.search).toBe('');
  expect(mocks.get).toHaveBeenCalledWith('/crm/leads/imports', expect.objectContaining({ params: expect.objectContaining({ status: undefined }) }));
});
