'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { tablePreferencesApi } from '@/shared/services/table-preferences.api';
import { USE_MOCK_DATA } from '@/lib/config';

export type PipelineViewMode = 'kanban' | 'table' | 'list';

const SYSTEM_DEFAULT: PipelineViewMode = 'kanban';
const VALID_MODES: PipelineViewMode[] = ['kanban', 'table', 'list'];
const MODULE = 'deals';

function isValidViewMode(value: unknown): value is PipelineViewMode {
  return typeof value === 'string' && VALID_MODES.includes(value as PipelineViewMode);
}

/**
 * Hook that reads/writes the pipeline view mode from the server-backed
 * Preference_System (UserPreference → TenantPreference → system default).
 *
 * Provides immediate optimistic UI updates while persisting to the server.
 * Falls back to 'kanban' when no preference is saved or when in mock mode.
 */
export function usePipelineViewMode(urlViewMode?: string | null): {
  viewMode: PipelineViewMode;
  setViewMode: (mode: PipelineViewMode) => void;
  isLoading: boolean;
} {
  // URL param takes priority for initial state (deep-link support)
  const initialMode: PipelineViewMode = isValidViewMode(urlViewMode) ? urlViewMode : SYSTEM_DEFAULT;
  const [viewMode, setViewModeState] = useState<PipelineViewMode>(initialMode);
  const [isLoading, setIsLoading] = useState(!urlViewMode);
  const hasFetched = useRef(false);

  // Fetch preference from server on mount (only if no URL param override)
  useEffect(() => {
    if (hasFetched.current) return;
    if (USE_MOCK_DATA) {
      // In mock mode, skip server call — use system default
      setIsLoading(false);
      return;
    }
    if (urlViewMode && isValidViewMode(urlViewMode)) {
      // URL takes priority, no need to fetch
      setIsLoading(false);
      return;
    }

    hasFetched.current = true;

    tablePreferencesApi.getViewType(MODULE)
      .then((res) => {
        const serverValue = res?.data?.viewType;
        if (isValidViewMode(serverValue)) {
          setViewModeState(serverValue);
        }
        // If null or invalid → keep system default (kanban)
      })
      .catch(() => {
        // On error, keep system default silently
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [urlViewMode]);

  // Persist preference change to server
  const setViewMode = useCallback((mode: PipelineViewMode): void => {
    setViewModeState(mode);

    if (USE_MOCK_DATA) return;

    // Fire-and-forget — optimistic update already applied
    tablePreferencesApi.saveViewType(MODULE, mode).catch(() => {
      // Silent failure — preference will be stale until next save
    });
  }, []);

  return { viewMode, setViewMode, isLoading };
}
