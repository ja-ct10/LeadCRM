'use client';
import { showCrmMutationError } from '@/shared/utils/crm-mutation-error';
import { useEffect, useId, useRef, useState } from 'react';
import { CUSTOM_FIELD_BUILT_IN_GROUPS, isClosedWonField, CLOSING_FILE_MAX_BYTES, closingValueError, customFieldNameKey, defaultFieldLayout, type ClosingField, type ClosingValues, type CustomFieldModule, type CustomFieldState, type RecordFileMetadata, type FieldLayout } from '@leadcrm/shared';
import { apiClient, type ApiRequestError } from '@/lib/api/client';
import { USE_MOCK_DATA } from '@/lib/config';
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import { PanelSectionHeading, panelInputClass } from '@/shared/components/side-panel-styles';
import { Button } from '@/shared/components/ui/button';
import { toast } from 'sonner';
import { InlineEditRows } from './inline-edit-rows';

async function uploadCustomFieldFile(module: CustomFieldModule, recordId: string | undefined, file: File) {
  if (!file.size || file.size > CLOSING_FILE_MAX_BYTES) throw new Error('Choose a nonempty file no larger than 10 MB.');
  const params = new URLSearchParams({ name: file.name, type: file.type || 'application/octet-stream' });
  const path = recordId ? `/crm/${module}/${encodeURIComponent(recordId)}/files` : `/crm/${module}/custom-field-uploads`;
  return (await apiClient.upload<{ data: RecordFileMetadata }>(`${path}?${params}`, new Blob([file], { type: 'application/octet-stream' }))).data;
}

export function useRecordCustomFields(module: CustomFieldModule, recordId?: string) {
  const query = useCachedPage<CustomFieldState>({ module, params: { customFields: true, recordId }, revalidateOnInvalidation: true, fetchFn: async signal => {
    if (recordId) return (await apiClient.get<{ data: CustomFieldState }>(`/crm/${module}/${recordId}/custom-fields`, { signal })).data;
    const [fields, configuration] = await Promise.all([apiClient.get<{ data: ClosingField[] }>(`/crm/${module}/custom-fields`, { signal }), apiClient.get<{ data: { layout: FieldLayout } }>(`/crm/${module}/field-layout`, { signal })]);
    return { fields: fields.data, layout: configuration.data.layout, values: {}, files: [] };
  } });
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadCount, setUploadCount] = useState(0);
  const [uploads, setUploads] = useState<Record<string, RecordFileMetadata>>({});
  useEffect(() => { setEdits({}); setErrors({}); setUploads({}); }, [module, recordId]);
  const fields = (query.data?.fields ?? []).filter(field => field.module === module && field.active && field.visibleInForm).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const value = (id: string) => edits[id] ?? String(query.data?.values[id] ?? '');
  const allValues = (): ClosingValues => Object.fromEntries(fields.map(field => {
    const raw = value(field.id).trim();
    return [field.id, !raw ? null : field.type === 'Number' ? Number(raw) : raw];
  }));
  const payload = (): ClosingValues => Object.fromEntries(Object.entries(allValues()).filter(([id]) => !recordId || Object.prototype.hasOwnProperty.call(edits, id)));
  const blocked = uploadCount > 0 || !!query.error || (!USE_MOCK_DATA && !query.data);
  const validate = () => {
    const values = allValues();
    const next = Object.fromEntries(fields.flatMap(field => {
      const error = !field.required && recordId && !Object.prototype.hasOwnProperty.call(edits, field.id) ? undefined : closingValueError(field, values[field.id]);
      return error ? [[field.id, error]] : [];
    }));
    setErrors(next);
    if (Object.keys(next).length) document.getElementById(`custom-field-${module}-${fields.find(f => next[f.id])?.id}`)?.focus();
    return !blocked && Object.keys(next).length === 0;
  };
  const update = (id: string, next: string) => { setEdits(prev => ({ ...prev, [id]: next })); setErrors(prev => ({ ...prev, [id]: '' })); };
  const upload = async (field: ClosingField, file: File) => {
    if (!file.size || file.size > CLOSING_FILE_MAX_BYTES) { setErrors(prev => ({ ...prev, [field.id]: 'Choose a nonempty file no larger than 10 MB.' })); return; }
    setUploadCount(count => count + 1);
    try {
      const uploaded = await uploadCustomFieldFile(module, recordId, file);
      setUploads(prev => ({ ...prev, [uploaded.id]: uploaded })); update(field.id, uploaded.id);
    } catch (error) { if ((error as { status?: number })?.status === 403) showCrmMutationError(error, 'Upload failed.'); setErrors(prev => ({ ...prev, [field.id]: error instanceof Error ? error.message : 'Upload failed.' })); }
    finally { setUploadCount(count => count - 1); }
  };
  return { module, fields, dirty: Object.keys(edits).some(id => edits[id] !== String(query.data?.values[id] ?? '')), layout: query.data?.layout ?? defaultFieldLayout(module), value, update, payload, validate, errors, blocked, uploadCount, upload, query, files: [...(query.data?.files ?? []), ...Object.values(uploads)] };
}
type FieldForm = ReturnType<typeof useRecordCustomFields>;

/** The same typed controls serve record forms and Details inline rows. */
export function CustomFieldControl({ field, module, value, onChange, onUpload, files, disabled = false, uploading = false, error = '', inline = false, describedBy, onSave, onCancel }: {
  field: ClosingField; module: CustomFieldModule; value: string; onChange: (value: string) => void;
  onUpload: (file: File) => void; files: CustomFieldState['files']; disabled?: boolean; uploading?: boolean;
  error?: string; inline?: boolean; describedBy?: string; onSave?: () => void; onCancel?: () => void;
}) {
  const id = `custom-field-${module}-${field.id}`;
  const props = { id, name: `customFieldValues.${field.id}`, value, disabled, autoFocus: inline,
    'aria-label': inline ? field.name : undefined, 'aria-invalid': !!error, 'aria-describedby': describedBy,
    required: field.required, 'aria-required': field.required,
    className: inline ? 'w-full min-w-0 max-w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring' : panelInputClass + ' min-w-0 max-w-full',
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const next = event.target.value;
      if (field.type === 'Number' && !/^-?\d*\.?\d*$/.test(next)) return;
      onChange(next);
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      if (!inline || disabled || uploading) return;
      if (event.key === 'Escape') { event.preventDefault(); onCancel?.(); }
      if (event.key === 'Enter' && field.type !== 'Long Text') { event.preventDefault(); onSave?.(); }
    },
  };
  const file = files.find(file => file.id === value);
  if (field.type === 'File Upload') return <div className="min-w-0 space-y-2"><input id={id} aria-label={inline ? field.name : undefined} aria-describedby={describedBy} aria-invalid={!!error} type="file" autoFocus={inline} className="block w-full min-w-0 max-w-full text-xs" disabled={disabled || uploading} accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.zip,.doc,.docx,.xls,.xlsx" onChange={event => { const selected = event.target.files?.[0]; if (selected) onUpload(selected); }} />{value && <div className="flex min-w-0 items-center gap-2 text-xs"><span className="min-w-0 [overflow-wrap:anywhere]">{file?.name ?? 'Saved file'}</span><button type="button" disabled={disabled || uploading} className="shrink-0 text-primary" onClick={() => onChange('')}>Clear</button></div>}<p className="text-xs text-muted-foreground">{uploading ? 'Uploading…' : 'Maximum 10 MB.'}</p></div>;
  if (field.type === 'Long Text') return <textarea {...props} rows={3} maxLength={10000} />;
  if (field.type === 'Dropdown') return <select {...props}><option value="">Select an option</option>{value && !field.options.includes(value) && <option value={value} disabled>{value} (previous choice)</option>}{field.options.map(option => <option key={option}>{option}</option>)}</select>;
  return <input {...props} type={field.type === 'Date' ? 'date' : 'text'} inputMode={field.type === 'Number' ? 'decimal' : undefined} maxLength={field.type === 'Number' ? 100 : 1000} />;
}

export function CustomFieldInput({ field, form }: { field: ClosingField; form: FieldForm }) {
  const id = `custom-field-${form.module}-${field.id}`, error = form.errors[field.id], helpId = useId();
  return <div className="min-w-0 space-y-1.5">
    <label htmlFor={id} className="block text-xs font-semibold text-slate-600 dark:text-slate-400 [overflow-wrap:anywhere]">{field.name}{field.required && <span className="text-red-500"> *</span>}</label>
    <CustomFieldControl field={field} module={form.module} value={form.value(field.id)} onChange={next => form.update(field.id, next)} onUpload={file => void form.upload(field, file)} files={form.files} uploading={form.uploadCount > 0} error={error} describedBy={helpId} />
    <div id={helpId}>{field.description && <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{field.description}</p>}{error && <p role="alert" className="text-xs text-destructive [overflow-wrap:anywhere]">{error}</p>}</div>
  </div>;
}

export function CustomFieldGroup({ form, group }: { form: FieldForm; group: string }) {
  const fields = form.fields.filter(field => customFieldNameKey(field.group) === customFieldNameKey(group));
  return fields.length ? <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">{fields.map(field => <CustomFieldInput key={field.id} field={field} form={form} />)}</div> : null;
}

export function CustomFieldExtraGroups({ form, startNumber }: { form: FieldForm; startNumber: number }) {
  const builtIn = CUSTOM_FIELD_BUILT_IN_GROUPS[form.module].map(customFieldNameKey);
  const groups = [...new Set(form.fields.filter(field => !builtIn.includes(customFieldNameKey(field.group))).map(field => field.group))];
  return <>{form.query.error ? <div role="alert" className="text-sm text-destructive">{form.query.error}<Button type="button" variant="ghost" onClick={() => void form.query.refetch()}>Retry custom fields</Button></div> : form.query.isInitialLoad ? <p role="status" className="text-xs text-muted-foreground">Loading custom fields…</p> : null}{groups.map((group, index) => <section key={group} className="min-w-0 space-y-4"><PanelSectionHeading number={startNumber + index}><span className="[overflow-wrap:anywhere]">{group}</span></PanelSectionHeading><CustomFieldGroup form={form} group={group} /></section>)}</>;
}

/** One authorized query per record, shared by every ordinary Details row. */
export function useRecordCustomFieldDetails(module: CustomFieldModule, recordId: string) {
  const query = useCachedPage<CustomFieldState>({ module, params: { customFields: true, recordId }, revalidateOnInvalidation: true,
    fetchFn: async signal => (await apiClient.get<{ data: CustomFieldState }>(`/crm/${module}/${encodeURIComponent(recordId)}/custom-fields`, { signal })).data });
  const fields = (query.data?.fields ?? []).filter(field => field.module === module && !isClosedWonField(field) && field.visibleInDetails !== false &&
    (field.active && !field.deletedAt || query.data?.values[field.id] != null && query.data.values[field.id] !== ''));
  const latest = useRef({ module, recordId, query });
  latest.current = { module, recordId, query };
  const save = async (field: ClosingField, value: string | number | null) => {
    try { await apiClient.put(`/crm/${module}/${encodeURIComponent(recordId)}`, { customFieldValues: { [field.id]: value } }); }
    catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 403) showCrmMutationError(error, 'Unable to save field.');
      if (latest.current.module === module && latest.current.recordId === recordId && [401, 403, 404].includes(status ?? 0)) {
        // An assignment denial does not revoke the separately authorized read.
        if (status !== 403) latest.current.query.setData({ fields: [], values: {}, files: [] });
        void latest.current.query.refetch();
      }
      const messages = (error as ApiRequestError).fieldErrors?.customFieldValues;
      if (messages?.length) throw new Error(messages.join(' '));
      throw error;
    }
    if (latest.current.module !== module || latest.current.recordId !== recordId) return;
    const current = latest.current.query;
    if (current.data) current.setData({ ...current.data, values: { ...current.data.values, [field.id]: value } });
    // apiClient's successful-write invalidation schedules the shared refresh.
  };
  return { module, recordId, query, fields, save };
}
type RecordCustomFieldDetailsState = ReturnType<typeof useRecordCustomFieldDetails>;
const inlineValue = (field: ClosingField, raw: string) => !raw.trim() ? null : field.type === 'Number' ? Number(raw) : raw.trim();

export function RecordCustomFieldInlineRow({ details, fieldId, canEdit }: { details: RecordCustomFieldDetailsState; fieldId: string; canEdit: boolean }) {
  const field = details.fields.find(field => field.id === fieldId);
  const [uploads, setUploads] = useState<CustomFieldState['files']>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  if (!field || !details.query.data) return null;
  const value = details.query.data.values[field.id];
  const files = [...details.query.data.files, ...uploads];
  const file = files.find(file => file.id === value);
  const editable = canEdit && field.active && !field.deletedAt;
  return <InlineEditRows canEdit={editable} rows={[{
    technicalKey: field.id, label: `${field.name}${field.deletedAt ? ' · Retired' : !field.active ? ' · Disabled' : ''}`,
    value, apiField: field.id, required: field.required, alwaysVisible: true, preserveWhitespace: true,
    validate: raw => closingValueError(field, inlineValue(field, raw)), editorDisabled: uploading || !!details.query.error, editorError: uploadError,
    renderValue: () => <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{value == null || value === '' ? '—' : field.type === 'File Upload' ? file?.name ?? 'File unavailable' : String(value)}</span>,
    valueHref: field.type === 'File Upload' ? file?.url : undefined,
    renderEditor: props => <CustomFieldControl field={field} module={details.module} value={props.value} onChange={next => { setUploadError(''); props.onChange(next); }} files={files} disabled={props.disabled} uploading={uploading} error={props.error || uploadError} inline onSave={props.onSave} onCancel={() => { setUploadError(''); props.onCancel(); }} onUpload={async selected => {
      setUploading(true); setUploadError('');
      try { const uploaded = await uploadCustomFieldFile(details.module, details.recordId, selected); setUploads(previous => [...previous, uploaded]); props.onChange(uploaded.id); }
      catch (error) { if ((error as { status?: number })?.status === 403) showCrmMutationError(error, 'Upload failed.'); setUploadError(error instanceof Error ? error.message : 'Upload failed. Try again.'); }
      finally { setUploading(false); }
    }} />,
  }]} onSave={async (_id, raw) => {
    await details.save(field, inlineValue(field, String(raw)));
    toast.success('Field updated');
  }} />;
}
