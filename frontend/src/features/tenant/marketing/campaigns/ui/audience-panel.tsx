'use client';
import { panelBodyClass, panelFooterClass, panelInputClass, panelLabelClass, panelPrimaryActionClass, panelSecondaryActionClass } from '@/shared/components/side-panel-styles';
import React, { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { AUDIENCE_FIELDS, AUDIENCE_OPERATORS, CRM_STATUSES, LEAD_SOURCES, AudiencePreviewSchema, CreateAudienceSchema, type AudienceInput, type AudienceBreakdown, type AudiencePreviewResult, type SavedAudience } from '@leadcrm/shared';
import { audiencesApi } from '@/shared/services/audiences.api';
import { SideSheet } from '@/shared/components/side-sheet';
import { CatalogProductInterestSelect } from '@/shared/components/crm/product-interest-select';
import { EntityCombobox } from '@/shared/components/entity-combobox';
import { PaginationControls } from '@/shared/components/crm/pagination-controls';
import { DataLoadingSkeleton } from '@/shared/components/crm/data-view-states';

export function FieldError({ message }: { message?: string }) {
  return message ? <p role="alert" className="mt-1 text-xs text-red-600">{message}</p> : null;
}
export function AudienceCounts({ counts, channel = 'EMAIL' }: { counts: AudienceBreakdown | null; channel?: 'EMAIL' | 'SMS' }) {
  return <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-700" aria-live="polite">
    {counts ? <><strong>{counts.eligible} eligible recipients</strong><p className="mt-1">Matched: {counts.matched} · {channel === 'SMS' ? <>Missing phone: {counts.missingPhone ?? 0} · Invalid phone: {counts.invalidPhone ?? 0} · Duplicates: {counts.duplicatePhone ?? 0} · Do not contact: {counts.doNotContact ?? 0}</> : <>Missing email: {counts.missingEmail} · Invalid: {counts.invalidEmail} · Duplicates: {counts.duplicateEmail} · Staff: {counts.staffEmail} · Unsubscribed: {counts.unsubscribed} · Blocked: {counts.blocked}</>} · Inactive: {counts.inactive} · Delivery restricted: {counts.recipientNotAllowed}</p></> : 'Audience estimate unavailable.'}
  </div>;
}
const labels = { status: 'Status', source: 'Lead Source', company: 'Company', productInterest: 'Product Interest', assignedUserId: 'Assigned Agent', createdAt: 'Created Date' };
type ConditionDraft = { key: number; field: typeof AUDIENCE_FIELDS[number]; operator: typeof AUDIENCE_OPERATORS[number]; value: string | string[] | { from: string; to: string } | null };
const operatorLabels: Record<string, string> = { equals: 'equals', not_equals: 'not equals', contains: 'contains', any: 'Any date', lte: '≤ Less than or equal', gte: '≥ Greater than or equal', between: 'Range' };
export function AudiencePanel({ onClose, onCreated, channel = 'EMAIL' }: { onClose: () => void; onCreated: (audience: SavedAudience) => void; channel?: 'EMAIL' | 'SMS' }) {
  const [name, setName] = useState('');
  const [source, setSource] = useState<AudienceInput['source']>('ALL');
  const [conditions, setConditions] = useState<ConditionDraft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<AudiencePreviewResult | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1), [limit, setLimit] = useState(25);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false), nextKey = useRef(0);
  const definition = () => ({ source, conditions: conditions.map(({ key: _key, ...c }) => c) });
  function changeCondition(key: number, patch: Partial<ConditionDraft>) {
    setPage(1); setConditions(rows => rows.map(row => row.key === key ? { ...row, ...patch } : row));
  }
  useEffect(() => {
    let cancelled = false;
    setPreview(null); setPreviewError(''); setLoading(false);
    const parsed = AudiencePreviewSchema.safeParse(definition());
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join('.'), issue.message])));
      return;
    }
    setErrors({}); setLoading(true);
    const timer = setTimeout(() => { audiencesApi.preview({ ...parsed.data, channel, page, limit }).then(res => { if (!cancelled) setPreview(res.data); }).catch(e => { if (!cancelled) setPreviewError(e.message); }).finally(() => { if (!cancelled) setLoading(false); }); }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [source, conditions, channel, page, limit]);
  async function save() {
    if (lock.current) return;
    const parsed = CreateAudienceSchema.safeParse({ name, ...definition() });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join('.')] ??= issue.message;
      setErrors(next); return;
    }
    lock.current = true; setBusy(true); setErrors({});
    try { const res = await audiencesApi.create(parsed.data); onCreated(res.data); }
    catch (e) { setErrors({ form: e instanceof Error ? e.message : 'Could not save audience.' }); }
    finally { lock.current = false; setBusy(false); }
  }
  const cls = panelInputClass + ' min-w-0 max-w-full';
  return <SideSheet isOpen onClose={onClose} title="Create Target Audience" subtitle="Define conditions to segment your leads and contacts">
    <div className="flex h-full min-h-0 min-w-0 flex-col"><div className={panelBodyClass + ' min-w-0 space-y-5'}>
      <div><label className={panelLabelClass + ' mb-1.5'} htmlFor="audience-name">Audience Name <span className="text-red-500">*</span></label><input id="audience-name" className={cls} value={name} onChange={e => setName(e.target.value)} /><FieldError message={errors.name} /></div>
      <div><label className={panelLabelClass + ' mb-1.5'} htmlFor="audience-source">Source <span className="text-red-500">*</span></label><select id="audience-source" className={cls} value={source} onChange={e => { setPage(1); setSource(e.target.value as AudienceInput['source']); }}><option value="ALL">All Leads &amp; Contacts</option><option value="LEADS">All Leads</option><option value="CONTACTS">All Contacts</option></select></div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold"><span>Conditions (all must match)</span><button type="button" className="min-h-10 rounded-xl px-3 text-sm text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10" disabled={conditions.length >= 20} onClick={() => { setPage(1); setConditions(c => [...c, { key: nextKey.current++, field: 'status', operator: 'equals', value: '' }]); }}>+ Add Condition</button></div>
      <p className="text-xs text-slate-500">Leave conditions empty to include all records from the selected source.</p>
      {conditions.map((c, i) => <div key={c.key} className="grid min-w-0 grid-cols-[minmax(0,1fr)_2.5rem] items-start gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_2.5rem] dark:border-white/10">
        <div className="min-w-0"><label className={panelLabelClass + ' mb-1.5'} htmlFor={`field-${c.key}`}>Field</label><select id={`field-${c.key}`} className={cls} value={c.field} onChange={e => changeCondition(c.key, { field: e.target.value as ConditionDraft['field'], operator: e.target.value === 'createdAt' ? 'any' : 'equals', value: e.target.value === 'productInterest' ? [] : e.target.value === 'createdAt' ? null : '' })}>{AUDIENCE_FIELDS.map(f => <option key={f} value={f}>{labels[f]}</option>)}</select></div>
        <div className="col-start-1 min-w-0 sm:col-start-auto"><label className={panelLabelClass + ' mb-1.5'} htmlFor={`operator-${c.key}`}>Operator</label><select id={`operator-${c.key}`} className={cls} value={c.operator} onChange={e => changeCondition(c.key, { operator: e.target.value as ConditionDraft['operator'], ...(c.field === 'createdAt' ? { value: e.target.value === 'any' ? null : e.target.value === 'between' ? { from: '', to: '' } : '' } : {}) })}>{(c.field === 'createdAt' ? ['any', 'lte', 'gte', 'between'] : c.field === 'company' ? ['equals', 'not_equals', 'contains'] : ['equals', 'not_equals']).map(op => <option key={op} value={op}>{operatorLabels[op]}</option>)}</select></div>
        <div className="col-start-1 min-w-0 sm:col-start-auto"><label className={panelLabelClass + ' mb-1.5'} htmlFor={`value-${c.key}`}>Value</label>
          {c.field === 'status' || c.field === 'source' ? <select id={`value-${c.key}`} className={cls} value={typeof c.value === 'string' ? c.value : ''} onChange={e => changeCondition(c.key, { value: e.target.value })}><option value="">Select {c.field === 'status' ? 'status' : 'source'}</option>{(c.field === 'status' ? CRM_STATUSES : LEAD_SOURCES).map(value => <option key={value}>{value}</option>)}</select>
            : c.field === 'productInterest' ? <CatalogProductInterestSelect id={`value-${c.key}`} values={Array.isArray(c.value) ? c.value : []} onChange={value => changeCondition(c.key, { value })} />
            : c.field === 'assignedUserId' ? <EntityCombobox entityType="users" placeholder="Select Assigned Agent" value={typeof c.value === 'string' ? c.value : null} onChange={value => changeCondition(c.key, { value: value || '' })} />
            : c.field === 'createdAt' ? c.operator === 'any' ? <p className="flex min-h-11 items-center text-xs text-slate-500">All dates</p> : c.operator === 'between' ? <div className="flex min-w-0 flex-col gap-1">
              <label className="text-xs">From<input id={`value-${c.key}`} aria-label="Created From" type="date" className={cls} value={c.value && typeof c.value === 'object' && !Array.isArray(c.value) ? c.value.from : ''} onChange={e => changeCondition(c.key, { value: { from: e.target.value, to: c.value && typeof c.value === 'object' && !Array.isArray(c.value) ? c.value.to : '' } })} /></label>
              <label className="text-xs">To<input aria-label="Created To" type="date" className={cls} value={c.value && typeof c.value === 'object' && !Array.isArray(c.value) ? c.value.to : ''} min={c.value && typeof c.value === 'object' && !Array.isArray(c.value) ? c.value.from || undefined : undefined} onChange={e => changeCondition(c.key, { value: { from: c.value && typeof c.value === 'object' && !Array.isArray(c.value) ? c.value.from : '', to: e.target.value } })} /></label>
            </div> : <input id={`value-${c.key}`} aria-label="Created Date" type="date" className={cls} value={typeof c.value === 'string' ? c.value : ''} onChange={e => changeCondition(c.key, { value: e.target.value })} />
            : <input id={`value-${c.key}`} type="text" className={cls} value={typeof c.value === 'string' ? c.value : ''} onChange={e => changeCondition(c.key, { value: e.target.value })} />}
          <FieldError message={errors[`conditions.${i}.value`] || errors[`conditions.${i}.operator`]} />
        </div>
        <button type="button" aria-label="Remove condition" title="Remove condition" className="col-start-2 row-start-1 mt-6 flex min-h-11 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500 sm:col-start-4 dark:text-red-400 dark:hover:bg-red-500/10" onClick={() => { setPage(1); setConditions(rows => rows.filter(row => row.key !== c.key)); }}><Trash2 size={16} /></button>
      </div>)}
      <AudienceCounts counts={preview} channel={channel} /><FieldError message={previewError || errors.form} />
      <section aria-label="Eligible Recipients" aria-busy={loading} className="min-w-0 space-y-2">
        <h3 className="text-sm font-semibold">Eligible Recipients</h3>
        {loading ? <DataLoadingSkeleton rowCount={3} columnCount={2} /> : preview && <>
          <p className="text-xs text-slate-500">Showing {preview.recipients?.length ?? 0} of {preview.eligible} eligible recipients</p>
          {preview.recipients?.length ? <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-white/10 dark:border-white/10">
            {preview.recipients.map(r => <li key={`${r.recordType}-${r.id}`} className="min-w-0 space-y-1 px-3 py-2 text-xs [overflow-wrap:anywhere]"><div className="flex flex-wrap items-center gap-2"><strong>{r.name || 'Unnamed recipient'}</strong><span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-white/10 dark:text-slate-300">{r.recordType}</span></div>{r.company && <p className="text-slate-500">{r.company}</p>}<p>{channel === 'SMS' ? r.phone : r.email}</p></li>)}
          </ul> : <p className="rounded-lg border border-slate-200 p-3 text-xs text-slate-500 dark:border-white/10">No eligible recipients match these conditions.</p>}
          {preview.meta && <PaginationControls currentPage={page} totalRecords={preview.meta.total} pageSize={limit} onPageChange={setPage} onPageSizeChange={size => { setPage(1); setLimit(size); }} />}
        </>}
      </section>
      </div><div className={panelFooterClass + ' shrink-0 justify-end'}><button className={panelSecondaryActionClass} onClick={onClose} disabled={busy}>Cancel</button><button onClick={save} disabled={busy} className={panelPrimaryActionClass}>{busy ? 'Saving...' : 'Create Audience'}</button></div>
    </div>
  </SideSheet>;
}
