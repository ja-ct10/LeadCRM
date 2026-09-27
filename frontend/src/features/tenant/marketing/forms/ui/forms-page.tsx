'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Layout, Edit, Copy, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/store/AuthContext';
import { RowActionsMenu } from '@/shared/components/data-grid/row-actions-menu';
import { getFormsByTenant, createForm, archiveForm, duplicateForm } from '../services/forms.service';
import type { FormRecord } from '../types/form.types';
import { FormBuilderPage } from './form-builder-page';

export default function FormsPage({ onBuilderActiveChange }: { onBuilderActiveChange?: (active: boolean) => void }) {
  const { tenant, user } = useAuth();
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [active, setActive] = useState<FormRecord | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false; setActive(null); setLoading(true); setError('');
    if (!tenant?.id) return;
    getFormsByTenant(tenant.id).then(data => { if (!cancelled) setForms(data); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load forms.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenant?.id, user?.activeEnvironment, retry]);
  useEffect(() => { onBuilderActiveChange?.(!!active); return () => onBuilderActiveChange?.(false); }, [!!active, onBuilderActiveChange]);
  const mutate = async (work: () => Promise<void>) => {
    if (busy) return; setBusy(true);
    try { await work(); } catch (err) { toast.error(err instanceof Error ? err.message : 'Unable to save form.'); } finally { setBusy(false); }
  };
  const update = useCallback((form: FormRecord) => { setForms(items => items.map(f => f.id === form.id ? form : f)); setActive(form); }, []);
  const create = () => void mutate(async () => {
    if (!tenant) return;
    const form = await createForm({ name: 'Contact Us', tenantId: tenant.id });
    setForms(items => [form, ...items]); setActive(form);
  });
  if (active) return <FormBuilderPage key={active.id} form={active} onBack={() => setActive(null)} onFormUpdate={update} />;
  return <div className="space-y-5 min-w-0">
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0"><h1 className="text-xl font-bold">Forms</h1><p className="text-sm text-slate-500 mt-1">Create and manage web forms to capture leads from your website</p></div>
      <button type="button" aria-label="New Form" title="New Form" disabled={busy || loading} onClick={create} className="flex shrink-0 items-center gap-2 rounded-md bg-blue-600 p-3 text-white disabled:opacity-50"><Plus size={18} /><span className="hidden sm:inline text-sm">New Form</span></button>
    </header>
    {loading ? <div aria-label="Loading forms" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(n => <div key={n} className="animate-pulse h-52 rounded-xl bg-slate-200 dark:bg-slate-800" />)}</div>
      : error ? <div role="alert" className="p-6 border rounded-xl"><p>{error}</p><button className="mt-3 text-blue-600 underline" onClick={() => setRetry(v => v + 1)}>Retry</button></div>
      : !forms.length ? <div className="py-16 text-center border border-dashed rounded-xl"><Layout className="mx-auto mb-3 text-slate-400" /><h2 className="font-semibold">No forms yet</h2><p className="text-sm text-slate-500">Create your first Contact Us form to start capturing leads.</p></div>
      : <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{forms.map(form => <article key={form.id} className="min-w-0 border border-slate-200 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
        <button className="h-36 w-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center" aria-label={'Edit ' + form.name} onClick={() => setActive(form)}>
          <div aria-hidden="true" className="w-24 bg-white border rounded-md p-3 shadow-sm space-y-2"><div className="h-2 w-2/3 bg-slate-800 rounded" /><div className="h-2 bg-slate-100 rounded" /><div className="h-2 bg-slate-100 rounded" /><div className="h-3 bg-blue-600 rounded" /></div>
        </button>
        <div className="flex justify-between items-center gap-2 p-4">
          <div className="min-w-0"><button className="text-sm font-semibold truncate max-w-full block" onClick={() => setActive(form)}>{form.name}</button><div className="text-xs text-slate-500 mt-1 flex gap-2"><span className="uppercase bg-slate-100 text-slate-600 px-1 rounded">{form.publishedVersion ? 'Published' : 'Draft'}</span><span>{form.fields.length} fields</span></div></div>
          <RowActionsMenu position="right" actions={[
            { id: 'edit', label: 'Edit', icon: <Edit size={14} />, onClick: () => setActive(form) },
            { id: 'duplicate', label: 'Duplicate', icon: <Copy size={14} />, disabled: busy, onClick: () => void mutate(async () => { const copy = await duplicateForm(form.id); setForms(items => [copy, ...items]); }) },
            { id: 'archive', label: 'Archive', icon: <Archive size={14} />, disabled: busy, onClick: () => void mutate(async () => { await archiveForm(form.id); setForms(items => items.filter(f => f.id !== form.id)); toast.success('Form archived. Submission history retained.'); }) },
          ]} />
        </div>
      </article>)}</div>}
  </div>;
}
