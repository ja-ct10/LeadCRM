'use client';
import { useRef, useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { apiClient } from '@/lib/api/client';
import { getPageCache, getPageCacheGeneration, requestPageCache } from '@/shared/cache/page-cache';
import { useCachedPage } from './use-cached-page';
import type { ActivityModule } from './use-record-activities';

/** Page related Deals through the existing authorized relationship endpoint. */
export function useRecordRelationships<T extends { deals?: { id?: unknown }[]; hasMoreDeals?: boolean }>(module: ActivityModule, id: string | undefined, disabled: boolean) {
  const { user, tenant, isLoading, authError } = useAuth();
  const unavailable = disabled || !!isLoading || !!authError;
  const identity = JSON.stringify([tenant?.id, user?.id, user?.role, getPageCacheGeneration(), module, id]);
  const [pagination, setPagination] = useState({ identity, count: 1 });
  const pageCount = pagination.identity === identity ? pagination.count : 1;
  const query = useCachedPage<T>({ module, params: { recordId: id, relationships: true, pageCount }, disabled: unavailable, revalidateOnInvalidation: true,
    fetchFn: async signal => {
      let result: T | undefined;
      const deals = new Map<unknown, { id?: unknown }>();
      for (let page = 1; page <= pageCount; page++) {
        const params = { query: { recordId: id, relationshipPage: page }, userId: user?.id, role: user?.role };
        const cached = getPageCache<T>(module, tenant?.id ?? '', params);
        const data = cached && !cached.isStale ? cached.data : await requestPageCache<T>(module, tenant?.id ?? '', params,
          async requestSignal => (await apiClient.get<{ data: T }>(`/crm/${module}/${encodeURIComponent(id!)}/relationships?limit=50&page=${page}`, { signal: requestSignal })).data, signal);
        data.deals?.forEach(deal => deals.set(deal.id, deal));
        result = { ...(result ?? data), hasMoreDeals: data.hasMoreDeals, deals: [...deals.values()] };
        if (!data.hasMoreDeals) break;
      }
      return result!;
    },
  });
  const loaded = useRef<{ identity: string; data?: T }>({ identity });
  if (loaded.current.identity !== identity || unavailable || [401,403,404].includes(query.errorStatus ?? 0)) loaded.current = { identity };
  if (!unavailable && query.data) loaded.current.data = query.data;
  const data = query.data ?? loaded.current.data;
  return { ...query, data: unavailable ? undefined : data, isInitialLoad: query.isInitialLoad && !data,
    loadMore: () => setPagination({ identity, count: pageCount + 1 }),
  };
}
