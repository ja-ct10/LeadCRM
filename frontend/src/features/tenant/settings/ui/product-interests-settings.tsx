'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Eye, Edit, Trash2, Tag } from 'lucide-react';
import { ProductInterestSchema, type ProductInterest } from '@leadcrm/shared';
import { apiClient } from '@/lib/api/client';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { Button } from '@/shared/components/ui/button';
import { SlidingDrawer } from '@/shared/components/sliding-drawer';
import { RowActionsMenu } from '@/shared/components/data-grid/row-actions-menu';
import { ConfirmActionDialog } from '@/shared/components/crm/confirm-action-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { PRODUCT_INTEREST_ENDPOINT as endpoint, useProductInterests, type ProductInterestResponse } from '@/shared/hooks/use-product-interests';
import { toast } from 'sonner';

const php = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputClass = 'min-h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm';
function ProductEditor({ product, busy, onSave, onCancel }: { product?: ProductInterest; busy: boolean; onSave: (data: { name: string; dealValue: number }) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(product?.name ?? '');
  const [amount, setAmount] = useState(product ? String(product.dealValue) : '');
  const [error, setError] = useState('');
  return <form className="space-y-3 rounded-lg border border-border p-3" onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) { setError('Enter a non-negative amount with up to two decimal places.'); return; }
    const parsed = ProductInterestSchema.safeParse({ name, dealValue: Number(amount.trim()) });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setError(''); await onSave(parsed.data);
  }}>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
      <label className="min-w-0 space-y-1 text-xs font-medium">Product Name<input autoFocus className={inputClass} maxLength={200} value={name} disabled={busy} onChange={e => setName(e.target.value)} required /></label>
      <label className="min-w-0 space-y-1 text-xs font-medium">Deal Value (PHP)<span className="relative block"><span className="absolute left-3 top-3 text-sm">₱</span><input className={inputClass + ' pl-7'} aria-label="Deal Value (PHP)" inputMode="decimal" value={amount} disabled={busy} onChange={e => setAmount(e.target.value)} required /></span></label>
    </div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save Product'}</Button></div>
  </form>;
}

export function ProductInterestsSettings() {
  const { products, enabled, loading, error, refresh } = useProductInterests();
  const canEdit = useHasPermission('settings.edit');
  const [open, setOpen] = useState(false), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductInterest | 'field' | null>(null);
  useEffect(() => { if (!open) { setEditor(null); setEditing(false); } }, [open]);
  const saving = useRef(false);
  async function mutate(work: () => Promise<ProductInterestResponse>, successMessage?: string) {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    try {
      const result = await work();
      window.dispatchEvent(new CustomEvent('product-interests-changed', { detail: result }));
      setEditor(null);
      if (successMessage) toast.success(successMessage);
      return true;
    }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to save Product Interest'); return false; }
    finally { saving.current = false; setBusy(false); }
  }
  const actions = [
    { id: 'edit', label: 'Edit', icon: <Edit size={14} />, disabled: !canEdit || busy, onClick: () => { setOpen(true); setEditing(true); } },
    { id: 'delete', label: 'Delete', icon: <Trash2 size={14} />, destructive: true, disabled: !canEdit || busy, onClick: () => setDeleteTarget('field') },
  ];
  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3"><h1 className="text-xl font-bold text-slate-900 dark:text-white">Custom Fields</h1><TooltipProvider><Tooltip><TooltipTrigger asChild><Button disabled={!canEdit || loading || busy || !!error} aria-label="Add New Field" onClick={async () => {
      if (!enabled && !await mutate(() => apiClient.post(endpoint + '/field', {}))) return;
      setOpen(true); setEditing(true); if (!enabled || !products.length) setEditor('new');
    }}><Plus size={18} /><span className="hidden sm:inline">Add New Field</span></Button></TooltipTrigger><TooltipContent>Add New Field</TooltipContent></Tooltip></TooltipProvider></div>
    {loading && !products.length && <div role="status" aria-label="Loading Custom Fields" className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"><div className="overflow-hidden rounded-lg border border-border bg-card"><div className="h-36 bg-slate-100 dark:bg-slate-800 animate-pulse motion-reduce:animate-none" /><div className="space-y-3 p-4"><div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-700 animate-pulse motion-reduce:animate-none" /><div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse motion-reduce:animate-none" /></div></div></div>}
    {error && <div role="alert" className="text-sm text-red-600">{error}<Button variant="ghost" onClick={refresh}>Retry</Button></div>}
    {(!loading || products.length > 0) && !error && enabled && <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      <article className="overflow-hidden rounded-lg border border-border bg-card">
        <button type="button" onClick={() => setOpen(true)} className="flex h-36 w-full items-center justify-center bg-slate-50 dark:bg-slate-800/40" aria-label="View Product Interest"><span className="rounded-lg border border-border bg-card p-5 shadow-sm"><Tag size={32} className="text-primary" /></span></button>
        <div className="flex items-start gap-2 p-4"><button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(true)}><h2 className="font-semibold">Product Interest</h2><p className="mt-1 text-sm text-muted-foreground">Controls product options and their default Deal values.</p></button>
          <RowActionsMenu label="Product Interest actions" position="right" actions={[{ id: 'view', label: 'View', icon: <Eye size={14} />, onClick: () => setOpen(true) }, ...actions]} />
        </div>
      </article>
    </div>}
    {!loading && !error && !enabled && <p className="text-sm text-muted-foreground">Add the Product Interest field to configure products and their default Deal values.</p>}
    <SlidingDrawer isOpen={open} onClose={() => { if (!busy && !deleteTarget) setOpen(false); }} title="Product Interest" subtitle="Manage products and their default Deal values." headerActions={<RowActionsMenu label="Product Interest panel actions" position="right" actions={actions} />}>
      <div className="space-y-4 p-4 sm:p-6">
        <p className="text-xs text-muted-foreground">Changes apply to future Deals. Existing Deal values stay unchanged.</p>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border pb-2 text-xs font-semibold"><span>Product Name</span><span>Deal Value</span></div>
        {products.map(product => <div key={product.id}>
          {editor === product.id ? <ProductEditor product={product} busy={busy} onCancel={() => setEditor(null)} onSave={async data => { await mutate(() => apiClient.patch(endpoint + '/' + product.id, data), 'Product updated successfully.'); }} />
            : <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3"><span className="min-w-0 flex-1 break-words text-sm">{product.name}</span><span className="shrink-0 text-sm tabular-nums">{php.format(product.dealValue)}</span>
              {editing && canEdit && <div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={'Edit ' + product.name} disabled={busy} onClick={() => setEditor(product.id)}><Edit size={16} /></Button><Button variant="ghost" size="icon" aria-label={'Delete ' + product.name} disabled={busy} onClick={() => setDeleteTarget(product)}><Trash2 size={16} /></Button></div>}
            </div>}
        </div>)}
        {!products.length && <p className="text-sm text-muted-foreground">No products configured.</p>}
        {editor === 'new' ? <ProductEditor busy={busy} onCancel={() => setEditor(null)} onSave={async data => { await mutate(() => apiClient.post(endpoint, data), 'Product created successfully.'); }} />
          : <Button variant="outline" disabled={!canEdit || busy} onClick={() => { setEditing(true); setEditor('new'); }}><Plus size={16} />Add Product</Button>}
      </div>
    </SlidingDrawer>
    {deleteTarget && createPortal(<div className="relative z-[400]"><ConfirmActionDialog open onOpenChange={value => { if (!value && !busy) setDeleteTarget(null); }} title={deleteTarget === 'field' ? 'Delete Product Interest?' : 'Delete product?'} description={deleteTarget === 'field' ? 'Remove this custom field and all its products from future selections?' : 'Remove ' + deleteTarget.name + ' from future selections?'} warning="Existing Leads and historical Deals will be preserved." variant="destructive" confirmLabel="Delete" isLoading={busy} onConfirm={async () => {
      if (await mutate(() => apiClient.delete(deleteTarget === 'field' ? endpoint : endpoint + '/' + deleteTarget.id))) { if (deleteTarget === 'field') setOpen(false); setDeleteTarget(null); }
    }} /></div>, document.body)}
  </div>;
}
