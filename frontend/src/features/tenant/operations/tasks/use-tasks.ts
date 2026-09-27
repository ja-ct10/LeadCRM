"use client";
import { useEffect, useState } from "react";
import type { TaskListQuery, TaskPage, TaskSummary } from "@leadcrm/shared";
import { useAuth } from "@/store/AuthContext";
import { useData } from "@/store/DataContext";
import { useHasPermission } from "@/shared/hooks/use-permissions";

export function useTasks(query: TaskListQuery = {}) {
  const { user, tenant } = useAuth();
  const { queryTasks, queryTaskSummary, tasksRevision, refreshTasks } =
    useData();
  const canRead = useHasPermission("deals.view");
  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);
  const queryKey = JSON.stringify(query);
  const identity = `${tenant?.id}:${user?.id}:${user?.activeEnvironment}:${canRead}`;
  const key = `${identity}:${queryKey}:${tasksRevision}`;
  const [result, setResult] = useState<{
    key: string;
    page?: TaskPage;
    summary?: TaskSummary;
    error?: string;
  }>();
  useEffect(() => {
    if (!canRead || !tenant) return;
    let current = true;
    const input: TaskListQuery = JSON.parse(queryKey);
    Promise.all([queryTasks(input), queryTaskSummary(input)])
      .then(([page, summary]) => {
        if (current) setResult({ key, page, summary });
      })
      .catch((error) => {
        if (current)
          setResult({
            key,
            error:
              error instanceof Error ? error.message : "Unable to load tasks.",
          });
      });
    return () => {
      current = false;
    };
  }, [key, queryKey, canRead, tenant, queryTasks, queryTaskSummary]);
  const visible = result?.key === key ? result : undefined;
  return {
    tasks: visible?.page?.data ?? [],
    meta: visible?.page?.meta,
    summary: visible?.summary,
    error: visible?.error,
    loading: canRead && !!tenant && !visible,
    canRead,
    refresh: refreshTasks,
    identity,
  };
}
