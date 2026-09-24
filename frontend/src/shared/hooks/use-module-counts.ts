'use client';

import { contactsV2Api } from '@/shared/services/contacts-v2.api';
import { apiClient } from '@/lib/api/client';
import { useCachedPage } from './use-cached-page';
import { invalidatePageCache } from '@/shared/cache/page-cache';
import { USE_MOCK_DATA } from '@/lib/config';

type ModuleId = 'leads' | 'contacts' | 'accounts' | 'deals';

export function clearModuleCountsCache(): void {
  for (const module of ['leads', 'contacts', 'accounts', 'deals']) invalidatePageCache(`counts-${module}`);
}

function useCount(module: ModuleId, enabled: boolean) {
  return useCachedPage({
    module: `counts-${module}`,
    params: {},
    revalidateOnInvalidation: true,
    intervalMs: 5 * 60_000,
    disabled: USE_MOCK_DATA || !enabled,
    fetchFn: async (signal) => {
      if (module === 'contacts') return (await contactsV2Api.list({ page: 1, limit: 1 }, signal)).meta.total;
      const response = await apiClient.get<{ meta: { total: number } }>(`/crm/${module}`, {
        params: { page: '1', pageSize: '1' }, signal,
      });
      return response.meta?.total ?? 0;
    },
  });
}

/** Keep counts independently cached so a denied module cannot hide other badges. */
export function useModuleCounts(modules: ModuleId[]) {
  const leads = useCount('leads', modules.includes('leads'));
  const contacts = useCount('contacts', modules.includes('contacts'));
  const accounts = useCount('accounts', modules.includes('accounts'));
  const deals = useCount('deals', modules.includes('deals'));
  const results = { leads, contacts, accounts, deals };
  return {
    counts: Object.fromEntries(modules.map((module) => [module, results[module].data ?? 0])),
    isLoading: modules.some((module) => results[module].isInitialLoad),
  };
}
