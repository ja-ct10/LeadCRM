'use client';
import { useEffect, useState } from 'react';
import type { WorkflowExecutionRun, WorkflowTestResult } from '@leadcrm/shared';
import { workflowsApi } from '@/shared/services/workflows.api';
import { USE_MOCK_DATA } from '@/lib/config';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { WorkflowDialog } from './workflow-dialog';
interface WorkflowRunsProps { workflowId: string; name: string; onClose: () => void; }
export function WorkflowExecutionLogModal({ workflowId, name, onClose }: WorkflowRunsProps) {
  const [runs, setRuns] = useState<WorkflowExecutionRun[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    if (USE_MOCK_DATA) { setLoading(false); return; }
    workflowsApi.getExecutions(workflowId, page).then(response => { if (!cancelled) setRuns(response.data); })
      .catch(failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : 'Unable to load runs.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workflowId, page]);
  return <WorkflowDialog title={`Runs — ${name}`} onClose={onClose}>
    {USE_MOCK_DATA ? <p>Mock mode does not execute automation. Connect the backend to view real runs.</p> : loading ? <p role="status">Loading runs…</p> : error ? <p role="alert">{error}</p> : !runs.length ? <p>No runs on this page.</p> : runs.map(run => <details key={run.id} className="rounded-lg border border-border p-3">
      <summary className="cursor-pointer">{run.status} · {new Date(run.startedAt).toLocaleString()} · {run.entityType}</summary>
      <p className="mt-2 text-sm text-muted-foreground">Record: {run.entityId}</p>
      {run.errorMessage && <p role="alert">{run.errorMessage}</p>}
      <ol className="mt-3 space-y-2">{run.steps.map(step => <li key={step.id} className="rounded border border-border p-2">{step.stepIndex + 1}. {step.actionType.replaceAll('_', ' ')} — {step.status}{step.error && <p className="text-red-600 dark:text-red-400">{step.error}</p>}{step.output && <pre className="overflow-x-auto text-xs">{JSON.stringify(step.output, null, 2)}</pre>}</li>)}</ol>
    </details>)}
    {!USE_MOCK_DATA && <div className="flex gap-2"><Button variant="outline" disabled={loading || page === 1} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page}</span><Button variant="outline" disabled={loading || runs.length < 25} onClick={() => setPage(page + 1)}>Next</Button></div>}
  </WorkflowDialog>;
}
interface WorkflowTestProps extends WorkflowRunsProps { entity: string; }
export function WorkflowTest({ workflowId, name, entity, onClose }: WorkflowTestProps) {
  const [entityId, setEntityId] = useState('');
  const [result, setResult] = useState<WorkflowTestResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function test() {
    setError(''); setResult(null); setLoading(true);
    try { setResult((await workflowsApi.test(workflowId, entityId.trim())).data); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to test workflow.'); }
    finally { setLoading(false); }
  }
  return <WorkflowDialog title={`Test — ${name}`} onClose={onClose}>
    <p>Validate a saved workflow against an existing {entity}. No records are changed and no messages are sent. This checks the configuration; it does not replay a historical event.</p>
    <label className="block space-y-2">Sample {entity} record ID<Input value={entityId} onChange={event => { setEntityId(event.target.value); setResult(null); }} /></label>
    <Button disabled={loading || !entityId.trim() || USE_MOCK_DATA} onClick={() => void test()}>{loading ? 'Validating…' : 'Run dry test'}</Button>
    {USE_MOCK_DATA && <p>Testing requires the real backend.</p>}
    {error && <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}
    {result && <div role="status" className="space-y-2"><p>Trigger: {result.trigger.matched ? 'record matched' : 'not matched'}</p><p>Conditions: {result.conditions.passed}/{result.conditions.total} passed — {result.conditions.matched ? 'matches' : 'does not match'}</p>{result.actions.map((action, index) => <p key={`${action.type}-${index}`}>{index + 1}. {action.type.replaceAll('_', ' ')} — {action.valid ? 'Valid' : 'Needs attention'}: {action.message}</p>)}</div>}
  </WorkflowDialog>;
}
