'use client';
import { useMemo, useState } from 'react';
import { CAMPAIGN_VARIABLE_CATEGORIES, campaignFields, campaignPersonalizationAvailable, type CampaignVariableChoice, type CrmFieldCatalogEntry } from '@leadcrm/shared';
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import { audiencesApi } from '@/shared/services/audiences.api';
import { campaignsApi } from '@/shared/services/campaigns.api';
import { ModuleSearchInput } from '@/shared/components/crm/module-search-input';

export function useCampaignFields(source?: 'LEADS' | 'CONTACTS') {
  const query = useCachedPage<CrmFieldCatalogEntry[]>({ module: source === 'LEADS' ? 'leads' : 'contacts', params: { fieldCatalog: source }, disabled: !source, revalidateOnInvalidation: true, fetchFn: async () => (await audiencesApi.fields(source!)).data });
  const fallback = useMemo(() => source ? campaignFields(source) : [], [source]);
  return { fields: query.data ?? fallback, error: query.error };
}
export function useCampaignVariableFields(enabled = true) {
  const query = useCachedPage<CrmFieldCatalogEntry[]>({ module: 'settings', params: { campaignVariableCatalog: true }, disabled: !enabled, revalidateOnInvalidation: true, fetchFn: async () => (await campaignsApi.variableFields()).data });
  return { ...query, fields: query.data ?? [] };
}
export function CampaignVariablePicker({ choices, onInsert }: { choices: CampaignVariableChoice[]; onInsert: (token: string) => void }) {
  const [search, setSearch] = useState('');
  const filtered = choices.filter(field => `${field.label} ${field.technicalKey} ${field.category} ${field.category === 'Standard Fields' ? 'System' : ''} ${field.origins.map(origin => origin.module).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="max-h-80 w-72 max-w-[80vw] overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-slate-900">
    <div className="mb-2"><ModuleSearchInput label="Search variables" placeholder="Search fields, keys or modules" value={search} onChange={setSearch} fullWidth /></div>
    {CAMPAIGN_VARIABLE_CATEGORIES.map(category => <div key={category}>
      <p className="px-2 pt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{category}</p>
      {filtered.filter(field => field.category === category).map(field => <button type="button" key={field.id} disabled={!field.personalizationAvailable} title={field.unavailableReason} onClick={() => onInsert(`{{${field.technicalKey}}}`)} className="block w-full rounded px-2 py-2 text-left text-xs text-slate-900 enabled:hover:bg-slate-100 disabled:cursor-not-allowed dark:text-slate-100 dark:enabled:hover:bg-white/5">
        <span className="font-medium">{field.label}</span>
        <code className="block break-all text-[11px] text-slate-600 dark:text-slate-300">{`{{${field.technicalKey}}}`}</code>
        {!!field.origins.length && <span className="block text-[11px] text-slate-600 dark:text-slate-300">{field.origins.map(origin => origin.module[0].toUpperCase() + origin.module.slice(1)).join(', ')}</span>}
        {!field.personalizationAvailable && <span className="block text-[11px] text-slate-600 dark:text-slate-300">{field.unavailableReason?.startsWith('Unavailable for this audience.') ? 'Unavailable for this audience.' : field.unavailableReason}</span>}
      </button>)}
    </div>)}
    {!filtered.length && <p className="p-2 text-xs text-slate-600 dark:text-slate-300">No matching variables.</p>}
  </div>;
}
export function campaignSampleValues(fields: CrmFieldCatalogEntry[]) {
  return Object.fromEntries(fields.filter(campaignPersonalizationAvailable).flatMap(field => {
    const value = field.type === 'number' ? '0' : field.type === 'date' ? '2026-10-11' : field.type === 'boolean' ? 'Yes' : field.type === 'products' ? 'Example Product' : field.type === 'reference' ? field.label === 'Account' ? 'Example Account' : 'Example Agent' : `Example ${field.label}`;
    return [...new Set([field.technicalKey, field.canonicalTechnicalKey ?? field.technicalKey])].map(key => [key, value]);
  }));
}
