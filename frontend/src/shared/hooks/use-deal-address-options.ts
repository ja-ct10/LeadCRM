'use client';
import { dealAddressKey, type DealAddressOption, type DealAddressSource, type DealAddressContext } from '@leadcrm/shared';
import { USE_MOCK_DATA } from '@/lib/config';
import { apiClient } from '@/lib/api/client';
import { useCachedPage } from './use-cached-page';
import { useHasPermission } from './use-permissions';

/** Read existing record APIs; source text is never submitted as a Deal override. */
export function useDealAddressOptions({ dealId, accountId, association, previous, changed = false }: {
  dealId?: string; accountId?: string; association?: DealAddressSource; previous?: DealAddressSource; changed?: boolean;
}) {
  const accountsVisible = useHasPermission('accounts.view');
  return useCachedPage<DealAddressOption[]>({ module: 'deals', params: { addressOptions: true, dealId, association, previous, changed, accountsVisible },
    intervalMs: 30000, pauseWhenHidden: true, revalidateOnInvalidation: true,
    disabled: USE_MOCK_DATA || (!dealId && !association?.id),
    fetchFn: async signal => {
      let options: DealAddressOption[] = [];
      if (dealId) {
        const { data } = await apiClient.get<{ data: { addressContext?: DealAddressContext } }>(`/crm/deals/${encodeURIComponent(dealId)}`, { signal });
        options = data?.addressContext?.options ?? [];
        if (!changed) return options;
        if (previous) options = options.filter(option => option.type === 'account' ? option.id === accountId : option.type !== previous.type || option.id !== previous.id);
      }
      if (association?.id && association.type !== 'account') {
        const { data } = await apiClient.get<{ data: { id: string; firstName: string; lastName: string; address?: string; accountId?: string; isArchived?: boolean; deletedAt?: string } }>(`/crm/${association.type === 'lead' ? 'leads' : 'contacts'}/${encodeURIComponent(association.id)}`, { signal });
        if (data?.isArchived || data?.deletedAt) return options;
        if (data?.address?.trim()) options.push({ ...association, label: `${association.type === 'lead' ? 'Lead' : 'Contact'}: ${data.firstName} ${data.lastName}`, address: data.address });
        if (accountsVisible && data?.accountId) {
          const { data: account } = await apiClient.get<{ data: { id: string; name: string; address?: string; isArchived?: boolean; deletedAt?: string } }>(`/crm/accounts/${encodeURIComponent(data.accountId)}`, { signal });
          if (!account?.isArchived && !account?.deletedAt && account?.address?.trim()) options.push({ type: 'account', id: account.id, label: `Company: ${account.name}`, address: account.address });
        }
      }
      return [...new Map(options.map(option => [dealAddressKey(option), option])).values()];
    },
  });
}
