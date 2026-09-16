'use client';

/**
 * useCampaignsData — route-scoped hook for the Campaigns page.
 *
 * Integrates with the shared page cache so return navigation shows data
 * instantly without a skeleton, followed by a silent background refresh.
 *
 * Cache key: tenantId + module('campaigns') + {} (no pagination — full list)
 * A request version counter prevents a stale background refresh from
 * overwriting a newer fetch result.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { campaignsApi } from '@/shared/services/campaigns.api';
import { templatesApi } from '@/shared/services/templates.api';
import { useRouteData } from '@/shared/hooks/use-route-data';
import { getPageCache, setPageCache } from '@/shared/cache/page-cache';
import { useAuth } from '@/store/AuthContext';
import { USE_MOCK_DATA } from '@/lib/config';
import type { Campaign, Template } from '@/store/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CampaignsCacheData {
  campaigns: Campaign[];
  templates: Template[];
}

export interface UseCampaignsDataReturn {
  campaigns:     Campaign[];
  templates:     Template[];
  isInitialLoad: boolean;
  isRefreshing:  boolean;
  error:         string | null;
  refetch:       () => void;
}

const REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const CACHE_PARAMS: Record<string, unknown> = {}; // no pagination for campaigns

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCampaignsData(): UseCampaignsDataReturn {
  const { tenant } = useAuth();
  const tenantId = tenant?.id ?? '';

  // ── Initialize from cache (synchronous) ────────────────────────────────
  const cachedResult = useMemo<CampaignsCacheData | null>(() => {
    if (USE_MOCK_DATA || !tenantId) return null;
    const cached = getPageCache<CampaignsCacheData>('campaigns', tenantId, CACHE_PARAMS);
    return cached?.data ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only read cache on first mount

  const [campaigns, setCampaigns] = useState<Campaign[]>(cachedResult?.campaigns ?? []);
  const [templates, setTemplates] = useState<Template[]>(cachedResult?.templates ?? []);

  // ── Request version counter — prevents stale refresh overwriting newer data
  const requestVersionRef = useRef(0);

  const fetchFn = useCallback(async (): Promise<void> => {
    const myVersion = ++requestVersionRef.current;
    const [campaignsRes, templatesRes] = await Promise.all([
      campaignsApi.list({ limit: 200 }),
      templatesApi.list({ limit: 200 }),
    ]);
    // Discard if a newer request has already started
    if (myVersion !== requestVersionRef.current) return;
    const c = (campaignsRes?.data ?? []).filter((c: Campaign) => !c.isArchived);
    const t = (templatesRes?.data ?? []).filter((t: Template) => !t.isArchived);
    setCampaigns(c);
    setTemplates(t);
    if (tenantId) {
      setPageCache<CampaignsCacheData>('campaigns', tenantId, CACHE_PARAMS, { campaigns: c, templates: t });
    }
  }, [tenantId]);

  const { isFetching, hasLoadedOnce, error, refetch } = useRouteData({
    fetchFn,
    intervalMs:      REFRESH_INTERVAL_MS,
    disabled:        USE_MOCK_DATA,
    initiallyLoaded: cachedResult !== null,
  });

  return {
    campaigns,
    templates,
    isInitialLoad: isFetching && !hasLoadedOnce,
    isRefreshing:  isFetching && hasLoadedOnce,
    error,
    refetch,
  };
}
