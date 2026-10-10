'use client';

import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { USE_MOCK_DATA } from '@/lib/config';
import { useRef, useState } from 'react';
import { getPageCache, getPageCacheGeneration, requestPageCache } from '@/shared/cache/page-cache';
import { activitiesService, type ActivityRecord } from '@/features/tenant/crm/activities/services/activities.service';
import { useCachedPage } from './use-cached-page';
import { useHasPermission } from './use-permissions';

export type ActivityModule = 'leads' | 'contacts' | 'accounts' | 'deals';
export type TimelineActivity = Pick<ActivityRecord, 'id' | 'type' | 'title' | 'createdAt' | 'description' | 'metadata'> & { createdBy?: ActivityRecord['createdBy'] };
export const activityReadKey = { leads: 'leadId', contacts: 'contactId', accounts: 'accountId', deals: 'dealId' } as const;
interface ActivityPage { data: TimelineActivity[]; total: number; nextCursor?: string | null }
export interface RecordActivityFilters { type?: string; search?: string }

/** One contextual reader, using the existing tenant/user cache. */
export function useRecordActivities(module: ActivityModule, id: string | undefined, enabled = true, providedActivities?: TimelineActivity[], filters: RecordActivityFilters = {}) {
  const { activities = [], users = [] } = useData();
  const { user, tenant, isLoading, authError } = useAuth();
  const identity = JSON.stringify([user?.id, user?.role, tenant?.id, getPageCacheGeneration(), module, id, filters.type, filters.search]);
  const [pagination, setPagination] = useState({ identity, count: 1 });
  const pageCount = pagination.identity === identity ? pagination.count : 1;
  const canViewActivities = useHasPermission(`${module}.view`);
  const canRead = enabled && canViewActivities && !isLoading && !authError;
  const result = useCachedPage<ActivityPage>({
    module: 'activities',
    params: { recordModule: module, id, ...filters, pageCount },
    revalidateOnInvalidation: true,
    disabled: USE_MOCK_DATA || !canRead || !id || providedActivities !== undefined,
    fetchFn: async signal => {
      let cursor: string | undefined;
      const rows = new Map<string, TimelineActivity>();
      let total = 0, nextCursor: string | null | undefined;
      for (let page = 0; page < pageCount; page++) {
        const params = { query: { recordModule: module, id, ...filters, cursor }, userId: user?.id, role: user?.role };
        const cached = getPageCache<ActivityPage>('activities', tenant?.id ?? '', params);
        const response = cached && !cached.isStale ? cached.data : await requestPageCache<ActivityPage>('activities', tenant?.id ?? '', params,
          requestSignal => activitiesService.getAll({ [activityReadKey[module]]: id, ...filters, cursor, limit: 20 }, requestSignal), signal);
        response.data.forEach(activity => rows.set(activity.id, activity));
        total = response.total; nextCursor = response.nextCursor;
        if (!nextCursor) break;
        cursor = nextCursor;
      }
      return { data: [...rows.values()], total, nextCursor };
    },
  });
  const relatedType = module === 'accounts' ? 'company' : module === 'deals' ? 'deal' : 'contact';
  const loaded = useRef<{ identity: string; page?: ActivityPage }>({ identity });
  if (loaded.current.identity !== identity || !canRead || [401,403,404].includes(result.errorStatus ?? 0)) loaded.current = { identity };
  if (canRead && result.data) loaded.current.page = result.data;
  const page = result.data ?? loaded.current.page;
  const mockActivities: TimelineActivity[] = activities
    .filter(activity => activity.tenantId === user?.tenantId && activity.relatedToId === id && activity.relatedToType === relatedType)
    .map(activity => {
      const actor = users.find(person => person.id === activity.createdBy);
      return { ...activity, createdBy: actor ? { id: actor.id, firstName: actor.firstName, lastName: actor.lastName, email: actor.email } : undefined };
    })
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const mockFiltered = mockActivities.filter(activity => (!filters.type || filters.type.split(',').includes(activity.type)) && (!filters.search || `${activity.title} ${activity.description ?? ''}`.toLowerCase().includes(filters.search.toLowerCase())));
  return { ...result,
    isInitialLoad: result.isInitialLoad && !page,
    activities: !canRead ? [] : USE_MOCK_DATA ? mockFiltered : providedActivities ?? page?.data ?? [],
    total: page?.total,
    hasMore: !!page?.nextCursor,
    loadMore: () => setPagination({ identity, count: pageCount + 1 }),
  };
}
