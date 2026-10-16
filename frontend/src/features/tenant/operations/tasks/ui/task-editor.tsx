"use client";
import { ConfirmActionDialog } from '@/shared/components/crm/confirm-action-dialog';
import { usePanelCloseGuard } from '@/shared/hooks/use-panel-close-guard';
import { ManilaDateTimePicker } from "@/shared/components/ui/manila-date-time-picker";
import { taskRecordHref, taskRecordOptions } from "../task-relations";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from 'next/link';
import {
  TASK_STATUSES,
  taskAssociationIds,
  type TaskLinkInput,
  TASK_STATUS_LABELS,
  type TaskRecord,
  type TaskOption,
  type UpdateTaskDto,
} from "@leadcrm/shared";
import { useData } from "@/store/DataContext";
import { useAuth } from "@/store/AuthContext";
import { useHasPermission } from "@/shared/hooks/use-permissions";
import { USE_MOCK_DATA } from "@/lib/config";
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import { tasksApi } from '@/shared/services/tasks.api';
import { formatDateTime } from '@/shared/components/data-grid/cell-renderers';
import { DataLoadingSpinner } from '@/shared/components/crm/data-view-states';
import { TaskRecordCreator } from "./task-record-creator";
import { Sheet, SheetContent } from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import {
  PanelSectionHeading,
  panelBodyClass,
  panelCloseClass,
  panelFooterClass,
  panelHeaderClass,
  panelInputClass,
  panelLabelClass,
  panelPrimaryButtonClass,
  panelSecondaryButtonClass,
  panelSurfaceClass,
  panelTitleClass,
} from "@/shared/components/side-panel-styles";
import {
  isPastManilaTaskDueDateTime,
  manilaCurrentDate,
  manilaLocalDateTime,
  manilaTaskDueInstant,
  resolveManilaTaskDueDateTime,
} from "../task-data";

export type TaskLinks = TaskLinkInput;
import { TaskSelector } from "./task-selector";
export { TaskSelector, taskInputClass } from "./task-selector";

export function TaskEditor({
  task: initialTask,
  taskId,
  links = {},
  readOnly = false,
  preserveContextLinks = false,
  onClose,
}: {
  task?: TaskRecord;
  taskId?: string;
  links?: TaskLinks;
  readOnly?: boolean;
  preserveContextLinks?: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const requestId = useRef<string>(crypto.randomUUID());
  const { addTask, updateTask, deleteTask } = useData();
  const canCreate = useHasPermission("tasks.create"),
    canEdit = useHasPermission("tasks.edit"),
    canArchive = useHasPermission("tasks.archive");
  const canComplete = useHasPermission("tasks.complete"), canAssign = useHasPermission("tasks.assign");
  const canRead = useHasPermission('tasks.view');
  const readableRecords = { lead: useHasPermission('leads.view'), contact: useHasPermission('contacts.view'),
    deal: useHasPermission('deals.view'), account: useHasPermission('accounts.view') };
  const recordId = initialTask?.id ?? taskId;
  const detail = useCachedPage<TaskRecord>({ module: 'tasks', params: { recordId },
    disabled: USE_MOCK_DATA || !recordId || !canRead, revalidateOnInvalidation: true,
    fetchFn: async signal => (await tasksApi.get(recordId!, signal)).data });
  const task = recordId ? detail.data ?? initialTask : undefined;
  const [baseline, setBaseline] = useState(task);
  const canCreateDeals = useHasPermission("deals.create");
  const editable = !readOnly && !task?.isArchived && (task ? canEdit : canCreate);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState(task?.status ?? "pending");
  const [priority, setPriority] = useState(task?.priority ?? "Medium");
  const [dueDate, setDueDate] = useState(
    manilaLocalDateTime(
      task?.dueDate ?? new Date(Date.now() + 86400000).toISOString(),
    ),
  );
  const [dueDraft, setDueDraft] = useState<string | null>(null);
  const initialDueDate = useRef(dueDate);
  const dueTrigger = useRef<HTMLButtonElement>(null);
  const closeDuePicker = () => { setDueDraft(null); dueTrigger.current?.focus({ preventScroll: true }); };
  const [assignedUserId, setOwner] = useState(
    task?.assignedUserId ?? "",
  );
  const [dealIds, setDealIds] = useState(() => taskAssociationIds(task ?? links, 'deal'));
  const changeDeals = (ids: string[]) => setDealIds([...new Set([...ids,
    ...(preserveContextLinks ? taskAssociationIds(links, 'deal') : [])])]);
  const [creating, setCreating] = useState<'deal' | null>(null);
  const [createdLabels, setCreatedLabels] = useState<TaskOption[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmArchive, setConfirmArchive] = useState(false);
  const [saveConflict, setSaveConflict] = useState(false);
  const dirty = baseline ? (title !== baseline.title || description !== baseline.description || status !== baseline.status ||
    priority !== (baseline.priority ?? 'Medium') || dueDate !== manilaLocalDateTime(baseline.dueDate) ||
    assignedUserId !== baseline.assignedUserId || JSON.stringify(dealIds) !== JSON.stringify(taskAssociationIds(baseline, 'deal')))
    : !!(title || description || assignedUserId || status !== 'pending' || priority !== 'Medium' || dueDate !== initialDueDate.current || JSON.stringify(dealIds) !== JSON.stringify(taskAssociationIds(links, 'deal')));
  const closeGuard = usePanelCloseGuard(onClose, { dirty: editable && dirty, busy });
  const changed = !!baseline && !!detail.data && (baseline.updatedAt !== detail.data.updatedAt ||
    !baseline.updatedAt && JSON.stringify(baseline) !== JSON.stringify(detail.data));
  const conflict = saveConflict || dirty && changed;
  const unavailable = !!recordId && (!canRead || [401, 403, 404].includes(detail.errorStatus ?? 0));
  const detailReady = !recordId || USE_MOCK_DATA || !!detail.data;
  const resetDraft = useCallback((saved: TaskRecord) => {
    setBaseline(saved); setTitle(saved.title); setDescription(saved.description); setStatus(saved.status);
    setPriority(saved.priority ?? 'Medium'); setDueDate(manilaLocalDateTime(saved.dueDate));
    setOwner(saved.assignedUserId); setDealIds(taskAssociationIds(saved, 'deal'));
    setDueDraft(null); setCreatedLabels([]); setSaveConflict(false); setError('');
  }, []);
  useEffect(() => {
    if (recordId && detail.data && !dirty && !busy && !saveConflict) resetDraft(detail.data);
  }, [recordId, detail.data, dirty, busy, saveConflict, resetDraft]);
  const heading = useId();
  const save = async () => {
    if (busy || !editable || !detailReady || unavailable || conflict) return;
    setBusy(true);
    setError("");
    try {
      if (!title.trim()) throw new Error("Enter a task title.");
      if (!assignedUserId) throw new Error("Select an assigned agent.");
      if (!dealIds.length && (!task || taskAssociationIds(task, "deal").length))
        throw new Error("Select at least one Deal to associate with this task.");
      const dueDateUnchanged = !!baseline && dueDate === manilaLocalDateTime(baseline.dueDate);
      const resolvedDueDate = resolveManilaTaskDueDateTime(dueDate);
      if (!dueDateUnchanged) {
        if (resolvedDueDate.slice(0, 10) < manilaCurrentDate())
          throw new Error("Choose today or a future due date.");
        if (isPastManilaTaskDueDateTime(resolvedDueDate))
          throw new Error("Choose a due date and time in the future.");
      }
      if (resolvedDueDate !== dueDate) setDueDate(resolvedDueDate);
      const data = {
        title: title.trim(),
        description,
        status,
        priority,
        dueDate: dueDateUnchanged
          ? baseline!.dueDate
          : manilaTaskDueInstant(resolvedDueDate),
        assignedUserId,
        dealIds: [...new Set([...dealIds, ...(preserveContextLinks ? taskAssociationIds(links, "deal") : [])])],
      };
      if (task) {
        const updates: UpdateTaskDto = { ...data };
        // Preserve untouched links, including historical archived relationships.
        for (const field of ['title', 'description', 'status', 'priority', 'dueDate', 'assignedUserId'] as const)
          if (data[field] === baseline?.[field]) delete updates[field];
        if (JSON.stringify(dealIds) === JSON.stringify(taskAssociationIds(baseline!, 'deal'))) delete updates.dealIds;
        if (Object.keys(updates).length) {
          if (baseline?.updatedAt) updates.expectedUpdatedAt = baseline.updatedAt;
          await updateTask(task.id, updates);
        }
      } else await addTask({ ...data, requestId: requestId.current });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save task.");
      if ((e as { status?: number })?.status === 409) { setSaveConflict(true); void detail.refetch(); }
    } finally {
      setBusy(false);
    }
  };
  const archive = async () => {
    if (!task || readOnly || !canArchive || task.isArchived || unavailable || !detailReady) return;
    setBusy(true);
    setError("");
    try {
      await deleteTask(task.id);
      onClose();
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Unable to archive task. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const person = task?.assignedUser?.id === assignedUserId
    ? task.assignedUser : assignedUserId === user?.id ? user : undefined;
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) {
          if (creating) setCreating(null);
          else closeGuard.requestClose();
        }
      }}
    >
      <SheetContent
        aria-labelledby={heading}
        showClose={!busy}
        className={panelSurfaceClass}
        closeClassName={panelCloseClass + " right-3 top-3 sm:right-5"}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (!busy) {
              if (creating) setCreating(null);
              else closeGuard.requestClose();
            }
          }
        }}
      >
        <header className={panelHeaderClass + " pr-16 sm:pr-20"}>
          <h2 id={heading} className={panelTitleClass}>
            {creating ? "Create deal" : recordId ? "Task details" : "Create task"}
          </h2>
          {!recordId && !creating && <p className="text-sm text-slate-500 mt-1 dark:text-slate-400 font-medium">Complete the task details below.</p>}
        </header>
        {unavailable ? (
          <div className={panelBodyClass + ' space-y-4'}>
            <p role="alert" className="text-sm text-destructive">{detail.error ?? 'Task access is restricted.'}</p>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        ) : creating ? (
          <TaskRecordCreator
            kind={creating}
            onBusy={setBusy}
            onCancel={() => setCreating(null)}
            onCreated={(option) => {
              changeDeals([...dealIds, option.id]);
              setCreatedLabels(previous => [...previous, option]);
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
            <div className={panelBodyClass + " space-y-6"}>
              {detail.isInitialLoad && <DataLoadingSpinner label="Loading task" hideLabel />}
              {detail.error && <div role="alert" className="space-y-2 text-sm text-destructive">
                <p>{detail.error}</p><Button type="button" variant="outline" onClick={() => void detail.refetch()}>Retry loading task</Button>
              </div>}
              {conflict && <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm">
                <p>This Task changed. Your unsaved changes are preserved. Reload the saved Task before saving.</p>
                <Button type="button" variant="outline" disabled={!detail.data || detail.isRefreshing || busy}
                  onClick={() => { if (detail.data) resetDraft(detail.data); }}>Reload saved task</Button>
              </div>}
              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <fieldset
                disabled={!editable || busy || !detailReady}
                className="min-w-0 space-y-6"
              >
                <section className="space-y-4">
                  <PanelSectionHeading number={1}>Task Information</PanelSectionHeading>
                  <label className="block space-y-1.5">
                    <span className={panelLabelClass}>Title <span className="text-red-500">*</span></span>
                    <input
                      className={panelInputClass}
                      required
                      maxLength={255}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="min-w-0 space-y-1.5">
                      <span className={panelLabelClass}>Status</span>
                      <select
                        className={panelInputClass}
                        value={status}
                        onChange={(e) =>
                          setStatus(e.target.value as typeof status)
                        }
                      >
                        {TASK_STATUSES.filter(value => value !== "completed" || canComplete || task?.status === "completed").map((s) => (
                          <option key={s} value={s}>
                            {TASK_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="min-w-0 space-y-1.5">
                      <span className={panelLabelClass}>Priority</span>
                      <select
                        className={panelInputClass}
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
                </section>
                <section className="space-y-4">
                  <PanelSectionHeading number={2}>Schedule &amp; Assignment</PanelSectionHeading>
                  <div className="min-w-0 space-y-1.5">
                    <label htmlFor={`${heading}-due`} className={panelLabelClass}>Due date and time <span className="text-red-500">*</span></label>
                    <button id={`${heading}-due`} ref={dueTrigger} type="button" className={panelInputClass + " text-left"} aria-expanded={dueDraft !== null} aria-controls={`${heading}-due-picker`} onClick={() => { if (dueDraft === null) setDueDraft(dueDate); else closeDuePicker(); }}>{dueDate.replace('T', ' ')}</button>
                    {dueDraft !== null && <ManilaDateTimePicker id={`${heading}-due-picker`} value={dueDraft} prefix="Due" label="Choose due date and time" rollPastToday onCancel={closeDuePicker} onDone={value => { setDueDate(value); closeDuePicker(); }} />}
                  </div>
                  <TaskSelector
                    appearance="panel"
                    kind="user"
                    disabled={!!task && !canAssign}
                    selfAssignmentOnly={!canAssign}
                    label="Assigned Agent"
                    required
                    value={assignedUserId}
                    selectedLabel={
                      person
                        ? person.firstName + " " + person.lastName
                        : undefined
                    }
                    onChange={setOwner}
                  />
                </section>
                <section className="space-y-4">
                  <PanelSectionHeading number={3}>Additional Information</PanelSectionHeading>
                  <label className="block space-y-1.5">
                    <span className={panelLabelClass}>Notes</span>
                    <textarea
                      rows={5}
                      maxLength={10000}
                      className={panelInputClass}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {description.length}/10000
                    </span>
                  </label>
                </section>
                <section>
                  <PanelSectionHeading number={4}>
                    Associated Deals ({dealIds.length})
                  </PanelSectionHeading>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Select the Deal associated with this task. Related Leads, Contacts, and Accounts will be linked automatically.
                  </p>
                  <div className="mt-4 space-y-4">
                    <TaskSelector appearance="panel" multiple kind="deal"
                      label="Associate task to deal" required={!task || !!taskAssociationIds(task, 'deal').length}
                      value={dealIds}
                      selectedLabels={[...taskRecordOptions(task, 'deal'), ...createdLabels]}
                      onCreate={editable && !USE_MOCK_DATA && canCreateDeals && dealIds.length < 50 ? () => setCreating('deal') : undefined}
                      onChange={changeDeals} />
                  </div>
                </section>
              </fieldset>
              {task && readableRecords.deal && !!taskRecordOptions(task, 'deal').length && (
                <section aria-label="Associated Deal records" className="space-y-2 text-sm">
                  <h3 className="font-semibold">Deal records</h3>
                  {taskRecordOptions(task, 'deal').map(record => <p key={record.id}>
                    <Link href={taskRecordHref('deal', record.id)} className="text-primary hover:underline">{record.label}</Link>
                  </p>)}
                </section>
              )}
              {task && (['lead', 'contact', 'account'] as const).some(kind => taskRecordOptions(task, kind).length) && (
                <section aria-label="Historical Task associations" className="space-y-2 text-sm">
                  <h3 className="font-semibold">Historical associations</h3>
                  {(['lead', 'contact', 'account'] as const).filter(kind => readableRecords[kind]).flatMap(kind => taskRecordOptions(task, kind).map(record => (
                    <p key={kind + record.id}><span className="capitalize text-muted-foreground">{kind}: </span><Link href={taskRecordHref(kind, record.id)} className="text-primary hover:underline">{record.label}</Link></p>
                  )))}
                </section>
              )}
              {!!task?.relatedRecords?.length && (
                <section aria-label="Related CRM records" className="space-y-3 rounded-xl border border-border p-4">
                  <h3 className="text-sm font-semibold">Related CRM records</h3>
                  <p className="text-xs text-muted-foreground">Connections from the records associated above. These do not change the task’s selected associations.</p>
                  <ul className="space-y-3">
                    {task.relatedRecords.filter(record => readableRecords[record.kind]).map(record => <li key={record.kind + record.id} className="min-w-0 text-sm [overflow-wrap:anywhere]">
                      <span className="capitalize text-muted-foreground">{record.kind}: </span><Link href={taskRecordHref(record.kind, record.id)} className="text-primary hover:underline">{record.label}</Link>
                      <p className="text-xs text-muted-foreground">Via {record.via}</p>
                    </li>)}
                  </ul>
                </section>
              )}
              {task && (
                <dl className="space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                  <div><dt className="inline">Task Owner (Created by): </dt><dd className="inline">{task.createdBy ? `${task.createdBy.firstName} ${task.createdBy.lastName}` : 'Not recorded'}</dd></div>
                  <div>Created {formatDateTime(task.createdAt)}</div>
                  {task.completedAt && (
                    <div>
                      Completed {formatDateTime(task.completedAt)}
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
            </div>
            <footer className={panelFooterClass + " justify-between"}>
              {task && !readOnly && canArchive && !task.isArchived ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-[42px] rounded-xl"
                  disabled={busy || !detailReady}
                  onClick={() => setConfirmArchive(true)}
                >
                  Archive
                </Button>
              ) : (
                <span />
              )}
              <div className="ml-auto flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className={panelSecondaryButtonClass}
                  disabled={busy}
                  onClick={closeGuard.requestClose}
                >
                  Close
                </Button>
                {editable && (
                  <Button type="submit" className={panelPrimaryButtonClass} disabled={busy || !detailReady || !!detail.error || conflict}>
                    {busy ? "Saving…" : task ? "Save changes" : "Create task"}
                  </Button>
                )}
              </div>
            </footer>
          </form>
        )}
        <ConfirmActionDialog open={confirmArchive} onOpenChange={setConfirmArchive}
          title="Archive task?" description="This task will leave active views and can be restored from Archived Data."
          variant="destructive" confirmLabel="Archive" isLoading={busy}
          confirmDisabled={!canArchive || readOnly || !!task?.isArchived || unavailable || !detailReady} onConfirm={archive} />
      </SheetContent>
      {closeGuard.confirmation}
    </Sheet>
  );
}
