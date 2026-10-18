import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
const mocks = vi.hoisted(() => ({
  addTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  canEdit: true,
  canEditLeads: true,
  canAssign: true,
  deniedPermissions: [] as string[],
  detail: {} as { data?: import('@leadcrm/shared').TaskRecord; error: string | null; errorStatus?: number; isInitialLoad: boolean; isRefreshing: boolean; refetch: ReturnType<typeof vi.fn> },
  options: vi.fn(),
  captureLayout: undefined as (() => void) | undefined,
}));
const user = {
  id: "owner",
  firstName: "Test",
  lastName: "Owner",
  };
const data = {
  ...mocks,
  users: [],
  contacts: [],
  deals: [],
  organizations: [],
};
vi.mock("@/store/DataContext", () => ({ useData: () => data }));
vi.mock("@/store/AuthContext", () => ({
  useAuth: () => ({ user, tenant: { id: "tenant" } }),
}));
vi.mock("@/shared/hooks/use-permissions", () => ({
  useHasPermission: (permission: string) =>
    mocks.deniedPermissions.includes(permission) ? false : permission === "leads.edit"
      ? mocks.canEditLeads
      : permission === 'tasks.assign' ? mocks.canAssign : permission !== "tasks.edit" || mocks.canEdit,
}));
vi.mock('@/shared/hooks/use-cached-page', () => ({ useCachedPage: () => mocks.detail }));
vi.mock('../ui/task-selector', async () => {
  const actual = await vi.importActual<typeof import('../ui/task-selector')>('../ui/task-selector');
  return { ...actual, TaskSelector: (props: React.ComponentProps<typeof actual.TaskSelector>) => {
    React.useLayoutEffect(() => { mocks.captureLayout?.(); });
    return <actual.TaskSelector {...props} />;
  } };
});
vi.mock('../ui/task-record-creator', () => ({ TaskRecordCreator: ({ onCancel }: { onCancel: () => void }) => <button type="button" onClick={onCancel}>Cancel deal creation</button> }));
vi.mock("@/lib/config", () => ({ USE_MOCK_DATA: false }));
vi.mock("@/shared/services/tasks.api", () => ({
  tasksApi: {
    options: mocks.options,
    dealOptions: async (filters: { search?: string }, signal?: AbortSignal) => { const result = await mocks.options('deal', filters.search ?? '', signal); return { ...result, meta: { total: result.data.length, page: 1, limit: 25, hasMore: false } }; },
  },
}));
import { TaskEditor } from "../ui/task-editor";
import { manilaCurrentDate } from "../task-data";
const task = {
  id: "task",
  tenantId: "tenant",
  title: "Call client",
  description: "Keep my notes",
  status: "pending" as const,
  priority: "High" as const,
  assignedUserId: "owner",
  dueDate: "2026-09-27T13:30:00.000Z",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: '2026-09-01T00:00:00.000Z',
};
afterEach(cleanup);
it('labels the existing task assignee Assigned Agent in the detail panel', () => {
  render(<TaskEditor task={task} readOnly onClose={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Assigned Agent *' })).toBeTruthy();
  expect(screen.queryByText('Task owner')).toBeNull();
});
it('shows original Task Owner separately from the Assigned Agent and records unknown historical ownership honestly', () => {
  mocks.detail.data = { ...task, createdBy: { id: 'creator', firstName: 'Original', lastName: 'Creator' } };
  const view = render(<TaskEditor task={{ ...task, createdBy: { id: 'creator', firstName: 'Original', lastName: 'Creator' } }} readOnly onClose={vi.fn()} />);
  expect(screen.getByText('Task Owner (Created by):')).toBeTruthy();
  expect(screen.getByText('Original Creator')).toBeTruthy();
  view.unmount();
  mocks.detail.data = task;
  render(<TaskEditor task={task} readOnly onClose={vi.fn()} />);
  expect(screen.getByText('Not recorded')).toBeTruthy();
});
it("uses the Philippine calendar minimum and does not show a timezone label", () => {
  render(<TaskEditor onClose={vi.fn()} />);
  fireEvent.click(screen.getByLabelText("Due date and time *"));
  const today = Number(manilaCurrentDate().slice(-2));
  const picker = screen.getByRole('group', { name: 'Choose due date and time' });
  if (today > 1) expect((within(picker).getByRole('button', { name: String(today - 1) }) as HTMLButtonElement).disabled).toBe(true);
  expect((within(picker).getByRole('button', { name: String(today) }) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.queryByText("Asia/Manila")).toBeNull();
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.canEdit = true;
  mocks.canEditLeads = true;
  mocks.canAssign = true;
  mocks.deniedPermissions = [];
  mocks.captureLayout = undefined;
  mocks.detail = { data: task, error: null, isInitialLoad: false, isRefreshing: false, refetch: vi.fn() };
  mocks.options.mockResolvedValue({ data: [{ id: 'owner', label: 'Test Owner' }] });
});
it('keeps fetched Task fields disabled until the initial draft is hydrated, then saves an early status change', async () => {
  mocks.detail = { ...mocks.detail, data: undefined, isInitialLoad: true };
  let firstLoadedFrameDisabled: boolean | undefined;
  mocks.captureLayout = () => {
    if (mocks.detail.data && firstLoadedFrameDisabled === undefined)
      firstLoadedFrameDisabled = screen.getByLabelText('Title *').matches(':disabled');
  };
  const onClose = vi.fn();
  const view = render(<TaskEditor taskId={task.id} onClose={onClose} />);
  mocks.detail = { ...mocks.detail, data: task, isInitialLoad: false };
  view.rerender(<TaskEditor taskId={task.id} onClose={onClose} />);
  expect(firstLoadedFrameDisabled).toBe(true);
  fireEvent.change(screen.getByRole('combobox', { name: /^Status/ }), { target: { value: 'completed' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(mocks.updateTask).toHaveBeenCalledWith(task.id, { status: 'completed', expectedUpdatedAt: task.updatedAt }));
  expect(mocks.updateTask).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
});
it('keeps a pristine Task locked until a newly fetched version has hydrated its draft', () => {
  mocks.detail = { ...mocks.detail, data: undefined, isInitialLoad: true };
  let firstLoadedFrameDisabled: boolean | undefined;
  mocks.captureLayout = () => {
    if (mocks.detail.data && firstLoadedFrameDisabled === undefined)
      firstLoadedFrameDisabled = screen.getByLabelText('Title *').matches(':disabled');
  };
  const view = render(<TaskEditor task={task} onClose={vi.fn()} />);
  mocks.detail = { ...mocks.detail, data: { ...task, title: 'New saved title', updatedAt: '2026-09-02T00:00:00.000Z' }, isInitialLoad: false };
  view.rerender(<TaskEditor task={task} onClose={vi.fn()} />);
  expect(firstLoadedFrameDisabled).toBe(true);
  expect(screen.getByLabelText('Title *')).toHaveProperty('value', 'New saved title');
  expect(screen.getByLabelText('Title *').matches(':disabled')).toBe(false);
});
it('shows the create subtitle only in task creation and restores it after nested deal creation closes', async () => {
  render(<TaskEditor onClose={vi.fn()} />);
  expect(screen.getByRole('heading', { name: 'Create task' })).toBeTruthy();
  const subtitle = screen.getByText('Complete the task details below.');
  expect(subtitle.classList.contains('text-sm')).toBe(true);
  expect(subtitle.classList.contains('dark:text-slate-400')).toBe(true);
  fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Keep task draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Associate task to deal *' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Create a deal' }));
  expect(screen.getByRole('heading', { name: 'Create deal' })).toBeTruthy();
  expect(screen.queryByText('Complete the task details below.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel deal creation' }));
  expect(screen.getByText('Complete the task details below.')).toBeTruthy();
  expect(screen.getByLabelText('Title *')).toHaveProperty('value', 'Keep task draft');
});

it('opens an ID-only destination through the shared detail reader without presenting a create form', () => {
  mocks.detail = { data: undefined, error: null, isInitialLoad: true, isRefreshing: false, refetch: vi.fn() };
  const view = render(<TaskEditor taskId={task.id} readOnly onClose={vi.fn()} />);
  expect(screen.getByRole('heading', { name: 'Task details' })).toBeTruthy();
  expect(screen.queryByText('Complete the task details below.')).toBeNull();
  mocks.detail = { ...mocks.detail, data: task, isInitialLoad: false };
  view.rerender(<TaskEditor taskId={task.id} readOnly onClose={vi.fn()} />);
  expect(screen.getByRole('textbox', { name: /^Title/ })).toHaveProperty('value', task.title);
  expect(screen.queryByRole('button', { name: 'Create task' })).toBeNull();
});
it.each([false, true])('omits task creation copy from Task details (read only: %s)', readOnly => {
  render(<TaskEditor task={task} readOnly={readOnly} onClose={vi.fn()} />);
  expect(screen.getByRole('heading', { name: 'Task details' })).toBeTruthy();
  expect(screen.queryByText('Complete the task details below.')).toBeNull();
});
async function selectAgent() {
  fireEvent.click(screen.getByRole('button', { name: 'Assigned Agent *' }));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Test Owner' }));
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
}
it('preserves authorized self-assignment without Tasks Assign permission while requiring an explicit choice', async () => {
  mocks.canAssign = false;
  mocks.options.mockResolvedValue({ data: [{ id: 'owner', label: 'Test Owner' }, { id: 'other', label: 'Other Agent' }] });
  render(<TaskEditor links={{ dealIds: ['deal'] }} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Self-assigned draft' } });
  expect(screen.getByText('Select Agent...')).toBeTruthy();
  await selectAgent();
  expect(screen.queryByText('Other Agent')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
  await waitFor(() => expect(mocks.addTask).toHaveBeenCalledWith(expect.objectContaining({ assignedUserId: 'owner' })));
});
it('requires explicit agent selection and preserves the entire draft for resubmission', async () => {
  const close = vi.fn();
  render(<TaskEditor links={{ dealIds: ['deal'] }} onClose={close} />);
  expect(screen.getByText('Select Agent...')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'My draft' } });
  fireEvent.change(screen.getByRole('textbox', { name: /Notes/ }), { target: { value: 'My notes' } });
  const due = screen.getByLabelText('Due date and time *').textContent;
  fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Select an assigned agent.');
  expect(mocks.addTask).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Title *') as HTMLInputElement).value).toBe('My draft');
  expect((screen.getByRole('textbox', { name: /Notes/ }) as HTMLTextAreaElement).value).toBe('My notes');
  expect(screen.getByLabelText('Due date and time *').textContent).toBe(due);
  await selectAgent();
  fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(mocks.addTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'My draft', description: 'My notes', assignedUserId: 'owner', dealIds: ['deal'] }));
});
it('shows the eligible-agent empty state without falling back to the logged-in user', async () => {
  mocks.options.mockResolvedValue({ data: [] });
  render(<TaskEditor onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Assigned Agent *' }));
  expect(await screen.findByText('No eligible agents available.')).toBeTruthy();
  expect(screen.getByText('Select Agent...')).toBeTruthy();
});
it('preserves a historical assignee as a read-only choice while allowing eligible reassignment', async () => {
  mocks.detail.data = { ...task, assignedUserId: 'admin', assignedUser: { id: 'admin', firstName: 'Historical', lastName: 'Admin' } };
  render(<TaskEditor task={{ ...task, assignedUserId: 'admin', assignedUser: { id: 'admin', firstName: 'Historical', lastName: 'Admin' } }} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Assigned Agent *' }));
  const historical = await screen.findByRole('checkbox', { name: 'Historical Admin (current assignment, read-only)' });
  expect((historical as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Keep historical assignment' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(mocks.updateTask).toHaveBeenCalled());
  expect(mocks.updateTask.mock.calls[0][1]).not.toHaveProperty('assignedUserId');
});
it('retains dropdown searching and keyboard opening', async () => {
  render(<TaskEditor onClose={vi.fn()} />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Assigned Agent *' }), { key: 'ArrowDown' });
  fireEvent.change(screen.getByRole('textbox', { name: 'Search owner' }), { target: { value: 'Test' } });
  await screen.findByRole('checkbox', { name: 'Test Owner' });
  expect(mocks.options).toHaveBeenLastCalledWith('user', 'Test', expect.any(AbortSignal));
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search owner' }), { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Select owner' })).toBeNull();
});
it("keeps the editor and entered values after a rejected save", async () => {
  mocks.updateTask.mockRejectedValue(new Error("Task update rejected"));
  const close = vi.fn();
  render(<TaskEditor task={task} onClose={close} />);
  await screen.findByRole("dialog");
  fireEvent.change(screen.getByLabelText("Title *"), {
    target: { value: "Edited title" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Task update rejected",
  );
  expect((screen.getByLabelText("Title *") as HTMLInputElement).value).toBe(
    "Edited title",
  );
  expect(close).not.toHaveBeenCalled();
});
it("sends only changed fields and the saved version without rewriting the due instant", async () => {
  mocks.updateTask.mockResolvedValue(undefined);
  const close = vi.fn();
  render(<TaskEditor task={task} onClose={close} />);
  fireEvent.change(screen.getByRole('textbox', { name: /Notes/ }), { target: { value: 'Updated notes' } });
  fireEvent.click(await screen.findByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(mocks.updateTask).toHaveBeenCalledWith(
    "task",
    { description: 'Updated notes', expectedUpdatedAt: task.updatedAt },
  );
  expect(mocks.addTask).not.toHaveBeenCalled();
});
it('requires a Deal for creation even when a legacy CRM context is supplied', async () => {
  render(<TaskEditor links={{ contactId: 'profile-id' }} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Follow up' } });
  await selectAgent();
  fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Select at least one Deal to associate with this task.');
  expect(mocks.addTask).not.toHaveBeenCalled();
});
it("does not render a save action without the existing edit permission", async () => {
  mocks.canEdit = false;
  render(<TaskEditor task={task} onClose={vi.fn()} />);
  await screen.findByRole("dialog");
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
});

it('shows only the existing multi-Deal selector and keeps legacy associations informational', () => {
  mocks.detail.data = { ...task, leadIds: ['legacy'], leads: [{ id: 'legacy', firstName: 'Historical', lastName: 'Lead' }] };
  render(<TaskEditor task={{ ...task, leadIds: ['legacy'], leads: [{ id: 'legacy', firstName: 'Historical', lastName: 'Lead' }] }} onClose={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /Associate task to (lead|contact|account)/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Associate task to deal' })).toBeTruthy();
  expect(screen.getByText('Historical Lead')).toBeTruthy();
  expect(screen.getByText('Associated Deals (0)')).toBeTruthy();
});

it('refreshes a clean Task drawer from canonical detail, including completion and assignment', () => {
  const close = vi.fn();
  const view = render(<TaskEditor task={task} readOnly onClose={close} />);
  mocks.detail.data = { ...task, title: 'Latest saved title', status: 'completed', assignedUserId: 'replacement',
    assignedUser: { id: 'replacement', firstName: 'New', lastName: 'Agent' }, completedAt: '2026-09-02T00:00:00Z', updatedAt: '2026-09-02T00:00:00Z' };
  view.rerender(<TaskEditor task={task} readOnly onClose={close} />);
  expect((screen.getByLabelText('Title *') as HTMLInputElement).value).toBe('Latest saved title');
  expect(screen.getByText('New Agent')).toBeTruthy();
  expect(screen.getByText(/Completed Sep 2, 2026 08:00 AM/)).toBeTruthy();
});

it('preserves a dirty draft and requires explicit reload after another committed edit', () => {
  const close = vi.fn();
  const view = render(<TaskEditor task={task} onClose={close} />);
  fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'My unsaved title' } });
  mocks.detail.data = { ...task, title: 'Another saved title', status: 'completed', updatedAt: '2026-09-02T00:00:00Z' };
  view.rerender(<TaskEditor task={task} onClose={close} />);
  expect((screen.getByLabelText('Title *') as HTMLInputElement).value).toBe('My unsaved title');
  expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.submit(screen.getByRole('button', { name: 'Save changes' }).closest('form')!);
  expect(mocks.updateTask).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Reload saved task' }));
  expect((screen.getByLabelText('Title *') as HTMLInputElement).value).toBe('Another saved title');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('preserves a draft and reloads detail after a server-side version race', async () => {
  mocks.updateTask.mockRejectedValue(Object.assign(new Error('Task changed on the server'), { status: 409 }));
  render(<TaskEditor task={task} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'My racing draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await screen.findByText('Task changed on the server');
  expect((screen.getByLabelText('Title *') as HTMLInputElement).value).toBe('My racing draft');
  expect(mocks.detail.refetch).toHaveBeenCalledOnce();
  expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
});

it.each([401, 403, 404])('removes protected Task fields after an authoritative %s response', status => {
  const close = vi.fn(); const view = render(<TaskEditor task={task} onClose={close} />);
  mocks.detail = { ...mocks.detail, data: undefined, error: 'Task unavailable', errorStatus: status };
  view.rerender(<TaskEditor task={task} onClose={close} />);
  expect(screen.getByRole('alert').textContent).toBe('Task unavailable');
  expect(screen.queryByLabelText('Title *')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
});

it('uses ID-based CRM links and hides inaccessible related records', () => {
  mocks.deniedPermissions = ['leads.view'];
  mocks.detail.data = { ...task, dealIds: ['deal/id'], deals: [{ id: 'deal/id', title: 'Associated Deal' }], relatedRecords: [
    { kind: 'lead', id: 'private-lead', label: 'Private Lead', via: 'Deal: Associated Deal' },
    { kind: 'contact', id: 'contact/id', label: 'Related Contact', via: 'Deal: Associated Deal' },
  ] };
  render(<TaskEditor task={task} readOnly onClose={vi.fn()} />);
  expect(screen.getByRole('link', { name: 'Associated Deal' }).getAttribute('href')).toBe('/crm/deals/deal%2Fid');
  expect(screen.getByRole('link', { name: 'Related Contact' }).getAttribute('href')).toBe('/crm/contacts/contact%2Fid');
  expect(screen.queryByText('Private Lead')).toBeNull();
});
it('prevents every mutation action in a read-only Task context', () => {
  render(<TaskEditor task={task} readOnly onClose={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  expect(screen.queryByRole('button', { name: /Create a deal/ })).toBeNull();
  expect((screen.getByLabelText('Title *') as HTMLInputElement).closest('fieldset')?.disabled).toBe(true);
});
it('keeps picker changes as a draft until Done and discards them on Cancel', () => {
  render(<TaskEditor onClose={vi.fn()} />);
  const trigger = screen.getByLabelText('Due date and time *');
  const original = trigger.textContent;
  fireEvent.click(trigger);
  fireEvent.change(screen.getByLabelText('Due minute'), { target: { value: '17' } });
  expect(trigger.textContent).toBe(original);
  fireEvent.click(within(screen.getByRole('group', { name: 'Choose due date and time' })).getByRole('button', { name: 'Cancel' }));
  expect(trigger.textContent).toBe(original);
  fireEvent.click(trigger);
  fireEvent.change(screen.getByLabelText('Due minute'), { target: { value: '23' } });
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(trigger.textContent).toContain(':23');
  expect(screen.queryByRole('group', { name: 'Choose due date and time' })).toBeNull();
});

it('retains the originating Deal and sends no direct associations during creation', async () => {
  mocks.addTask.mockResolvedValue(undefined);
  render(<TaskEditor links={{ dealIds: ['originating-deal'] }} preserveContextLinks onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Deal follow up' } });
  await selectAgent();
  fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
  await waitFor(() => expect(mocks.addTask).toHaveBeenCalledWith(expect.objectContaining({ dealIds: ['originating-deal'], title: 'Deal follow up' })));
  for (const kind of ['lead','contact','account']) expect(mocks.addTask.mock.calls[0][0]).not.toHaveProperty(kind + 'Ids');
});
