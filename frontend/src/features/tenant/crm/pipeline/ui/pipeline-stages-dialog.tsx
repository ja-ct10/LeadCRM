'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { DataLoadingSkeleton } from '@/shared/components/crm/data-view-states';
import { pipelinesApi } from '@/shared/services/pipelines.api';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import type { Stage } from '@/store/types';

export function PipelineStagesDialog({ pipelineId, onClose, onChanged }: { pipelineId: string; onClose: () => void; onChanged: () => Promise<void> }) {
  const canEdit = useHasPermission('deals.edit'), canCreate = useHasPermission('deals.create'), canDelete = useHasPermission('deals.delete');
  const [stages, setStages] = useState<Stage[]>([]), [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [name, setName] = useState(''), [removing, setRemoving] = useState<Stage>();
  const pending = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const reload = async () => {
    const result = await pipelinesApi.get(pipelineId);
    const ordered = [...result.data.stages].sort((a, b) => a.order - b.order);
    setStages(ordered); setNames(Object.fromEntries(ordered.map(s => [s.id, s.name])));
  };
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    let active = true;
    pipelinesApi.get(pipelineId).then(result => {
      if (!active) return;
      const ordered = [...result.data.stages].sort((a, b) => a.order - b.order);
      setStages(ordered); setNames(Object.fromEntries(ordered.map(s => [s.id, s.name])));
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; previousFocus.current?.focus(); };
  }, [pipelineId]);
  const mutate = async (operation: () => Promise<unknown>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await operation(); setRemoving(undefined); await reload(); await onChanged(); toast.success('Pipeline stages updated'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update stages'); }
    finally { pending.current = false; setBusy(false); }
  };
  const move = (index: number, direction: number) => {
    const ids = stages.map(s => s.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    void mutate(() => pipelinesApi.reorderStages(pipelineId, ids));
  };
  return <Dialog open onOpenChange={open => { if (!open && !pending.current) onClose(); }}>
    <DialogContent aria-label="Manage pipeline stages" className="max-h-[90dvh] overflow-y-auto p-4 sm:p-6" tabIndex={-1} ref={node => { if (node && !node.contains(document.activeElement)) node.focus(); }} onKeyDown={e => {
      if (e.key !== 'Tab') return;
      const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'));
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }}>
      <DialogHeader><DialogTitle className="pr-8">Manage pipeline stages</DialogTitle><p className="text-sm text-muted-foreground">Sales Pipeline</p></DialogHeader>
      {error && <p role="alert" className="my-3 text-sm text-destructive">{error}</p>}
      {loading ? <div role="status" aria-label="Loading pipeline stages"><DataLoadingSkeleton rowCount={5} columnCount={2} rowHeight={76} /></div> : removing ? <div className="mt-4 space-y-4">
        <p className="break-words text-sm">Remove “{removing.name}”? This cannot be undone. Stages referenced by Deals, including archived Deals, or stage history cannot be removed.</p>
        <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => { setRemoving(undefined); setError(''); }}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={() => void mutate(() => pipelinesApi.deleteStage(removing.id))}>Remove stage</Button></div>
      </div> : <div className="mt-4 space-y-4">
        <ol className="space-y-3">{stages.map((stage, index) => <li key={stage.id} className="min-w-0 rounded-xl border border-border p-3">
          <label className="block text-xs text-muted-foreground" htmlFor={`stage-${stage.id}`}>Stage {index + 1}{stage.isDefault ? ' · Starting stage' : stage.isWon ? ' · Won' : stage.isLost ? ' · Lost' : ''}</label>
          <input id={`stage-${stage.id}`} value={names[stage.id] ?? ''} onChange={e => setNames(old => ({ ...old, [stage.id]: e.target.value }))} maxLength={100} disabled={busy || !canEdit} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm" />
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {canEdit && <><Button variant="ghost" size="icon" aria-label={`Move ${stage.name} up`} title="Move up" disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></Button><Button variant="ghost" size="icon" aria-label={`Move ${stage.name} down`} title="Move down" disabled={busy || index === stages.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></Button><Button size="sm" variant="outline" disabled={busy || !names[stage.id]?.trim() || names[stage.id].trim() === stage.name} onClick={() => void mutate(() => pipelinesApi.updateStage(stage.id, { name: names[stage.id].trim() }))}>Save name</Button></>}
            {canDelete && <Button variant="ghost" size="icon" className="ml-auto" aria-label={`Remove ${stage.name}`} title="Remove stage" disabled={busy || stage.isDefault || stage.isWon || stage.isLost} onClick={() => { setRemoving(stage); setError(''); }}><Trash2 size={16} /></Button>}
          </div>
        </li>)}</ol>
        {canCreate && <form className="space-y-2 border-t border-border pt-3" onSubmit={e => { e.preventDefault(); if (name.trim()) void mutate(async () => { await pipelinesApi.createStage({ pipelineId, name: name.trim(), order: Math.max(0, ...stages.map(s => s.order)) + 1 }); setName(''); }); }}><label htmlFor="new-stage-name" className="text-sm">New stage</label><input id="new-stage-name" maxLength={100} value={name} disabled={busy} onChange={e => setName(e.target.value)} className="min-h-11 w-full rounded-lg border border-input bg-background px-2 text-sm" /><Button disabled={busy || !name.trim()} type="submit">Add stage</Button></form>}
        {!!error && !stages.length && <Button variant="outline" onClick={() => void mutate(reload)}>Retry</Button>}
      </div>}
    </DialogContent>
  </Dialog>;
}
