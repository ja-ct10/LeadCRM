import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ContactFormInner } from './contact-form';
vi.mock('@/store/DataContext', () => ({ useData: () => ({ users: [] }) }));
vi.mock('@/shared/hooks/use-product-interests', () => ({ useProductInterests: () => ({ products: [], loading: false }) }));
vi.mock('@/shared/hooks/use-scroll-to-error', () => ({ useScrollToError: () => {} }));
vi.mock('@/shared/components/entity-combobox', () => ({ EntityCombobox: () => null }));
vi.mock('@/shared/components/crm/record-custom-fields', () => ({
  useRecordCustomFields: () => ({ fields: [], blocked: false, validate: () => true, payload: () => ({}) }),
  CustomFieldGroup: () => null, CustomFieldExtraGroups: () => null,
}));
afterEach(cleanup);
it('retains a failed draft and permits retry without submitting twice while saving', async () => {
  let reject!: (error: Error) => void;
  const save = vi.fn().mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest; })).mockResolvedValue(undefined);
  render(<ContactFormInner onSave={save} onCancel={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'Nora' } });
  fireEvent.change(screen.getByLabelText('Last Name *'), { target: { value: 'Lim' } });
  fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'nora@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Contact' }));
  await screen.findByRole('button', { name: 'Saving...' });
  expect((screen.getByRole('button', { name: 'Saving...' }) as HTMLButtonElement).disabled).toBe(true);
  reject(new Error('Temporary save failure'));
  expect((await screen.findByRole('alert')).textContent).toBe('Temporary save failure');
  expect((screen.getByLabelText('First Name *') as HTMLInputElement).value).toBe('Nora');
  fireEvent.click(screen.getByRole('button', { name: 'Create Contact' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
});

it('keeps configured Job title, Active Products and Notes values on Contact edits', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<ContactFormInner initialData={{ id: 'contact-1', tenantId: 'tenant-1', createdAt: '2026-01-01T00:00:00.000Z', firstName: 'Nora', lastName: 'Lim', email: 'nora@example.test', status: 'Warm', jobTitle: 'Buyer', activeProducts: ['CRM Enterprise'], notes: 'Keep this note' }} onSave={save} onCancel={vi.fn()} />);
  expect((screen.getByLabelText('Job Title') as HTMLInputElement).value).toBe('Buyer');
  expect(screen.getByLabelText('Active Products').textContent).toContain('CRM Enterprise');
  expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('Keep this note');
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ jobTitle: 'Buyer', activeProducts: ['CRM Enterprise'], notes: 'Keep this note' })));
});
