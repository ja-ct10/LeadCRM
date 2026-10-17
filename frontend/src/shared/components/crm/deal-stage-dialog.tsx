'use client';
import { showCrmMutationError } from '@/shared/utils/crm-mutation-error';
import { useRef, useState } from 'react';
import type { Deal, Pipeline } from '@/store/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { dealStagePipeline } from '@/shared/utils/deal-stage-pipeline';

export function DealStageDialog({ deal, pipelines, onClose, onMove }: {
  deal: Deal; pipelines: Pipeline[]; onClose: () => void; onMove: (stageId: string) => Promise<void>;
}) {
  const [stageId, setStageId] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  const currentPipeline = dealStagePipeline(deal, pipelines);
  const currentStage = currentPipeline?.stages.find(s => s.id === deal.stageId);
  const stages = (currentPipeline?.stages ?? []).filter(s => !s.isWon && !s.isLost).sort((a, b) => a.order - b.order);
  const isCurrentStage = (id: string) => id === deal.stageId;
  const available = stages.some(s => !isCurrentStage(s.id));
  const validTarget = !!currentStage && !currentStage.isWon && !currentStage.isLost && !deal.isArchived && stages.some(s => s.id === stageId) && !isCurrentStage(stageId);
  return <Dialog open onOpenChange={open => { if (!open && !pending.current) onClose(); }}>
    <DialogContent aria-label="Change Deal stage" className="max-w-md space-y-4">
      <DialogHeader><DialogTitle>Change Deal stage</DialogTitle></DialogHeader>
      <section aria-label="Current deal location" className="rounded-lg border border-border bg-muted/30 p-3">
        <dl className="space-y-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">Current pipeline</dt><dd className="font-medium [overflow-wrap:anywhere]">{currentPipeline?.name ?? 'Unavailable'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Current stage</dt><dd className="[overflow-wrap:anywhere]">{currentStage?.name ?? 'Unavailable'}</dd></div>
        </dl>
      </section>
      <form className="space-y-4" onSubmit={async event => {
        event.preventDefault();
        if (pending.current || !validTarget) return;
        pending.current = true; setBusy(true); setError('');
        try { await onMove(stageId); onClose(); }
        catch (failure) { if ((failure as { status?: number })?.status === 403) showCrmMutationError(failure, 'Unable to change stage.'); setError(failure instanceof Error ? failure.message : 'Unable to change stage.'); }
        finally { pending.current = false; setBusy(false); }
      }}>
        <label className="block text-sm">Choose the target stage
          <select aria-label="Choose the target stage" className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3" disabled={busy || !currentStage || !available} value={stageId} onChange={event => { setStageId(event.target.value); setError(''); }}>
            <option value="">Select a stage</option>{stages.map(s => <option key={s.id} value={s.id} disabled={isCurrentStage(s.id)}>{s.name}{isCurrentStage(s.id) ? ' (current)' : ''}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">Won and Lost use the separate outcome actions.</p>
        {!currentStage && <p role="status" className="text-sm">The current pipeline or stage is unavailable. Refresh Deals and try again.</p>}
        {!deal.pipelineId && currentPipeline && <p className="text-xs text-muted-foreground">Using Sales Pipeline because this Deal has no assigned pipeline.</p>}
        {currentPipeline && !available && <p role="status" className="text-sm">No other open stages are available in this pipeline.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !validTarget}>{busy ? 'Moving…' : 'Move deal'}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
