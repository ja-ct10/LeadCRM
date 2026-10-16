'use client';

import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { USE_MOCK_DATA } from '@/lib/config';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPageCache, getPageCacheGeneration, invalidatePageCache, requestPageCache } from '@/shared/cache/page-cache';
import { subscribeMailboxEvents } from '@/shared/services/mailbox-events';
import { getGmailStatus, type GmailConnectionStatus } from '@/features/tenant/inbox/services/gmail.service';
import { activitiesService, type ActivityRecord } from '@/features/tenant/crm/activities/services/activities.service';
import { useCachedPage } from './use-cached-page';
import { useHasPermission } from './use-permissions';
import { matchesSearch } from '@/shared/utils/search';

export type ActivityModule = 'leads' | 'contacts' | 'accounts' | 'deals';
export type TimelineActivity = Pick<ActivityRecord, 'id' | 'type' | 'title' | 'createdAt' | 'description' | 'metadata'> & { createdBy?: ActivityRecord['createdBy'] };
export const activityReadKey = { leads: 'leadId', contacts: 'contactId', accounts: 'accountId', deals: 'dealId' } as const;
interface ActivityPage { data: TimelineActivity[]; total: number; nextCursor?: string | null }
export interface RecordActivityFilters { type?: string; search?: string }

// Shared reads must reset every mounted reader after a mid-query scope conflict.
// This registry carries no Activity data; ordinary refreshes use the page cache.
const accessResets = new Set<{ scope: string; reset: () => void }>();

/** One contextual reader, using the existing tenant/user cache. */
export function useRecordActivities(module: ActivityModule, id: string | undefined, enabled = true, providedActivities?: TimelineActivity[], filters: RecordActivityFilters = {}) {
  const { activities = [], users = [] } = useData();
  const { user, tenant, isLoading, authError } = useAuth();
  const [authorizationRevision, setAuthorizationRevision] = useState(0);
  const scopeRetry = useRef(false);
  const generation = getPageCacheGeneration();
  const scopeIdentity = JSON.stringify([user?.id, user?.role, tenant?.id, generation]);
  const identity = JSON.stringify([user?.id, user?.role, tenant?.id, generation, authorizationRevision, module, id, filters.type, filters.search]);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const [pagination, setPagination] = useState({ identity, count: 1 });
  const pageCount = pagination.identity === identity ? pagination.count : 1;
  const canViewActivities = useHasPermission(`${module}.view`);
  const canViewLeads = useHasPermission('leads.view');
  const canViewContacts = useHasPermission('contacts.view');
  const canRead = enabled && canViewActivities && !isLoading && !authError;
  const mailboxStatus = useCachedPage<GmailConnectionStatus>({
    module: 'activities',
    params: { purpose: 'gmail-status', authorizationRevision },
    revalidateOnInvalidation: true,
    disabled: USE_MOCK_DATA || !canRead || !id || providedActivities !== undefined || module === 'accounts' ||
      !tenant?.id || !user?.id || !(canViewLeads || canViewContacts) || !!filters.type && !filters.type.split(',').includes('email'),
    fetchFn: getGmailStatus,
  });
  useEffect(() => {
    scopeRetry.current = false;
    if (USE_MOCK_DATA || !canRead || !id || providedActivities !== undefined || !tenant?.id || !user?.id) return;
    const accessReset = { scope: scopeIdentity, reset: () => {
      scopeRetry.current = true;
      setAuthorizationRevision(value => value + 1);
    } };
    accessResets.add(accessReset);
    return () => { accessResets.delete(accessReset); };
  }, [canRead, id, providedActivities, module, tenant?.id, user?.id, scopeIdentity]);
  useEffect(() => {
    if (USE_MOCK_DATA || !canRead || !id || providedActivities !== undefined || !tenant?.id || !user?.id || module === 'accounts' || !mailboxStatus.data?.isConnected) return;
    const refresh = () => {
      scopeRetry.current = false;
      invalidatePageCache('activities', tenant.id);
    };
    const subscription = subscribeMailboxEvents(tenant.id, user.id, {
      onChange: refresh,
      onOpen: () => { if (!scopeRetry.current) invalidatePageCache('activities', tenant.id); },
      onAccessChanged: () => {
        refresh();
        setAuthorizationRevision(value => value + 1);
      },
      onError: () => { void mailboxStatus.refetch(); },
    });
    return () => subscription.close();
  }, [canRead, id, providedActivities, module, tenant?.id, user?.id, scopeIdentity, mailboxStatus.data?.isConnected, mailboxStatus.refetch]);
  const result = useCachedPage<ActivityPage>({
    module: 'activities',
    params: { recordModule: module, id, ...filters, pageCount, authorizationRevision },
    revalidateOnInvalidation: true,
    disabled: USE_MOCK_DATA || !canRead || !id || providedActivities !== undefined,
    fetchFn: async signal => {
      let cursor: string | undefined;
      const rows = new Map<string, TimelineActivity>();
      let total = 0, nextCursor: string | null | undefined;
      for (let page = 0; page < pageCount; page++) {
        const params = { query: { recordModule: module, id, ...filters, cursor, authorizationRevision }, userId: user?.id, role: user?.role };
        const cached = getPageCache<ActivityPage>('activities', tenant?.id ?? '', params);
        const response = cached && !cached.isStale ? cached.data : await requestPageCache<ActivityPage>('activities', tenant?.id ?? '', params,
          async requestSignal => {
            try {
              return await activitiesService.getAll({ [activityReadKey[module]]: id, ...filters, cursor, limit: 20 }, requestSignal);
            } catch (error) {
              const failure = error as { status?: number; code?: string };
              if (!requestSignal.aborted && currentIdentity.current === identity && failure.status === 409 && failure.code === 'MAILBOX_SCOPE_CHANGED' && !scopeRetry.current) {
                // The new cache key starts the retry; do not also queue reads of
                // the obsolete key while React is applying the access reset.
                invalidatePageCache('activities', tenant?.id ?? '', false);
                accessResets.forEach(subscriber => { if (subscriber.scope === scopeIdentity) subscriber.reset(); });
              }
              throw error;
            }
          }, signal);
        response.data.forEach(activity => rows.set(activity.id, activity));
        total = response.total; nextCursor = response.nextCursor;
        if (!nextCursor) break;
        cursor = nextCursor;
      }
      return { data: [...rows.values()], total, nextCursor };
    },
  });
  const mailboxError = mailboxStatus.data?.syncError || (mailboxStatus.data?.isConnected === false ? 'Connect your work Gmail account first.' : mailboxStatus.error);
  const refetch = useCallback(async () => {
    // Explicit retry must also expire the per-cursor pages read inside the list.
    invalidatePageCache('activities', tenant?.id ?? '', false);
    await Promise.all([result.refetch(), mailboxStatus.refetch()]);
  }, [result.refetch, mailboxStatus.refetch, tenant?.id]);
  const relatedType = module === 'accounts' ? 'company' : module === 'deals' ? 'deal' : 'contact';
  const loaded = useRef<{ identity: string; page?: ActivityPage }>({ identity });
  const unavailable = [401,403,404,409].includes(result.errorStatus ?? 0);
  if (loaded.current.identity !== identity || !canRead || unavailable) loaded.current = { identity };
  if (canRead && !unavailable && result.data) loaded.current.page = result.data;
  const page = unavailable ? undefined : result.data ?? loaded.current.page;
  const mockActivities: TimelineActivity[] = activities
    .filter(activity => activity.tenantId === user?.tenantId && activity.relatedToId === id && activity.relatedToType === relatedType)
    .map(activity => {
      const actor = users.find(person => person.id === activity.createdBy);
      return { ...activity, createdBy: actor ? { id: actor.id, firstName: actor.firstName, lastName: actor.lastName, email: actor.email } : undefined };
    })
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const mockFiltered = mockActivities.filter(activity => (!filters.type || filters.type.split(',').includes(activity.type)) && matchesSearch(filters.search ?? '', activity.title, activity.description, activity.createdBy?.firstName, activity.createdBy?.lastName));
  return { ...result,
    refetch,
    error: result.error || mailboxError,
    data: unavailable ? undefined : result.data,
    isInitialLoad: result.isInitialLoad && !page,
    activities: !canRead ? [] : USE_MOCK_DATA ? mockFiltered : providedActivities ?? page?.data ?? [],
    total: page?.total,
    hasMore: !!page?.nextCursor,
    loadMore: () => setPagination({ identity, count: pageCount + 1 }),
  };
}
