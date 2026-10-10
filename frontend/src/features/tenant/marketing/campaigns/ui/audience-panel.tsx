'use client';
import { panelBodyClass, panelFooterClass, panelInputClass, panelLabelClass, panelPrimaryActionClass, panelSecondaryActionClass } from '@/shared/components/side-panel-styles';
import React, { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { campaignConditionField, campaignConditionError, campaignFieldOperators, type AudienceCondition, AudienceConditionSchema, AudiencePreviewSchema, CreateAudienceSchema, type AudienceInput, type AudienceBreakdown, type AudiencePreviewResult, type SavedAudience } from '@leadcrm/shared';
import { useCampaignFields } from './campaign-variable-picker';
import { audiencesApi } from '@/shared/services/audiences.api';
import { SideSheet } from '@/shared/components/side-sheet';
import { CatalogProductInterestSelect } from '@/shared/components/crm/product-interest-select';
import { ConditionFieldSelect, ConditionOperatorSelect, ConditionScalarInput } from '@/shared/components/condition-controls';
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
const operatorLabels: Record<string, string> = { equals: 'equals', not_equals: 'not equals', contains: 'contains', not_contains: 'does not contain', starts_with: 'starts with', ends_with: 'ends with', any: 'Any date', gt: 'Greater than', lt: 'Less than', lte: 'Less than or equal', gte: 'Greater than or equal', between: 'Date range', is_empty: 'is empty', is_not_empty: 'is not empty' };
type ConditionDraft = AudienceCondition & { key: number };
export function AudiencePanel({ onClose, onCreated, channel = 'EMAIL', initialAudience }: { initialAudience?: SavedAudience; onClose: () => void; onCreated: (audience: SavedAudience) => void; channel?: 'EMAIL' | 'SMS' }) {
  const [name, setName] = useState(initialAudience?.name || ''), [source, setSource] = useState<AudienceInput['source'] | ''>(initialAudience?.source === 'ALL' ? '' : initialAudience?.source || 'LEADS'), [matchMode, setMatchMode] = useState<'AND' | 'OR'>(initialAudience?.matchMode || 'AND');
  const { fields, error: fieldsError } = useCampaignFields(source || undefined);
  const [conditions, setConditions] = useState<ConditionDraft[]>((initialAudience?.conditions || []).map((condition, key) => ({ ...condition, key }))), [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({}), [preview, setPreview] = useState<AudiencePreviewResult | null>(null), [previewError, setPreviewError] = useState('');
  const [loading, setLoading] = useState(false), [page, setPage] = useState(1), [limit, setLimit] = useState(25), [busy, setBusy] = useState(false);
  const lock = useRef(false), nextKey = useRef(initialAudience?.conditions.length || 0);
  const blurTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  useEffect(() => () => blurTimers.current.forEach(clearTimeout), []);
  const definition = { source, matchMode, conditions: conditions.map(({ key: _key, ...condition }) => condition) };
  const conditionError = (condition: ConditionDraft) => {
    const result = AudienceConditionSchema.safeParse(conditionWithoutKey(condition));
    return result.success ? campaignConditionError(result.data, fields) : result.error.issues[0]?.message;
  };
  function changeCondition(key: number, patch: Partial<ConditionDraft>) { if (patch.field || patch.operator) setTouched(previous => new Set([...previous].filter(value => value !== key))); setPage(1); setConditions(rows => rows.map(row => row.key === key ? { ...row, ...patch } : row)); }
  useEffect(() => {
    let cancelled = false;
    const parsed = AudiencePreviewSchema.safeParse(definition);
    if (!parsed.success || conditions.some(condition => conditionError(condition))) { setLoading(false); setPreviewError(''); return; }
    setLoading(true); setPreviewError('');
    const timer = setTimeout(() => audiencesApi.preview({ ...parsed.data, channel, page, limit }).then(result => { if (!cancelled) setPreview(result.data); }).catch(error => { if (!cancelled) setPreviewError(error.message); }).finally(() => { if (!cancelled) setLoading(false); }), 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [source, matchMode, conditions, fields, channel, page, limit]);
  async function save() {
    if (lock.current) return;
    setSubmitted(true);
    const parsed = CreateAudienceSchema.safeParse({ name, ...definition });
    if (!parsed.success || conditions.some(condition => conditionError(condition))) { setErrors(previous => ({ ...previous, source: !source ? 'Select Leads or Contacts.' : '', name: !name.trim() ? 'Audience name is required.' : name.length > 150 ? 'Use no more than 150 characters.' : '' })); return; }
    lock.current = true; setBusy(true); setErrors({});
    try { onCreated((initialAudience ? await audiencesApi.update(initialAudience.id, parsed.data) : await audiencesApi.create(parsed.data)).data); }
    catch (error) { setErrors({ form: error instanceof Error ? error.message : 'Could not save audience.' }); }
    finally { lock.current = false; setBusy(false); }
  }
  const cls = panelInputClass + ' min-w-0 max-w-full';
  return <SideSheet isOpen onClose={onClose} width="w-full max-w-[960px]" title={initialAudience ? 'Edit Target Audience' : 'Create Target Audience'} subtitle="Choose Leads or Contacts and define typed conditions">
    <div className="flex h-full min-h-0 min-w-0 flex-col"><div className={panelBodyClass + ' min-w-0 space-y-5'}>
      <label className={panelLabelClass}>Audience Name<input aria-label="Audience Name" className={cls} value={name} onChange={event => setName(event.target.value)} /><FieldError message={errors.name} /></label>
      <label className={panelLabelClass}>Source<select aria-label="Source" className={cls} value={source} onChange={event => { setSource(event.target.value as AudienceInput['source']); setPage(1); setPreview(null); }}>{!source && <option value="">Select a source to repair this audience</option>}<option value="LEADS">All Leads</option><option value="CONTACTS">All Contacts</option></select><FieldError message={errors.source} /></label>
      <label className={panelLabelClass}>Match conditions<select aria-label="Match conditions" className={cls} value={matchMode} onChange={event => { setMatchMode(event.target.value as 'AND' | 'OR'); setPage(1); }}><option value="AND">Match all (AND)</option><option value="OR">Match any (OR)</option></select></label>
      <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">Conditions</span><button type="button" className={panelSecondaryActionClass} disabled={conditions.length >= 20} onClick={() => setConditions(rows => [...rows, { key: nextKey.current++, field: 'status', operator: 'equals', value: '' }])}>+ Add Condition</button></div>
      <p className="text-xs text-slate-500">Zero conditions include the chosen source. Changing source keeps rules visible for correction. Product selections use ANY for equals and NONE for not equals.</p>
      {conditions.map(condition => {
        const field = campaignConditionField(condition.field, fields), operators = campaignFieldOperators(field), presence = ['is_empty', 'is_not_empty', 'any'].includes(condition.operator);
        const range = condition.value && typeof condition.value === 'object' && !Array.isArray(condition.value) ? condition.value : { from: '', to: '' };
        return <div key={condition.key} onFocus={() => { clearTimeout(blurTimers.current.get(condition.key)); blurTimers.current.delete(condition.key); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) blurTimers.current.set(condition.key, setTimeout(() => { setTouched(previous => new Set([...previous, condition.key])); blurTimers.current.delete(condition.key); }, 0)); }} className="grid min-w-0 gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] dark:border-white/10">
          <label className={panelLabelClass}>Field<ConditionFieldSelect id={`field-${condition.key}`} label={`Condition ${condition.key + 1} field`} className={cls} value={condition.field} fields={fields.filter(field => field.conditionAvailable).map(field => ({ key: field.technicalKey, label: field.label, group: field.group }))} onChange={key => { const next = fields.find(field => field.technicalKey === key); changeCondition(condition.key, { field: key, operator: campaignFieldOperators(next)[0], value: next?.type === 'file' || next?.type === 'date' ? null : next?.type === 'number' ? 0 : next?.type === 'boolean' ? false : next?.type === 'products' ? [] : '' }); }} /></label>
          <label className={panelLabelClass}>Operator<ConditionOperatorSelect label={`Condition ${condition.key + 1} operator`} className={cls} value={condition.operator} operators={operators.map(key => ({ key, label: operatorLabels[key] || key }))} onChange={operator => changeCondition(condition.key, { operator: operator as AudienceCondition['operator'], ...(['is_empty', 'is_not_empty', 'any'].includes(operator) ? { value: null } : operator === 'between' ? { value: { from: '', to: '' } } : condition.value === null ? { value: field?.type === 'number' ? 0 : '' } : {}) })} /></label>
          <div className="min-w-0"><span className={panelLabelClass}>Value</span>{presence ? <p className="py-3 text-xs text-slate-500">{field?.type === 'file' ? field.unavailableReason : 'No value required'}</p>
            : field?.type === 'products' ? <CatalogProductInterestSelect id={`value-${condition.key}`} values={Array.isArray(condition.value) ? condition.value : []} onChange={value => changeCondition(condition.key, { value })} />
            : field?.type === 'reference' ? <EntityCombobox entityType={field.reference === 'account' ? 'accounts' : 'users'} placeholder={`Select ${field.label}`} value={typeof condition.value === 'string' ? condition.value : null} onChange={value => changeCondition(condition.key, { value: value || '' })} />
            : field?.type === 'dropdown' || field?.type === 'boolean' ? <select aria-label={`Condition ${condition.key + 1} value`} className={cls} value={String(condition.value ?? '')} onChange={event => changeCondition(condition.key, { value: field.type === 'boolean' ? event.target.value === 'true' : event.target.value })}><option value="">Choose…</option>{(field.type === 'boolean' ? ['true', 'false'] : field.options || []).map(value => <option key={value} value={value}>{field.type === 'boolean' ? value === 'true' ? 'Yes' : 'No' : value}</option>)}</select>
            : condition.operator === 'between' ? <div className="space-y-1"><ConditionScalarInput aria-label="Created From" className={cls} type="date" value={range.from} onValueChange={from => changeCondition(condition.key, { value: { ...range, from: String(from) } })} /><ConditionScalarInput aria-label="Created To" className={cls} type="date" value={range.to} onValueChange={to => changeCondition(condition.key, { value: { ...range, to: String(to) } })} /></div>
            : <ConditionScalarInput id={`value-${condition.key}`} aria-label={`Condition ${condition.key + 1} value`} className={cls} type={field?.type === 'number' ? 'number' : field?.type === 'date' ? 'date' : 'text'} value={condition.value} onValueChange={value => changeCondition(condition.key, { value })} />}
            <FieldError message={submitted || touched.has(condition.key) ? conditionError(condition) : undefined} />
          </div>
          <button type="button" className="min-h-10 self-start rounded p-2 text-red-600" aria-label="Remove condition" onClick={() => setConditions(rows => rows.filter(row => row.key !== condition.key))}><Trash2 size={16} /></button>
        </div>;
      })}
      <AudienceCounts counts={preview} channel={channel} /><FieldError message={previewError || errors.form || fieldsError || undefined} />
      <section aria-label="Eligible Recipients" className="min-w-0 space-y-2"><h3 className="text-sm font-semibold">Eligible Recipients</h3>{loading && !preview ? <DataLoadingSkeleton rowCount={3} columnCount={2} /> : preview && <><p className="text-xs text-slate-500">Showing {preview.recipients.length} of {preview.eligible} eligible recipients</p><ul className="max-h-60 divide-y overflow-y-auto rounded-lg border">{preview.recipients.map(recipient => <li key={recipient.id} className="space-y-1 p-3 text-xs"><strong>{recipient.name || 'Unnamed recipient'}</strong> · {recipient.recordType}<p>{recipient.company}</p><p>{channel === 'SMS' ? recipient.phone : recipient.email}</p></li>)}</ul>{!preview.recipients.length && <p className="text-xs">No eligible recipients match these conditions.</p>}<PaginationControls currentPage={page} totalRecords={preview.meta.total} pageSize={limit} onPageChange={setPage} onPageSizeChange={size => { setPage(1); setLimit(size); }} /></>}</section>
    </div><div className={panelFooterClass + ' shrink-0 justify-end'}><button className={panelSecondaryActionClass} onClick={onClose} disabled={busy}>Cancel</button><button onClick={save} disabled={busy} className={panelPrimaryActionClass}>{busy ? 'Saving...' : initialAudience ? 'Save Audience' : 'Create Audience'}</button></div></div>
  </SideSheet>;
}
function conditionWithoutKey({ key: _key, ...condition }: ConditionDraft) { return condition; }
