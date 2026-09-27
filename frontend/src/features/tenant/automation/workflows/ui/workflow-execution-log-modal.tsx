'use client';
import { useEffect, useState } from 'react';
import type { WorkflowExecutionRun } from '@leadcrm/shared';
import { workflowsApi } from '@/shared/services/workflows.api';
import { Button } from '@/shared/components/ui/button';
import { WorkflowDialog } from './workflow-dialog';
interface WorkflowRunsProps {
  workflowId: string;
  name: string;
  onClose: () => void;
}
export function WorkflowExecutionLogModal({
  workflowId,
  name,
  onClose,
}: WorkflowRunsProps) {
  return (
    <WorkflowDialog title={`Runs — ${name}`} onClose={onClose}>
      <WorkflowRuns workflowId={workflowId} />
    </WorkflowDialog>
  );
}
export function WorkflowRuns({ workflowId }: { workflowId: string }) {
  const [runs, setRuns] = useState<WorkflowExecutionRun[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    workflowsApi
      .getExecutions(workflowId, page)
      .then((response) => {
        if (!cancelled) setRuns(response.data);
      })
      .catch((failure) => {
        if (!cancelled)
          setError(
            failure instanceof Error ? failure.message : 'Unable to load runs.',
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workflowId, page, retry]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted-foreground)]">
        Runs show the action order at execution time. Older runs may differ from
        the current canvas.
      </p>
      <Button
        variant="outline"
        disabled={loading}
        onClick={() => setRetry(retry + 1)}
      >
        Refresh activity
      </Button>
      {loading ? (
        <p role="status">Loading runs…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !runs.length ? (
        <p>
          No runs on this page. Activity appears after a matching CRM event.
        </p>
      ) : (
        runs.map((run) => (
          <details key={run.id} className="rounded-lg border border-[var(--border)] p-3">
            <summary className="cursor-pointer">
              {run.status} · {new Date(run.startedAt).toLocaleString()} ·{' '}
              {run.entityType}
            </summary>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Record: {run.trigger.payload?.recordName || run.entityType}
              <br />
              Trigger: {run.trigger.triggerType.replaceAll('_', ' ')}
              <br />
              Finished:{' '}
              {run.completedAt
                ? new Date(run.completedAt).toLocaleString()
                : 'In progress or interrupted — review before replay'}
            </p>
            {run.errorMessage && <p role="alert">{run.errorMessage}</p>}
            <ol className="mt-3 space-y-2">
              {run.steps.map((step) => (
                <li key={step.id} className="rounded border border-[var(--border)] p-2">
                  {step.stepIndex + 1}. {step.actionType.replaceAll('_', ' ')} —{' '}
                  {step.status}
                  {step.output?.reason === 'Action disabled' && (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Action disabled
                    </p>
                  )}
                  {step.error && (
                    <p className="text-red-600 dark:text-red-400">
                      {step.error}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </details>
        ))
      )}
      {
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={loading || page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span>Page {page}</span>
          <Button
            variant="outline"
            disabled={loading || runs.length < 25}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      }
    </div>
  );
}
