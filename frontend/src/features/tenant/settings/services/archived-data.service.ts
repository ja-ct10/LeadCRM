import { apiClient } from '@/lib/api/client';
import type { ArchivedRecord, ArchiveType, PaginatedResponse } from '@leadcrm/shared';

const restorePaths: Record<ArchiveType, string> = {
  Lead: '/crm/leads', Contact: '/crm/contacts', Account: '/crm/accounts', Deal: '/crm/deals',
  User: '/administration/users', Task: '/administration/archived-data/Task',
};

export const archivedDataService = {
  list: (type: ArchiveType | 'All', page: number, limit: number, signal?: AbortSignal) => {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (type !== 'All') query.set('type', type);
    return apiClient.get<PaginatedResponse<ArchivedRecord>>(`/administration/archived-data?${query}`, { signal });
  },
  restore: (record: ArchivedRecord) => apiClient.patch<void>(`${restorePaths[record.type]}/${encodeURIComponent(record.id)}/restore`),
};
