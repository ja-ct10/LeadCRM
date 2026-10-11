'use client';
import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';

export function DealLostDialog({ onClose, onSave }: { onClose: () => void; onSave: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  return <Dialog open onOpenChange={open => { if (!open && !pending.current) onClose(); }}>
    <DialogContent aria-label="Close Deal as lost" className="max-w-sm">
      <DialogHeader><DialogTitle>Mark deal as lost</DialogTitle></DialogHeader>
      <form className="space-y-3" onSubmit={async event => {
        event.preventDefault(); if (pending.current || !reason.trim()) return;
        pending.current = true; setBusy(true); setError('');
        try { await onSave(reason.trim()); onClose(); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to close deal.'); }
        finally { pending.current = false; setBusy(false); }
      }}>
        <label className="block text-sm">Lost reason<textarea aria-label="Lost reason" required maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} className="mt-2 w-full rounded border border-border bg-background p-2" /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !reason.trim()}>{busy ? 'Saving…' : 'Save'}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
