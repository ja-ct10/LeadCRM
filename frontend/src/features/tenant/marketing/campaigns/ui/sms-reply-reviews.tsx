'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/shared/components/ui/button';

export function SmsReplyReviews() {
  const { user, tenant } = useAuth();
  const [open, setOpen] = useState(false), [retry, setRetry] = useState(0), [error, setError] = useState('');
  const [rows, setRows] = useState<Array<{ id: string; sender: string; receivedAt: string; reason: string | null; message: string }>>([]), [loading, setLoading] = useState(false);
  useEffect(() => {
    setRows([]);
    if (!open || user?.role !== 'Client Admin') return;
    const controller = new AbortController();
    setLoading(true); setError('');
    apiClient.get<{ data: typeof rows }>('/marketing/campaigns/sms-replies', { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setRows(result.data); }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to load SMS replies.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, retry, user?.id, user?.role, tenant?.id]);
  if (user?.role !== 'Client Admin') return null;
  return <details className="rounded-xl border border-border bg-card p-3" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-medium">SMS replies requiring review</summary>
    <div className="mt-3 space-y-3"><p className="text-xs text-muted-foreground">Ambiguous replies do not change customer status. Resolve the phone, ownership, or receiving configuration issue first. Existing received messages are preserved for review.</p>
      <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => setRetry(value => value + 1)}>Refresh replies</Button>
      {loading && <p role="status">Loading…</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!loading && !error && !rows.length && <p className="text-sm text-muted-foreground">No replies require review.</p>}
      <ul className="space-y-2">{rows.map(row => <li key={row.id} className="rounded-lg border border-border p-3 text-sm"><strong>{row.sender}</strong><p>{row.reason}</p><p className="my-2 whitespace-pre-wrap break-words">{row.message}</p><Button type="button" size="sm" variant="outline" disabled={loading} onClick={async () => { setLoading(true); setError(''); try { await apiClient.post(`/marketing/campaigns/sms-replies/${row.id}/retry`, {}); setRetry(value => value + 1); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to retry this reply.'); } finally { setLoading(false); } }}>Retry matching</Button><time className="text-xs text-muted-foreground" dateTime={row.receivedAt}>{new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(row.receivedAt))}</time></li>)}</ul>
    </div>
  </details>;
}
