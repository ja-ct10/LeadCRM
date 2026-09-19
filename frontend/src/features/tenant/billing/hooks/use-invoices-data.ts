'use client';

import { invoicesApi } from '@/shared/services/invoices.api';
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import type { Invoice } from '@/store/types';

export interface UseInvoicesDataReturn {
  invoices: Invoice[];
  isInitialLoad: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => void;
}

export function useInvoicesData(): UseInvoicesDataReturn {
  const result = useCachedPage({
    module: 'invoices',
    params: { limit: 100 },
    intervalMs: 5 * 60_000,
    fetchFn: async () => (await invoicesApi.list({ limit: 100 })).data ?? [],
  });
  return { ...result, invoices: result.data ?? [] };
}
