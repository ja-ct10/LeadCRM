vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => true }));
vi.mock('@/shared/hooks/use-crm-record-access', () => ({ useCrmRecordAccess: () => ({ canMutate: () => true, canReassign: true, policy: { userId: 'agent', tenantId: 'tenant', assignmentRestricted: false, clientAdmin: false } }) }));
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('@/store/DataContext', () => ({ useData: () => ({ users: [] }) }));
vi.mock('@/shared/hooks/use-product-interests', () => ({ useProductInterests: () => ({ products: [] }) }));
vi.mock('@/shared/hooks/use-scroll-to-error', () => ({ useScrollToError: vi.fn() }));
vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: () => ({ data: { fields: [], values: {}, files: [] }, error: null, isInitialLoad: false }) }));
import { AccountFormInner } from '../account-form';
afterEach(cleanup);
it.each([false, true])('submits an Account without obsolete fields (edit=%s)', async edit => {
  const save = vi.fn();
  render(<AccountFormInner initialData={edit ? { id: 'account', tenantId: 'tenant', name: 'Account', createdAt: '2026-09-24T00:00:00Z', internalNotes: 'Historical note', activeProducts: ['Historical product'] } : undefined} onSave={save} onCancel={vi.fn()} />);
  if (!edit) {
    expect(screen.getByRole('option', { name: 'Assign automatically' })).toBeTruthy();
    expect(screen.queryByText('Active Products')).toBeNull();
    expect(screen.queryByLabelText('Internal Notes')).toBeNull();
    expect(screen.queryByLabelText('Notes')).toBeNull();
    expect(screen.queryByText('Notes')).toBeNull();
  }
  for (const label of ['Tax ID', 'Customer Type', 'Customer Since', 'Customer Classification']) expect(screen.queryByText(label)).toBeNull();
  fireEvent.change(screen.getByLabelText(/Account Name/), { target: { value: 'New Account' } });
  const address = screen.getByLabelText('Full Address');
  expect(address.tagName).toBe('TEXTAREA');
  fireEvent.change(address, { target: { value: '123 Main Street\nMakati City, Metro Manila, Philippines' } });
  fireEvent.submit(screen.getByLabelText(/Account Name/).closest('form')!);
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0]).toMatchObject({ name: 'New Account', address: '123 Main Street\nMakati City, Metro Manila, Philippines' });
  for (const field of ['city', 'province', 'country']) expect(save.mock.calls[0][0]).not.toHaveProperty(field);
  for (const label of ['City', 'Province', 'Country']) expect(screen.queryByLabelText(label)).toBeNull();
  for (const field of ['taxId', 'customerType', 'customerSince']) expect(save.mock.calls[0][0]).not.toHaveProperty(field);
  if (edit) expect(save.mock.calls[0][0]).toMatchObject({ internalNotes: 'Historical note', activeProducts: ['Historical product'] });
  else for (const field of ['notes', 'internalNotes', 'activeProducts']) expect(save.mock.calls[0][0]).not.toHaveProperty(field);
});

it('keeps existing Notes and international address data when editing', async () => {
  const save = vi.fn();
  render(<AccountFormInner initialData={{ id: 'account', tenantId: 'tenant', name: 'Account', createdAt: '2026-09-24T00:00:00Z', address: '42 Queen Street\nToronto, Ontario, Canada', notes: 'Historical notes', internalNotes: 'Private notes', assignedUserId: 'agent' }} onSave={save} onCancel={vi.fn()} />);
  expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('Historical notes');
  expect((screen.getByLabelText('Full Address') as HTMLTextAreaElement).value).toBe('42 Queen Street\nToronto, Ontario, Canada');
  fireEvent.submit(screen.getByLabelText(/Account Name/).closest('form')!);
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0]).toMatchObject({ address: '42 Queen Street\nToronto, Ontario, Canada', notes: 'Historical notes', internalNotes: 'Private notes', assignedUserId: 'agent' });
  for (const field of ['city', 'province', 'country']) expect(save.mock.calls[0][0]).not.toHaveProperty(field);
});
