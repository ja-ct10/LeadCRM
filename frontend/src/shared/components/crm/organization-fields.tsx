'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { COMPANY_INDUSTRIES, COMPANY_SIZE_OPTIONS, NewAccountSchema, type AccountSummary, type NewAccountInput } from '@leadcrm/shared';
import { apiClient } from '@/lib/api/client';
import { USE_MOCK_DATA } from '@/lib/config';
import { useData } from '@/store/DataContext';
import { useHasPermission } from '@/shared/hooks/use-permissions';
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import { EntityCombobox } from '@/shared/components/entity-combobox';
import { panelInputClass } from '@/shared/components/side-panel-styles';
import { CustomFieldInput, useRecordCustomFields } from './record-custom-fields';

type Mode = 'legacy' | 'existing' | 'new';
type CompanyFields = { companyName: string; industry: string; size: string; website: string };
const empty = { companyName: '', industry: '', size: '', website: '' };

export function useOrganizationForm(initial?: { id?: string; accountId?: string | null; organizationId?: string; companyName?: string | null }) {
  const [mode, setMode] = useState<Mode>(initial?.accountId || initial?.organizationId ? 'existing' : 'legacy');
  const [accountId, setAccountId] = useState(initial?.accountId || initial?.organizationId || '');
  const [fields, setFields] = useState<CompanyFields>({ ...empty, companyName: initial?.companyName || '' });
  const [error, setError] = useState('');
  const custom = useRef<ReturnType<typeof useRecordCustomFields> | null>(null);
  const identity = useRef<{ value: string; requestId: string } | undefined>(undefined);
  useEffect(() => {
    setMode(initial?.accountId || initial?.organizationId ? 'existing' : 'legacy');
    setAccountId(initial?.accountId || initial?.organizationId || '');
    setFields({ ...empty, companyName: initial?.companyName || '' }); setError(''); identity.current = undefined;
  }, [initial?.id]); // Background refreshes must not replace a user's draft.
  const newAccount = (): NewAccountInput => {
    const values = { name: fields.companyName, industry: fields.industry || undefined, size: fields.size || undefined,
      website: fields.website || undefined, customFieldValues: custom.current?.payload() };
    const fingerprint = JSON.stringify(values);
    if (identity.current?.value !== fingerprint) identity.current = { value: fingerprint, requestId: crypto.randomUUID() };
    return { ...values, requestId: identity.current.requestId } as NewAccountInput;
  };
  const validate = () => {
    setError('');
    if (mode === 'existing' && !accountId) { setError('Select an Account, or choose Company name only.'); return false; }
    if (mode !== 'new') return true;
    const parsed = NewAccountSchema.safeParse(newAccount());
    if (!parsed.success) { setError(parsed.error.issues[0].message); return false; }
    if (!custom.current?.validate()) { setError('Complete the company fields before saving.'); return false; }
    return true;
  };
  const payload = () => ({ companyName: fields.companyName.trim(), accountId: mode === 'existing' ? accountId : null,
    ...(mode === 'new' ? { newAccount: NewAccountSchema.parse(newAccount()) } : {}) });
  return { mode, setMode, accountId, setAccountId, fields, setFields, error, custom, validate, payload };
}
type OrganizationForm = ReturnType<typeof useOrganizationForm>;

function CompanyCustomFields({ draft }: { draft: OrganizationForm }) {
  const fields = useRecordCustomFields('accounts');
  draft.custom.current = fields;
  useEffect(() => () => { draft.custom.current = null; }, [draft.custom]);
  return <>{fields.fields.map(field => <CustomFieldInput key={field.id} field={field} form={fields} />)}
    {fields.query.error && <p role="alert" className="text-xs text-destructive sm:col-span-2">{fields.query.error}</p>}</>;
}

/** Company attributes are owned by Account; the person keeps only its canonical link. */
export function OrganizationFields({ draft, companyLabel = 'Company Name', showAccount = true, showCompany = true }: { draft: OrganizationForm; companyLabel?: string; showAccount?: boolean; showCompany?: boolean }) {
  const id = useId();
  const canView = useHasPermission('accounts.view');
  const canCreate = useHasPermission('accounts.create');
  const { organizations = [] } = useData();
  const accountQuery = useCachedPage<AccountSummary>({ module: 'accounts', params: { recordId: draft.accountId }, revalidateOnInvalidation: true,
    disabled: !canView || !draft.accountId || draft.mode !== 'existing' || USE_MOCK_DATA,
    fetchFn: async signal => (await apiClient.get<{ data: AccountSummary }>(`/crm/accounts/${encodeURIComponent(draft.accountId)}`, { signal })).data });
  const account = canView ? USE_MOCK_DATA ? organizations.find(item => item.id === draft.accountId) : accountQuery.data : undefined;
  useEffect(() => {
    if (account?.name && draft.mode === 'existing') draft.setFields(previous => previous.companyName === account.name ? previous : { ...previous, companyName: account.name });
  }, [account?.name, draft.mode, draft.setFields]);
  const change = (key: keyof CompanyFields, value: string) => draft.setFields(previous => ({ ...previous, [key]: value }));
  const existing = draft.mode === 'existing';
  const values = existing ? { companyName: account?.name || (canView ? '' : draft.fields.companyName), industry: account?.industry || '', size: account?.size || '', website: account?.website || '' } : draft.fields;
  const labelClass = 'block space-y-1.5 text-xs font-semibold text-muted-foreground';
  return <div className="min-w-0 space-y-4 sm:col-span-2">
    {showAccount && <div className="flex flex-wrap gap-2" aria-label="Organization options">
      {([['legacy', 'Company name only'], ['existing', 'Link existing Account'], ['new', 'Create new Account']] as const).map(([mode, label]) =>
        <button key={mode} type="button" aria-pressed={draft.mode === mode} disabled={mode === 'existing' && !canView || mode === 'new' && (!canView || !canCreate)}
          hidden={mode === 'new' && !showCompany} className="min-h-9 rounded-lg border border-border px-3 py-1.5 text-xs aria-pressed:bg-primary/10 aria-pressed:text-primary disabled:opacity-50"
          onClick={() => draft.setMode(mode)}>{label}</button>)}
    </div>}
    {existing && canView && showAccount && <div className="space-y-2"><span className={labelClass}>Account</span><EntityCombobox entityType="accounts" value={draft.accountId || null} onChange={value => draft.setAccountId(value || '')} placeholder="Search accounts..." />
      {accountQuery.isInitialLoad && <p role="status" className="text-xs text-muted-foreground">Loading company details…</p>}
      {accountQuery.error && <p role="alert" className="text-xs text-destructive">{accountQuery.error} <button type="button" className="underline" onClick={() => void accountQuery.refetch()}>Retry</button></p>}
      {account && <Link className="inline-flex min-h-8 items-center text-xs text-primary underline" href={`/crm/accounts/${encodeURIComponent(account.id)}`}>Open Account</Link>}
    </div>}
    {showCompany && <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
      <label className={labelClass} htmlFor={`${id}-name`}>{companyLabel}{draft.mode === 'new' ? ' *' : ''}<input id={`${id}-name`} className={panelInputClass} value={values.companyName} readOnly={existing} maxLength={draft.mode === 'new' ? 255 : 2000} onChange={event => change('companyName', event.target.value)} /></label>
      <label className={labelClass} htmlFor={`${id}-industry`}>Industry<select id={`${id}-industry`} className={panelInputClass} value={values.industry} disabled={draft.mode !== 'new'} onChange={event => change('industry', event.target.value)}><option value="">Select industry...</option>{values.industry && !COMPANY_INDUSTRIES.some(value => value === values.industry) && <option>{values.industry}</option>}{COMPANY_INDUSTRIES.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className={labelClass} htmlFor={`${id}-size`}>Size<select id={`${id}-size`} className={panelInputClass} value={values.size} disabled={draft.mode !== 'new'} onChange={event => change('size', event.target.value)}><option value="">Select size...</option>{values.size && !COMPANY_SIZE_OPTIONS.some(value => value === values.size) && <option>{values.size}</option>}{COMPANY_SIZE_OPTIONS.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className={labelClass} htmlFor={`${id}-website`}>Website<input id={`${id}-website`} type="url" className={panelInputClass} value={values.website} disabled={draft.mode === 'legacy'} readOnly={existing} onChange={event => change('website', event.target.value)} placeholder="https://example.com" /></label>
      {draft.mode === 'new' && canView && canCreate && <CompanyCustomFields draft={draft} />}
    </div>}
    {draft.mode === 'legacy' && <p className="text-xs text-muted-foreground">Company name only keeps the existing text. Choose Create new Account to save company details and link this record.</p>}
    {draft.mode === 'new' && <p className="text-xs text-muted-foreground">The new Account and this record will be saved together.</p>}
    {draft.error && <p role="alert" className="text-xs text-destructive">{draft.error}</p>}
  </div>;
}
