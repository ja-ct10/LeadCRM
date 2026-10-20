import React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskBulkSchema,
  TaskQuerySchema,
  TaskStatusSchema,
  StoredTaskStatusSchema,
  taskDisplayStatus,
  isTaskOverdue,
  taskDateRange,
} from "@leadcrm/shared";
import type { Task } from "@/store/types";
import { invalidatePageCache } from '@/shared/cache/page-cache';
import { subscribePageCacheInvalidation } from '@/shared/cache/page-cache';
import { useTaskDueTransition } from '../use-task-due-transition';
const api = vi.hoisted(() => ({ list: vi.fn(), summary: vi.fn() }));
vi.mock("@/shared/services/tasks.api", () => ({ tasksApi: api }));
import {
  localTaskQuery,
  taskDueInstant,
  localDateTime,
  isPastManilaTaskDueDateTime,
  manilaCurrentDate,
  manilaLocalDateTime,
  manilaTaskDueInstant,
  resolveManilaTaskDueDateTime,
  useTaskQueries,
} from "../task-data";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});
it('refreshes mounted views at the next due boundary with one timeout and replaces it after rescheduling', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-20T00:00:00Z'));
  const invalidated = vi.fn(); const unsubscribe = subscribePageCacheInvalidation(invalidated);
  const now = new Date().toISOString(), soon = new Date(Date.now() + 1000).toISOString(), later = new Date(Date.now() + 2000).toISOString();
  const { rerender, unmount } = renderHook(({ next }) => { useTaskDueTransition(next, now); useTaskDueTransition(next, now); }, { initialProps: { next: soon } });
  expect(vi.getTimerCount()).toBe(1);
  act(() => vi.advanceTimersByTime(1000));
  expect(invalidated).not.toHaveBeenCalled();
  rerender({ next: later });
  act(() => vi.advanceTimersByTime(1000));
  expect(invalidated).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(invalidated).toHaveBeenCalledTimes(1);
  expect(invalidated).toHaveBeenCalledWith('tasks', undefined);
  unmount(); unsubscribe();
});
const task: Task = {
  id: "task",
  tenantId: "tenant",
  title: "Follow up",
  description: "",
  status: "pending",
  dueDate: "2020-01-01T10:30:00.000Z",
  createdAt: "2020-01-01T00:00:00.000Z",
  assignedUserId: "owner",
};
describe("Task contract and calendar rules", () => {
  it('accepts only To do at manual creation and preserves the four status edits', () => {
    const draft = { title: 'Personal task', dueDate: task.dueDate, dealIds: ['deal'] };
    expect(CreateTaskSchema.parse(draft).status).toBe('pending');
    for (const status of ['blocked', 'overdue', 'completed', 'cancelled', 'in_progress']) expect(CreateTaskSchema.safeParse({ ...draft, status }).success).toBe(false);
    for (const status of ['pending', 'in_progress', 'completed', 'cancelled']) expect(UpdateTaskSchema.safeParse({ status }).success).toBe(true);
    expect(UpdateTaskSchema.safeParse({ status: 'blocked' }).success).toBe(false);
    expect(UpdateTaskSchema.safeParse({ status: 'overdue' }).success).toBe(false);
    expect(StoredTaskStatusSchema.parse('blocked')).toBe('pending');
    const at = Date.parse(task.dueDate);
    expect(taskDisplayStatus({ ...task, status: 'blocked' }, at)).toBe('pending');
    expect(taskDisplayStatus({ ...task, status: 'blocked' }, at + 1)).toBe('overdue');
    expect(taskDisplayStatus({ ...task, dueDate: new Date(at + 2).toISOString() }, at + 1)).toBe('pending');
  });
  it("normalizes only the intentional status alias and rejects blank titles and unsupported fields", () => {
    expect(TaskStatusSchema.parse("in-progress")).toBe("in_progress");
    expect(
      CreateTaskSchema.safeParse({
        title: " ",
        assignedUserId: "owner",
        dueDate: task.dueDate,
      }).success,
    ).toBe(false);
    expect(UpdateTaskSchema.safeParse({ tenantId: "foreign" }).success).toBe(
      false,
    );
    expect(TaskQuerySchema.safeParse({ status: "unknown" }).success).toBe(
      false,
    );
    expect(TaskQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(
      TaskBulkSchema.safeParse({ operation: "complete", ids: [] }).success,
    ).toBe(false);
  });
  it("preserves Manila date and time and constructs half-open Manila calendar boundaries", () => {
    const input = "2026-09-27T21:30";
    expect(localDateTime(taskDueInstant(input))).toBe(input);
    expect(localDateTime(taskDueInstant("2026-09-27"))).toBe(
      "2026-09-27T17:00",
    );
    expect(taskDueInstant('2026-09-27T21:30')).toBe('2026-09-27T13:30:00.000Z');
    expect(taskDueInstant('2026-09-27T13:30:00.000Z')).toBe('2026-09-27T13:30:00.000Z');
    const now = new Date('2026-09-27T23:59:00.000Z');
    expect(taskDateRange('today', now)).toEqual({ dueFrom: '2026-09-27T16:00:00.000Z', dueTo: '2026-09-28T16:00:00.000Z' });
    expect(taskDateRange('week', now)).toEqual({ dueFrom: '2026-09-27T16:00:00.000Z', dueTo: '2026-10-04T16:00:00.000Z' });
  });
  it("uses Manila wall time and rolls an elapsed same-day clock time to tomorrow", () => {
    const now = new Date(manilaTaskDueInstant("2026-10-05T21:50"));
    expect(manilaCurrentDate(now)).toBe("2026-10-05");
    expect(manilaLocalDateTime(now)).toBe("2026-10-05T21:50");
    expect(resolveManilaTaskDueDateTime("2026-10-05T21:30", now)).toBe("2026-10-06T21:30");
    expect(resolveManilaTaskDueDateTime("2026-10-05T22:30", now)).toBe("2026-10-05T22:30");
    expect(isPastManilaTaskDueDateTime("2026-10-06T21:30", now)).toBe(false);
    expect(manilaLocalDateTime(manilaTaskDueInstant("2026-10-06T21:30"))).toBe("2026-10-06T21:30");
  });
  it("excludes completed, cancelled and archived records from overdue", () => {
    expect(isTaskOverdue(task)).toBe(true);
    for (const status of ["completed", "cancelled"])
      expect(isTaskOverdue({ ...task, status })).toBe(false);
    expect(isTaskOverdue({ ...task, isArchived: true })).toBe(false);
  });
});
describe("Task query owner", () => {
  it.each(['Sales Agent', 'Sales Representative'])('scopes %s mock rows before filters, pagination and summaries', role => {
    const actor = { id: 'owner', tenantId: 'tenant', role };
    const rows = [task, { ...task, id: 'done', status: 'completed' as const, createdById: 'other' },
      { ...task, id: 'created-by-me', createdById: actor.id, assignedUserId: 'other' },
      { ...task, id: 'foreign', tenantId: 'foreign' }];
    const result = localTaskQuery(rows, { limit: 1, page: 2 }, actor);
    expect(result.page.data).toHaveLength(1);
    expect(result.page.meta.total).toBe(2);
    expect(result.summary).toMatchObject({ total: 2, completed: 1, overdue: 1 });
    expect(localTaskQuery(rows, { assignedUserId: 'other' }, actor).page.data).toEqual([]);
    expect(localTaskQuery(rows, { search: 'Follow', overdue: true }, actor).page.data.map(row => row.id)).toEqual(['task']);
    expect(localTaskQuery(rows, {}, { ...actor, role: 'Sales Manager' }).page.meta.total).toBe(2);
    expect(localTaskQuery(rows, {}, { ...actor, role: 'Sales Manager', taskTeamUserIds: ['owner', 'other'] }).page.meta.total).toBe(3);
    for (const role of ['Top Management', 'Client Admin', 'Viewer']) {
      expect(localTaskQuery(rows, {}, { ...actor, role }).page.meta.total).toBe(3);
    }
  });

  it('refreshes both active session lists and summaries when assignment changes', async () => {
    let assignedUserId = 'owner';
    api.list.mockImplementation(async query => ({ data: query.assignedUserId === assignedUserId ? [{ ...task, assignedUserId }] : [], meta: { total: query.assignedUserId === assignedUserId ? 1 : 0 } }));
    api.summary.mockImplementation(async query => ({ data: { total: query.assignedUserId === assignedUserId ? 1 : 0 } }));
    const { result } = renderHook(() => ({
      a: useTaskQueries('tenant:a:Sales Agent:true', [], false),
      b: useTaskQueries('tenant:b:Sales Agent:true', [], false),
    }));
    expect((await result.current.a.queryTasks({ assignedUserId: 'owner' })).data).toHaveLength(1);
    expect((await result.current.b.queryTasks({ assignedUserId: 'other' })).data).toEqual([]);
    await result.current.a.queryTaskSummary({ assignedUserId: 'owner' });
    await result.current.b.queryTaskSummary({ assignedUserId: 'other' });
    assignedUserId = 'other';
    act(() => invalidatePageCache('tasks', 'tenant'));
    await waitFor(() => expect([result.current.a.tasksRevision, result.current.b.tasksRevision]).toEqual([1, 1]));
    expect((await result.current.a.queryTasks({ assignedUserId: 'owner' })).data).toEqual([]);
    expect((await result.current.b.queryTasks({ assignedUserId: 'other' })).data).toHaveLength(1);
    expect((await result.current.a.queryTaskSummary({ assignedUserId: 'owner' })).total).toBe(0);
    expect((await result.current.b.queryTaskSummary({ assignedUserId: 'other' })).total).toBe(1);
  });

  it("paginates beyond 100 and keeps counts independent of the current page", () => {
    const rows = Array.from({ length: 125 }, (_, index) => ({
      ...task,
      id: String(index).padStart(3, "0"),
      leadId: "lead",
    }));
    const result = localTaskQuery(rows, {
      page: 2,
      limit: 100,
      leadId: "lead",
    });
    expect(result.page.data).toHaveLength(25);
    expect(result.summary).toMatchObject({
      total: 125,
      active: 125,
      overdue: 125,
    });
    expect(
      localTaskQuery(rows, { leadId: "same-name-different-id" }).page.meta
        .total,
    ).toBe(0);
    expect(
      localTaskQuery([{ ...task, status: "completed" }], {
        status: "completed",
        overdue: true,
      }).page.data,
    ).toEqual([]);
  });
  it("deduplicates requests, invalidates after mutation, and isolates identities", async () => {
    api.list.mockResolvedValue({ data: [task], meta: { total: 1 } });
    const { result, rerender } = renderHook(
      ({ identity }) => useTaskQueries(identity, [], false),
      { initialProps: { identity: "tenant-a:user" } },
    );
    const first = result.current.queryTasks({});
    expect(result.current.queryTasks({})).toBe(first);
    await first;
    expect(api.list).toHaveBeenCalledOnce();
    act(() => result.current.refreshTasks());
    await result.current.queryTasks({});
    expect(api.list).toHaveBeenCalledTimes(2);
    rerender({ identity: "tenant-b:user" });
    await result.current.queryTasks({});
    expect(api.list).toHaveBeenCalledTimes(3);
  });
  it("propagates read failures and permits a retry", async () => {
    api.list
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce({ data: [], meta: { total: 0 } });
    const { result } = renderHook(() =>
      useTaskQueries("tenant-a:user", [], false),
    );
    await expect(result.current.queryTasks()).rejects.toThrow("Unavailable");
    await expect(result.current.queryTasks()).resolves.toMatchObject({
      data: [],
    });
  });
  it('refreshes Task relationship labels when a CRM record changes', async () => {
    api.list.mockResolvedValue({ data: [task], meta: { total: 1 } });
    const { result } = renderHook(() => useTaskQueries('tenant:user', [], false));
    await result.current.queryTasks({});
    for (const module of ['leads', 'contacts', 'accounts', 'deals']) {
      const previous = result.current.tasksRevision;
      act(() => invalidatePageCache(module, 'tenant'));
      await waitFor(() => expect(result.current.tasksRevision).toBe(previous + 1));
      await result.current.queryTasks({});
    }
    expect(api.list).toHaveBeenCalledTimes(5);
  });
  it('coalesces repeated CRM and Task invalidations into one query refresh', async () => {
    const { result } = renderHook(() => useTaskQueries('tenant:user', [], false));
    act(() => {
      invalidatePageCache('activities', 'tenant');
      invalidatePageCache('tasks', 'tenant');
      invalidatePageCache('contacts', 'tenant');
    });
    await waitFor(() => expect(result.current.tasksRevision).toBe(1));
  });
});

it("validates bounded multiple links and finds tasks through secondary links",()=>{
  expect(UpdateTaskSchema.parse({dealIds:["a","a","b"]}).dealIds).toEqual(["a","b"]);
  expect(UpdateTaskSchema.safeParse({leadId:"a",leadIds:["b"]}).success).toBe(false);
  expect(UpdateTaskSchema.safeParse({leadIds:Array.from({length:51},(_,i)=>String(i))}).success).toBe(false);
  const result=localTaskQuery([{...task,leadId:"a",leadIds:["a","b"]}],{leadId:"b"});
  expect(result.page.data).toHaveLength(1);
  expect(result.summary.total).toBe(1);
  expect(localTaskQuery([{...task,leadId:null,leadIds:[]}],{leadId:"b"}).page.data).toHaveLength(0);
});
