'use client';

import { campaignsApi } from '@/shared/services/campaigns.api';
import { templatesApi } from '@/shared/services/templates.api';
import { useCachedPage } from '@/shared/hooks/use-cached-page';
import type { Campaign, Template } from '@/store/types';

export interface UseCampaignsDataReturn {
  campaigns: Campaign[];
  templates: Template[];
  isInitialLoad: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCampaignsData(): UseCampaignsDataReturn {
  const result = useCachedPage({
    module: 'campaigns',
    params: { limit: 200 },
    intervalMs: 2 * 60_000,
    fetchFn: async () => {
      const [campaigns, templates] = await Promise.all([
        campaignsApi.list({ limit: 200 }), templatesApi.list({ limit: 200 }),
      ]);
      return {
        campaigns: (campaigns.data ?? []).filter((c) => !c.isArchived),
        templates: (templates.data ?? []).filter((t) => !t.isArchived),
      };
    },
  });
  return { ...result, campaigns: result.data?.campaigns ?? [], templates: result.data?.templates ?? [] };
}
