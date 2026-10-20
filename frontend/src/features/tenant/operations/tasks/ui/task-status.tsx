import { TASK_STATUS_LABELS, taskDisplayStatus, type TaskDisplayStatus, type TaskRecord } from '@leadcrm/shared';

export const taskStatusClasses: Record<TaskDisplayStatus, string> = {
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  cancelled: 'bg-slate-700 text-slate-100 dark:bg-slate-700 dark:text-slate-100',
};

export function TaskStatusBadge({ task }: { task: Pick<TaskRecord, 'status' | 'dueDate' | 'isArchived' | 'displayStatus'> }) {
  const status = taskDisplayStatus(task);
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs ${taskStatusClasses[status]}`}>{TASK_STATUS_LABELS[status]}</span>;
}
