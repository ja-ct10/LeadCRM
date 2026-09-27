"use client";
import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical, Plus, RefreshCw, Search, Columns3 } from "lucide-react";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  isTaskOverdue,
  taskDateRange,
  type TaskListQuery,
  type TaskRecord,
  type TaskStatus,
  type TaskBulkInput,
} from "@leadcrm/shared";
import { useData } from "@/store/DataContext";
import { useHasPermission } from "@/shared/hooks/use-permissions";
import { Button } from "@/shared/components/ui/button";
import { TaskTable } from "./task-table";
import { TaskColumnsDrawer } from "./task-columns-drawer";
import { useTaskColumns } from "../use-task-columns";
import { useTasks } from "../use-tasks";
import { taskDueInstant } from "../task-data";
import { TaskEditor, TaskSelector, taskInputClass } from "./task-editor";

function TaskCard({
  task,
  disabled,
  open,
}: {
  task: TaskRecord;
  disabled: boolean;
  open: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id, disabled });
  return (
    <article
      ref={setNodeRef}
      style={{
        transform: transform
          ? "translate3d(" + transform.x + "px," + transform.y + "px,0)"
          : undefined,
      }}
      className={
        "rounded-xl border border-border bg-background p-4 shadow-sm " +
        (isDragging ? "relative z-20 opacity-60" : "")
      }
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={disabled}
          aria-label={"Move " + task.title}
          className="touch-none rounded py-1 text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GripVertical size={16} />
        </button>
        <button
          className="text-left text-sm font-semibold hover:underline"
          onClick={open}
        >
          {task.title}
        </button>
      </div>
      {task.description && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {task.description}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span
          className={
            task.priority === "High"
              ? "font-medium text-destructive"
              : "text-muted-foreground"
          }
        >
          {task.priority ?? "Medium"}
        </span>
        <span
          className={
            isTaskOverdue(task) ? "text-destructive" : "text-muted-foreground"
          }
        >
          {isTaskOverdue(task) ? "Overdue · " : ""}
          {new Date(task.dueDate).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {task.assignedUser
          ? task.assignedUser.firstName + " " + task.assignedUser.lastName
          : "Team member"}
      </p>
    </article>
  );
}
function TaskColumn({
  status,
  tasks,
  count,
  disabled,
  open,
}: {
  status: TaskStatus;
  tasks: TaskRecord[];
  count: number;
  disabled: boolean;
  open: (task: TaskRecord) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled });
  return (
    <section
      ref={setNodeRef}
      aria-label={TASK_STATUS_LABELS[status]}
      className={
        "min-h-56 min-w-64 flex-1 rounded-xl border p-3 " +
        (isOver
          ? "border-primary bg-primary/5"
          : "border-border bg-secondary/30")
      }
    >
      <h2 className="mb-4 flex items-center justify-between text-sm font-semibold">
        {TASK_STATUS_LABELS[status]}
        <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {count}
        </span>
      </h2>
      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            disabled={disabled}
            open={() => open(task)}
          />
        ))}
        {!tasks.length && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No tasks on this page
          </p>
        )}
      </div>
    </section>
  );
}
export default function TaskBoard() {
  const { updateTask, bulkTasks } = useData();
  const canCreate = useHasPermission("deals.create"),
    canEdit = useHasPermission("deals.edit"),
    canArchive = useHasPermission("deals.delete");
  const [view, setView] = useState<"list" | "kanban" | "workload">("list");
  const [period, setPeriod] = useState<"all" | "overdue" | "today" | "week">(
    "all",
  );
  const [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState("");
  const [filters, setFilters] = useState<TaskListQuery>({});
  const [page, setPage] = useState(1),
    [limit, setLimit] = useState(25);
  const [editor, setEditor] = useState<TaskRecord | "new" | null>(null);
  const [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [bulkAction, setBulkAction] = useState<
      "assign" | "reschedule" | "archive" | null
    >(null),
    [owner, setOwner] = useState(""),
    [date, setDate] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const range =
    period === "today" || period === "week" ? taskDateRange(period) : {};
  const query = {
    ...filters,
    ...range,
    ...(period === "overdue" ? { overdue: true } : {}),
    search: debounced,
    page,
    limit,
  };
  const data = useTasks(query);
  const columnPreferences = useTaskColumns(data.identity, data.canRead);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const identity = useRef(data.identity);
  identity.current = data.identity;
  useEffect(() => {
    setSelected([]);
    setBulkAction(null);
  }, [JSON.stringify(query), data.identity]);
  useEffect(() => {
    setEditor(null);
    setColumnsOpen(false);
    setError("");
    setNotice("");
  }, [data.identity]);
  useEffect(() => {
    if (data.meta && page > Math.max(1, Math.ceil(data.meta.total / limit)))
      setPage(Math.max(1, Math.ceil(data.meta.total / limit)));
  }, [data.meta, page, limit]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const change = async (task: TaskRecord, status: TaskStatus) => {
    if (busy || task.status === status || !canEdit || task.isArchived) return;
    const started = identity.current;
    setBusy(true);
    setError("");
    try {
      await updateTask(task.id, { status });
      if (started === identity.current) setNotice("Task updated.");
    } catch (e) {
      if (started === identity.current)
        setError(e instanceof Error ? e.message : "Unable to update task.");
    } finally {
      setBusy(false);
    }
  };
  const drop = (event: DragEndEvent) => {
    if (!event.over) return;
    const task = data.tasks.find((row) => row.id === event.active.id);
    const target = String(event.over.id);
    if (task && TASK_STATUSES.includes(target as TaskStatus))
      void change(task, target as TaskStatus);
  };
  const runBulk = async (operation: TaskBulkInput["operation"]) => {
    if (!selected.length || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const started = identity.current;
    try {
      const request: TaskBulkInput =
        operation === "assign"
          ? { operation, ids: selected, assignedUserId: owner }
          : operation === "reschedule"
            ? { operation, ids: selected, dueDate: taskDueInstant(date) }
            : { operation, ids: selected };
      const result = await bulkTasks(request);
      if (started !== identity.current) return;
      setNotice(result.succeeded.length + " task(s) updated.");
      setError(
        result.failed
          .map(
            (failure) =>
              (data.tasks.find((t) => t.id === failure.id)?.title ?? "Task") +
              ": " +
              failure.error,
          )
          .join(" "),
      );
      setSelected(result.failed.map((f) => f.id));
      setBulkAction(null);
    } catch (e) {
      if (started === identity.current)
        setError(
          e instanceof Error ? e.message : "Unable to update selected tasks.",
        );
    } finally {
      setBusy(false);
    }
  };
  const updateFilter = (values: TaskListQuery) => {
    setFilters((previous) => ({ ...previous, ...values }));
    setPage(1);
  };
  const total = data.meta?.total ?? 0;
  if (!data.canRead)
    return (
      <div className="p-8 text-muted-foreground">
        You do not have permission to view tasks.
      </div>
    );
  return (
    <div className="space-y-4 p-4 text-foreground sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mt-1 text-2xl font-semibold">Tasks</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={data.refresh} disabled={busy}>
            <RefreshCw size={16} />
            Refresh
          </Button>
          {canCreate && (
            <Button onClick={() => setEditor("new")}>
              <Plus size={16} />
              Create task
            </Button>
          )}
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border">
        <nav aria-label="Task due period" className="flex gap-1">
          {(["all", "overdue", "today", "week"] as const).map((value) => (
            <button
              key={value}
              onClick={() => {
                setPeriod(value);
                setPage(1);
              }}
              aria-current={period === value ? "page" : undefined}
              className={
                "border-b-2 px-3 py-3 text-sm " +
                (period === value
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground")
              }
            >
              {value === "week"
                ? "This week"
                : value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </nav>
        <div className="flex gap-1 pb-2" aria-label="Task view">
          {(["list", "kanban", "workload"] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={view === value ? "secondary" : "ghost"}
              aria-pressed={view === value}
              onClick={() => setView(value)}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          className="order-last ml-auto text-primary"
          disabled={columnPreferences.loading}
          onClick={() => setColumnsOpen(true)}
        >
          <Columns3 size={15} />
          Customise columns
        </Button>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search tasks</span>
          <Search
            size={16}
            className="absolute left-3 top-3 text-muted-foreground"
          />
          <input
            className={taskInputClass + " pl-9"}
            placeholder="Search tasks"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Status
          <select
            aria-label="Filter status"
            className={taskInputClass}
            value={filters.status ?? ""}
            onChange={(e) =>
              updateFilter({
                status: e.target.value
                  ? (e.target.value as TaskStatus)
                  : undefined,
              })
            }
          >
            <option value="">All statuses</option>
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Priority
          <select
            aria-label="Filter priority"
            className={taskInputClass}
            value={filters.priority ?? ""}
            onChange={(e) =>
              updateFilter({
                priority: e.target.value
                  ? (e.target.value as "Low" | "Medium" | "High")
                  : undefined,
              })
            }
          >
            <option value="">All priorities</option>
            {["Low", "Medium", "High"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Show
          <select
            aria-label="Archive filter"
            className={taskInputClass}
            value={filters.archived ? "archived" : "current"}
            onChange={(e) =>
              updateFilter({ archived: e.target.value === "archived" })
            }
          >
            <option value="current">Current tasks</option>
            <option value="archived">Archived tasks</option>
          </select>
        </label>
        <Button
          variant="ghost"
          onClick={() => {
            setSearch("");
            setFilters({});
            setPeriod("all");
            setPage(1);
          }}
        >
          Clear filters
        </Button>
        <div className="w-full sm:w-56">
          <TaskSelector
            kind="user"
            label="Task owner"
            value={filters.assignedUserId ?? ""}
            onChange={(value) =>
              updateFilter({ assignedUserId: value || undefined })
            }
          />
        </div>
      </div>
      {(error || data.error) && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive"
        >
          {error || data.error}
          {data.error && (
            <Button variant="ghost" onClick={data.refresh}>
              Retry
            </Button>
          )}
        </div>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/40 p-3">
          <span className="mr-2 text-sm">{selected.length} selected</span>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Clear selection
          </Button>
          {canEdit && (
            <>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void runBulk("complete")}
              >
                Mark done
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setBulkAction("assign")}
              >
                Assign
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setBulkAction("reschedule")}
              >
                Reschedule
              </Button>
            </>
          )}
          {canArchive && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setBulkAction("archive")}
            >
              Archive
            </Button>
          )}
          {bulkAction && (
            <div className="w-full space-y-3 border-t border-border pt-3">
              {bulkAction === "assign" ? (
                <TaskSelector
                  kind="user"
                  label="New owner"
                  required
                  value={owner}
                  onChange={setOwner}
                />
              ) : bulkAction === "reschedule" ? (
                <label className="block text-sm">
                  New due date and time
                  <input
                    className={taskInputClass}
                    type="datetime-local"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
              ) : (
                <p className="text-sm">
                  Archive {selected.length} selected tasks? They remain
                  available in the archive.
                </p>
              )}
              <Button
                disabled={
                  busy ||
                  (bulkAction === "assign" && !owner) ||
                  (bulkAction === "reschedule" && !date)
                }
                onClick={() => void runBulk(bulkAction)}
              >
                Confirm {bulkAction}
              </Button>
            </div>
          )}
        </div>
      )}
      {data.loading ? (
        <div
          role="status"
          className="rounded-xl border border-border p-12 text-center text-muted-foreground"
        >
          Loading tasks…
        </div>
      ) : (
        !data.error && (
          <>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>{total} tasks</span>
              <span>{data.summary?.active ?? 0} active</span>
              <span>{data.summary?.overdue ?? 0} overdue</span>
              <span>{data.summary?.completed ?? 0} completed</span>
            </div>
            {view === "workload" ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.summary?.workload.map((row) => (
                  <article
                    key={row.assignedUserId}
                    className="rounded-xl border border-border bg-background p-5"
                  >
                    <h2 className="font-semibold">{row.name}</h2>
                    <p className="mt-2 text-2xl font-semibold">
                      {row.total}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        active tasks
                      </span>
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {row.pending} to do · {row.inProgress} in progress ·{" "}
                      {row.blocked} blocked
                    </p>
                    <p className="mt-2 text-sm text-destructive">
                      {row.overdue} overdue
                    </p>
                  </article>
                ))}
                {!data.summary?.workload.length && (
                  <p className="p-6 text-muted-foreground">
                    No active workload matches these filters.
                  </p>
                )}
              </div>
            ) : view === "kanban" ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Columns show this page of results. Counts include all matching
                  tasks. Open a task to change its status without dragging.
                </p>
                <DndContext sensors={sensors} onDragEnd={drop}>
                  <div className="flex gap-4 overflow-x-auto pb-4">
                    {TASK_STATUSES.map((status) => (
                      <TaskColumn
                        key={status}
                        status={status}
                        tasks={data.tasks.filter((t) => t.status === status)}
                        count={data.summary?.byStatus[status] ?? 0}
                        disabled={busy || !canEdit || !!filters.archived}
                        open={setEditor}
                      />
                    ))}
                  </div>
                </DndContext>
              </>
            ) : (
              <TaskTable
                tasks={data.tasks}
                columns={columnPreferences.columns}
                selected={selected}
                onSelect={setSelected}
                onOpen={setEditor}
                onStatus={(task) =>
                  void change(
                    task,
                    task.status === "completed" ? "pending" : "completed",
                  )
                }
                onSort={updateFilter}
                query={query}
                busy={busy}
                canEdit={canEdit}
                canArchive={canArchive}
              />
            )}
            {view !== "workload" && (
              <footer className="!mt-0 flex flex-wrap items-center justify-end gap-3 rounded-b-xl border border-t-0 border-border bg-background p-3 text-sm text-muted-foreground">
                <label>
                  Rows per page{" "}
                  <select
                    className="rounded border border-border bg-background p-2"
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {[25, 50, 100].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <span>
                  {total ? (page - 1) * limit + 1 : 0}–
                  {Math.min(page * limit, total)} of {total}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1 || busy}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </Button>
                <span>
                  Page {page} of {Math.max(1, Math.ceil(total / limit))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.meta?.hasMore || busy}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </footer>
            )}
          </>
        )
      )}
      {columnPreferences.error && (
        <p role="alert" className="text-sm text-destructive">
          {columnPreferences.error}{" "}
          <button onClick={columnPreferences.retry} className="underline">
            Retry columns
          </button>
        </p>
      )}
      {columnsOpen && (
        <TaskColumnsDrawer
          columns={columnPreferences.columns}
          onSave={columnPreferences.save}
          onClose={() => setColumnsOpen(false)}
        />
      )}
      {editor && (
        <TaskEditor
          key={data.identity + (editor === "new" ? "new" : editor.id)}
          task={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
