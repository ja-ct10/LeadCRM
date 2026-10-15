import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OrganizationFields, useOrganizationForm } from '../organization-fields';
const fixture = vi.hoisted(() => ({ custom: '', denied: [] as string[], account: { id: 'account', name: 'Linked Company', industry: 'Technology', size: '11-50', website: 'https://company.test' } }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: (key: string) => !fixture.denied.includes(key) }));
vi.mock('@/store/DataContext', () => ({ useData: () => ({ organizations: [] }) }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: () => ({ data: fixture.account, isInitialLoad: false, refetch: vi.fn() }) }));
vi.mock('@/shared/components/entity-combobox', () => ({ EntityCombobox: ({ onChange }: any) => <button type="button" onClick={() => onChange('account')}>Choose Company</button> }));
vi.mock('../record-custom-fields', () => ({
  useRecordCustomFields: () => ({ fields: [{ id: 'context', name: 'Company context' }], payload: () => ({ context: fixture.custom }), validate: () => !!fixture.custom, query: {} }),
  CustomFieldInput: () => <label>Company context<input onChange={event => { fixture.custom = event.target.value; }} /></label>,
}));
afterEach(cleanup);
beforeEach(() => { fixture.custom = ''; fixture.denied = []; });
function Form({ save, initial }: { save: (data: unknown) => void; initial?: { id: string; companyName?: string; accountId?: string } }) {
  const draft = useOrganizationForm(initial);
  return <form onSubmit={event => { event.preventDefault(); if (draft.validate()) save(draft.payload()); }}><OrganizationFields draft={draft} /><button>Save</button></form>;
}
it('keeps legacy company text and an optional organization without creating an Account', () => {
  const save = vi.fn(); render(<Form save={save} initial={{ id: 'person', companyName: 'Historical company' }} />);
  expect((screen.getByLabelText('Company Name') as HTMLInputElement).value).toBe('Historical company');
  fireEvent.click(screen.getByText('Save'));
  expect(save).toHaveBeenCalledWith({ companyName: 'Historical company', accountId: null });
});
it('shows existing company fields read-only and links to its Account', () => {
  const save = vi.fn(); render(<Form save={save} />);
  fireEvent.click(screen.getByRole('button', { name: 'Link existing Account' }));
  fireEvent.click(screen.getByText('Choose Company'));
  const name = screen.getByLabelText('Company Name') as HTMLInputElement;
  expect(name.value).toBe('Linked Company'); expect(name.readOnly).toBe(true);
  expect((screen.getByLabelText('Industry') as HTMLSelectElement).disabled).toBe(true);
  expect((screen.getByLabelText('Size') as HTMLSelectElement).value).toBe('11-50');
  expect(screen.getByRole('link', { name: 'Open Account' }).getAttribute('href')).toBe('/crm/accounts/account');
});
it('validates new Account fields, preserves required custom values and reuses the retry identity', () => {
  const save = vi.fn(); render(<Form save={save} />);
  fireEvent.click(screen.getByRole('button', { name: 'Create new Account' }));
  fireEvent.click(screen.getByText('Save')); expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Company Name *'), { target: { value: 'New company' } });
  fireEvent.change(screen.getByLabelText('Industry'), { target: { value: 'Retail' } });
  fireEvent.change(screen.getByLabelText('Size'), { target: { value: '51-200' } });
  fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'bad url' } });
  fireEvent.click(screen.getByText('Save')); expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'https://new.test' } });
  fireEvent.click(screen.getByText('Save')); expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Company context'), { target: { value: 'Required context' } });
  fireEvent.click(screen.getByText('Save')); fireEvent.click(screen.getByText('Save'));
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[0][0]).toEqual(save.mock.calls[1][0]);
  expect(save.mock.calls[0][0]).toMatchObject({ accountId: null, newAccount: { name: 'New company', industry: 'Retail', size: '51-200', website: 'https://new.test', customFieldValues: { context: 'Required context' } } });
});
it('requires Account permissions for both linking and new company creation', () => {
  fixture.denied = ['accounts.view', 'accounts.create']; render(<Form save={vi.fn()} />);
  expect((screen.getByRole('button', { name: 'Link existing Account' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'Create new Account' }) as HTMLButtonElement).disabled).toBe(true);
});
