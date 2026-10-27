'use client';
import { useEffect, useState, useRef } from 'react';
import { EMAIL_AVAILABILITY_MESSAGES, FORM_TRACKING_KEYS, publicSubmissionContent, validateFormValues, type PublicFormDefinition } from '@leadcrm/shared';
import { useEmailAvailability } from '@/shared/hooks/use-email-availability';
import { FormInput } from './form-input';
import { showCrmMutationError } from '@/shared/utils/crm-mutation-error';
const textTypes = new Set(['single-line', 'multi-line', 'email', 'contact-email', 'phone', 'contact-phone', 'url', 'company-website', 'contact-name', 'company-name']);
export default function PublicFormPage({ publicId }: { publicId: string }) {
  const receipt = useRef<{ content: string; requestId: string } | undefined>(undefined);
  const submitting = useRef(false);
  const [form, setForm] = useState<PublicFormDefinition | null>(null), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string | boolean | string[]>>({}), [website, setWebsite] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({}), [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false), [retry, setRetry] = useState(0);
  const currentValues = useRef(values); currentValues.current = values;
  const identity = JSON.stringify([publicId, form?.version]);
  const scope = useRef({ identity, revision: 0 });
  if (scope.current.identity !== identity) scope.current = { identity, revision: scope.current.revision + 1 };
  const revision = scope.current.revision;
  const isCurrentForm = () => scope.current.identity === identity && scope.current.revision === revision;
  const validated = validateFormValues(form?.fields ?? [], values);
  const emailField = form?.fields.find(field => field.mapToField === 'email');
  const emailValue = emailField && typeof values[emailField.id] === 'string' ? values[emailField.id] as string : '';
  const emailCheck = useEmailAvailability(emailValue, 'leads', Boolean(form && emailField && emailValue.trim() && !validated.errors[emailField.id]), form ? { publicId, version: form.version } : undefined);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setForm(null);
    setValues({}); setErrors({}); setTouched({}); setAttempted(false); setDone(false); setWebsite(''); receipt.current = undefined;
    fetch('/api/proxy/public/forms/' + encodeURIComponent(publicId), { signal: controller.signal, cache: 'no-store' }).then(async r => {
      const body = await r.json(); if (!r.ok) throw new Error(r.status === 404 ? 'This form is unavailable.' : 'Unable to load this form. Please retry.'); if (!controller.signal.aborted) setForm(body.data);
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [publicId, retry]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!form || submitting.current) return;
    const checked = validateFormValues(form.fields, values); setErrors(checked.errors); setError(''); setAttempted(true);
    if (Object.keys(checked.errors).length) { document.getElementById('input-' + Object.keys(checked.errors)[0])?.focus(); return; }
    if (emailField && checked.values[emailField.id] && !emailCheck.confirm(emailValue.trim())) {
      emailCheck.retry(); document.getElementById('input-' + emailField.id)?.focus(); return;
    }
    setBusy(true); submitting.current = true;
    try {
      const query = new URLSearchParams(window.location.search), tracking: Record<string, string> = {};
      if (form.trackUrlParams) for (const key of FORM_TRACKING_KEYS) { const v = query.get(key); if (v) tracking[key] = v.slice(0, 200); }
      const content = publicId + publicSubmissionContent(form.version, checked.values, tracking);
      if (receipt.current?.content !== content) receipt.current = { content, requestId: crypto.randomUUID() };
      const r = await fetch('/api/proxy/public/forms/' + encodeURIComponent(publicId) + '/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: receipt.current.requestId, version: form.version, values, tracking, website }) });
      const body = await r.json();
      if (!isCurrentForm()) return;
      if (!r.ok) {
        if (body.fieldErrors) {
          const fieldErrors: Record<string, string> = {};
          for (const field of form.fields) {
            const message = body.fieldErrors[field.id];
            if (field.id === emailField?.id && emailValue.trim() && message === EMAIL_AVAILABILITY_MESSAGES.STAFF_EMAIL_NOT_ALLOWED) emailCheck.reject('STAFF_EMAIL_NOT_ALLOWED');
            else if (typeof message === 'string' && currentValues.current[field.id] === values[field.id]) fieldErrors[field.id] = message;
          }
          setErrors(fieldErrors); return;
        }
        throw new Error(typeof body.error === 'string' ? body.error : body.error?.message || 'Submission failed. Please try again.');
      }
      setDone(true);
    } catch (err) {
      if (isCurrentForm()) {
        setError(err instanceof Error ? err.message : 'Unable to submit. Please retry.');
        showCrmMutationError(err, 'Unable to submit. Please retry.');
      }
    } finally { setBusy(false); submitting.current = false; }
  }
  return <main className="min-h-[var(--app-viewport-height)] bg-slate-100 px-3 py-6 sm:p-8 text-slate-900">
    <div className="w-full max-w-2xl mx-auto min-w-0">
      {loading ? <div aria-label="Loading form" className="animate-pulse h-96 rounded-xl bg-slate-200" /> : done ? <section role="status" className="bg-white rounded-xl p-6 text-center space-y-3"><h1 className="text-2xl font-bold">Thank you!</h1><p>Thank you for submitting the form.</p><p className="text-sm">Your submission has been received.<br />We will get back to you shortly.</p></section> : <>
        {error && <div role="alert" className="bg-white border border-red-200 rounded-lg p-4 mb-4 text-red-700 break-words">{error}{!form && <button onClick={() => setRetry(v => v + 1)} className="block underline mt-2">Retry</button>}</div>}
        {form && <form noValidate onSubmit={submit} className="rounded-lg border p-4 sm:p-8 space-y-6" style={{ backgroundColor: form.design.generalBg || '#fff', borderColor: form.design.generalBorder || '#e2e8f0', color: form.design.generalText || '#0f172a' }}>
          <h1 className="text-2xl font-bold break-words">{form.name}</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">{form.fields.map(f => <div key={f.id} className={f.width === 'half' ? 'min-w-0' : 'min-w-0 sm:col-span-2'}><FormInput field={f} productCatalog={form.productCatalog} value={values[f.id]} onChange={v => {
            setValues(old => ({ ...old, [f.id]: v }));
            if (textTypes.has(f.type)) {
              setTouched(old => ({ ...old, [f.id]: true }));
              setErrors(old => { const next = { ...old }; delete next[f.id]; return next; });
            }
          }} onBlur={textTypes.has(f.type) ? () => { setTouched(old => ({ ...old, [f.id]: true })); if (f.id === emailField?.id) emailCheck.retry(); } : undefined}
            error={(f.id === emailField?.id ? emailCheck.error : undefined) || (textTypes.has(f.type) && (touched[f.id] || attempted) ? validated.errors[f.id] : undefined) || errors[f.id]} design={form.design} /></div>)}</div>
          <div className="hidden" aria-hidden="true"><label>Leave empty<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label></div>
          <button type="submit" disabled={busy || emailCheck.blocked} className="w-full rounded-md border py-3 font-semibold disabled:opacity-50" style={{ backgroundColor: form.design.buttonBg || '#2563eb', borderColor: form.design.buttonBorder || '#2563eb', color: form.design.buttonText || '#fff' }}>{busy ? 'Submitting…' : 'Submit'}</button>
        </form>}
      </>}
    </div>
  </main>;
}
