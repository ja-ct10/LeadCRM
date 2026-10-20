import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GroupsSubTab } from '../team-management-groups';
import type { TenantGroup } from '@leadcrm/shared';
const mocks = vi.hoisted(() => ({ getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), addMember: vi.fn(), addMembers: vi.fn(), removeMember: vi.fn(), setHead: vi.fn(), success: vi.fn(), error: vi.fn(), role: 'Client Admin' }));
vi.mock('@/shared/services/groups.api', () => ({ groupsApi: mocks }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role }, userCan: () => true }) }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('sonner', () => ({ toast: mocks }));
const user = { id: 'julie', firstName: 'Julie Ann', lastName: 'Tiron', email: 'julie@example.com', role: 'Sales Marketing', status: 'ACTIVE', avatarUrl: null };
const group = (members = true): TenantGroup => ({ id: 'sales', tenantId: 'tenant', name: 'Sales', createdAt: '', updatedAt: '', members: members ? [{ id: 'membership', userId: user.id, isHead: false, canBeHead: false, user }] : [] });
const mount = () => render(<GroupsSubTab tenantUsers={[user] as never} />);
const openGroup = async () => { fireEvent.click(await screen.findByRole('button', { name: 'Open Sales' })); };
beforeEach(() => { vi.resetAllMocks(); mocks.role = 'Client Admin'; mocks.getAll.mockResolvedValue({ data: [group()] }); mocks.remove.mockResolvedValue(undefined); mocks.removeMember.mockResolvedValue(undefined); mocks.addMembers.mockResolvedValue({ data: group() }); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('uses initial skeletons, searches groups and retains rows during background refresh', async () => {
  let resolve!: (value: unknown) => void; mocks.getAll.mockReturnValueOnce(new Promise(done => { resolve = done; })); mount();
  expect(screen.getByRole('status', { name: 'Loading groups' })).toBeTruthy(); expect(screen.queryByText(/Loading groups/)).toBeNull(); expect(screen.queryByRole('button', { name: /Filter/ })).toBeNull();
  await act(async () => resolve({ data: [group()] }));
  fireEvent.change(screen.getByLabelText('Search groups'), { target: { value: 'none' } }); expect(screen.getByText('No groups match your search.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search groups'), { target: { value: 'sal' } }); expect(screen.getByText('Sales')).toBeTruthy();
  mocks.getAll.mockReturnValueOnce(new Promise(done => { resolve = done; })); const refresh = screen.getByRole('button', { name: 'Refresh' }); fireEvent.click(refresh); fireEvent.click(refresh);
  expect(screen.getByText('Sales')).toBeTruthy(); expect(screen.queryByRole('status', { name: 'Loading groups' })).toBeNull(); expect(mocks.getAll).toHaveBeenCalledTimes(2); await act(async () => resolve({ data: [group()] }));
});

it('refetches a Group change that arrives while the first response is in flight', async () => {
  let resolve!: (value: unknown) => void;
  mocks.getAll.mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValueOnce({ data: [{ ...group(), name: 'Sales renamed' }] });
  mount();
  await act(async () => window.dispatchEvent(new Event('leadcrm:groups-changed')));
  await act(async () => resolve({ data: [group()] }));
  expect(await screen.findByText('Sales renamed')).toBeTruthy();
  expect(mocks.getAll).toHaveBeenCalledTimes(2);
});
it('requires trimmed names and creates a group with zero optional members, without duplicate requests', async () => {
  mount(); await screen.findByText('Sales'); fireEvent.click(screen.getByRole('button', { name: 'New Group' }));
  const field = screen.getByRole('textbox', { name: /^Name/ }); expect(field.hasAttribute('required')).toBe(true);
  fireEvent.change(field, { target: { value: '   ' } }); fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
  expect(await screen.findByText('Name is required.')).toBeTruthy(); expect(mocks.create).not.toHaveBeenCalled(); expect(field.getAttribute('aria-invalid')).toBe('true');
  let resolve!: (value: unknown) => void; mocks.create.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  fireEvent.change(field, { target: { value: ' Support ' } }); fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
  fireEvent.submit(field.closest('form')!); expect(mocks.create).toHaveBeenCalledExactlyOnceWith('Support');
  await act(async () => resolve({ data: { ...group(false), id: 'support', name: 'Support' } }));
  expect(mocks.success).toHaveBeenCalledWith('Group created successfully.'); expect(mocks.addMembers).not.toHaveBeenCalled(); expect(screen.getByRole('heading', { name: 'Support' })).toBeTruthy();
});
it.each(['Julie', 'Tiron', 'Julie Ann Tiron', 'julie@example', 'Sales Marketing'])('searches actual group members by %s', async query => {
  // Deliberately omit tenantUsers: the group response is the complete membership source.
  render(<GroupsSubTab tenantUsers={[]} />); await openGroup(); fireEvent.change(screen.getByLabelText('Search members...'), { target: { value: query } }); expect(screen.getByText('Julie Ann Tiron')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search members...'), { target: { value: 'no match' } }); expect(screen.getByText('No members match your search.')).toBeTruthy();
});
it('lets other roles view members but hides membership controls', async () => {
  mocks.role = 'Sales'; mount(); await openGroup();
  expect(screen.getByText('Julie Ann Tiron')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Add Members' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Remove Julie Ann Tiron' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Edit group' })).toBeTruthy();
});
it('requires removal confirmation, traps focus, cancels safely and updates membership/counts after success', async () => {
  mount(); await openGroup(); fireEvent.click(screen.getByRole('button', { name: 'Remove Julie Ann Tiron' }));
  expect(mocks.removeMember).not.toHaveBeenCalled(); const dialog = screen.getByRole('alertdialog'); expect(dialog.textContent).toContain('remove Julie Ann Tiron');
  const remove = within(dialog).getByRole('button', { name: 'Remove Member' }); remove.focus(); fireEvent.keyDown(document, { key: 'Tab' }); expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close confirmation' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' })); expect(mocks.removeMember).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Julie Ann Tiron' })); fireEvent.click(screen.getByRole('button', { name: 'Remove Member' }));
  await waitFor(() => expect(mocks.removeMember).toHaveBeenCalledWith('sales', 'julie')); await waitFor(() => expect(screen.queryByText('Julie Ann Tiron')).toBeNull()); expect(mocks.success).toHaveBeenCalledWith('Member removed successfully.');
});
it('blocks nonempty deletion and confirms empty deletion with the requested toast', async () => {
  const view = mount(); await screen.findByText('Sales'); fireEvent.click(screen.getByRole('button', { name: 'Delete Sales' })); expect(mocks.remove).not.toHaveBeenCalled(); expect(mocks.error).toHaveBeenCalledWith('Remove all members from this group before deleting it.');
  view.unmount(); mocks.getAll.mockResolvedValue({ data: [group(false)] }); mount(); await screen.findByText('Sales'); fireEvent.click(screen.getByRole('button', { name: 'Delete Sales' })); expect(mocks.remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete Group' })); await screen.findByText('No groups yet.'); expect(mocks.success).toHaveBeenCalledWith('Group deleted successfully.');
});
it('disables deletion of the default Sales group even when empty', async () => {
  mocks.getAll.mockResolvedValue({ data: [{ ...group(false), isDefault: true }] });
  mount();
  expect((await screen.findByRole('button', { name: 'Delete Sales' })).hasAttribute('disabled')).toBe(true);
  expect(screen.getByText('Default')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Delete Sales' }));
  expect(mocks.remove).not.toHaveBeenCalled();
});
it('preserves meaningful API failures and allows retry', async () => {
  mocks.getAll.mockRejectedValueOnce(new Error('Groups unavailable')); mount(); expect(await screen.findByRole('alert')).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: 'Retry' })); await screen.findByText('Sales');
  fireEvent.click(screen.getByRole('button', { name: 'New Group' })); mocks.create.mockRejectedValueOnce(new Error('Duplicate group name')); fireEvent.change(screen.getByRole('textbox', { name: /^Name/ }), { target: { value: 'Sales' } }); fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
  await screen.findByText('Duplicate group name'); expect(mocks.error).toHaveBeenCalledWith('Duplicate group name'); expect(screen.getByDisplayValue('Sales')).toBeTruthy();
});
it('renames a group and adds only available members with a success toast', async () => {
  mocks.getAll.mockResolvedValue({ data: [group(false)] }); mount(); fireEvent.click(await screen.findByRole('button', { name: 'Open Sales' }));
  mocks.update.mockResolvedValue({ data: { ...group(false), name: 'Sales team' } }); fireEvent.click(screen.getByRole('button', { name: 'Edit group' })); fireEvent.change(screen.getByRole('textbox', { name: /^Name/ }), { target: { value: ' Sales team ' } }); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: 'Sales team' }); expect(mocks.update).toHaveBeenCalledWith('sales', 'Sales team');
  fireEvent.click(screen.getByRole('button', { name: 'Add Members' })); const dialog = screen.getByRole('dialog'); fireEvent.click(within(dialog).getByLabelText('Select Julie Ann Tiron'));
  mocks.getAll.mockResolvedValue({ data: [group()] }); fireEvent.click(within(dialog).getByRole('button', { name: 'Add Members' }));
  await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Member added successfully.')); expect(mocks.addMembers).toHaveBeenCalledExactlyOnceWith('sales', ['julie']);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); fireEvent.click(screen.getByRole('button', { name: 'Add Members' })); expect(screen.getByText('No users available.')).toBeTruthy();
});

const batchUsers = [user, { ...user, id: 'mica', firstName: 'Mica', lastName: 'Calingo', email: 'mica@example.com' },
  { ...user, id: 'mark', firstName: 'Mark', lastName: 'Panes', email: 'mark@example.com' }];
const savedBatch = (): TenantGroup => ({ ...group(false), members: batchUsers.map(person => ({ id: `member-${person.id}`, userId: person.id, isHead: false, canBeHead: false, user: person })) });
const selectBatch = async () => {
  await openGroup(); fireEvent.click(screen.getByRole('button', { name: 'Add Members' }));
  const dialog = screen.getByRole('dialog');
  for (const person of batchUsers) fireEvent.click(within(dialog).getByLabelText(`Select ${person.firstName} ${person.lastName}`));
  return dialog;
};

it('saves three selected users once and immediately renders confirmed members, counts and available users', async () => {
  mocks.getAll.mockResolvedValue({ data: [group(false)] });
  let complete!: (value: unknown) => void;
  mocks.addMembers.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const view = render(<GroupsSubTab tenantUsers={batchUsers as never} />);
  const dialog = await selectBatch();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add Members' }));
  fireEvent.submit(dialog.querySelector('form')!);
  expect(mocks.addMembers).toHaveBeenCalledExactlyOnceWith('sales', ['julie', 'mica', 'mark']);
  expect(mocks.addMember).not.toHaveBeenCalled();
  expect(within(dialog).getByRole('button', { name: 'Saving…' }).hasAttribute('disabled')).toBe(true);
  expect(mocks.success).not.toHaveBeenCalled();
  await act(async () => complete({ data: savedBatch() }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  for (const person of batchUsers) expect(screen.getByText(`${person.firstName} ${person.lastName}`)).toBeTruthy();
  expect(screen.getByText('3 Members')).toBeTruthy();
  expect(mocks.success).toHaveBeenCalledExactlyOnceWith('Member added successfully.');
  expect(mocks.error).not.toHaveBeenCalled();
  expect(mocks.getAll).toHaveBeenCalledTimes(1); // The response updates the UI without waiting for a GET.
  fireEvent.click(screen.getByRole('button', { name: 'Add Members' }));
  expect(screen.getByText('No users available.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back to Groups' }));
  expect(screen.getByText('3 members')).toBeTruthy();
  await openGroup(); expect(screen.getByText('3 Members')).toBeTruthy();
  view.unmount(); mocks.getAll.mockResolvedValue({ data: [savedBatch()] });
  render(<GroupsSubTab tenantUsers={batchUsers as never} />);
  await openGroup(); expect(screen.getByText('3 Members')).toBeTruthy();
});

it.each(['Unable to save members.', 'This group changed while saving. Refresh the group and try again.'])('retains the entire failed batch and clears stale errors on a successful retry: %s', async message => {
  mocks.getAll.mockResolvedValue({ data: [group(false)] });
  mocks.addMembers.mockRejectedValueOnce(new Error(message));
  render(<GroupsSubTab tenantUsers={batchUsers as never} />);
  const dialog = await selectBatch();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add Members' }));
  expect(await within(dialog).findByRole('alert')).toHaveProperty('textContent', message);
  expect(mocks.error).toHaveBeenCalledExactlyOnceWith(message);
  expect(mocks.success).not.toHaveBeenCalled();
  expect(screen.getByText('0 Members')).toBeTruthy();
  for (const checkbox of within(dialog).getAllByRole('checkbox')) expect((checkbox as HTMLInputElement).checked).toBe(true);
  let complete!: (value: unknown) => void;
  mocks.addMembers.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add Members' }));
  expect(within(dialog).queryByRole('alert')).toBeNull();
  await act(async () => complete({ data: savedBatch() }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getByText('3 Members')).toBeTruthy();
  expect(mocks.success).toHaveBeenCalledExactlyOnceWith('Member added successfully.');
});

it('ignores a pre-save Group response and coalesces invalidations without overwriting confirmed members', async () => {
  mocks.getAll.mockResolvedValueOnce({ data: [group(false)] });
  let stale!: (value: unknown) => void, fresh!: (value: unknown) => void;
  mocks.getAll.mockImplementationOnce(() => new Promise(resolve => { stale = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { fresh = resolve; }));
  mocks.addMembers.mockImplementationOnce(async () => {
    window.dispatchEvent(new Event('leadcrm:groups-changed'));
    window.dispatchEvent(new Event('leadcrm:groups-changed'));
    return { data: savedBatch() };
  });
  render(<GroupsSubTab tenantUsers={batchUsers as never} />);
  const dialog = await selectBatch();
  act(() => window.dispatchEvent(new Event('leadcrm:groups-changed')));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add Members' }));
  await screen.findByText('3 Members');
  await act(async () => stale({ data: [group(false)] }));
  expect(screen.getByText('3 Members')).toBeTruthy();
  expect(mocks.getAll).toHaveBeenCalledTimes(3);
  await act(async () => fresh({ data: [savedBatch()] }));
  expect(screen.getByRole('heading', { name: 'Sales' })).toBeTruthy();
  expect(screen.getByText('3 Members')).toBeTruthy();
});

it('uses one batch and one toast when creating a Group with optional members', async () => {
  mocks.getAll.mockResolvedValue({ data: [] });
  mocks.create.mockResolvedValue({ data: group(false) });
  mocks.addMembers.mockResolvedValue({ data: savedBatch() });
  render(<GroupsSubTab tenantUsers={batchUsers as never} />);
  await screen.findByText('No groups yet.');
  fireEvent.click(screen.getByRole('button', { name: 'New Group' }));
  fireEvent.change(screen.getByRole('textbox', { name: /^Name/ }), { target: { value: 'Sales' } });
  for (const person of batchUsers) fireEvent.click(screen.getByLabelText(`Select ${person.firstName} ${person.lastName}`));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create Group' }));
  await screen.findByText('3 Members');
  expect(mocks.addMembers).toHaveBeenCalledExactlyOnceWith('sales', ['julie', 'mica', 'mark']);
  expect(mocks.success).toHaveBeenCalledExactlyOnceWith('Group created successfully.');
});

const managers = [
  { ...user, id: 'manager', firstName: 'Juan', lastName: 'Dela Cruz', role: 'Sales Manager' },
  { ...user, id: 'head', firstName: 'Mica', lastName: 'Calingo', role: 'Head of Sales' },
  { ...user, id: 'inactive', firstName: 'Inactive', role: 'Sales Manager', status: 'INACTIVE' },
];
const headGroup = (headId?: string): TenantGroup => ({ ...group(), members: [user, ...managers].map(person => ({ id: `m-${person.id}`, userId: person.id, isHead: person.id === headId, canBeHead: person.id !== user.id && person.status === 'ACTIVE', user: person })) });
const openHeadDialog = async (changing = false) => {
  await openGroup(); fireEvent.click(screen.getByRole('button', { name: changing ? 'Change Head' : 'Assign Head' }));
  return screen.getByRole('dialog', { name: 'Assign Group Head' });
};
const chooseHead = (dialog: HTMLElement, name: string) => {
  fireEvent.click(within(dialog).getByRole('button', { name: 'Group Head' }));
  fireEvent.click(screen.getByRole('menuitemradio', { name }));
};

it('uses red Group deletion and primary Add Members while leaving the member X action unchanged', async () => {
  mount();
  const removeGroup = await screen.findByRole('button', { name: 'Delete Sales' });
  expect(removeGroup.classList.contains('text-destructive')).toBe(true);
  expect(removeGroup.classList.contains('hover:bg-destructive/10')).toBe(true);
  expect(removeGroup.title).toContain('Remove all members');
  await openGroup();
  expect(screen.getByRole('button', { name: 'Add Members' }).style.backgroundColor).toBe('var(--primary)');
  const removeMember = screen.getByRole('button', { name: 'Remove Julie Ann Tiron' });
  expect(removeMember.querySelector('.lucide-x')).toBeTruthy();
  expect(removeMember.classList.contains('text-destructive')).toBe(false);
  expect(removeMember.title).toBe('Remove member');
});

it('filters and searches eligible members in a keyboard-accessible head picker', async () => {
  const saved = headGroup('manager');
  saved.members.push({ id: 'unlinked', userId: 'unlinked', isHead: false, canBeHead: false, user: { ...managers[0], id: 'unlinked', firstName: 'Unlinked' } });
  mocks.getAll.mockResolvedValue({ data: [saved] }); mount();
  const dialog = await openHeadDialog(true);
  expect(within(dialog).getByText('Select a member to assign as the head of this group.')).toBeTruthy();
  expect(within(dialog).getByText('The group head should be a manager responsible for this team.')).toBeTruthy();
  expect(within(dialog).getByRole('button', { name: 'Change Head' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Group Head' }));
  expect(screen.getAllByRole('menuitemradio')).toHaveLength(2);
  const selected = screen.getByRole('menuitemradio', { name: /Juan Dela Cruz/ });
  expect(selected.getAttribute('aria-checked')).toBe('true');
  expect(selected.classList.contains('bg-primary/10')).toBe(true);
  expect(selected.querySelector('.lucide-check')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search group members'), { target: { value: 'Head of Sales' } });
  expect(screen.getAllByRole('menuitemradio')).toHaveLength(1);
  fireEvent.keyDown(screen.getByLabelText('Search group members'), { key: 'ArrowDown' });
  expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: /Mica Calingo/ }));
  fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(within(dialog).getByRole('button', { name: 'Group Head' }).textContent).toContain('Mica Calingo');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Group Head' }));
  fireEvent.keyDown(screen.getByLabelText('Search group members'), { key: 'Escape' });
  expect(screen.getByRole('dialog', { name: 'Assign Group Head' })).toBeTruthy();
  expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Group Head' }));
});

it('retains a failed selection, prevents duplicate saves and shows the persisted Head immediately and after reopening', async () => {
  mocks.getAll.mockResolvedValue({ data: [headGroup()] });
  mocks.setHead.mockRejectedValueOnce(new Error('This group changed while saving. Refresh the group and try again.'));
  const view = mount(); const dialog = await openHeadDialog();
  expect(within(dialog).getByRole('button', { name: 'Assign Head' }).hasAttribute('disabled')).toBe(true);
  chooseHead(dialog, 'Juan Dela Cruz Sales Manager');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Assign Head' }));
  expect(await within(dialog).findByRole('alert')).toHaveProperty('textContent', 'This group changed while saving. Refresh the group and try again.');
  expect(within(dialog).getByRole('button', { name: 'Group Head' }).textContent).toContain('Juan Dela Cruz');
  expect(mocks.success).not.toHaveBeenCalled();
  let complete!: (value: unknown) => void;
  mocks.setHead.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Assign Head' }));
  fireEvent.submit(dialog.querySelector('form')!);
  expect(mocks.setHead).toHaveBeenCalledTimes(2);
  expect(within(dialog).getByRole('button', { name: 'Saving…' }).hasAttribute('disabled')).toBe(true);
  expect(within(dialog).queryByRole('alert')).toBeNull();
  await act(async () => complete({ data: headGroup('manager') }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getByText('Head')).toBeTruthy();
  expect(screen.getByLabelText('Group Head').textContent).toContain('Juan Dela Cruz');
  expect(mocks.success).toHaveBeenCalledExactlyOnceWith('Group Head saved.');
  expect(mocks.getAll).toHaveBeenCalledTimes(1);
  view.unmount(); mocks.getAll.mockResolvedValue({ data: [headGroup('manager')] }); mount(); await openGroup();
  expect(screen.getByLabelText('Group Head').textContent).toContain('Juan Dela Cruz');
});

it('replaces the head and clears only after confirmation, preserving membership', async () => {
  mocks.getAll.mockResolvedValue({ data: [headGroup('manager')] }); mount();
  let dialog = await openHeadDialog(true); chooseHead(dialog, 'Mica Calingo Head of Sales');
  mocks.setHead.mockResolvedValueOnce({ data: headGroup('head') });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Change Head' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getByLabelText('Group Head').textContent).toContain('Mica Calingo');
  expect(screen.getAllByText('Head')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Change Head' })); dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Clear Head' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
  expect(mocks.setHead).toHaveBeenCalledTimes(1);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Clear Head' }));
  mocks.setHead.mockResolvedValueOnce({ data: headGroup() });
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Clear Head' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mocks.setHead).toHaveBeenLastCalledWith('sales', null);
  expect(screen.getByLabelText('Group Head').textContent).toContain('Not assigned');
  expect(screen.getByText('4 Members')).toBeTruthy();
  expect(screen.queryByText('Head')).toBeNull();
});

it('shows an accurate empty picker and leaves assignment disabled without eligible members', async () => {
  mount(); const dialog = await openHeadDialog();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Group Head' }));
  expect(screen.getByText('No active Sales Managers or Heads of Sales in this group.')).toBeTruthy();
  expect(within(dialog).getByRole('button', { name: 'Assign Head' }).hasAttribute('disabled')).toBe(true);
  expect(mocks.setHead).not.toHaveBeenCalled();
});

it('shows the designation to Group viewers without granting assignment controls', async () => {
  mocks.role = 'Sales Manager'; mocks.getAll.mockResolvedValue({ data: [headGroup('manager')] }); mount(); await openGroup();
  expect(screen.getByLabelText('Group Head').textContent).toContain('Juan Dela Cruz');
  expect(screen.getByText('Head')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Change Head' })).toBeNull();
});

it('removes the head display when the existing Remove Member action succeeds', async () => {
  mocks.getAll.mockResolvedValue({ data: [headGroup('manager')] }); mount(); await openGroup();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Juan Dela Cruz' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove Member' }));
  await waitFor(() => expect(screen.getByLabelText('Group Head').textContent).toContain('Not assigned'));
  expect(screen.getByText('3 Members')).toBeTruthy();
  expect(mocks.setHead).not.toHaveBeenCalled();
});
