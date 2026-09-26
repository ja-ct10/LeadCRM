import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('@/store/DataContext', () => ({ useData: () => ({ pipelines: [{ id: 'pipeline', name: 'Sales', stages: [{ id: 'stage', name: 'New' }] }] }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: () => true }));
vi.mock('./deal-account-field', () => ({ DealAccountField: () => null }));
vi.mock('./deal-contacts-field', () => ({ DealContactsField: () => null }));
vi.mock('./deal-leads-field', () => ({ DealLeadsField: () => null }));
vi.mock('@/shared/components/entity-combobox', () => ({ EntityCombobox: () => null }));
import { DealForm } from './deal-form';
afterEach(cleanup);

it('adds approved interests once, resets the select, removes chips and preserves the deal payload', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<DealForm mode="create" preselect={{ pipelineId: 'pipeline', stageId: 'stage' }} onSubmit={save} onCancel={() => {}} />);
  const select = screen.getByLabelText('Product Interests') as HTMLSelectElement;
  const add = screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement;
  expect(add.disabled).toBe(true);
  expect(screen.queryByRole('button', { name: 'CCTV' })).toBeNull();
  for (const value of ['CCTV', 'Biometrics']) {
    fireEvent.change(select, { target: { value } });
    expect(add.disabled).toBe(false);
    fireEvent.click(add);
    expect(select.value).toBe('');
    expect(add.disabled).toBe(true);
  }
  fireEvent.change(select, { target: { value: 'CCTV' } });
  expect(add.disabled).toBe(true);
  fireEvent.click(add);
  expect(screen.getAllByRole('button', { name: 'Remove CCTV' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Biometrics' }));
  fireEvent.change(select, { target: { value: '<script>invalid</script>' } });
  expect(add.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Camera installation' } });
  fireEvent.change(screen.getByLabelText('Value'), { target: { value: '1000' } });
  await waitFor(() => expect((screen.getByRole('button', { name: 'Create Deal' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Create Deal' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ productInterests: ['CCTV'], pipelineId: 'pipeline', stageId: 'stage', currency: 'PHP' })));
});
