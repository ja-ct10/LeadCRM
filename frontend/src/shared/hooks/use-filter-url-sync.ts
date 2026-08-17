'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { tablePreferencesApi } from '@/shared/services/table-preferences.api';
import type { FilterCondition, FilterOperator } from '@leadcrm/shared';

// ─── Constants ───────────────────────────────────────────────────────────────

const FILTER_PREFIX = 'filter[';
const FILTER_SUFFIX = ']';

// ─── Serialization Helpers ───────────────────────────────────────────────────

/**
 * Serialize FilterCondition[] to URL query params.
 * Format: filter[field]=operator:value
 * For arrays (in/not_in): filter[field]=in:val1,val2
 * For null operators (is_null/is_not_null): filter[field]=is_null
 */
function serializeFiltersToParams(
  filters: FilterCondition[],
  existingParams: URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams(existingParams.toString());

  // Remove all existing filter params
  const keysToRemove: string[] = [];
  params.forEach((_value, key) => {
    if (key.startsWith(FILTER_PREFIX) && key.endsWith(FILTER_SUFFIX)) {
      keysToRemove.push(key);
    }
  });
  for (const key of keysToRemove) {
    params.delete(key);
  }

  // Serialize new filters
  for (const condition of filters) {
    const key = `${FILTER_PREFIX}${condition.field}${FILTER_SUFFIX}`;

    if (condition.value === null || condition.value === undefined) {
      // Null operators: filter[field]=is_null
      params.set(key, condition.operator);
    } else if (Array.isArray(condition.value)) {
      // Array values (in/not_in): filter[field]=in:val1,val2
      const joined = (condition.value as string[]).join(',');
      params.set(key, `${condition.operator}:${joined}`);
    } else {
      // Scalar values: filter[field]=equals:value
      params.set(key, `${condition.operator}:${String(condition.value)}`);
    }
  }

  return params;
}

/**
 * Parse URL query params back to FilterCondition[].
 * Reads all params matching filter[field]=operator:value pattern.
 */
function parseFiltersFromParams(searchParams: URLSearchParams): FilterCondition[] {
  const conditions: FilterCondition[] = [];

  searchParams.forEach((rawValue, key) => {
    if (!key.startsWith(FILTER_PREFIX) || !key.endsWith(FILTER_SUFFIX)) {
      return;
    }

    // Extract field name from filter[fieldName]
    const field = key.slice(FILTER_PREFIX.length, -FILTER_SUFFIX.length);
    if (!field) return;

    // Parse operator:value
    const colonIdx = rawValue.indexOf(':');
    let operator: FilterOperator;
    let value: unknown;

    if (colonIdx === -1) {
      // No colon means the entire string is the operator (is_null, is_not_null)
      operator = rawValue as FilterOperator;
      value = null;
    } else {
      operator = rawValue.slice(0, colonIdx) as FilterOperator;
      const rawVal = rawValue.slice(colonIdx + 1);

      // For 'in' and 'not_in', split value by commas into an array
      if (operator === 'in' || operator === 'not_in') {
        value = rawVal.split(',').filter(Boolean);
      } else if (operator === 'between') {
        value = rawVal.split(',').filter(Boolean);
      } else {
        value = rawVal;
      }
    }

    conditions.push({ field, operator, value });
  });

  return conditions;
}

// ─── Hook Return Type ────────────────────────────────────────────────────────

interface UseFilterUrlSyncReturn {
  /** Current filter conditions parsed from URL */
  filters: FilterCondition[];
  /** Update filters — serializes to URL and persists via fire-and-forget */
  setFilters: (filters: FilterCondition[]) => void;
  /** Get a single URL param by key (non-filter params) */
  getParam: (key: string) => string;
  /** Get a comma-separated URL param as array (non-filter params) */
  getArrayParam: (key: string) => string[];
  /** Update arbitrary URL params (for non-filter params like search, page) */
  updateParams: (newParams: Record<string, string | string[] | null | undefined>) => void;
  /** The raw searchParams instance */
  searchParams: URLSearchParams;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Hook for bidirectional filter ↔ URL synchronization.
 *
 * Serializes FilterCondition[] to URL query params: ?filter[field]=operator:value
 * Parses URL params back to FilterCondition[] on mount.
 * Persists filter preferences via fire-and-forget to the preference API.
 *
 * Requirements: 6.5, 6.8
 *
 * @param moduleId - Module identifier for preference persistence (e.g. 'leads')
 */
export function useFilterUrlSync(moduleId?: string): UseFilterUrlSyncReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse current filters from URL on every render (derived state)
  const filters = useMemo(
    () => parseFiltersFromParams(searchParams),
    [searchParams],
  );

  const getParam = useCallback((key: string): string => {
    return searchParams.get(key) || '';
  }, [searchParams]);

  const getArrayParam = useCallback((key: string): string[] => {
    const val = searchParams.get(key);
    return val ? val.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const updateParams = useCallback((newParams: Record<string, string | string[] | null | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(newParams).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
        params.delete(key);
      } else if (Array.isArray(value)) {
        params.set(key, value.filter(Boolean).join(','));
      } else {
        params.set(key, String(value));
      }
    });

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  /**
   * Set new filter conditions:
   * 1. Serialize to URL params (immediate)
   * 2. Persist to server preferences via fire-and-forget
   */
  const setFilters = useCallback((newFilters: FilterCondition[]) => {
    // Serialize filters to URL
    const params = serializeFiltersToParams(newFilters, searchParams);

    // Also reset page to 1 when filters change (remove page param or set to 1)
    params.set('page', '1');

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });

    // Fire-and-forget: persist filter preferences to server
    if (moduleId) {
      tablePreferencesApi
        .saveFilters(moduleId, newFilters)
        .catch(() => {
          toast.error('Unable to save filter preference', { duration: 5000 });
        });
    }
  }, [router, pathname, searchParams, moduleId]);

  return { filters, setFilters, getParam, getArrayParam, updateParams, searchParams };
}
