'use client';

import { apiClient } from '@/lib/api/client';
import { useCachedPage } from './use-cached-page';
import { invalidatePageCache } from '@/shared/cache/page-cache';
import { USE_MOCK_DATA } from '@/lib/config';

type ModuleId = 'leads' | 'accounts' | 'deals';

export function clearModuleCountsCache(): void {
  for (const module of ['leads', 'accounts', 'deals']) invalidatePageCache(`counts-${module}`);
}

function useCount(module: ModuleId, enabled: boolean) {
  return useCachedPage({
    module: `counts-${module}`,
    params: {},
    intervalMs: 5 * 60_000,
    disabled: USE_MOCK_DATA || !enabled,
    fetchFn: async (signal) => {
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
  const accounts = useCount('accounts', modules.includes('accounts'));
  const deals = useCount('deals', modules.includes('deals'));
  const results = { leads, accounts, deals };
  return {
    counts: Object.fromEntries(modules.map((module) => [module, results[module].data ?? 0])),
    isLoading: modules.some((module) => results[module].isInitialLoad),
  };
}
