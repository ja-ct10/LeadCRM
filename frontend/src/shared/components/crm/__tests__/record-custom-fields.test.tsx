import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CUSTOM_FIELD_BUILT_IN_GROUPS, defaultFieldLayout, getCrmFieldCatalog, type ClosingField, type CustomFieldModule, type CustomFieldState } from '@leadcrm/shared';
import { useRecordCustomFields, CustomFieldGroup, CustomFieldExtraGroups, RecordCustomFieldInlineRow, useRecordCustomFieldDetails } from '../record-custom-fields';
import { ConfiguredFormLayout } from '../configured-form-layout';
import { InlineEditRows } from '../inline-edit-rows';
const fixture = vi.hoisted(() => ({ data: { fields: [], values: {}, files: [] } as CustomFieldState, hasData: true, error: null as string | null }));
const api = vi.hoisted(() => ({ put: vi.fn(), upload: vi.fn(), refetch: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiClient: api }));
vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: () => { const [, rerender] = React.useState(0); return { ...fixture, data: fixture.hasData ? fixture.data : undefined, isInitialLoad: false, refetch: api.refetch, setData: (data: CustomFieldState) => { fixture.data = data; rerender(previous => previous + 1); } }; } }));
const field = (module: CustomFieldModule, changes: Partial<ClosingField> = {}): ClosingField => ({ id: 'field', name: 'Project Budget', module, group: CUSTOM_FIELD_BUILT_IN_GROUPS[module][0], type: 'Number', required: true, active: true, visibleInForm: true, visibleInDetails: true, options: [], description: 'Budget in PHP', order: 0, version: 1, ...changes });
function RecordCustomFieldDetails({ module, recordId, canEdit = false }: { module: CustomFieldModule; recordId: string; canEdit?: boolean }) {
  const details = useRecordCustomFieldDetails(module, recordId);
  const layout = details.query.data?.layout ?? defaultFieldLayout(module);
  return <>{details.query.error && <div role="alert">{details.query.error}<button onClick={() => void details.query.refetch()}>Retry custom fields</button></div>}{layout.groups.map(group => <section key={group.id} aria-label={group.label}>{getCrmFieldCatalog(module, details.fields.map(field => ({ ...field, deletedAt: undefined })), layout).filter(field => field.customFieldId && field.groupId === group.id).map(field => <RecordCustomFieldInlineRow key={field.customFieldId} details={details} fieldId={field.customFieldId!} canEdit={canEdit} />)}</section>)}</>;
}
function Form({ module, recordId, save }: { module: CustomFieldModule; recordId?: string; save: (value: unknown) => void }) {
  const form = useRecordCustomFields(module, recordId);
  return <form noValidate onSubmit={event => { event.preventDefault(); if (form.validate()) save(form.payload()); }}>
    {CUSTOM_FIELD_BUILT_IN_GROUPS[module].map(group => <section key={group} aria-label={group}><h3>{group}</h3><CustomFieldGroup form={form} group={group} /></section>)}
    <CustomFieldExtraGroups form={form} startNumber={5} /><button disabled={form.blocked}>Save</button>
  </form>;
}
afterEach(cleanup);
beforeEach(() => { fixture.data = { fields: [], values: {}, files: [] }; fixture.hasData = true; fixture.error = null; vi.clearAllMocks(); api.put.mockResolvedValue({ success: true }); });
it.each(['leads', 'contacts', 'accounts', 'deals'] as const)('places %s fields in configured sections and rejects invalid/empty values inline', module => {
  fixture.data.fields = [field(module), field(module, { id: 'extra', name: 'Server Count', group: 'Technical Details', required: false, order: 1 })];
  const save = vi.fn(); render(<Form module={module} save={save} />);
  expect(screen.getByLabelText(/Project Budget/).closest('section')?.getAttribute('aria-label')).toBe(CUSTOM_FIELD_BUILT_IN_GROUPS[module][0]);
  expect(screen.getByLabelText('Server Count').closest('section')?.textContent).toContain('5Technical Details');
  fireEvent.click(screen.getByText('Save')); expect(save).not.toHaveBeenCalled(); expect(screen.getByRole('alert').textContent).toContain('required');
  fireEvent.change(screen.getByLabelText(/Project Budget/), { target: { value: 'invalid' } });
  expect((screen.getByLabelText(/Project Budget/) as HTMLInputElement).value).toBe('');
  fireEvent.change(screen.getByLabelText(/Project Budget/), { target: { value: '-' } });
  fireEvent.click(screen.getByText('Save')); expect(save).not.toHaveBeenCalled(); expect(screen.getByRole('alert').textContent).toContain('valid number');
  fireEvent.change(screen.getByLabelText(/Project Budget/), { target: { value: '25000' } });
  fireEvent.click(screen.getByText('Save')); expect(save).toHaveBeenCalledWith({ field: 25000, extra: null });
});
it('loads existing values, submits only edits and omits hidden, disabled and foreign-module fields', () => {
  fixture.data = { fields: [field('leads'), field('leads', { id: 'hidden', name: 'Hidden', visibleInForm: false }), field('leads', { id: 'disabled', name: 'Disabled', active: false }), field('contacts', { id: 'foreign', name: 'Contact only' })], values: { field: 100, hidden: 'Retained' }, files: [] };
  const save = vi.fn(); render(<Form module="leads" recordId="lead" save={save} />);
  expect((screen.getByLabelText(/Project Budget/) as HTMLInputElement).value).toBe('100');
  for (const name of ['Hidden', 'Disabled', 'Contact only']) expect(screen.queryByLabelText(name)).toBeNull();
  fireEvent.click(screen.getByText('Save')); expect(save).toHaveBeenLastCalledWith({});
  fireEvent.change(screen.getByLabelText(/Project Budget/), { target: { value: '200' } });
  fireEvent.click(screen.getByText('Save')); expect(save).toHaveBeenLastCalledWith({ field: 200 });
});
it('retains hidden and disabled values in grouped details', () => {
  fixture.data = { fields: [field('accounts', { visibleInForm: false }), field('accounts', { id: 'other', name: 'Old note', active: false, type: 'Text' })], values: { field: 12, other: 'History' }, files: [] };
  render(<RecordCustomFieldDetails module="accounts" recordId="account" />);
  expect(screen.getByText('12')).toBeTruthy(); expect(screen.getByText('History')).toBeTruthy(); expect(screen.queryByText(/Hidden in forms/)).toBeNull(); expect(screen.getByText(/Disabled/)).toBeTruthy();
});
it.each(['leads', 'contacts', 'accounts', 'deals'] as const)('edits a %s field visible only in Details through the existing Long Text control', async module => {
  fixture.data = { fields: [field(module, { name: 'Cancellation Reason', type: 'Long Text', required: false, visibleInForm: false, visibleInDetails: true })], values: { unrelated: 'Keep' }, files: [] };
  const form = render(<Form module={module} save={vi.fn()} />);
  expect(screen.queryByLabelText('Cancellation Reason')).toBeNull();
  form.unmount();

  const details = render(<RecordCustomFieldDetails module={module} recordId="record" canEdit />);
  expect(screen.getByText('Cancellation Reason').textContent).toBe('Cancellation Reason');
  expect(screen.queryByText(/Hidden in forms/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Cancellation Reason' }));
  const input = screen.getByLabelText('Cancellation Reason') as HTMLTextAreaElement;
  expect(input.tagName).toBe('TEXTAREA'); expect(input.value).toBe('');
  const saved = 'Customer cancelled\nNo longer needed';
  fireEvent.change(input, { target: { value: saved } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByLabelText('Cancellation Reason')).toBeNull());
  expect(api.put).toHaveBeenCalledExactlyOnceWith(`/crm/${module}/record`, { customFieldValues: { field: saved } });
  expect(screen.getByRole('button', { name: 'Edit Cancellation Reason' }).textContent).toBe(saved);
  expect(fixture.data.values).toEqual({ unrelated: 'Keep', field: saved });

  details.rerender(<RecordCustomFieldDetails module={module} recordId="record" />);
  expect(screen.queryByRole('button', { name: 'Edit Cancellation Reason' })).toBeNull();
  expect(screen.getByText(/Customer cancelled/).textContent).toBe(saved);
});
it('keeps a failed definition load from submitting an incomplete record', () => {
  fixture.error = 'Unable to load custom fields'; const save = vi.fn(); render(<Form module="leads" save={save} />);
  expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true); expect(screen.getByRole('alert').textContent).toContain(fixture.error);
});
it('edits Deal custom values inside Details and preserves history on cancel', async () => {
  fixture.data = { fields: [field('deals')], values: { field: 100 }, files: [] };
  render(<RecordCustomFieldDetails module="deals" recordId="deal" canEdit />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Project Budget' }));
  fireEvent.change(screen.getByLabelText(/Project Budget/), { target: { value: '200' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(api.put).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Project Budget' }));
  expect((screen.getByLabelText(/Project Budget/) as HTMLInputElement).value).toBe('100');
  fireEvent.change(screen.getByLabelText(/Project Budget/), { target: { value: '300' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/crm/deals/deal', { customFieldValues: { field: 300 } }));
  await waitFor(() => expect(screen.queryByRole('form', { name: 'Edit Project Budget' })).toBeNull());
  expect(screen.getByRole('button', { name: 'Edit Project Budget' })).toBeTruthy();
  expect(screen.getByText('300')).toBeTruthy();
  expect(api.refetch).not.toHaveBeenCalled();
});
it('does not expose custom editing without record edit permission', () => {
  fixture.data = { fields: [field('deals')], values: { field: 100 }, files: [] };
  render(<RecordCustomFieldDetails module="deals" recordId="deal" />);
  expect(screen.queryByRole('button', { name: 'Edit Project Budget' })).toBeNull();
});
it('combines existing native controls and custom fields in saved section order without duplicates or draft resets', () => {
  const layout = defaultFieldLayout('leads');
  layout.groups.push({ id: 'project', label: 'Project information', order: 0 });
  layout.groups[0].order = 1;
  layout.fields.firstName = { label: 'Given name', groupId: 'project', order: 2, visibleInForm: true, visibleInDetails: true };
  layout.fields.phone = { label: 'Phone', groupId: layout.groups[0].id, order: 1, visibleInForm: false, visibleInDetails: true };
  fixture.data = { fields: [field('leads', { groupId: 'project', group: 'Project information', order: 1 })], values: {}, files: [], layout };
  function Native({ label, children }: { fieldKey: string; label: string; children: React.ReactNode }) { return <label>{label}{children}</label>; }
  function Configured() { const form = useRecordCustomFields('leads'); const [name, setName] = React.useState('Nora'); return <ConfiguredFormLayout form={form}><Native fieldKey="firstName" label="First name"><input value={name} onChange={event => setName(event.target.value)} /></Native><Native fieldKey="phone" label="Phone"><input /></Native><CustomFieldGroup form={form} group="Project information" /></ConfiguredFormLayout>; }
  const view = render(<Configured />);
  expect(screen.getAllByLabelText(/Project Budget/)).toHaveLength(1);
  expect(screen.queryByLabelText('Phone')).toBeNull();
  expect(screen.getByLabelText('Given name *').closest('section')?.textContent).toContain('Project information');
  const section = screen.getByLabelText(/Project Budget/).closest('section')!;
  expect(section.querySelectorAll('label')[0].textContent).toContain('Project Budget');
  fireEvent.change(screen.getByLabelText('Given name *'), { target: { value: 'Nora draft' } });
  fixture.data.layout!.groups.find(group => group.id === 'project')!.label = 'Renamed project';
  view.rerender(<Configured />);
  expect((screen.getByLabelText('Given name *') as HTMLInputElement).value).toBe('Nora draft');
  expect(section.textContent).toContain('Renamed project');
});
it('Details hiding preserves values and independently leaves the form field available', () => {
  fixture.data = { fields: [field('leads', { visibleInDetails: false })], values: { field: 0 }, files: [] };
  render(<><RecordCustomFieldDetails module="leads" recordId="lead" /><Form module="leads" save={vi.fn()} /></>);
  expect(screen.queryByText('0')).toBeNull(); expect((screen.getByLabelText(/Project Budget/) as HTMLInputElement).value).toBe('0');
  expect(fixture.data.values.field).toBe(0);
});
it('keeps loaded custom values during a transient refresh failure and hides them when cached data is cleared', () => {
  fixture.data = { fields: [field('accounts')], values: { field: 0 }, files: [] };
  const view = render(<RecordCustomFieldDetails module="accounts" recordId="account" />);
  const value = screen.getByText('0');
  fixture.error = 'Unable to refresh custom fields';
  view.rerender(<RecordCustomFieldDetails module="accounts" recordId="account" />);
  expect(screen.getByText('0')).toBe(value);
  expect(screen.getByRole('alert').textContent).toContain(fixture.error);
  fireEvent.click(screen.getByRole('button', { name: 'Retry custom fields' }));
  expect(api.refetch).toHaveBeenCalledTimes(1);
  fixture.hasData = false;
  view.rerender(<RecordCustomFieldDetails module="accounts" recordId="account" />);
  expect(screen.queryByText('0')).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain(fixture.error);
});
it('preserves the open custom-field draft when refresh fails', () => {
  fixture.data = { fields: [field('leads')], values: { field: 100 }, files: [] };
  const view = render(<RecordCustomFieldDetails module="leads" recordId="lead" canEdit />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Project Budget' }));
  const input = screen.getByLabelText(/Project Budget/) as HTMLInputElement;
  fireEvent.change(input, { target: { value: '250' } });
  fixture.error = 'Unable to refresh custom fields';
  view.rerender(<RecordCustomFieldDetails module="leads" recordId="lead" canEdit />);
  expect(screen.getByLabelText(/Project Budget/)).toBe(input);
  expect(input.value).toBe('250');
  expect(screen.getByRole('alert').textContent).toContain(fixture.error);
  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
});

it.each(['leads', 'contacts', 'accounts', 'deals'] as const)('shows an unsaved %s field exactly once and initializes a blank inline editor without writing', module => {
  fixture.data.fields = [field(module, { required: false })];
  render(<RecordCustomFieldDetails module={module} recordId="record" canEdit />);
  expect(screen.getAllByText('Project Budget')).toHaveLength(1);
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Edit custom fields' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Project Budget' }));
  expect((screen.getByLabelText('Project Budget') as HTMLInputElement).value).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(api.put).not.toHaveBeenCalled();
});
it.each([
  ['Text', 'New value', 'New value'], ['Long Text', 'First line\nSecond line', 'First line\nSecond line'],
  ['Number', '0', 0], ['Date', '2026-10-11', '2026-10-11'], ['Dropdown', 'Gold', 'Gold'],
] as const)('uses the %s control and sends one canonical value while preserving unrelated values', async (type, raw, expected) => {
  fixture.data = { fields: [field('contacts', { type, required: false, technicalAlias: 'stable-budget', options: ['Gold', 'Silver'] })], values: { unrelated: 'Keep' }, files: [] };
  render(<RecordCustomFieldDetails module="contacts" recordId="record" canEdit />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Project Budget' }));
  const control = screen.getByLabelText('Project Budget');
  expect(control.tagName).toBe(type === 'Long Text' ? 'TEXTAREA' : type === 'Dropdown' ? 'SELECT' : 'INPUT');
  if (type === 'Date') expect(control.getAttribute('type')).toBe('date');
  fireEvent.change(control, { target: { value: raw } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/crm/contacts/record', { customFieldValues: { field: expected } }));
  await waitFor(() => expect(screen.queryByLabelText('Project Budget')).toBeNull());
  expect(fixture.data.values.unrelated).toBe('Keep');
  expect(fixture.data.values.field).toBe(expected);
});
it('rejects a required empty value, invalid number and overlong text without changing saved values', () => {
  fixture.data = { fields: [field('leads')], values: { field: 100 }, files: [] };
  const view = render(<RecordCustomFieldDetails module="leads" recordId="record" canEdit />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Project Budget' }));
  fireEvent.change(screen.getByLabelText('Project Budget'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('alert').textContent).toContain('required');
  fireEvent.change(screen.getByLabelText('Project Budget'), { target: { value: '-' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('alert').textContent).toContain('valid number');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fixture.data.fields = [field('leads', { type: 'Text', required: false })];
  view.rerender(<RecordCustomFieldDetails module="leads" recordId="record" canEdit />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Project Budget' }));
  fireEvent.change(screen.getByLabelText('Project Budget'), { target: { value: 'x'.repeat(1001) } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('alert').textContent).toContain('too long');
  expect(api.put).not.toHaveBeenCalled(); expect(fixture.data.values.field).toBe(100);
});
it('clears an optional number to null and keeps the blank row visible', async () => {
  fixture.data = { fields: [field('accounts', { required: false })], values: { field: 0, another: 8 }, files: [] };
  render(<RecordCustomFieldDetails module="accounts" recordId="record" canEdit />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Project Budget' }));
  fireEvent.change(screen.getByLabelText('Project Budget'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getByText('—')).toBeTruthy());
  expect(api.put).toHaveBeenCalledWith('/crm/accounts/record', { customFieldValues: { field: null } });
  expect(fixture.data.values.another).toBe(8);
});
it('preserves a failed save draft and allows retry', async () => {
  fixture.data = { fields: [field('leads')], values: { field: 1 }, files: [] };
  api.put.mockRejectedValueOnce(new Error('Connection failed. Try again.'));
  render(<RecordCustomFieldDetails module="leads" recordId="record" canEdit />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Project Budget' }));
  fireEvent.change(screen.getByLabelText('Project Budget'), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('alert'); expect((screen.getByLabelText('Project Budget') as HTMLInputElement).value).toBe('5');
  expect(fixture.data.values.field).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.getByText('5')).toBeTruthy());
});
it('retains historical dropdown choices until an explicit valid replacement', async () => {
  fixture.data = { fields: [field('leads', { type: 'Dropdown', required: false, options: ['Silver'] })], values: { field: 'Gold' }, files: [] };
  render(<RecordCustomFieldDetails module="leads" recordId="record" canEdit />);
  expect(screen.getByText('Gold')).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: 'Edit Project Budget' }));
  expect((screen.getByRole('option', { name: 'Gold (previous choice)' }) as HTMLOptionElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Save' })); expect(screen.getByRole('alert').textContent).toContain('configured option');
  expect(api.put).not.toHaveBeenCalled(); expect(fixture.data.values.field).toBe('Gold');
  fireEvent.change(screen.getByLabelText('Project Budget'), { target: { value: 'Silver' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' })); await waitFor(() => expect(fixture.data.values.field).toBe('Silver'));
});
it('shows the backend custom-field validation message without discarding the draft', async () => {
  fixture.data = { fields: [field('leads')], values: { field: 1 }, files: [] };
  api.put.mockRejectedValueOnce(Object.assign(new Error('Validation failed'), { status: 400, fieldErrors: { customFieldValues: ['Required site code: Site code is required.'] } }));
  render(<RecordCustomFieldDetails module="leads" recordId="record" canEdit />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Project Budget' }));
  fireEvent.change(screen.getByLabelText('Project Budget'), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Site code is required');
  expect((screen.getByLabelText('Project Budget') as HTMLInputElement).value).toBe('5');
  expect(fixture.data.values.field).toBe(1);
});
it('rejects empty and oversized uploads before making a request', async () => {
  fixture.data.fields = [field('accounts', { type: 'File Upload', required: false })];
  render(<RecordCustomFieldDetails module="accounts" recordId="record" canEdit />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Project Budget' }));
  const input = screen.getByLabelText('Project Budget');
  fireEvent.change(input, { target: { files: [new File([], 'empty.pdf', { type: 'application/pdf' })] } });
  expect((await screen.findByRole('alert')).textContent).toContain('nonempty');
  const oversized = new File(['test'], 'large.pdf', { type: 'application/pdf' });
  Object.defineProperty(oversized, 'size', { value: 10 * 1024 * 1024 + 1 });
  fireEvent.change(input, { target: { files: [oversized] } });
  expect((await screen.findByRole('alert')).textContent).toContain('10 MB');
  expect(api.upload).not.toHaveBeenCalled(); expect(api.put).not.toHaveBeenCalled();
});
it('keeps historical disabled/retired values read only while allowing fields visible only in Details', () => {
  fixture.data = { fields: [field('leads', { active: false }), field('leads', { id: 'retired', name: 'Retired', deletedAt: '2026-10-10', active: false }), field('leads', { id: 'empty-retired', name: 'Empty retired', deletedAt: '2026-10-10', active: false }), field('leads', { id: 'hidden-form', name: 'Hidden form', visibleInForm: false }), field('leads', { id: 'hidden-details', name: 'Hidden details', visibleInDetails: false })], values: { field: 2, retired: 3, 'hidden-form': 4, 'hidden-details': 5 }, files: [] };
  render(<RecordCustomFieldDetails module="leads" recordId="record" canEdit />);
  expect(screen.getByText('2')).toBeTruthy(); expect(screen.getByText('3')).toBeTruthy(); expect(screen.getByText('4')).toBeTruthy();
  expect(screen.queryByText('5')).toBeNull(); expect(screen.queryByText('Empty retired')).toBeNull();
  expect(screen.getAllByRole('button', { name: /^Edit/ })).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Edit Hidden form' })).toBeTruthy();
  expect(screen.getByText('Project Budget · Disabled')).toBeTruthy();
  expect(screen.getByText('Retired · Retired')).toBeTruthy();
  expect(screen.queryByText(/Hidden in forms/)).toBeNull();
});
it('excludes protected Deal evidence even with edit permission', () => {
  fixture.data.fields = [field('deals', { group: 'Closed Won Requirements', groupId: 'deals:closing-evidence' }), field('deals', { id: 'ordinary', name: 'Ordinary', required: false })];
  render(<RecordCustomFieldDetails module="deals" recordId="record" canEdit />);
  expect(screen.queryByText('Project Budget')).toBeNull(); expect(screen.getByRole('button', { name: 'Edit Ordinary' })).toBeTruthy();
});
it('keeps a draft across label/cache updates, then clears it on permission revocation', () => {
  fixture.data.fields = [field('leads')];
  const view = render(<RecordCustomFieldDetails module="leads" recordId="record" canEdit />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Project Budget' }));
  fireEvent.change(screen.getByLabelText('Project Budget'), { target: { value: '9' } });
  fixture.data.fields[0].name = 'Renamed'; fixture.data.values.field = 4;
  view.rerender(<RecordCustomFieldDetails module="leads" recordId="record" canEdit />);
  expect((screen.getByLabelText('Renamed') as HTMLInputElement).value).toBe('9');
  view.rerender(<RecordCustomFieldDetails module="leads" recordId="record" />);
  expect(screen.queryByLabelText('Renamed')).toBeNull(); expect(screen.getByText('4')).toBeTruthy();
});
it('retains readable custom values and refreshes after an assignment write denial', async () => {
  fixture.data = { fields: [field('leads')], values: { field: 99 }, files: [] };
  api.put.mockRejectedValueOnce(Object.assign(new Error('Access revoked'), { status: 403 }));
  render(<RecordCustomFieldDetails module="leads" recordId="record" canEdit />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Project Budget' })); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.refetch).toHaveBeenCalled()); expect(fixture.data.values).toEqual({ field: 99 });
});
it('uploads through the authorized record endpoint and cancel never deletes the saved file', async () => {
  const saved = 'ffed816d-5250-40d4-a116-8d5d6b5f7844', uploaded = 'afed816d-5250-40d4-a116-8d5d6b5f7844';
  fixture.data = { fields: [field('accounts', { type: 'File Upload', required: false })], values: { field: saved }, files: [{ id: saved, name: 'old.pdf', url: '/authorized/old' }] };
  api.upload.mockResolvedValue({ data: { id: uploaded, name: 'new.pdf', url: '/authorized/new' } });
  render(<RecordCustomFieldDetails module="accounts" recordId="record" canEdit />);
  expect(screen.getByRole('link', { name: 'Open file' }).getAttribute('href')).toBe('/authorized/old');
  fireEvent.click(screen.getByRole('button', { name: 'Edit Project Budget' }));
  const fileInput = screen.getByLabelText('Project Budget'); expect(fileInput.getAttribute('type')).toBe('file');
  fireEvent.change(fileInput, { target: { files: [new File(['%PDF-test'], 'new.pdf', { type: 'application/pdf' })] } });
  await waitFor(() => expect(screen.getByText('new.pdf')).toBeTruthy());
  expect(api.upload.mock.calls[0][0]).toBe('/crm/accounts/record/files?name=new.pdf&type=application%2Fpdf');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(api.put).not.toHaveBeenCalled(); expect(fixture.data.values.field).toBe(saved);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Project Budget' }));
  fireEvent.change(screen.getByLabelText('Project Budget'), { target: { files: [new File(['%PDF-test'], 'new.pdf', { type: 'application/pdf' })] } });
  await waitFor(() => expect(screen.getByText('new.pdf')).toBeTruthy()); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/crm/accounts/record', { customFieldValues: { field: uploaded } }));
});
it('keeps native required/email validation and Save/Cancel behavior after sharing the row component', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<InlineEditRows rows={[{ label: 'Email', technicalKey: 'email', value: 'old@example.test', apiField: 'email', type: 'email', required: true }]} canEdit onSave={save} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Email' })); fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bad' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' })); expect(screen.getByRole('alert')).toBeTruthy(); expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.test' } }); fireEvent.keyDown(screen.getByLabelText('Email'), { key: 'Enter' });
  await waitFor(() => expect(save).toHaveBeenCalledWith('email', 'new@example.test'));
});
