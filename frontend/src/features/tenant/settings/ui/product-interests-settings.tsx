'use client';
import { useEffect, useState } from 'react';
import { ProductInterestConfigSchema, type ProductInterestConfig } from '@leadcrm/shared';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/store/AuthContext';
import { Button } from '@/shared/components/ui/button';
import { toast } from 'sonner';

export function ProductInterestsSettings() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ProductInterestConfig>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setRows([]); setError('');
    apiClient.get<{ data: ProductInterestConfig }>('/administration/product-interests', { signal: controller.signal })
      .then(response => setRows(response.data)).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [user?.tenantId, retry]);
  return <form className="max-w-2xl space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5" onSubmit={async event => {
    event.preventDefault(); const parsed = ProductInterestConfigSchema.safeParse(rows);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true); setError('');
    try { const response = await apiClient.put<{ data: ProductInterestConfig }>('/administration/product-interests', parsed.data); setRows(response.data); toast.success('Product Interest values saved'); }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to save values'); }
    finally { setBusy(false); }
  }}>
    <h2 className="font-semibold">Product Interest</h2><p className="text-sm text-muted-foreground">Default Deal values in PHP. Changes apply to future automatic Deals. Values start at ₱0 until configured.</p>
    {error && <div role="alert" className="text-sm text-red-600">{error}{!rows.length && <Button type="button" variant="ghost" onClick={() => setRetry(v => v + 1)}>Retry</Button>}</div>}
    {!rows.length && !error && <p role="status">Loading Product Interests…</p>}
    <div className="divide-y divide-border"><div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3 py-2 text-xs font-semibold"><span>Product Interest</span><span>Deal Value (PHP)</span></div>{rows.map((row, index) => <label key={row.name} className="grid grid-cols-[minmax(0,1fr)_110px] items-center gap-3 py-3 text-sm"><span className="break-words">{row.name}</span><input aria-label={`${row.name} Deal value`} type="number" min="0" max="999999999999" step="0.01" required disabled={busy || user?.role !== 'Client Admin'} value={Number.isNaN(row.value) ? '' : row.value} onChange={event => setRows(old => old.map((item, i) => i === index ? { ...item, value: event.target.value === '' ? NaN : Number(event.target.value) } : item))} className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-background px-2" /></label>)}</div>
    {user?.role === 'Client Admin' && <Button disabled={busy || !rows.length}>{busy ? 'Saving…' : 'Save values'}</Button>}
  </form>;
}
