'use client';
import { defaultFieldLayout, type CrmFieldCatalogEntry, type CustomFieldModule, type FieldLayout } from '@leadcrm/shared';
import { apiClient } from '@/lib/api/client';
import { USE_MOCK_DATA } from '@/lib/config';
import { useCachedPage } from './use-cached-page';
export function useFieldLayout(module: CustomFieldModule) {
  const query = useCachedPage<{ layout: FieldLayout; fields: CrmFieldCatalogEntry[] }>({ module, params: { fieldLayout: true }, disabled: USE_MOCK_DATA, revalidateOnInvalidation: true, fetchFn: async signal => (await apiClient.get<{ data: { layout: FieldLayout; fields: CrmFieldCatalogEntry[] } }>(`/crm/${module}/field-layout`, { signal })).data });
  return { ...query, layout: query.data?.layout ?? defaultFieldLayout(module) };
}
export function useConfiguredCrmColumns<T extends { id: string; header: string }>(module: CustomFieldModule, columns: T[]): T[] {
  const { layout } = useFieldLayout(module);
  const aliases: Record<string, string> = { productInterests: 'productInterestIds', productInterest: 'productInterestIds', activeProducts: 'activeProductIds', organizationId: 'accountId', assignedUser: 'assignedUserId', ...(module === 'contacts' ? { companyName: 'company' } : {}) };
  return columns.map(column => { const override = layout.fields[aliases[column.id] ?? column.id]; return override ? { ...column, header: override.label } : column; });
}
