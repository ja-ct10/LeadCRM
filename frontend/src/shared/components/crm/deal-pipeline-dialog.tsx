'use client';
import { useRef, useState } from 'react';
import type { Deal, Pipeline } from '@/store/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import type { MoveDealPipelineInput } from '@leadcrm/shared';

export function DealPipelineDialog({ deal, pipelines, onClose, onMove }: {
  deal: Deal; pipelines: Pipeline[]; onClose: () => void; onMove: (input: MoveDealPipelineInput) => Promise<void>;
}) {
  const [pipelineId, setPipelineId] = useState(''), [stageId, setStageId] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  const choices = pipelines.filter(p => !p.isArchived && p.id !== deal.pipelineId);
  const stages = (choices.find(p => p.id === pipelineId)?.stages ?? []).filter(s => !s.isWon && !s.isLost).sort((a, b) => a.order - b.order);
  const usable = choices.some(p => p.stages.some(s => !s.isWon && !s.isLost));
  return <Dialog open onOpenChange={open => { if (!open && !pending.current) onClose(); }}>
    <DialogContent aria-label="Move this deal to a new pipeline" className="max-w-md">
      <DialogHeader><DialogTitle>Move this deal to a new pipeline</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={async event => {
        event.preventDefault();
        if (pending.current || !stages.some(s => s.id === stageId)) return;
        pending.current = true; setBusy(true); setError('');
        try { await onMove({ pipelineId, stageId }); onClose(); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to move deal.'); }
        finally { pending.current = false; setBusy(false); }
      }}>
        <label className="block text-sm">Choose the target pipeline
          <select aria-label="Choose the target pipeline" className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3" disabled={busy} value={pipelineId} onChange={event => { setPipelineId(event.target.value); setStageId(''); setError(''); }}>
            <option value="">Select a pipeline</option>{choices.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="block text-sm">Choose the target stage
          <select aria-label="Choose the target stage" className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3" disabled={busy || !pipelineId || !stages.length} value={stageId} onChange={event => setStageId(event.target.value)}>
            <option value="">Select a stage</option>{stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">Won and Lost use the separate outcome actions.</p>
        {!usable && <p role="status" className="text-sm">No other pipeline has an available open stage.</p>}
        {pipelineId && !stages.length && <p role="status" className="text-sm">This pipeline has no open stages.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !pipelineId || !stages.some(s => s.id === stageId)}>{busy ? 'Moving…' : 'Move deal'}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
