'use client';
import type { WorkflowDraft, WorkflowOptions } from '@leadcrm/shared';
import { WorkflowDefinitionSummary } from './workflow-definition-summary';
import { useEffect, useState } from 'react';
import { workflowsApi } from '@/shared/services/workflows.api';
import { Button } from '@/shared/components/ui/button';
import { SlidingDrawer } from '@/shared/components/sliding-drawer';
import { ConfirmActionDialog } from '@/shared/components/crm/confirm-action-dialog';

export function WorkflowVersionHistory({ workflowId, version, dirty, onRestore, options }: { workflowId: string; version?: number; dirty: boolean; options?: WorkflowOptions; onRestore?: (version: number) => Promise<void> }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [rows, setRows] = useState<Array<{ version: number; createdAt: string; definition: WorkflowDraft }>>([]), [restoring, setRestoring] = useState<number | null>(null);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(''); setBusy(true);
    workflowsApi.versions(workflowId).then(result => { if (!cancelled) setRows(result.data); }).catch(failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : 'Unable to load versions.'); }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [open, workflowId, version]);
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Version history</Button>
    <SlidingDrawer isOpen={open} onClose={() => { if (!busy) setOpen(false); }} title="Published versions">
      <div className="space-y-4 p-5"><p className="text-sm text-muted-foreground">Restore a version into the shared draft. The active workflow continues until you publish changes.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {busy && <p role="status">Loading…</p>}
        {!busy && !rows.length && <p>No published versions yet.</p>}
        <ul className="space-y-3">{rows.map(row => <li key={row.version} className="space-y-3 rounded-lg border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><strong>Version {row.version}</strong>{row.version === version && <span className="ml-2 text-xs">Current</span>}<p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(row.createdAt))}</p></div>{onRestore && <Button size="sm" variant="outline" disabled={busy} onClick={() => setRestoring(row.version)}>Restore into draft</Button>}</div><details><summary className="cursor-pointer text-sm">View definition</summary><div className="mt-3"><WorkflowDefinitionSummary definition={row.definition} options={options} /></div></details></li>)}</ul>
      </div>
    </SlidingDrawer>
    <ConfirmActionDialog open={restoring !== null} onOpenChange={value => { if (!value && !busy) setRestoring(null); }} title="Restore this version into the draft?" description={dirty ? 'This replaces the shared draft and your unsaved editor changes. The published version stays active.' : 'This replaces the shared draft. The published version stays active until you publish.'} confirmLabel="Restore draft" isLoading={busy} onConfirm={async () => {
      if (restoring === null || !onRestore) return;
      setBusy(true); setError('');
      try { await onRestore(restoring); setRestoring(null); setOpen(false); }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to restore this version.'); }
      finally { setBusy(false); }
    }} />
  </>;
}
