'use client';
import { useMemo } from 'react';
import { campaignFields, campaignPersonalizationAvailable, type CrmFieldCatalogEntry } from '@leadcrm/shared';
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import { audiencesApi } from '@/shared/services/audiences.api';
import { campaignsApi } from '@/shared/services/campaigns.api';

export function useCampaignFields(source?: 'LEADS' | 'CONTACTS') {
  const query = useCachedPage<CrmFieldCatalogEntry[]>({ module: source === 'LEADS' ? 'leads' : 'contacts', params: { fieldCatalog: source }, disabled: !source, revalidateOnInvalidation: true, fetchFn: async () => (await audiencesApi.fields(source!)).data });
  const fallback = useMemo(() => source ? campaignFields(source) : [], [source]);
  return { fields: query.data ?? fallback, error: query.error };
}
export function useCampaignVariableFields(enabled = true) {
  const query = useCachedPage<CrmFieldCatalogEntry[]>({ module: 'settings', params: { campaignVariableCatalog: true }, disabled: !enabled, revalidateOnInvalidation: true, fetchFn: async () => (await campaignsApi.variableFields()).data });
  return { ...query, fields: query.data ?? [] };
}
export { VariablePicker as CampaignVariablePicker } from '@/shared/components/variable-picker';
export function campaignSampleValues(fields: CrmFieldCatalogEntry[]) {
  return Object.fromEntries(fields.filter(campaignPersonalizationAvailable).flatMap(field => {
    const value = field.type === 'number' ? '0' : field.type === 'date' ? '2026-10-11' : field.type === 'boolean' ? 'Yes' : field.type === 'products' ? 'Example Product' : field.type === 'reference' ? field.label === 'Account' ? 'Example Account' : 'Example Agent' : `Example ${field.label}`;
    return [...new Set([field.technicalKey, field.canonicalTechnicalKey ?? field.technicalKey])].map(key => [key, value]);
  }));
}
