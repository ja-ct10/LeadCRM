import React, { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
const api = vi.hoisted(() => ({ options: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/config", () => ({ USE_MOCK_DATA: false }));
vi.mock("@/store/DataContext", () => {
  const data = { users: [], contacts: [], organizations: [], deals: [] };
  return { useData: () => data };
});
vi.mock("@/store/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "owner", activeEnvironment: "SANDBOX" },
    tenant: { id: "tenant" },
  }),
}));
vi.mock("@/shared/services/tasks.api", () => ({ tasksApi: api }));
vi.mock("@/lib/api/client", () => ({ apiClient: api }));
import { TaskSelector } from "../ui/task-editor";
import { TaskColumnsDrawer } from "../ui/task-columns-drawer";
import { TaskRecordCreator } from "../ui/task-record-creator";
import { TaskTable } from "../ui/task-table";
import { normalizeTaskColumns } from "../task-columns";
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

it("searches inside the association dropdown, checks one explicit record, and supports clearing and creating", async () => {
  api.options.mockImplementation(async (_kind, search) => ({
    data: search
      ? [{ id: "b", label: "Beta Contact" }]
      : [
          { id: "a", label: "Alpha Contact" },
          { id: "b", label: "Beta Contact" },
        ],
  }));
  const create = vi.fn();
  function Selection() {
    const [value, setValue] = useState("");
    return (
      <>
        <output aria-label="Selected ID">{value}</output>
        <TaskSelector
          kind="contact"
          label="Associate contact"
          value={value}
          onChange={setValue}
          onCreate={create}
        />
      </>
    );
  }
  render(<Selection />);
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Associate contact" }));
  const menu = screen.getByRole("dialog", { name: "Select contact" });
  fireEvent.click(
    await within(menu).findByRole("checkbox", { name: "Alpha Contact" }),
  );
  fireEvent.change(
    within(menu).getByRole("textbox", { name: "Search contact" }),
    { target: { value: "Beta" } },
  );
  await waitFor(() =>
    expect(api.options).toHaveBeenLastCalledWith(
      "contact",
      "Beta",
      expect.any(AbortSignal),
    ),
  );
  fireEvent.click(
    await within(menu).findByRole("checkbox", { name: "Beta Contact" }),
  );
  expect(screen.getByRole("status", { name: "Selected ID" }).textContent).toBe(
    "b",
  );
  fireEvent.click(within(menu).getByRole("checkbox", { name: "Beta Contact" }));
  expect(screen.getByRole("status", { name: "Selected ID" }).textContent).toBe(
    "",
  );
  fireEvent.click(
    within(menu).getByRole("button", { name: "Create a contact" }),
  );
  expect(create).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("preserves a failed contact draft and selects the saved response only after a successful retry", async () => {
  api.post
    .mockRejectedValueOnce(new Error("Contact save failed"))
    .mockResolvedValueOnce({
      data: { id: "new-contact", firstName: "Test", lastName: "Person" },
    });
  const created = vi.fn();
  render(
    <TaskRecordCreator
      kind="contact"
      onCreated={created}
      onCancel={vi.fn()}
      onBusy={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("First name *"), {
    target: { value: "Test" },
  });
  fireEvent.change(screen.getByLabelText("Last name *"), {
    target: { value: "Person" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create contact" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Contact save failed",
  );
  expect(created).not.toHaveBeenCalled();
  expect(
    (screen.getByLabelText("First name *") as HTMLInputElement).value,
  ).toBe("Test");
  fireEvent.click(screen.getByRole("button", { name: "Create contact" }));
  await waitFor(() =>
    expect(created).toHaveBeenCalledWith({
      id: "new-contact",
      label: "Test Person",
    }),
  );
  expect(api.post).toHaveBeenLastCalledWith(
    "/crm/contacts",
    expect.objectContaining({ firstName: "Test", lastName: "Person" }),
  );
});

it("keeps column edits as a draft, prevents removing defaults, reorders and retries failed persistence", async () => {
  const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("Column save failed"))
      .mockResolvedValueOnce(undefined),
    close = vi.fn();
  render(
    <TaskColumnsDrawer
      columns={normalizeTaskColumns(null)}
      onSave={save}
      onClose={close}
    />,
  );
  expect(
    (
      (await screen.findByRole("button", {
        name: "Save",
      })) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(
    screen.queryByRole("button", { name: "Remove Task title" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Remove Priority" }));
  fireEvent.click(screen.getByRole("button", { name: "Move Task title down" }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Select attributes" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Search attributes" }), {
    target: { value: "Created" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Created/ }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Column save failed",
  );
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  const columns = save.mock.calls[1][0];
  expect(columns[0].id).toBe("action");
  expect(
    columns.find((column: { id: string }) => column.id === "priority").visible,
  ).toBe(false);
  expect(
    columns.find((column: { id: string }) => column.id === "createdAt").visible,
  ).toBe(true);
});

it("uses saved table order and selects only the displayed page", () => {
  const select = vi.fn(),
    sort = vi.fn();
  const task = {
    id: "one",
    tenantId: "tenant",
    title: "Follow-up",
    description: "",
    status: "pending" as const,
    assignedUserId: "owner",
    dueDate: "2030-01-01T08:00:00Z",
    createdAt: "2026-09-01T08:00:00Z",
  };
  const columns = normalizeTaskColumns([
    { id: "title", visible: true, order: 3 },
    { id: "dueDate", visible: true, order: 1 },
  ]);
  render(
    <TaskTable
      tasks={[task]}
      columns={columns}
      selected={[]}
      onSelect={select}
      onOpen={vi.fn()}
      onStatus={vi.fn()}
      onSort={sort}
      query={{ sortBy: "dueDate", sortOrder: "asc" }}
      busy={false}
      canEdit
      canArchive
    />,
  );
  const headers = screen
    .getAllByRole("columnheader")
    .map((element) => element.textContent);
  expect(headers.indexOf("Due date↑")).toBeLessThan(
    headers.indexOf("Task title↕"),
  );
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Select all tasks on this page" }),
  );
  expect(select).toHaveBeenCalledWith(["one"]);
  fireEvent.click(screen.getByRole("button", { name: "Due date" }));
  expect(sort).toHaveBeenCalledWith({ sortBy: "dueDate", sortOrder: "desc" });
});
