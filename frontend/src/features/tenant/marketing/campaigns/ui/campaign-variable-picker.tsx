'use client';
import { useMemo, useState } from 'react';
import { EMAIL_VARIABLES, campaignFields, type CrmFieldCatalogEntry } from '@leadcrm/shared';
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import { audiencesApi } from '@/shared/services/audiences.api';

export function useCampaignFields(source?: 'LEADS' | 'CONTACTS') {
  const query = useCachedPage<CrmFieldCatalogEntry[]>({ module: source === 'LEADS' ? 'leads' : 'contacts', params: { fieldCatalog: source }, disabled: !source, revalidateOnInvalidation: true, fetchFn: async () => (await audiencesApi.fields(source!)).data });
  const fallback = useMemo(() => source ? campaignFields(source) : [], [source]);
  return { fields: query.data ?? fallback, error: query.error };
}
export function CampaignVariablePicker({ fields, onInsert }: { fields: CrmFieldCatalogEntry[]; onInsert: (token: string) => void }) {
  const [search, setSearch] = useState('');
  const aliases = EMAIL_VARIABLES.map(key => ({ technicalKey: key, label: key.replaceAll('_', ' '), group: key.startsWith('sender_') ? 'Sender' : 'Existing aliases', personalizationAvailable: true, unavailableReason: undefined as string | undefined }));
  const choices = [...aliases, ...fields.filter(field => !EMAIL_VARIABLES.includes(field.technicalKey as typeof EMAIL_VARIABLES[number]))].filter(field => `${field.label} ${field.technicalKey}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="max-h-80 w-72 max-w-[80vw] overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-slate-900"><input aria-label="Search variables" placeholder="Search label or technical key" value={search} onChange={event => setSearch(event.target.value)} className="mb-2 w-full rounded border bg-transparent p-2 text-xs" />{[...new Set(choices.map(field => field.group))].map(group => <div key={group}><p className="px-2 pt-2 text-xs font-semibold text-slate-500">{group}</p>{choices.filter(field => field.group === group).map(field => <button type="button" key={field.technicalKey} disabled={!field.personalizationAvailable} title={field.unavailableReason} onClick={() => onInsert(`{{${field.technicalKey}}}`)} className="block w-full rounded px-2 py-2 text-left text-xs hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-white/5"><span>{field.label}</span><code className="block break-all text-[10px] text-slate-500">{`{{${field.technicalKey}}}`}</code>{!field.personalizationAvailable && <span className="block text-[10px]">{field.unavailableReason}</span>}</button>)}</div>)}</div>;
}
export function campaignSampleValues(fields: CrmFieldCatalogEntry[]) {
  return Object.fromEntries(fields.filter(field => field.personalizationAvailable).map(field => [field.technicalKey, field.type === 'number' ? '0' : field.type === 'date' ? '2026-10-11' : field.type === 'boolean' ? 'Yes' : field.type === 'products' ? 'Example Product' : field.type === 'reference' ? field.label === 'Account' ? 'Example Account' : 'Example Agent' : `Example ${field.label}`]));
}
