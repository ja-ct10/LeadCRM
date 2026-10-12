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
  options: vi.fn(),
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
    permission === "leads.edit"
      ? mocks.canEditLeads
      : permission !== "tasks.edit" || mocks.canEdit,
}));
vi.mock("@/lib/config", () => ({ USE_MOCK_DATA: false }));
vi.mock("@/shared/services/tasks.api", () => ({
  tasksApi: {
    options: mocks.options,
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
};
afterEach(cleanup);
it('labels the existing task assignee Assigned Agent in the detail panel', () => {
  render(<TaskEditor task={task} readOnly onClose={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Assigned Agent *' })).toBeTruthy();
  expect(screen.queryByText('Task owner')).toBeNull();
});
it('shows original Task Owner separately from the Assigned Agent and records unknown historical ownership honestly', () => {
  const view = render(<TaskEditor task={{ ...task, createdBy: { id: 'creator', firstName: 'Original', lastName: 'Creator' } }} readOnly onClose={vi.fn()} />);
  expect(screen.getByText('Task Owner (Created by):')).toBeTruthy();
  expect(screen.getByText('Original Creator')).toBeTruthy();
  view.unmount();
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
it("preserves the due instant and existing identity on successful edits", async () => {
  mocks.updateTask.mockResolvedValue(undefined);
  const close = vi.fn();
  render(<TaskEditor task={task} onClose={close} />);
  fireEvent.click(await screen.findByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(mocks.updateTask).toHaveBeenCalledWith(
    "task",
    expect.objectContaining({ dueDate: task.dueDate, title: task.title }),
  );
  expect(mocks.addTask).not.toHaveBeenCalled();
});
it('requires a Deal for creation even when a legacy CRM context is supplied', async () => {
  render(<TaskEditor links={{ contactId: 'profile-id' }} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Follow up' } });
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
  render(<TaskEditor task={{ ...task, leadIds: ['legacy'], leads: [{ id: 'legacy', firstName: 'Historical', lastName: 'Lead' }] }} onClose={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /Associate task to (lead|contact|account)/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Associate task to deal' })).toBeTruthy();
  expect(screen.getByText('Historical Lead')).toBeTruthy();
  expect(screen.getByText('Associated Deals (0)')).toBeTruthy();
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
  fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
  await waitFor(() => expect(mocks.addTask).toHaveBeenCalledWith(expect.objectContaining({ dealIds: ['originating-deal'], title: 'Deal follow up' })));
  for (const kind of ['lead','contact','account']) expect(mocks.addTask.mock.calls[0][0]).not.toHaveProperty(kind + 'Ids');
});
