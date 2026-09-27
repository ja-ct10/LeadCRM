"use client";
import { ChevronDown, Search, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskRecord,
  type TaskOption,
  type TaskOptionKind,
  type CreateTaskInput,
} from "@leadcrm/shared";
import { useData } from "@/store/DataContext";
import { useAuth } from "@/store/AuthContext";
import { useHasPermission } from "@/shared/hooks/use-permissions";
import { tasksApi } from "@/shared/services/tasks.api";
import { USE_MOCK_DATA } from "@/lib/config";
import { TaskRecordCreator } from "./task-record-creator";
import { Sheet, SheetContent } from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { localDateTime, taskDueInstant } from "../task-data";

export const taskInputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export type TaskLinks = Pick<
  CreateTaskInput,
  "leadId" | "contactId" | "dealId" | "accountId"
>;
export function TaskSelector({
  kind,
  label,
  value,
  selectedLabel,
  onChange,
  onCreate,
  required = false,
}: {
  kind: TaskOptionKind;
  label: string;
  value: string;
  selectedLabel?: string;
  onChange: (value: string) => void;
  onCreate?: () => void;
  required?: boolean;
}) {
  const id = useId();
  const { users, contacts, deals, organizations } = useData();
  const { user, tenant } = useAuth();
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<TaskOption[]>([]);
  const [selected, setSelected] = useState<TaskOption>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    input = useRef<HTMLInputElement>(null);
  const singular =
    kind === "contact"
      ? "contact"
      : kind === "account"
        ? "account"
        : kind === "user"
          ? "owner"
          : kind;
  useEffect(() => {
    if (!open) return;
    const bounds = trigger.current?.getBoundingClientRect();
    if (bounds)
      setAbove(bounds.bottom > window.innerHeight - 360 && bounds.top > 340);
    input.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        let rows: TaskOption[];
        if (USE_MOCK_DATA) {
          rows =
            kind === "user"
              ? users
                  .filter((u) => u.status.toLowerCase() === "active")
                  .map((u) => ({
                    id: u.id,
                    label: u.firstName + " " + u.lastName,
                  }))
              : kind === "deal"
                ? deals.map((d) => ({ id: d.id, label: d.title }))
                : kind === "account"
                  ? organizations.map((o) => ({ id: o.id, label: o.name }))
                  : kind === "lead"
                    ? contacts.map((c) => ({
                        id: c.id,
                        label: c.firstName + " " + c.lastName,
                      }))
                    : [];
          rows = rows
            .filter((row) =>
              row.label.toLowerCase().includes(search.toLowerCase()),
            )
            .slice(0, 50);
        } else rows = (await tasksApi.options(kind, search, abort.signal)).data;
        if (!abort.signal.aborted) setOptions(rows);
      } catch (e) {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : "Unable to load options.");
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [
    open,
    kind,
    search,
    retry,
    tenant?.id,
    user?.activeEnvironment,
    users,
    contacts,
    deals,
    organizations,
  ]);
  const caption =
    options.find((option) => option.id === value)?.label ||
    (selected?.id === value ? selected.label : selectedLabel) ||
    "Selected record";
  const visible =
    value && !options.some((option) => option.id === value) && !search
      ? [{ id: value, label: caption }, ...options]
      : options;
  return (
    <div
      ref={wrapper}
      className="relative space-y-2"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
        if (event.key === "ArrowDown" && !open) {
          event.preventDefault();
          setOpen(true);
        }
      }}
    >
      <label id={id + "-label"} className="block text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </label>
      <button
        ref={trigger}
        type="button"
        aria-labelledby={id + "-label"}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((value) => !value);
          setSearch("");
        }}
        className={
          taskInputClass + " flex items-center justify-between gap-2 text-left"
        }
      >
        <span className={"truncate " + (value ? "" : "text-muted-foreground")}>
          {value
            ? caption
            : "Select " +
              (kind === "user" || kind === "account" ? "an " : "a ") +
              singular}
        </span>
        <ChevronDown size={16} className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={"Select " + singular}
          className={
            "absolute left-0 right-0 z-30 overflow-hidden rounded-xl border border-border bg-background shadow-xl " +
            (above ? "bottom-full mb-1" : "top-full mt-1")
          }
        >
          <div className="relative border-b border-border p-3">
            <Search
              size={16}
              className="absolute left-6 top-6 text-muted-foreground"
            />
            <input
              ref={input}
              aria-label={"Search " + singular}
              placeholder={"Search for " + singular}
              className={taskInputClass + " pl-9"}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-2" aria-busy={loading}>
            {loading ? (
              <p
                role="status"
                className="px-2 py-3 text-xs text-muted-foreground"
              >
                Loading…
              </p>
            ) : error ? (
              <div role="alert" className="p-2 text-xs text-destructive">
                {error}
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => setRetry((v) => v + 1)}
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                {visible.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-3 text-sm hover:bg-secondary/50"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-primary"
                      checked={value === option.id}
                      onChange={() => {
                        setSelected(option);
                        onChange(value === option.id ? "" : option.id);
                      }}
                    />
                    <span className="min-w-0 break-words">{option.label}</span>
                  </label>
                ))}
                {!visible.length && (
                  <p className="p-3 text-sm text-muted-foreground">
                    No matching records.
                  </p>
                )}
              </>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border p-3">
            {onCreate ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  onCreate();
                }}
              >
                <Plus size={14} />
                Create {kind === "account" ? "an" : "a"} {singular}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Select one {singular}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TaskEditor({
  task,
  links = {},
  onClose,
}: {
  task?: TaskRecord;
  links?: TaskLinks;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { addTask, updateTask, deleteTask } = useData();
  const canCreate = useHasPermission("deals.create"),
    canEdit = useHasPermission("deals.edit"),
    canArchive = useHasPermission("deals.delete");
  const canCreateContacts = useHasPermission("contacts.create"),
    canCreateAccounts = useHasPermission("accounts.create");
  const canContacts = useHasPermission("contacts.view"),
    canAccounts = useHasPermission("accounts.view");
  const editable = !task?.isArchived && (task ? canEdit : canCreate);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState(task?.status ?? "pending");
  const [priority, setPriority] = useState(task?.priority ?? "Medium");
  const [dueDate, setDueDate] = useState(
    localDateTime(
      task?.dueDate ?? new Date(Date.now() + 86400000).toISOString(),
    ),
  );
  const [assignedUserId, setOwner] = useState(
    task?.assignedUserId ?? user?.id ?? "",
  );
  const [relations, setRelations] = useState<TaskLinks>({
    leadId: task?.leadId ?? links.leadId,
    contactId: task?.contactId ?? links.contactId,
    dealId: task?.dealId ?? links.dealId,
    accountId: task?.accountId ?? links.accountId,
  });
  const [creating, setCreating] = useState<Exclude<
    TaskOptionKind,
    "user"
  > | null>(null);
  const [createdLabels, setCreatedLabels] = useState<
    Partial<Record<TaskOptionKind, string>>
  >({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmArchive, setConfirmArchive] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const heading = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(
      () => panel.current?.querySelector<HTMLElement>("input,button")?.focus(),
      0,
    );
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panel.current) return;
      const nodes = [
        ...panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ),
      ];
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !panel.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, []);
  const save = async () => {
    if (busy || !editable) return;
    setBusy(true);
    setError("");
    try {
      if (!title.trim()) throw new Error("Enter a task title.");
      if (!assignedUserId) throw new Error("Select a task owner.");
      const data = {
        title,
        description,
        status,
        priority,
        dueDate:
          task && dueDate === localDateTime(task.dueDate)
            ? task.dueDate
            : taskDueInstant(dueDate),
        assignedUserId,
        ...relations,
      };
      if (task) {
        const updates: Partial<TaskRecord> = { ...data };
        // Do not revalidate unchanged archived links or overwrite reassignment.
        for (const field of [
          "assignedUserId",
          "leadId",
          "contactId",
          "dealId",
          "accountId",
        ] as const) {
          if ((updates[field] ?? null) === (task[field] ?? null))
            delete updates[field];
        }
        await updateTask(task.id, updates);
      } else await addTask(data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save task.");
    } finally {
      setBusy(false);
    }
  };
  const archive = async () => {
    if (!task) return;
    setBusy(true);
    setError("");
    try {
      await deleteTask(task.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to archive task.");
    } finally {
      setBusy(false);
    }
  };
  const person =
    task?.assignedUser ?? (assignedUserId === user?.id ? user : undefined);
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) {
          if (creating) setCreating(null);
          else onClose();
        }
      }}
    >
      <SheetContent
        ref={panel}
        aria-labelledby={heading}
        showClose={!busy}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (!busy) {
              if (creating) setCreating(null);
              else onClose();
            }
          }
        }}
      >
        <header className="border-b border-border bg-primary/10 px-6 py-5 pr-14">
          <h2 id={heading} className="mt-1 text-xl font-semibold">
            {creating
              ? "Create " +
                (creating === "contact" ? "client profile" : creating)
              : task
                ? "Task details"
                : "Create task"}
          </h2>
        </header>
        {creating ? (
          <TaskRecordCreator
            kind={creating}
            onBusy={setBusy}
            onCancel={() => setCreating(null)}
            onCreated={(option) => {
              setRelations((previous) => ({
                ...previous,
                [creating + "Id"]: option.id,
              }));
              setCreatedLabels((previous) => ({
                ...previous,
                [creating]: option.label,
              }));
              setCreating(null);
            }}
          />
        ) : (
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <fieldset
                disabled={!editable || busy}
                className="space-y-5 disabled:opacity-75"
              >
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Title *</span>
                  <input
                    className={taskInputClass}
                    required
                    maxLength={255}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Status</span>
                    <select
                      className={taskInputClass}
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as typeof status)
                      }
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {TASK_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Priority</span>
                    <select
                      className={taskInputClass}
                      value={priority}
                      onChange={(e) =>
                        setPriority(e.target.value as typeof priority)
                      }
                    >
                      {["Low", "Medium", "High"].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">
                    Due date and time *
                  </span>
                  <input
                    className={taskInputClass}
                    type="datetime-local"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                  <span className="block text-xs text-muted-foreground">
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </span>
                </label>
                <TaskSelector
                  kind="user"
                  label="Task owner"
                  required
                  value={assignedUserId}
                  selectedLabel={
                    person
                      ? person.firstName + " " + person.lastName
                      : undefined
                  }
                  onChange={setOwner}
                />
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Notes</span>
                  <textarea
                    rows={5}
                    maxLength={10000}
                    className={taskInputClass}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {description.length}/10000
                  </span>
                </label>
                <section>
                  <h3 className="text-sm font-semibold text-primary">
                    Associate task (
                    {Object.values(relations).filter(Boolean).length})
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Link one record of each type.
                  </p>
                  <div className="mt-4 space-y-4">
                    {(["lead", "contact", "deal", "account"] as const)
                      .filter(
                        (kind) =>
                          kind === "deal" ||
                          (kind === "account" ? canAccounts : canContacts),
                      )
                      .map((kind) => {
                        const field = (kind + "Id") as keyof TaskLinks;
                        const record =
                          kind === "lead"
                            ? task?.lead
                            : kind === "contact"
                              ? task?.contact
                              : null;
                        return (
                          <TaskSelector
                            key={kind}
                            kind={kind}
                            label={
                              kind === "contact"
                                ? "Associate task to client profile"
                                : kind === "account"
                                  ? "Associate task to account"
                                  : kind === "lead"
                                    ? "Associate task to lead"
                                    : "Associate task to deal"
                            }
                            value={relations[field] ?? ""}
                            selectedLabel={
                              createdLabels[kind] ||
                              (kind === "account"
                                ? task?.account?.name
                                : kind === "deal"
                                  ? task?.deal?.title
                                  : record
                                    ? record.firstName + " " + record.lastName
                                    : undefined)
                            }
                            onCreate={
                              !USE_MOCK_DATA &&
                              (kind === "deal"
                                ? canCreate
                                : kind === "account"
                                  ? canCreateAccounts
                                  : canCreateContacts)
                                ? () => setCreating(kind)
                                : undefined
                            }
                            onChange={(value) =>
                              setRelations((previous) => ({
                                ...previous,
                                [field]: value || null,
                              }))
                            }
                          />
                        );
                      })}
                  </div>
                </section>
              </fieldset>
              {task && (
                <dl className="space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                  <div>Created {new Date(task.createdAt).toLocaleString()}</div>
                  {task.completedAt && (
                    <div>
                      Completed {new Date(task.completedAt).toLocaleString()}
                      {task.completedBy
                        ? " by " +
                          task.completedBy.firstName +
                          " " +
                          task.completedBy.lastName
                        : ""}
                    </div>
                  )}
                  {task.assignedByUser && (
                    <div>
                      Assigned by {task.assignedByUser.firstName}{" "}
                      {task.assignedByUser.lastName}
                    </div>
                  )}
                  {task.isArchived && <div>Archived</div>}
                </dl>
              )}
              {confirmArchive && (
                <div
                  role="alert"
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  Archive this task? It will leave active views and remain in
                  the archive.
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void archive()}
                    >
                      Confirm archive
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setConfirmArchive(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <footer className="flex items-center justify-between gap-3 border-t border-border p-4">
              {task && canArchive && !task.isArchived ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirmArchive(true)}
                >
                  Archive
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={onClose}
                >
                  Close
                </Button>
                {editable && (
                  <Button type="submit" disabled={busy}>
                    {busy ? "Saving…" : task ? "Save changes" : "Create task"}
                  </Button>
                )}
              </div>
            </footer>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
