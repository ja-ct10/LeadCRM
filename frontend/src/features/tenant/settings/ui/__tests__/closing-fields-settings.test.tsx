import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CUSTOM_FIELD_MODULES, DEFAULT_CLOSING_FIELDS, defaultFieldLayout, type ClosingField, type FieldLayout } from '@leadcrm/shared';
import { ClosingFieldsSettings } from '../closing-fields-settings';

const mocks = vi.hoisted(() => ({
  post: vi.fn(), patch: vi.fn(), delete: vi.fn(), refetch: vi.fn(), success: vi.fn(), error: vi.fn(),
  permissions: new Set<string>(), data: {} as Record<string, { definitions: ClosingField[]; layout: FieldLayout }>,
}));
vi.mock('@/lib/api/client', () => ({ apiClient: mocks }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: (permission: string) => mocks.permissions.has(permission) }));
vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: ({ params }: { params: { fieldLayout: string } }) => ({ data: mocks.data[params.fieldLayout], refetch: mocks.refetch, isInitialLoad: false, error: null }) }));
vi.mock('@/shared/components/sliding-drawer', () => ({ SlidingDrawer: ({ isOpen, title, children }: { isOpen: boolean; title: string; children: React.ReactNode }) => isOpen ? <section aria-label={title}><h2>{title}</h2>{children}</section> : null }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));

const budget: ClosingField = { ...DEFAULT_CLOSING_FIELDS[0], id: 'lead-budget', name: 'Project Budget', type: 'Number', module: 'leads', group: 'Basic Information', groupId: 'leads:section:0', order: 100, required: false };
const contactNote: ClosingField = { ...budget, id: 'contact-note', name: 'Contact Note', type: 'Text', module: 'contacts', groupId: 'contacts:section:0' };
const customRow = () => screen.getByText(budget.name).closest('tr')!;
const drawer = (name: 'Add Field' | 'Edit Field') => within(screen.getByRole('region', { name }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.permissions = new Set(['custom_fields.view', 'custom_fields.create', 'custom_fields.edit', 'custom_fields.delete', 'custom_fields.disable']);
  const definitions = [...DEFAULT_CLOSING_FIELDS, budget, contactNote];
  mocks.data = Object.fromEntries(CUSTOM_FIELD_MODULES.map(module => [module, { definitions, layout: defaultFieldLayout(module) }]));
  mocks.post.mockResolvedValue({ data: { id: 'new-id' } }); mocks.patch.mockResolvedValue({}); mocks.delete.mockResolvedValue({}); mocks.refetch.mockResolvedValue(undefined);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

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
  fireEvent.change(drawer('Edit Field').getByLabelText('Display label'), { target: { value: 'Project value' } });
  fireEvent.click(drawer('Edit Field').getByRole('button', { name: 'Save field' }));
  await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith(`/administration/closing-requirements/${budget.id}`, expect.objectContaining({ name: 'Project value', module: 'leads', type: 'Number' })));
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Edit Field' })).toBeNull());
  expect(mocks.patch.mock.calls).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Add Field' }));
  expect((drawer('Add Field').getByLabelText('Display label') as HTMLInputElement).value).toBe('');
  expect((drawer('Add Field').getByLabelText('Type') as HTMLSelectElement).value).toBe('Text');
  expect((drawer('Add Field').getByLabelText('Required') as HTMLInputElement).checked).toBe(false);
  fireEvent.click(drawer('Add Field').getByRole('button', { name: 'Save field' }));
  expect(mocks.post).not.toHaveBeenCalled();
  expect(drawer('Add Field').getByRole('alert')).toBeTruthy();
  fireEvent.change(drawer('Add Field').getByLabelText('Display label'), { target: { value: 'A new field' } });
  fireEvent.click(drawer('Add Field').getByRole('button', { name: 'Save field' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/administration/closing-requirements', expect.objectContaining({ name: 'A new field', options: [], required: false })));
  expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('id');
  expect(mocks.success).toHaveBeenCalledWith('Field created');
  expect(mocks.refetch).toHaveBeenCalledTimes(2);
});

it('adds and selects a persisted same-module group while preserving the unfinished field draft', async () => {
  render(<ClosingFieldsSettings />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Module' }), { target: { value: 'contacts' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Field' }));
  fireEvent.change(drawer('Add Field').getByLabelText('Display label'), { target: { value: 'Preferred tier' } });
  fireEvent.change(drawer('Add Field').getByLabelText('Type'), { target: { value: 'Dropdown' } });
  fireEvent.change(drawer('Add Field').getByLabelText('Options, one per line'), { target: { value: 'Gold\nSilver' } });
  fireEvent.change(drawer('Add Field').getByLabelText('Description'), { target: { value: 'Keep this draft' } });
  fireEvent.click(drawer('Add Field').getByLabelText('Required'));
  fireEvent.click(drawer('Add Field').getByRole('button', { name: 'Add Group' }));
  const layout = defaultFieldLayout('contacts'), group = { id: 'persisted-contact-group', label: 'Site information', order: layout.groups.length };
  mocks.patch.mockResolvedValueOnce({ data: { layout: { ...layout, groups: [...layout.groups, group] }, fields: [] } });
  fireEvent.change(drawer('Add Field').getByLabelText('New field group name'), { target: { value: ' Site information ' } });
  fireEvent.click(drawer('Add Field').getByRole('button', { name: 'Add and select' }));
  await waitFor(() => expect((drawer('Add Field').getByLabelText('Group') as HTMLSelectElement).value).toBe(group.id));
  expect(mocks.patch).toHaveBeenCalledWith('/administration/closing-requirements/layout/contacts', { action: 'add', label: ' Site information ', expectedRevision: 0 });
  expect((drawer('Add Field').getByLabelText('Display label') as HTMLInputElement).value).toBe('Preferred tier');
  expect((drawer('Add Field').getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Keep this draft');
  expect((drawer('Add Field').getByLabelText('Options, one per line') as HTMLTextAreaElement).value).toBe('Gold\nSilver');
  expect((drawer('Add Field').getByLabelText('Required') as HTMLInputElement).checked).toBe(true);
  expect(drawer('Add Field').queryByLabelText('Module')).toBeNull();
  fireEvent.click(drawer('Add Field').getByRole('button', { name: 'Save field' }));
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/administration/closing-requirements', expect.objectContaining({ name: 'Preferred tier', module: 'contacts', groupId: group.id, group: group.label, type: 'Dropdown', options: ['Gold', 'Silver'], required: true })));
});

it('inherits module groups and discards a canceled field draft', () => {
  render(<ClosingFieldsSettings />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Module' }), { target: { value: 'contacts' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Field' }));
  expect(Array.from((drawer('Add Field').getByLabelText('Group') as HTMLSelectElement).options, option => option.value)).toEqual(defaultFieldLayout('contacts').groups.map(group => group.id));
  fireEvent.change(drawer('Add Field').getByLabelText('Display label'), { target: { value: 'Unsaved draft' } });
  fireEvent.click(drawer('Add Field').getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Field' }));
  expect((drawer('Add Field').getByLabelText('Display label') as HTMLInputElement).value).toBe('');
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
  render(<ClosingFieldsSettings />);
  fireEvent.click(screen.getByRole('button', { name: 'Manage Field Groups' }));
  const groups = within(screen.getByRole('dialog', { name: 'Manage Fields Groups' }));
  expect(groups.getByRole('heading', { name: 'Manage Fields Groups' })).toBeTruthy();
  expect(groups.getByText('5 groups')).toBeTruthy();
  expect(groups.queryByLabelText('Move fields to')).toBeNull();
  expect(groups.getByRole('button', { name: 'Reorder Basic Information group' })).toBeTruthy();
  fireEvent.click(groups.getByRole('button', { name: 'Rename Basic Information' }));
  expect((groups.getByLabelText('Group label: Basic Information') as HTMLInputElement).value).toBe('Basic Information');
  fireEvent.click(groups.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(groups.getByRole('button', { name: 'Delete Basic Information group' }));
  const confirmation = within(screen.getByRole('dialog', { name: 'Delete field group' }));
  expect((confirmation.getByRole('button', { name: 'Delete group' }) as HTMLButtonElement).disabled).toBe(true);
  const destination = defaultFieldLayout('leads').groups[1].id;
  fireEvent.change(confirmation.getByLabelText('Move fields to'), { target: { value: destination } });
  fireEvent.click(confirmation.getByRole('button', { name: 'Delete group' }));
  await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('/administration/closing-requirements/layout/leads', { action: 'delete', groupId: 'leads:section:0', moveToGroupId: destination, expectedRevision: 0 }));
});

it('disables field sorting while searching and preserves failed group additions', async () => {
  mocks.patch.mockRejectedValueOnce(new Error('Duplicate group name'));
  render(<ClosingFieldsSettings />);
  fireEvent.change(screen.getByLabelText('Search fields'), { target: { value: 'budget' } });
  expect((screen.getByRole('button', { name: 'Reorder Project Budget' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('Clear search to reorder fields within their group.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Manage Field Groups' }));
  const groups = within(screen.getByRole('dialog', { name: 'Manage Fields Groups' }));
  fireEvent.change(groups.getByLabelText('New group name'), { target: { value: 'Basic Information' } });
  fireEvent.click(groups.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Duplicate group name'));
  expect((groups.getByLabelText('New group name') as HTMLInputElement).value).toBe('Basic Information');
});

it('synchronizes the modal module and enforces the separate group delete permission', () => {
  mocks.permissions.delete('custom_fields.delete');
  render(<ClosingFieldsSettings />);
  fireEvent.click(screen.getByRole('button', { name: 'Manage Field Groups' }));
  const groups = within(screen.getByRole('dialog', { name: 'Manage Fields Groups' }));
  expect(groups.queryByRole('button', { name: 'Delete Basic Information group' })).toBeNull();
  fireEvent.change(groups.getByLabelText('Field groups module'), { target: { value: 'contacts' } });
  expect((screen.getByRole('combobox', { name: 'Module' }) as HTMLSelectElement).value).toBe('contacts');
  expect(screen.getByText('Contact Note')).toBeTruthy();
  expect(screen.queryByText(budget.name)).toBeNull();
});
