vi.mock('@/shared/hooks/use-deal-address-options', () => ({ useDealAddressOptions: () => ({ data: [], isInitialLoad: false, error: null, refetch: vi.fn() }) }));
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InlineDealForm } from '../inline-deal-form';
const mocks = vi.hoisted(() => ({ stages: [
  { id: 'qualified', name: 'Qualified', isDefault: true }, { id: 'lead', name: 'Lead' }, { id: 'won', name: 'Won', isWon: true },
] }));
vi.mock('@/shared/components/entity-combobox', () => ({ EntityCombobox: ({ entityType, value, onChange }: any) => <select aria-label={`Search ${entityType}`} value={value ?? ''} onChange={event => onChange(event.target.value)}><option value="">Choose</option><option value="selected-person">Person</option></select> }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ pipelines: [{ id: 'sales', name: 'Sales Pipeline', stages: mocks.stages }] }) }));
vi.mock('@/shared/hooks/use-product-interests', () => ({ useProductInterests: () => ({ products: [{ id: '11111111-1111-4111-8111-111111111111', name: 'CCTV', dealValue: 500 }], loading: false }) }));
vi.mock('../record-custom-fields', () => ({
  useRecordCustomFields: () => ({ fields: [], validate: () => true, payload: () => ({}), blocked: false }),
  CustomFieldGroup: () => null, CustomFieldExtraGroups: () => null,
}));
afterEach(cleanup);
beforeEach(() => { mocks.stages = [{ id: 'qualified', name: 'Qualified', isDefault: true }, { id: 'lead', name: 'Lead' }, { id: 'won', name: 'Won', isWon: true }]; });
it('shows the enforced Lead starting stage and submits its configured ID', async () => {
  const submitted = vi.fn().mockResolvedValue(undefined);
  render(<InlineDealForm relatedRecord={{ type: 'lead', id: 'origin-lead' }} onSubmit={submitted} />);
  expect((screen.getByLabelText('Starting stage') as HTMLInputElement).value).toBe('Lead');
  expect(screen.queryByRole('combobox', { name: /stage/i })).toBeNull();
  fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'CCTV installation' } });
  fireEvent.click(screen.getByRole('button', { name: 'Product Interest' }));
  fireEvent.click(screen.getByRole('radio', { name: 'CCTV' }));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Create Deal' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Create Deal' }));
  await waitFor(() => expect(submitted).toHaveBeenCalledWith(expect.objectContaining({ pipelineId: 'sales', stageId: 'lead' })));
});
it('prevents creation if the Lead stage is unavailable', () => {
  mocks.stages = [{ id: 'qualified', name: 'Qualified', isDefault: true }];
  render(<InlineDealForm onSubmit={vi.fn()} />);
  expect(screen.getByRole('alert').textContent).toContain('Lead starting stage is unavailable');
  expect((screen.getByRole('button', { name: 'Create Deal' }) as HTMLButtonElement).disabled).toBe(true);
});


it.each(['lead', 'contact'] as const)('preselects a source %s and submits its relationship', async type => {
  const save = vi.fn();
  render(<InlineDealForm relatedRecord={{ type, id: 'selected-person' }} onSubmit={save} />);
  expect(screen.getByLabelText(/Associate Deal To/)).toHaveProperty('value', type);
  fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Related Deal' } });
  fireEvent.click(screen.getByRole('button', { name: 'Product Interest' }));
  fireEvent.click(screen.getByRole('radio', { name: 'CCTV' }));
  fireEvent.submit(screen.getByLabelText(/Title/).closest('form')!);
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ [type === 'lead' ? 'leadId' : 'contactId']: 'selected-person' })));
});

it('requires a person for creation from an Account and clears selections on type changes', async () => {
  const save = vi.fn();
  render(<InlineDealForm relatedRecord={{ type: 'account', id: 'company' }} onSubmit={save} />);
  expect(screen.queryByRole('combobox', { name: 'Search leads' })).toBeNull();
  fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Company Deal' } });
  fireEvent.click(screen.getByRole('button', { name: 'Product Interest' }));
  fireEvent.click(screen.getByRole('radio', { name: 'CCTV' }));
  fireEvent.submit(screen.getByLabelText(/Title/).closest('form')!);
  await screen.findByText('Choose Lead or Contact.');
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/Associate Deal To/), { target: { value: 'lead' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Search leads' }), { target: { value: 'selected-person' } });
  fireEvent.change(screen.getByLabelText(/Associate Deal To/), { target: { value: 'contact' } });
  expect(screen.getByRole('combobox', { name: 'Search contacts' })).toHaveProperty('value', '');
  fireEvent.change(screen.getByRole('combobox', { name: 'Search contacts' }), { target: { value: 'selected-person' } });
  fireEvent.submit(screen.getByLabelText(/Title/).closest('form')!);
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0]).toMatchObject({ contactId: 'selected-person' });
  expect(save.mock.calls[0][0].organizationId).toBeUndefined();
  expect(save.mock.calls[0][0].leadId).toBeUndefined();
});

it('blocks duplicate inline submissions and retains the selected record for a failed-request retry', async () => {
  let reject!: (error: Error) => void;
  const save = vi.fn().mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })).mockResolvedValue(undefined);
  const onError = vi.fn();
  render(<InlineDealForm relatedRecord={{ type: 'lead', id: 'selected-person' }} onSubmit={save} onError={onError} />);
  fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Retry Deal' } });
  fireEvent.click(screen.getByRole('button', { name: 'Product Interest' }));
  fireEvent.click(screen.getByRole('radio', { name: 'CCTV' }));
  const form = screen.getByLabelText(/Title/).closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  fireEvent.submit(form); expect(save).toHaveBeenCalledOnce();
  reject(new Error('Controlled request failure'));
  await waitFor(() => expect(onError).toHaveBeenCalledOnce());
  expect(screen.getByRole('combobox', { name: 'Search leads' })).toHaveProperty('value', 'selected-person');
  await waitFor(() => expect((screen.getByRole('button', { name: 'Create Deal' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.submit(form); await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
});
