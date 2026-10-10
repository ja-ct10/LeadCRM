'use client';

import { useCachedPage } from './use-cached-page';
import { useRecordRelationships } from './use-record-relationships';
import { apiClient } from '@/lib/api/client';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { USE_MOCK_DATA } from '@/lib/config';
import { useRecordActivities, type TimelineActivity } from './use-record-activities';


// ─── Types ───────────────────────────────────────────────────────────────────

export type RecordModule = 'leads' | 'contacts' | 'accounts' | 'deals';

interface RelationshipData {
  contact?: { id: string; firstName: string; lastName: string; email?: string; phone?: string; status?: string } | null;
  sourceLead?: { id: string; firstName: string; lastName: string; email?: string; status?: string; source?: string } | null;
  account?: { id: string; name: string; industry?: string; website?: string } | null;
  deals?: Array<{ id: string; title: string; value?: number; priority?: string; stage?: { id: string; name: string } }>;
  leads?: Array<{ id: string; firstName: string; lastName: string; email?: string; status?: string; source?: string }>;
  contacts?: Array<{ id: string; firstName: string; lastName: string; email?: string; phone?: string; status?: string }>;
  activities?: Array<{ id: string; type: string; title: string; createdAt: string }>;
  tasks?: Array<{ id: string; title: string; status: string; priority?: string; dueDate?: string }>;
}

export interface UseRecordDetailReturn {
  /** The full record from API (or DataContext fallback) */
  record: Record<string, unknown> | null;
  /** Related entities from the /relationships endpoint */
  relationships: RelationshipData | null;
  /** Activity timeline entries for this record */
  activities: TimelineActivity[];
  /** Whether initial fetch is in progress */
  isLoading: boolean;
  /** Whether a refetch is in progress */
  isRefetching: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Whether the record was not found (404) */
  isNotFound: boolean;
  /** Manually trigger a refetch of all data */
  refetch: () => void;
}

interface UseRecordDetailParams {
  /** CRM module type */
  module: RecordModule;
  /** Record ID to fetch — pass undefined to skip fetching */
  id: string | undefined;
}

/** Shares the same scoped cache keys as the drawer. Background reads retain usable data. */
export function useRecordDetail({ module, id }: UseRecordDetailParams): UseRecordDetailReturn {
  const { user } = useAuth();
  const { contacts, organizations, deals } = useData();
  const recordQuery = useCachedPage<Record<string, unknown>>({ module, params: { recordId: id }, disabled: !id || USE_MOCK_DATA, revalidateOnInvalidation: true,
    fetchFn: async signal => (await apiClient.get<{ data: Record<string, unknown> }>(`/crm/${module}/${encodeURIComponent(id!)}`, { signal })).data });
  const relatedQuery = useRecordRelationships<RelationshipData>(module, id, !id || USE_MOCK_DATA || !recordQuery.data);
  const timeline = useRecordActivities(module, id, !!recordQuery.data || USE_MOCK_DATA);
  const mockRows = module === 'accounts' ? organizations : module === 'deals' ? deals : contacts;
  const mockRecord = USE_MOCK_DATA ? mockRows.find(record => record.id === id && record.tenantId === user?.tenantId) : undefined;
  const record = USE_MOCK_DATA ? mockRecord as unknown as Record<string, unknown> ?? null : recordQuery.data ?? null;
  return { record, relationships: relatedQuery.data ?? null, activities: timeline.activities,
    isLoading: recordQuery.isInitialLoad, isRefetching: recordQuery.isRefreshing,
    error: recordQuery.error, isNotFound: !record && !!recordQuery.error?.toLowerCase().includes('not found'),
    refetch: () => { void recordQuery.refetch(); void relatedQuery.refetch(); void timeline.refetch(); },
  };
}
