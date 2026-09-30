import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ProductInterestsSettings } from './product-interests-settings';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { tenantId: 'one' } }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => true }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
const product = { id: '0ff82f9c-48e9-4e1c-8c77-8a30755d704c', name: 'CCTV Surveillance System', dealValue: 25000, active: true, createdAt: '', updatedAt: '' };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiClient.get).mockResolvedValue({ data: [product], meta: { enabled: true } });
  vi.mocked(apiClient.post).mockResolvedValue({ data: [product], meta: { enabled: true } });
  vi.mocked(apiClient.delete).mockResolvedValue({ data: [], meta: { enabled: false } });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('shows a collapsed card and toggles the exact card and panel actions', async () => {
  render(<ProductInterestsSettings />);
  await screen.findByRole('button', { name: 'View Product Interest' });
  expect(screen.queryByText(product.name)).toBeNull();
  const trigger = screen.getByRole('button', { name: 'Product Interest actions' });
  fireEvent.click(trigger);
  expect(within(screen.getByRole('menu')).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['View', 'Edit', 'Delete']);
  fireEvent.click(trigger); expect(screen.queryByRole('menu')).toBeNull();
  fireEvent.click(trigger); fireEvent.mouseDown(document.body); expect(screen.queryByRole('menu')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'View Product Interest' }));
  expect(await screen.findByText('₱25,000.00')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Product Interest panel actions' }));
  expect(within(screen.getByRole('menu')).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Edit', 'Delete']);
});
it('validates money and persists only trimmed names and numeric amounts through the API', async () => {
  render(<ProductInterestsSettings />);
  fireEvent.click(await screen.findByRole('button', { name: 'View Product Interest' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Product' }));
  fireEvent.change(screen.getByLabelText('Product Name'), { target: { value: '  Biometrics  ' } });
  fireEvent.change(screen.getByLabelText('Deal Value (PHP)'), { target: { value: '-5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  expect(await screen.findByRole('alert')).toBeTruthy(); expect(apiClient.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Deal Value (PHP)'), { target: { value: '30000.50' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/administration/product-interests', { name: 'Biometrics', dealValue: 30000.5 }));
});
it('requires confirmation before deleting the field', async () => {
  render(<ProductInterestsSettings />);
  fireEvent.click(await screen.findByRole('button', { name: 'Product Interest actions' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
  expect(apiClient.delete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
  await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/administration/product-interests'));
});

async function editProduct() {
  fireEvent.click(await screen.findByRole('button', { name: 'Product Interest actions' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Edit ' + product.name }));
  fireEvent.change(screen.getByLabelText('Deal Value (PHP)'), { target: { value: '7000.25' } });
}
it('shows a skeleton then applies the committed response and toasts only after success', async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(apiClient.patch).mockImplementation(() => new Promise(done => { resolve = done; }));
  render(<ProductInterestsSettings />);
  expect(screen.getByRole('status', { name: 'Loading Custom Fields' }).querySelector('.animate-pulse')).toBeTruthy();
  await editProduct();
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(true);
  expect(toast.success).not.toHaveBeenCalled();
  expect(apiClient.patch).toHaveBeenCalledWith('/administration/product-interests/' + product.id, { name: product.name, dealValue: 7000.25 });
  // The follow-up GET stays pending: the mutation response must be enough to update the UI.
  vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}));
  resolve({ data: [{ ...product, dealValue: 7000.25 }], meta: { enabled: true } });
  await screen.findByText('₱7,000.25');
  expect(toast.success).toHaveBeenCalledWith('Product updated successfully.');
  expect(screen.queryByLabelText('Deal Value (PHP)')).toBeNull();
});
it('retains entered values and allows retry when saving fails', async () => {
  vi.mocked(apiClient.patch).mockRejectedValue(new Error('Database unavailable'));
  render(<ProductInterestsSettings />);
  await editProduct();
  fireEvent.click(screen.getByRole('button', { name: 'Save Product' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Database unavailable'));
  expect(toast.success).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Deal Value (PHP)') as HTMLInputElement).value).toBe('7000.25');
  expect((screen.getByRole('button', { name: 'Save Product' }) as HTMLButtonElement).disabled).toBe(false);
});
