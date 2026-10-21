import { TASK_STATUS_LABELS, taskDisplayStatus, type TaskDisplayStatus, type TaskRecord } from '@leadcrm/shared';

export const taskStatusClasses: Record<TaskDisplayStatus, string> = {
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300'
    + ' hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-500/20 dark:hover:text-gray-300 focus:bg-gray-100 focus:text-gray-700 dark:focus:bg-gray-500/20 dark:focus:text-gray-300 active:bg-gray-100 active:text-gray-700 dark:active:bg-gray-500/20 dark:active:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
    + ' hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-500/20 dark:hover:text-blue-300 focus:bg-blue-100 focus:text-blue-700 dark:focus:bg-blue-500/20 dark:focus:text-blue-300 active:bg-blue-100 active:text-blue-700 dark:active:bg-blue-500/20 dark:active:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
    + ' hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-500/20 dark:hover:text-green-300 focus:bg-green-100 focus:text-green-700 dark:focus:bg-green-500/20 dark:focus:text-green-300 active:bg-green-100 active:text-green-700 dark:active:bg-green-500/20 dark:active:text-green-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
    + ' hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-500/20 dark:hover:text-red-300 focus:bg-red-100 focus:text-red-700 dark:focus:bg-red-500/20 dark:focus:text-red-300 active:bg-red-100 active:text-red-700 dark:active:bg-red-500/20 dark:active:text-red-300',
  cancelled: 'bg-slate-700 text-slate-100 dark:bg-slate-700 dark:text-slate-100'
    + ' hover:bg-slate-700 hover:text-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-100 focus:bg-slate-700 focus:text-slate-100 dark:focus:bg-slate-700 dark:focus:text-slate-100 active:bg-slate-700 active:text-slate-100 dark:active:bg-slate-700 dark:active:text-slate-100',
};

export function TaskStatusBadge({ task }: { task: Pick<TaskRecord, 'status' | 'dueDate' | 'isArchived' | 'displayStatus'> }) {
  const status = taskDisplayStatus(task);
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs ${taskStatusClasses[status]}`}>{TASK_STATUS_LABELS[status]}</span>;
}
