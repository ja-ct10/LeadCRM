"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TASK_STATUSES,
  taskAssociationIds,
  TaskQuerySchema,
  StoredTaskStatusSchema,
  taskDisplayStatus,
  isTaskManagerRole,
  isTaskOverdue,
  isTaskAssignmentRestrictedRole,
  type TaskListQuery,
  type TaskPage,
  type TaskSummary,
} from "@leadcrm/shared";
import type { Task } from "@/store/types";
import { subscribePageCacheInvalidation } from "@/shared/cache/page-cache";
import { tasksApi } from "@/shared/services/tasks.api";
import { manilaLocalDateTime, manilaTaskDueInstant } from '@/lib/manila-time';
import { matchesSearch } from '@/shared/utils/search';

type TaskQueryActor = { id: string; tenantId: string; role: string; taskTeamUserIds?: string[] };

export function localTaskQuery(
  tasks: Task[],
  input: TaskListQuery,
  actor?: TaskQueryActor,
): { page: TaskPage; summary: TaskSummary } {
  const query = TaskQuerySchema.parse(input);
  const now = Date.now();
  const eligible = tasks
    .filter((task) => {
      const status = StoredTaskStatusSchema.parse(task.status);
      return (
        (!actor || task.tenantId === actor.tenantId && (isTaskManagerRole(actor.role)
          ? (actor.taskTeamUserIds ?? [actor.id]).includes(task.assignedUserId)
          : !isTaskAssignmentRestrictedRole(actor.role) || task.assignedUserId === actor.id)) &&
        Boolean(task.isArchived) === query.archived &&
        (!query.priority || task.priority === query.priority) &&
        (!query.assignedUserId ||
          task.assignedUserId === query.assignedUserId) &&
        (!query.leadId ||
          taskAssociationIds(task, "lead").includes(query.leadId)) &&
        (!query.contactId ||
          taskAssociationIds(task, "contact").includes(query.contactId)) &&
        (!query.dealId ||
          taskAssociationIds(task, "deal").includes(query.dealId)) &&
        (!query.accountId ||
          taskAssociationIds(task, "account").includes(query.accountId)) &&
        (query.state !== "active" ||
          !["completed", "cancelled"].includes(status)) &&
        (query.state !== "completed" || status === "completed") &&
        (!query.dueFrom ||
          Date.parse(task.dueDate) >= Date.parse(query.dueFrom)) &&
        (!query.dueTo || Date.parse(task.dueDate) < Date.parse(query.dueTo)) &&
        matchesSearch(query.search ?? '', task.title, task.description)
      );
    })
    .map((task) => ({ ...task, status: StoredTaskStatusSchema.parse(task.status), displayStatus: taskDisplayStatus(task, now) }));
  const filtered = eligible.filter(task => (!query.status || task.displayStatus === query.status) && (!query.overdue || task.displayStatus === 'overdue'));
  filtered.sort((a, b) => {
    const aValue = a[query.sortBy] ?? "",
      bValue = b[query.sortBy] ?? "";
    return (
      (query.sortOrder === "asc" ? 1 : -1) * aValue.localeCompare(bValue) ||
      a.id.localeCompare(b.id)
    );
  });
  const byStatus = Object.fromEntries(
    TASK_STATUSES.map((status) => [
      status,
      filtered.filter((task) => task.displayStatus === status).length,
    ]),
  ) as TaskSummary["byStatus"];
  const active = filtered.filter(
    (task) =>
      !task.isArchived && !["completed", "cancelled"].includes(task.status),
  );
  const workload = [...new Set(active.map((task) => task.assignedUserId))].map(
    (assignedUserId) => {
      const rows = active.filter(
        (task) => task.assignedUserId === assignedUserId,
      );
      const person = rows[0].assignedUser;
      return {
        assignedUserId,
        name: person ? `${person.firstName} ${person.lastName}` : "Team member",
        pending: rows.filter((task) => task.displayStatus === "pending").length,
        inProgress: rows.filter((task) => task.displayStatus === "in_progress").length,
        overdue: rows.filter((task) => isTaskOverdue(task)).length,
        total: rows.length,
      };
    },
  );
  return {
    page: {
      data: filtered.slice(
        (query.page - 1) * query.limit,
        query.page * query.limit,
      ),
      meta: {
        total: filtered.length,
        page: query.page,
        limit: query.limit,
        hasMore: query.page * query.limit < filtered.length,
      },
    },
    summary: {
      total: filtered.length,
      active: active.length,
      completed: byStatus.completed,
      overdue: active.filter((task) => isTaskOverdue(task)).length,
      byStatus,
      evaluatedAt: new Date(now).toISOString(),
      nextStatusChangeAt: eligible.filter(task => !task.isArchived && !['completed', 'cancelled'].includes(task.status) && Date.parse(task.dueDate) >= now)
        .map(task => task.dueDate).sort()[0] ?? null,
      workload,
    },
  };
}

/** One query owner, mounted inside the existing DataProvider. No additional Task store. */
export function useTaskQueries(identity: string, tasks: Task[], mock: boolean, actor?: TaskQueryActor) {
  const [tasksRevision, setRevision] = useState(0);
  const owner = useRef({
    identity,
    pages: new Map<string, Promise<TaskPage>>(),
    summaries: new Map<string, Promise<TaskSummary>>(),
  });
  if (owner.current.identity !== identity)
    owner.current = { identity, pages: new Map(), summaries: new Map() };
  const taskRef = useRef(tasks);
  taskRef.current = tasks;
  const actorRef = useRef(actor);
  actorRef.current = actor;
  const refreshTasks = useCallback(() => {
    owner.current.pages.clear();
    owner.current.summaries.clear();
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    let queued: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribePageCacheInvalidation((module) => {
      if (["*", "activities", "tasks", "leads", "contacts", "accounts", "deals"].includes(module)) {
        clearTimeout(queued); queued = setTimeout(refreshTasks, 0);
      }
    });
    return () => { unsubscribe(); clearTimeout(queued); };
  }, [refreshTasks]);
  const queryTasks = useCallback(
    (query: TaskListQuery = {}) => {
      if (mock)
        return Promise.resolve(localTaskQuery(taskRef.current, query, actorRef.current).page);
      const key = JSON.stringify(TaskQuerySchema.parse(query));
      const cache = owner.current.pages;
      let promise = cache.get(key);
      if (!promise) {
        promise = tasksApi.list(query);
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(key, promise);
        void promise.catch(() => {
          if (cache.get(key) === promise) cache.delete(key);
        });
      }
      return promise;
    },
    [mock],
  );
  const queryTaskSummary = useCallback(
    (query: TaskListQuery = {}) => {
      if (mock)
        return Promise.resolve(localTaskQuery(taskRef.current, query, actorRef.current).summary);
      const key = JSON.stringify(
        TaskQuerySchema.parse({ ...query, page: 1, limit: 25 }),
      );
      const cache = owner.current.summaries;
      let promise = cache.get(key);
      if (!promise) {
        promise = tasksApi.summary(query).then((result) => result.data);
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(key, promise);
        void promise.catch(() => {
          if (cache.get(key) === promise) cache.delete(key);
        });
      }
      return promise;
    },
    [mock],
  );
  return useMemo(
    () => ({ tasksRevision, refreshTasks, queryTasks, queryTaskSummary }),
    [tasksRevision, refreshTasks, queryTasks, queryTaskSummary],
  );
}

export function localDateTime(value: string): string {
  return manilaLocalDateTime(value);
}
export function taskDueInstant(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/.test(value)) return manilaTaskDueInstant(value);
  // Persisted ISO instants retain their timezone, including existing API callers.
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) throw new Error('Choose a valid due date and time.');
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new Error("Choose a valid due date and time.");
  return date.toISOString();
}

export { manilaLocalDateTime, manilaCurrentDateTime, manilaCurrentDate, manilaTaskDueInstant, resolveManilaTaskDueDateTime, isPastManilaTaskDueDateTime } from '@/lib/manila-time';
