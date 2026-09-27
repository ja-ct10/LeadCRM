"use client";
import type { ReactNode } from "react";
import {
  TASK_COLUMN_DEFINITIONS,
  TASK_STATUS_LABELS,
  isTaskOverdue,
  type ColumnConfigItem,
  type TaskRecord,
  type TaskListQuery,
} from "@leadcrm/shared";
import { Button } from "@/shared/components/ui/button";
interface Props {
  tasks: TaskRecord[];
  columns: ColumnConfigItem[];
  selected: string[];
  onSelect: (ids: string[]) => void;
  onOpen: (task: TaskRecord) => void;
  onStatus: (task: TaskRecord) => void;
  onSort: (query: TaskListQuery) => void;
  query: TaskListQuery;
  busy: boolean;
  canEdit: boolean;
  canArchive: boolean;
}
export function TaskTable({
  tasks,
  columns,
  selected,
  onSelect,
  onOpen,
  onStatus,
  onSort,
  query,
  busy,
  canEdit,
  canArchive,
}: Props) {
  const visible = columns
    .filter((column) => column.visible)
    .sort((a, b) => a.order - b.order);
  const selectable = !query.archived && (canEdit || canArchive) && !busy;
  const relation = (text?: string | null) =>
    text ? (
      <span
        className="inline-flex max-w-48 truncate rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary"
        title={text}
      >
        {text}
      </span>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  const person = (value?: { firstName: string; lastName: string } | null) =>
    value ? value.firstName + " " + value.lastName : undefined;
  const cell = (task: TaskRecord, id: string): ReactNode => {
    switch (id) {
      case "action":
        return canEdit && !task.isArchived ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-lg px-2.5 font-normal"
            disabled={busy}
            onClick={() => onStatus(task)}
          >
            {task.status === "completed" ? "Reopen" : "Done"}
          </Button>
        ) : (
          "—"
        );
      case "title":
        return (
          <button
            onClick={() => onOpen(task)}
            className="max-w-72 truncate text-left font-medium hover:text-primary hover:underline"
            title={task.title}
          >
            {task.title}
          </button>
        );
      case "status":
        return (
          <span className="rounded-full bg-secondary px-2 py-1 text-xs">
            {TASK_STATUS_LABELS[task.status]}
          </span>
        );
      case "priority":
        return (
          <span
            className={
              task.priority === "High"
                ? "text-destructive"
                : "text-muted-foreground"
            }
          >
            {task.priority ?? "Medium"}
          </span>
        );
      case "dueDate":
        return (
          <span
            className={
              "inline-flex items-center gap-2 " +
              (isTaskOverdue(task) ? "text-destructive" : "")
            }
          >
            {isTaskOverdue(task) && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-destructive"
                aria-label="Overdue"
              />
            )}
            {new Date(task.dueDate).toLocaleString([], {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        );
      case "lead":
        return relation(person(task.lead));
      case "contact":
        return relation(person(task.contact));
      case "deal":
        return relation(task.deal?.title);
      case "account":
        return relation(task.account?.name);
      case "assignedUser":
        return person(task.assignedUser) ?? "—";
      case "createdAt":
        return new Date(task.createdAt).toLocaleString();
      case "completedAt":
        return task.completedAt
          ? new Date(task.completedAt).toLocaleString()
          : "—";
      default:
        return "—";
    }
  };
  return (
    <div className="overflow-x-auto rounded-t-xl border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-background text-xs">
          <tr>
            <th className="sticky left-0 z-10 w-10 bg-background px-3 py-4">
              <input
                type="checkbox"
                aria-label="Select all tasks on this page"
                disabled={!selectable}
                checked={
                  tasks.length > 0 &&
                  tasks.every((task) => selected.includes(task.id))
                }
                ref={(element) => {
                  if (element)
                    element.indeterminate =
                      selected.length > 0 && selected.length < tasks.length;
                }}
                onChange={(event) =>
                  onSelect(
                    event.target.checked ? tasks.map((task) => task.id) : [],
                  )
                }
              />
            </th>
            {visible.map((column) => {
              const sortable = ["title", "dueDate", "createdAt"].includes(
                column.id,
              );
              const label = TASK_COLUMN_DEFINITIONS.find(
                (item) => item.id === column.id,
              )?.label;
              return (
                <th
                  key={column.id}
                  className={
                    "whitespace-nowrap px-4 py-4 font-medium " +
                    (column.id === "action"
                      ? "sticky left-10 z-10 bg-background"
                      : "")
                  }
                  aria-sort={
                    sortable && query.sortBy === column.id
                      ? query.sortOrder === "desc"
                        ? "descending"
                        : "ascending"
                      : undefined
                  }
                >
                  {sortable ? (
                    <button
                      className="flex w-full items-center justify-between gap-8"
                      onClick={() =>
                        onSort({
                          sortBy: column.id as TaskListQuery["sortBy"],
                          sortOrder:
                            query.sortBy === column.id &&
                            query.sortOrder !== "desc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      {label}
                      <span aria-hidden="true">
                        {query.sortBy === column.id
                          ? query.sortOrder === "desc"
                            ? "↓"
                            : "↑"
                          : "↕"}
                      </span>
                    </button>
                  ) : (
                    label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr
              key={task.id}
              className={
                "group border-t border-border " +
                (selected.includes(task.id)
                  ? "bg-primary/5"
                  : "bg-background hover:bg-secondary/20")
              }
            >
              <td className="sticky left-0 z-10 bg-inherit px-3 py-3">
                <input
                  type="checkbox"
                  aria-label={"Select " + task.title}
                  disabled={!selectable}
                  checked={selected.includes(task.id)}
                  onChange={(event) =>
                    onSelect(
                      event.target.checked
                        ? [...selected, task.id]
                        : selected.filter((id) => id !== task.id),
                    )
                  }
                />
              </td>
              {visible.map((column) => (
                <td
                  key={column.id}
                  className={
                    "whitespace-nowrap px-4 py-3 " +
                    (column.id === "action"
                      ? "sticky left-10 z-10 bg-inherit"
                      : "")
                  }
                >
                  {cell(task, column.id)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!tasks.length && (
        <div className="p-12 text-center">
          <p className="font-medium">No tasks match these filters</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different date, status, or search.
          </p>
        </div>
      )}
    </div>
  );
}
