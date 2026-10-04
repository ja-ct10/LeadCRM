'use client';
import { useEffect, useState } from 'react';
import type { WorkflowExecutionRun } from '@leadcrm/shared';
import { WORKFLOW_TRIGGERS } from '@leadcrm/shared';
import { workflowActionLabel } from '../services/workflow-editor';
import { workflowsApi } from '@/shared/services/workflows.api';
import { Button } from '@/shared/components/ui/button';
import { Sheet, SheetContent } from '@/shared/components/ui/sheet';
import { DataLoadingSkeleton } from '@/shared/components/crm/data-view-states';
import {
  panelBodyClass,
  panelCloseClass,
  panelFooterClass,
  panelHeaderClass,
  panelSecondaryButtonClass,
  panelSurfaceClass,
  panelTitleClass,
} from '@/shared/components/side-panel-styles';
import { ChevronRight, X } from 'lucide-react';
interface WorkflowRunsProps {
  workflowId: string;
  name: string;
  status?: string;
  onClose: () => void;
}
export function WorkflowExecutionLogModal({
  workflowId,
  name,
  status,
  onClose,
}: WorkflowRunsProps) {
  return (
    <Sheet open onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent showClose={false} aria-label={`Runs — ${name}`} className={panelSurfaceClass}>
        <header className={panelHeaderClass + ' flex items-start gap-3'}>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Workflow runs{status ? ` · ${status}` : ''}</p>
            <h2 className={panelTitleClass}>{name}</h2>
          </div>
          <Button variant="ghost" size="icon" className={panelCloseClass + ' -mr-1 -mt-2'} onClick={onClose} aria-label="Close workflow runs"><X size={16} /></Button>
        </header>
        <WorkflowRuns key={workflowId} workflowId={workflowId} layout="panel" />
      </SheetContent>
    </Sheet>
  );
}
function runStatusClass(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'failed':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
    case 'running':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  }
}

export function WorkflowRuns({ workflowId, layout = 'inline' }: { workflowId: string; layout?: 'inline' | 'panel' }) {
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
    <div className={'min-w-0 [overflow-wrap:anywhere] ' + (layout === 'panel' ? 'flex min-h-0 flex-1 flex-col' : 'space-y-4')}>
      <div className={layout === 'panel' ? panelBodyClass + ' space-y-4' : 'space-y-4'}>
        <p className="text-sm text-[var(--muted-foreground)]">
          Runs show the action order at execution time. Older runs may differ from
          the current canvas.
        </p>
        <Button
          variant="outline"
          className={panelSecondaryButtonClass}
          disabled={loading}
          onClick={() => setRetry(retry + 1)}
        >
          Refresh activity
        </Button>
        {loading ? (
          <div role="status" aria-label="Loading workflow runs"><DataLoadingSkeleton rowCount={4} columnCount={2} /></div>
        ) : error ? (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>
        ) : !runs.length ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 dark:border-white/10 dark:bg-slate-800/50 dark:text-slate-300">
            No runs on this page. Activity appears after a matching CRM event.
          </p>
        ) : (
          runs.map((run) => (
            <details key={run.id} className="group min-w-0 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
              <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl p-4 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:bg-slate-800/50 [&::-webkit-details-marker]:hidden">
                <ChevronRight aria-hidden="true" size={16} className="mt-1 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5">
                  <span className={'rounded-full px-2.5 py-1 text-xs font-semibold capitalize ' + runStatusClass(run.status)}>{run.status}</span>
                  <span className="text-slate-600 dark:text-slate-300">{new Date(run.startedAt).toLocaleString()} · {run.entityType}</span>
                </span>
              </summary>
              <div className="space-y-3 border-t border-slate-100 p-4 dark:border-white/5">
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Record: {run.trigger.payload?.recordName || run.entityType}
                  <br />
                  Trigger: {WORKFLOW_TRIGGERS.find(trigger => trigger.type === run.trigger.triggerType)?.label ?? run.trigger.triggerType.replaceAll('_', ' ')}
                  <br />
                  Finished:{' '}
                  {run.completedAt
                    ? new Date(run.completedAt).toLocaleString()
                    : 'In progress or interrupted — review before replay'}
                </p>
                {run.errorMessage && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{run.errorMessage}</p>}
                <ol className="space-y-2">
                  {run.steps.map((step) => (
                    <li key={step.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-slate-800/50">
                      {step.stepIndex + 1}. {workflowActionLabel(step.actionType)} —{' '}
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
              </div>
            </details>
          ))
        )}
      </div>
      <div className={layout === 'panel' ? panelFooterClass + ' justify-between' : 'flex flex-wrap items-center gap-2'}>
        <Button
          variant="outline"
          className={panelSecondaryButtonClass}
          disabled={loading || page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <span className="text-sm text-slate-600 dark:text-slate-300">Page {page}</span>
        <Button
          variant="outline"
          className={panelSecondaryButtonClass}
          disabled={loading || runs.length < 25}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
