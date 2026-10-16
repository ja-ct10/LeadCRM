import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CUSTOM_FIELD_MODULES, DEFAULT_CLOSING_FIELDS, defaultFieldLayout, getCrmFieldCatalog, type ClosingField, type FieldLayout } from '@leadcrm/shared';
import { ClosingFieldsSettings } from '../closing-fields-settings';

const mocks = vi.hoisted(() => ({
  post: vi.fn(), patch: vi.fn(), delete: vi.fn(), refetch: vi.fn(), success: vi.fn(), error: vi.fn(),
  permissions: new Set<string>(), data: {} as Record<string, { definitions: ClosingField[]; layout: FieldLayout }>,
}));
vi.mock('@/lib/api/client', () => ({ apiClient: mocks }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: (permission: string) => mocks.permissions.has(permission) }));
vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: ({ params }: { params: { fieldLayout: string } }) => ({ data: mocks.data[params.fieldLayout], refetch: mocks.refetch, isInitialLoad: false, error: null }) }));
vi.mock('@/shared/components/sliding-drawer', () => ({ SlidingDrawer: ({ isOpen, title, subtitle, children }: { isOpen: boolean; title: string; subtitle?: string; children: React.ReactNode }) => isOpen ? <section aria-label={title}><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}{children}</section> : null }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));

const budget: ClosingField = { ...DEFAULT_CLOSING_FIELDS[0], id: 'lead-budget', name: 'Project Budget', type: 'Number', module: 'leads', group: 'Basic Information', groupId: 'leads:section:0', order: 100, required: false };
const contactNote: ClosingField = { ...budget, id: 'contact-note', name: 'Contact Note', type: 'Text', module: 'contacts', groupId: 'contacts:section:0' };
const customRow = () => screen.getByText(budget.name).closest('tr')!;
const drawer = (name: 'Add Field' | 'Edit Field') => within(screen.getByRole('region', { name }));
const customGroup = { id: 'lead-custom-group', label: 'Project specifics', order: 5 };
const addCustomGroupFixture = () => {
  mocks.data.leads.layout.groups.push({ ...customGroup });
  mocks.data.leads.definitions = mocks.data.leads.definitions.map(field => field.id === budget.id ? { ...field, groupId: customGroup.id, group: customGroup.label } : field);
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.permissions = new Set(['custom_fields.view', 'custom_fields.create', 'custom_fields.edit', 'custom_fields.delete', 'custom_fields.disable']);
  const definitions = [...DEFAULT_CLOSING_FIELDS, budget, contactNote];
  mocks.data = Object.fromEntries(CUSTOM_FIELD_MODULES.map(module => [module, { definitions, layout: defaultFieldLayout(module) }]));
  mocks.post.mockResolvedValue({ data: { id: 'new-id' } }); mocks.patch.mockResolvedValue({}); mocks.delete.mockResolvedValue({}); mocks.refetch.mockResolvedValue(undefined);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each(['leads', 'contacts'] as const)('projects canonical %s groups without changing saved layouts, custom groups, or technical keys', module => {
  const layout = mocks.data[module].layout;
  layout.revision = 7;
  layout.groups.reverse().forEach((group, order) => { group.order = order; });
  layout.groups.find(group => group.id === `${module}:section:1`)!.label = 'Status & Classification';
  layout.groups.find(group => group.id === `${module}:section:2`)!.label = 'Relationships';
  layout.groups.push({ id: 'custom-relationships', label: 'Relationships', order: 0 });
  const companyKey = module === 'leads' ? 'companyName' : 'company';
  layout.fields[companyKey] = { label: 'Company Name', groupId: `${module}:section:0`, order: 1, visibleInForm: false, visibleInDetails: true };
  layout.fields.assignedUserId = { label: 'Assigned Agent', groupId: `${module}:section:2`, order: 0, visibleInForm: true, visibleInDetails: true };
  mocks.data[module].definitions.push({ ...budget, module, id: 'relationship-note', name: 'Relationship Note', group: 'Relationships', groupId: 'custom-relationships' });
  const before = structuredClone(mocks.data[module]);
  render(<ClosingFieldsSettings />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Module' }), { target: { value: module } });
  const expected = [
    ['First Name', 'Basic Information'], ['Last Name', 'Basic Information'], ['Email', 'Basic Information'], ['Phone', 'Basic Information'], ['Created', 'Basic Information'],
    ['Status', 'Status & Interest'], ['Product Interest', 'Status & Interest'], ['Company Name', 'Organization'], ['Account', 'Organization'],
    [module === 'contacts' ? 'Source' : 'Lead Source', 'Additional Information'], ['Full Address', 'Additional Information'], ['Assigned Agent', 'Assigned Agent'],
    ...(module === 'contacts' ? [['Notes', 'Additional Information']] : []),
  ];
  for (const [label, group] of expected) expect(screen.getByRole('button', { name: `Edit ${label}` }).closest('tr')!.cells[5].textContent).toBe(group);
  expect(screen.queryByText('Status & Classification')).toBeNull();
  expect(within(screen.getByText('Relationship Note').closest('tr')!).getByText('Relationships')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Reorder Company Name' })).toHaveProperty('disabled', true);
  expect(screen.getByRole('button', { name: 'Reorder First Name' })).toHaveProperty('disabled', true);
  expect(screen.getByRole('button', { name: 'Reorder Assigned Agent' })).toHaveProperty('disabled', true);
  expect(screen.getByRole('button', { name: 'Reorder Status' })).toHaveProperty('disabled', false);
  expect(screen.getByRole('button', { name: 'Reorder Relationship Note' })).toHaveProperty('disabled', false);
  const canonical = ['Basic Information', 'Status & Interest', 'Organization', 'Additional Information', 'Assigned Agent', 'Relationships'];
  fireEvent.click(screen.getByRole('button', { name: 'Add Field' }));
  expect(Array.from((drawer('Add Field').getByLabelText('Group') as HTMLSelectElement).options, option => option.text)).toEqual(canonical);
  fireEvent.click(drawer('Add Field').getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit Company Name' }));
  const nativeForm = within(screen.getByRole('region', { name: 'Edit Field' }));
  expect(nativeForm.getByLabelText('Group')).toHaveProperty('value', `${module}:section:2`);
  expect(Array.from((nativeForm.getByLabelText('Group') as HTMLSelectElement).options, option => option.text)).toEqual(canonical);
  fireEvent.click(nativeForm.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit Relationship Note' }));
  expect(drawer('Edit Field').getByLabelText('Group')).toHaveProperty('value', 'custom-relationships');
  expect(mocks.data[module]).toEqual(before);
  expect(mocks.patch).not.toHaveBeenCalled(); expect(mocks.post).not.toHaveBeenCalled();
  expect(within(screen.getByRole('button', { name: 'Edit Company Name' }).closest('tr')!).getByText(companyKey)).toBeTruthy();
});

it('keeps canonical labels after an optimistic server response and resolves a legacy custom-field group without an ID', async () => {
  const layout = mocks.data.contacts.layout;
  layout.groups[1].label = 'Status & Classification'; layout.groups[2].label = 'Relationships';
  mocks.data.contacts.definitions.push({ ...contactNote, id: 'legacy', name: 'Legacy relationship note', group: 'Relationships', groupId: undefined });
  render(<ClosingFieldsSettings />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Module' }), { target: { value: 'contacts' } });
  fireEvent.click(screen.getByRole('button', { name: 'Edit Legacy relationship note' }));
  expect(drawer('Edit Field').getByLabelText('Group')).toHaveProperty('value', 'contacts:section:2');
  fireEvent.click(drawer('Edit Field').getByRole('button', { name: 'Cancel' }));
  const responseLayout = { ...layout, revision: 1 };
  mocks.patch.mockResolvedValueOnce({ data: { layout: responseLayout, fields: getCrmFieldCatalog('contacts', mocks.data.contacts.definitions, responseLayout) } });
  fireEvent.click(screen.getByLabelText('Show in Details: Phone'));
  await waitFor(() => expect(mocks.refetch).toHaveBeenCalled());
  expect(within(screen.getByRole('button', { name: 'Edit Status' }).closest('tr')!).getByText('Status & Interest')).toBeTruthy();
  expect(within(screen.getByRole('button', { name: 'Edit Legacy relationship note' }).closest('tr')!).getByText('Organization')).toBeTruthy();
  expect(mocks.patch).toHaveBeenCalledWith('/administration/closing-requirements/layout/contacts', { action: 'field', technicalKey: 'phone', visibleInDetails: false, expectedRevision: 0 });
});

it('shows a compact searchable catalog with the four modules and System/Custom identity', () => {
  render(<ClosingFieldsSettings />);
  expect(screen.getByRole('heading', { name: 'Customize Fields' })).toBeTruthy();
  expect(Array.from((screen.getByRole('combobox', { name: 'Module' }) as HTMLSelectElement).options, option => option.value)).toEqual([...CUSTOM_FIELD_MODULES]);
  expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual(['Drag', 'Label', 'System/Custom', 'Type', 'Technical variable key', 'Group', 'Required', 'Show in Forms', 'Show in Details', 'Actions']);
  expect(within(customRow()).getByText('Custom')).toBeTruthy();
  expect(within(screen.getByText('First Name').closest('tr')!).getByText('System')).toBeTruthy();
  expect(screen.queryByText('Deal Stage Automation')).toBeNull();
  expect(mocks.patch).not.toHaveBeenCalled();
});

it('searches labels, immutable keys and section names within the selected module', () => {
  render(<ClosingFieldsSettings />);
  const search = screen.getByLabelText('Search fields');
  fireEvent.change(search, { target: { value: 'customFieldValues.lead-budget' } });
  expect(screen.getByText(budget.name)).toBeTruthy(); expect(screen.queryByText('First Name')).toBeNull();
  fireEvent.change(search, { target: { value: 'status & interest' } });
  expect(screen.getByText('Status')).toBeTruthy(); expect(screen.queryByText(budget.name)).toBeNull();
  fireEvent.change(search, { target: { value: '' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Module' }), { target: { value: 'contacts' } });
  expect(screen.getByText(contactNote.name)).toBeTruthy(); expect(screen.queryByText(budget.name)).toBeNull();
  fireEvent.change(search, { target: { value: 'missing-field' } });
  expect(screen.getByText('No fields match your search.')).toBeTruthy();
});

it('edits the original custom ID and starts a clean create form without publishing public Forms', async () => {
  render(<ClosingFieldsSettings />);
  fireEvent.click(within(customRow()).getByRole('button', { name: 'Edit Project Budget' }));
  expect((drawer('Edit Field').getByLabelText('Type') as HTMLSelectElement).disabled).toBe(true);
  expect(drawer('Edit Field').queryByText('Complete the field details below.')).toBeNull();
  fireEvent.change(drawer('Edit Field').getByRole('textbox', { name: 'Display label' }), { target: { value: 'Project value' } });
  fireEvent.click(drawer('Edit Field').getByRole('button', { name: 'Save field' }));
  await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith(`/administration/closing-requirements/${budget.id}`, expect.objectContaining({ name: 'Project value', module: 'leads', type: 'Number' })));
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Edit Field' })).toBeNull());
  expect(mocks.patch.mock.calls).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Add Field' }));
  expect((drawer('Add Field').getByRole('textbox', { name: 'Display label' }) as HTMLInputElement).value).toBe('');
  expect((drawer('Add Field').getByLabelText('Type') as HTMLSelectElement).value).toBe('Text');
  expect((drawer('Add Field').getByLabelText('Required') as HTMLInputElement).checked).toBe(false);
  fireEvent.click(drawer('Add Field').getByRole('button', { name: 'Save field' }));
  expect(mocks.post).not.toHaveBeenCalled();
  expect(drawer('Add Field').getByRole('alert')).toBeTruthy();
  fireEvent.change(drawer('Add Field').getByRole('textbox', { name: 'Display label' }), { target: { value: 'A new field' } });
  fireEvent.click(drawer('Add Field').getByRole('button', { name: 'Save field' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/administration/closing-requirements', expect.objectContaining({ name: 'A new field', options: [], required: false })));
  expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('id');
  expect(mocks.success).toHaveBeenCalledWith('Field created');
  expect(mocks.refetch).toHaveBeenCalledTimes(2);
});

it('shows the create subtitle, a visual required indicator and an adjacent primary group action', () => {
  render(<ClosingFieldsSettings />);
  fireEvent.click(screen.getByRole('button', { name: 'Add Field' }));
  const form = drawer('Add Field');
  expect(form.getByText('Complete the field details below.')).toBeTruthy();
  const input = form.getByRole('textbox', { name: 'Display label' }) as HTMLInputElement;
  expect(input.required).toBe(true);
  const asterisk = within(input.closest('label')!).getByText('*');
  expect(asterisk.classList.contains('text-red-500')).toBe(true);
  expect(asterisk.getAttribute('aria-hidden')).toBe('true');
  expect(form.getAllByText('*')).toHaveLength(1);
  const group = form.getByRole('combobox', { name: 'Group' });
  const add = form.getByRole('button', { name: 'Add' });
  expect(group.parentElement).toBe(add.parentElement);
  expect(group.parentElement?.classList.contains('flex')).toBe(true);
  expect(group.classList.contains('flex-1')).toBe(true);
  expect(add.style.backgroundColor).toBe('var(--primary)');
  expect(form.queryByLabelText('Add a new group name')).toBeNull();
  expect(form.queryByRole('button', { name: 'Add Group' })).toBeNull();
  fireEvent.click(add);
  expect(form.getByLabelText('Add a new group name')).toBe(form.getByPlaceholderText('New group name'));
  const create = form.getByRole('button', { name: 'Add group' });
  expect(create.textContent).toBe('');
  expect(create.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  expect(create.style.backgroundColor).toBe('var(--primary)');
  expect(create).toHaveProperty('disabled', true);
  expect(form.queryByRole('button', { name: 'Add and select' })).toBeNull();
});

it('adds and selects a persisted same-module group while preserving the unfinished field draft', async () => {
  render(<ClosingFieldsSettings />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Module' }), { target: { value: 'contacts' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Field' }));
  fireEvent.change(drawer('Add Field').getByRole('textbox', { name: 'Display label' }), { target: { value: 'Preferred tier' } });
  fireEvent.change(drawer('Add Field').getByLabelText('Type'), { target: { value: 'Dropdown' } });
  fireEvent.change(drawer('Add Field').getByLabelText('Options, one per line'), { target: { value: 'Gold\nSilver' } });
  fireEvent.change(drawer('Add Field').getByLabelText('Description'), { target: { value: 'Keep this draft' } });
  fireEvent.click(drawer('Add Field').getByLabelText('Required'));
  fireEvent.click(drawer('Add Field').getByRole('button', { name: 'Add' }));
  const layout = defaultFieldLayout('contacts'), group = { id: 'persisted-contact-group', label: 'Site information', order: layout.groups.length };
  mocks.patch.mockResolvedValueOnce({ data: { layout: { ...layout, revision: 1, groups: [...layout.groups, group] }, fields: [] } });
  fireEvent.change(drawer('Add Field').getByLabelText('Add a new group name'), { target: { value: ' Site information ' } });
  fireEvent.click(drawer('Add Field').getByRole('button', { name: 'Add group' }));
  await waitFor(() => expect((drawer('Add Field').getByLabelText('Group') as HTMLSelectElement).value).toBe(group.id));
  expect(mocks.patch).toHaveBeenCalledWith('/administration/closing-requirements/layout/contacts', { action: 'add', label: ' Site information ', expectedRevision: 0 });
  expect((drawer('Add Field').getByRole('textbox', { name: 'Display label' }) as HTMLInputElement).value).toBe('Preferred tier');
  expect((drawer('Add Field').getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Keep this draft');
  expect((drawer('Add Field').getByLabelText('Options, one per line') as HTMLTextAreaElement).value).toBe('Gold\nSilver');
  expect((drawer('Add Field').getByLabelText('Required') as HTMLInputElement).checked).toBe(true);
  expect(drawer('Add Field').queryByLabelText('Module')).toBeNull();
  expect(drawer('Add Field').queryByLabelText('Add a new group name')).toBeNull();
  fireEvent.click(drawer('Add Field').getByRole('button', { name: 'Add' }));
  expect(drawer('Add Field').getByLabelText('Add a new group name')).toHaveProperty('value', '');
  fireEvent.click(drawer('Add Field').getByRole('button', { name: 'Save field' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/administration/closing-requirements', expect.objectContaining({ name: 'Preferred tier', module: 'contacts', groupId: group.id, group: group.label, type: 'Dropdown', options: ['Gold', 'Silver'], required: true, expectedRevision: 1 })));
});

it('cancels and clears the temporary group name without discarding the field draft or making a request', () => {
  render(<ClosingFieldsSettings />);
  fireEvent.click(screen.getByRole('button', { name: 'Add Field' }));
  const form = drawer('Add Field');
  fireEvent.change(form.getByRole('textbox', { name: 'Display label' }), { target: { value: 'Keep this draft' } });
  const selected = (form.getByLabelText('Group') as HTMLSelectElement).value;
  fireEvent.click(form.getByRole('button', { name: 'Add' }));
  const input = form.getByLabelText('Add a new group name');
  fireEvent.change(input, { target: { value: 'Canceled group' } });
  const cancel = within(input.parentElement!).getByRole('button', { name: 'Cancel' });
  expect(cancel.getAttribute('title')).toBe('Cancel');
  const icon = cancel.querySelector('svg')!;
  expect(icon.getAttribute('aria-hidden')).toBe('true');
  expect(icon.classList.contains('text-destructive')).toBe(true);
  expect(icon.classList.contains('sm:hidden')).toBe(true);
  expect(within(cancel).getByText('Cancel').className).toBe('hidden sm:inline');
  fireEvent.click(cancel);
  expect(form.queryByLabelText('Add a new group name')).toBeNull();
  expect(form.getByRole('textbox', { name: 'Display label' })).toHaveProperty('value', 'Keep this draft');
  expect(form.getByLabelText('Group')).toHaveProperty('value', selected);
  expect(mocks.patch).not.toHaveBeenCalled(); expect(mocks.post).not.toHaveBeenCalled();
  fireEvent.click(form.getByRole('button', { name: 'Add' }));
  expect(form.getByLabelText('Add a new group name')).toHaveProperty('value', '');
});

it('preserves inline group errors and disables duplicate creation while the existing request is pending', async () => {
  mocks.patch.mockRejectedValueOnce(new Error('Field configuration changed. Refresh and retry your change.'));
  render(<ClosingFieldsSettings />);
  fireEvent.click(screen.getByRole('button', { name: 'Add Field' }));
  const form = drawer('Add Field');
  fireEvent.click(form.getByRole('button', { name: 'Add' }));
  const input = form.getByLabelText('Add a new group name');
  const create = form.getByRole('button', { name: 'Add group' });
  fireEvent.change(input, { target: { value: '   ' } });
  expect(create).toHaveProperty('disabled', true);
  fireEvent.change(input, { target: { value: 'Project group' } });
  fireEvent.click(create);
  expect(await form.findByRole('alert')).toHaveProperty('textContent', 'Field configuration changed. Refresh and retry your change.');
  expect(input).toHaveProperty('value', 'Project group');
  expect(form.getByLabelText('Group')).toHaveProperty('value', 'leads:section:0');
  let resolve!: (value: unknown) => void;
  mocks.patch.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  fireEvent.click(create); fireEvent.click(create);
  expect(create).toHaveProperty('disabled', true);
  expect(input).toHaveProperty('disabled', true);
  expect(within(input.parentElement!).getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', true);
  expect(mocks.patch).toHaveBeenCalledTimes(2);
  const layout = mocks.data.leads.layout;
  resolve({ data: { layout: { ...layout, revision: 1, groups: [...layout.groups, customGroup] }, fields: [] } });
  await waitFor(() => expect(form.getByLabelText('Group')).toHaveProperty('value', customGroup.id));
  expect(form.queryByRole('alert')).toBeNull();
  expect(form.queryByLabelText('Add a new group name')).toBeNull();
});

it('inherits module groups and discards a canceled field draft', () => {
  render(<ClosingFieldsSettings />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Module' }), { target: { value: 'contacts' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Field' }));
  expect(Array.from((drawer('Add Field').getByLabelText('Group') as HTMLSelectElement).options, option => option.value)).toEqual(defaultFieldLayout('contacts').groups.map(group => group.id));
  fireEvent.change(drawer('Add Field').getByRole('textbox', { name: 'Display label' }), { target: { value: 'Unsaved draft' } });
  fireEvent.click(drawer('Add Field').getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Field' }));
  expect((drawer('Add Field').getByRole('textbox', { name: 'Display label' }) as HTMLInputElement).value).toBe('');
});

it('keeps Details visibility independent while mandatory native form inputs remain available', async () => {
  render(<ClosingFieldsSettings />);
  expect((screen.getByLabelText('Show in Forms: First Name') as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText(`Show in Details: ${budget.name}`));
  await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('/administration/closing-requirements/layout/leads', { action: 'field', technicalKey: `customFieldValues.${budget.id}`, visibleInDetails: false, expectedRevision: 0 }));
  expect((screen.getByLabelText(`Show in Forms: ${budget.name}`) as HTMLInputElement).checked).toBe(true);
  await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByLabelText('Show in Details: First Name'));
  await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('/administration/closing-requirements/layout/leads', { action: 'field', technicalKey: 'firstName', visibleInDetails: false, expectedRevision: 0 }));
});

it('uses distinct create, edit and delete permissions for native and custom actions', () => {
  mocks.permissions.delete('custom_fields.create'); mocks.permissions.delete('custom_fields.delete');
  const view = render(<ClosingFieldsSettings />);
  expect(screen.queryByRole('button', { name: 'Add Field' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Manage Field Groups' })).toBeTruthy();
  expect(within(customRow()).getByRole('button', { name: 'Edit Project Budget' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Delete field' })).toBeNull();
  mocks.permissions.delete('custom_fields.edit'); view.rerender(<ClosingFieldsSettings />);
  expect(screen.queryByRole('button', { name: 'Manage Field Groups' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Edit Project Budget' })).toBeNull();
  expect((screen.getByLabelText(`Show in Details: ${budget.name}`) as HTMLInputElement).disabled).toBe(true);
});

it('offers deletion only for Custom definitions and submits the immutable ID after confirmation', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<ClosingFieldsSettings />);
  expect(within(screen.getByText('First Name').closest('tr')!).queryByRole('button', { name: 'Delete field' })).toBeNull();
  fireEvent.click(within(customRow()).getByRole('button', { name: 'Delete field' }));
  const dialog = within(screen.getByRole('alertdialog', { name: 'Delete custom field?' }));
  expect(dialog.getByText(`Delete “${budget.name}” from the current configuration?`)).toBeTruthy();
  expect(dialog.getByText('Historical values and evidence will be retained.')).toBeTruthy();
  expect(mocks.delete).not.toHaveBeenCalled();
  fireEvent.click(dialog.getByRole('button', { name: 'Delete field' }));
  await waitFor(() => expect(mocks.delete).toHaveBeenCalledExactlyOnceWith(`/administration/closing-requirements/${budget.id}`));
  expect(confirm).not.toHaveBeenCalled();
  await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Field deleted'));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(mocks.refetch).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole('combobox', { name: 'Module' }), { target: { value: 'deals' } });
  for (const field of DEFAULT_CLOSING_FIELDS) expect(within(screen.getByText(field.name).closest('tr')!).queryByRole('button', { name: 'Delete field' })).toBeNull();
});

it('reports actionable dependency errors without treating a failed deletion as success', async () => {
  mocks.delete.mockRejectedValueOnce(new Error('Referenced by Workflow: Budget routing'));
  render(<ClosingFieldsSettings />);
  fireEvent.click(within(customRow()).getByRole('button', { name: 'Delete field' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete field' }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Referenced by Workflow: Budget routing'));
  expect(mocks.success).not.toHaveBeenCalled(); expect(mocks.refetch).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(screen.getByText(budget.name)).toBeTruthy();
});

it.each(['Cancel', 'Close confirmation', 'Escape', 'backdrop'])('dismisses field deletion with %s without changing configuration', method => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<ClosingFieldsSettings />);
  const remove = within(customRow()).getByRole('button', { name: 'Delete field' });
  remove.focus(); fireEvent.click(remove);
  if (method === 'Escape') fireEvent.keyDown(document, { key: 'Escape' });
  else if (method === 'backdrop') fireEvent.click(document.querySelector('[data-confirm-action-layer] > [aria-hidden]')!);
  else fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: method }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(document.activeElement).toBe(remove);
  expect(mocks.delete).not.toHaveBeenCalled();
  expect(mocks.refetch).not.toHaveBeenCalled();
  expect(mocks.success).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
});

it('disables row and confirmation actions while a confirmed deletion is pending', async () => {
  let resolve!: (value: unknown) => void;
  mocks.delete.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  render(<ClosingFieldsSettings />);
  const remove = within(customRow()).getByRole('button', { name: 'Delete field' }) as HTMLButtonElement;
  expect(remove.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  expect(remove.textContent).toBe('');
  fireEvent.click(remove);
  expect(mocks.delete).not.toHaveBeenCalled();
  const dialog = within(screen.getByRole('alertdialog'));
  const confirm = dialog.getByRole('button', { name: 'Delete field' });
  fireEvent.click(confirm); fireEvent.click(confirm);
  expect(remove.disabled).toBe(true);
  expect((within(customRow()).getByRole('button', { name: 'Edit Project Budget', hidden: true }) as HTMLButtonElement).disabled).toBe(true);
  expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', true);
  expect(dialog.getByRole('button', { name: 'Close confirmation' })).toHaveProperty('disabled', true);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  fireEvent.click(remove);
  expect(mocks.delete).toHaveBeenCalledTimes(1);
  resolve({});
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  await waitFor(() => expect(remove.disabled).toBe(false));
  expect(mocks.success).toHaveBeenCalledWith('Field deleted');
});

it('shows compact group cards and requests a destination only when deleting a populated group', async () => {
  addCustomGroupFixture();
  render(<ClosingFieldsSettings />);
  fireEvent.click(screen.getByRole('button', { name: 'Manage Field Groups' }));
  const groups = within(screen.getByRole('dialog', { name: 'Manage Fields Groups' }));
  expect(groups.getByRole('heading', { name: 'Manage Fields Groups' })).toBeTruthy();
  expect(groups.getByText('6 groups')).toBeTruthy();
  expect(groups.queryByLabelText('Move fields to')).toBeNull();
  expect(groups.getByRole('button', { name: 'Reorder Basic Information group' })).toBeTruthy();
  fireEvent.click(groups.getByRole('button', { name: 'Rename Basic Information' }));
  expect((groups.getByLabelText('Group label: Basic Information') as HTMLInputElement).value).toBe('Basic Information');
  fireEvent.click(groups.getByRole('button', { name: 'Cancel' }));
  expect(groups.queryByRole('button', { name: 'Delete Basic Information group' })).toBeNull();
  const remove = groups.getByRole('button', { name: `Delete ${customGroup.label} group` });
  for (const style of ['h-11', 'w-11', 'text-destructive', 'dark:text-destructive', 'hover:text-destructive', 'dark:hover:text-destructive']) expect(remove.classList.contains(style)).toBe(true);
  expect(remove.getAttribute('title')).toBe(`Delete ${customGroup.label} group`);
  fireEvent.click(remove);
  const confirmation = within(screen.getByRole('dialog', { name: 'Delete field group' }));
  expect((confirmation.getByRole('button', { name: 'Delete group' }) as HTMLButtonElement).disabled).toBe(true);
  const destination = defaultFieldLayout('leads').groups[1].id;
  fireEvent.change(confirmation.getByLabelText('Move fields to'), { target: { value: destination } });
  fireEvent.click(confirmation.getByRole('button', { name: 'Delete group' }));
  await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('/administration/closing-requirements/layout/leads', { action: 'delete', groupId: customGroup.id, moveToGroupId: destination, expectedRevision: 0 }));
});

it.each(CUSTOM_FIELD_MODULES)('hides deletion for every System-containing group in %s while retaining rename and reorder controls', module => {
  render(<ClosingFieldsSettings />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Module' }), { target: { value: module } });
  fireEvent.change(screen.getByLabelText('Search fields'), { target: { value: 'no matching fields' } });
  fireEvent.click(screen.getByRole('button', { name: 'Manage Field Groups' }));
  const groups = within(screen.getByRole('dialog', { name: 'Manage Fields Groups' }));
  const { definitions, layout } = mocks.data[module], catalog = getCrmFieldCatalog(module, definitions, layout);
  const protectedGroups = layout.groups.filter(group => catalog.some(field => field.groupId === group.id && field.kind === 'System'));
  expect(groups.getAllByText('Contains system fields and cannot be deleted.')).toHaveLength(protectedGroups.length);
  for (const group of protectedGroups) {
    expect(groups.queryByRole('button', { name: `Delete ${group.label} group` })).toBeNull();
    expect(groups.getByRole('button', { name: `Rename ${group.label}` })).toHaveProperty('disabled', false);
    expect(groups.getByRole('button', { name: `Reorder ${group.label} group` })).toHaveProperty('disabled', false);
  }
  if (module === 'deals') expect(groups.getByText(/Protected closing evidence/)).toBeTruthy();
});

it('protects a user-created group containing a hidden System field', () => {
  addCustomGroupFixture();
  mocks.data.leads.layout.fields.email = { label: 'Work email', groupId: customGroup.id, order: 0, visibleInForm: true, visibleInDetails: false };
  render(<ClosingFieldsSettings />);
  fireEvent.click(screen.getByRole('button', { name: 'Manage Field Groups' }));
  const groups = within(screen.getByRole('dialog', { name: 'Manage Fields Groups' }));
  expect(groups.queryByRole('button', { name: `Delete ${customGroup.label} group` })).toBeNull();
  const card = groups.getByText(customGroup.label).parentElement!;
  expect(within(card).getByText('Contains system fields and cannot be deleted.')).toBeTruthy();
});

it('creates a group from the labeled management form and clears its input after success', async () => {
  render(<ClosingFieldsSettings />);
  fireEvent.click(screen.getByRole('button', { name: 'Manage Field Groups' }));
  const groups = within(screen.getByRole('dialog', { name: 'Manage Fields Groups' }));
  const input = groups.getByLabelText('Add a new group name');
  expect(input.getAttribute('placeholder')).toBe('New group name');
  expect(groups.getByRole('button', { name: 'Add' }).style.backgroundColor).toBe('var(--primary)');
  const layout = mocks.data.leads.layout;
  mocks.patch.mockResolvedValueOnce({ data: { layout: { ...layout, revision: 1, groups: [...layout.groups, customGroup] }, fields: [] } });
  fireEvent.change(input, { target: { value: customGroup.label } });
  fireEvent.click(groups.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(input).toHaveProperty('value', ''));
  expect(mocks.patch).toHaveBeenCalledWith('/administration/closing-requirements/layout/leads', { action: 'add', label: customGroup.label, expectedRevision: 0 });
  expect(groups.getByText(customGroup.label)).toBeTruthy();
});

it('disables field sorting while searching and preserves failed group additions', async () => {
  mocks.patch.mockRejectedValueOnce(new Error('Duplicate group name'));
  render(<ClosingFieldsSettings />);
  fireEvent.change(screen.getByLabelText('Search fields'), { target: { value: 'budget' } });
  expect((screen.getByRole('button', { name: 'Reorder Project Budget' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('Clear search to reorder fields within their group.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Manage Field Groups' }));
  const groups = within(screen.getByRole('dialog', { name: 'Manage Fields Groups' }));
  fireEvent.change(groups.getByLabelText('Add a new group name'), { target: { value: 'Basic Information' } });
  fireEvent.click(groups.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Duplicate group name'));
  expect((groups.getByLabelText('Add a new group name') as HTMLInputElement).value).toBe('Basic Information');
});

it('synchronizes the modal module and enforces the separate group delete permission', () => {
  addCustomGroupFixture();
  mocks.permissions.delete('custom_fields.delete');
  render(<ClosingFieldsSettings />);
  fireEvent.click(screen.getByRole('button', { name: 'Manage Field Groups' }));
  const groups = within(screen.getByRole('dialog', { name: 'Manage Fields Groups' }));
  expect(groups.queryByRole('button', { name: 'Delete Basic Information group' })).toBeNull();
  expect(groups.queryByRole('button', { name: `Delete ${customGroup.label} group` })).toBeNull();
  fireEvent.change(groups.getByLabelText('Field groups module'), { target: { value: 'contacts' } });
  expect((screen.getByRole('combobox', { name: 'Module' }) as HTMLSelectElement).value).toBe('contacts');
  expect(screen.getByText('Contact Note')).toBeTruthy();
  expect(screen.queryByText(budget.name)).toBeNull();
});
