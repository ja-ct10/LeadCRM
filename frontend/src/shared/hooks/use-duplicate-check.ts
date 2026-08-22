'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api/client';
import { USE_MOCK_DATA } from '@/lib/config';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DuplicateMatch {
  id: string;
  entityType: 'lead' | 'contact' | 'account';
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  status?: string;
  confidence: 'HIGH' | 'MEDIUM';
  matchedFields: string[];
}

interface UseDuplicateCheckOptions {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  excludeId?: string;
  entityTypes?: ('lead' | 'contact' | 'account')[];
  enabled?: boolean;
}

interface UseDuplicateCheckResult {
  matches: DuplicateMatch[];
  isChecking: boolean;
  hasDuplicates: boolean;
  dismiss: () => void;
  isDismissed: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 600;
const EMPTY_MATCHES: DuplicateMatch[] = [];

// ─── Hook ──────────────────────────────────────────────────────────────────

/**
 * useDuplicateCheck — debounced duplicate detection hook.
 * Calls POST /api/v1/crm/duplicate-check when input fields change.
 * Returns matches with confidence levels and a dismiss function.
 *
 * IMPORTANT: This hook is designed to be safe against infinite re-render loops.
 * - Uses a stable empty array constant (EMPTY_MATCHES) to avoid new references
 * - Uses refs for mutable values that shouldn't trigger re-renders
 * - Stabilizes the entityTypes dependency via a string key
 * - Only calls setState when values actually change
 */
export function useDuplicateCheck(options: UseDuplicateCheckOptions): UseDuplicateCheckResult {
  const { email, phone, firstName, lastName, companyName, excludeId, entityTypes, enabled = true } = options;

  const [matches, setMatches] = useState<DuplicateMatch[]>(EMPTY_MATCHES);
  const [isChecking, setIsChecking] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const prevKeyRef = useRef<string>('');

  // Stabilize entityTypes — convert array to string for stable dep comparison
  const entityTypesStable = useMemo(
    () => entityTypes ?? ['lead', 'contact', 'account'],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [(entityTypes ?? []).join(',')],
  );

  // Build a stable "search key" from the meaningful input values.
  // Only trigger the effect when this key actually changes.
  const searchKey = useMemo(() => {
    const parts: string[] = [];
    if (email && email.includes('@')) parts.push(`e:${email}`);
    if (phone && phone.replace(/\D/g, '').length >= 7) parts.push(`p:${phone}`);
    if (firstName && lastName) parts.push(`n:${firstName}|${lastName}`);
    if (companyName && companyName.length >= 2) parts.push(`c:${companyName}`);
    return parts.join(';');
  }, [email, phone, firstName, lastName, companyName]);

  // Reset dismissed state only when the search key meaningfully changes
  useEffect(() => {
    if (searchKey !== prevKeyRef.current) {
      prevKeyRef.current = searchKey;
      setIsDismissed(false);
    }
  }, [searchKey]);

  // Main duplicate check effect — triggers only when searchKey changes
  useEffect(() => {
    // Skip entirely in mock mode or when disabled
    if (USE_MOCK_DATA || !enabled) {
      if (matches.length > 0) setMatches(EMPTY_MATCHES);
      return;
    }

    // No valid search criteria — clear matches
    if (!searchKey) {
      if (matches.length > 0) setMatches(EMPTY_MATCHES);
      return;
    }

    // Debounce the API call
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      // Cancel previous in-flight request
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setIsChecking(true);
      try {
        const body: Record<string, unknown> = {};
        if (email && email.includes('@')) body.email = email;
        if (phone && phone.replace(/\D/g, '').length >= 7) body.phone = phone;
        if (firstName && lastName) { body.firstName = firstName; body.lastName = lastName; }
        if (companyName && companyName.length >= 2) body.companyName = companyName;
        if (excludeId) body.excludeId = excludeId;
        body.entityTypes = entityTypesStable;

        const response = await apiClient.post<{ success: boolean; data: { matches: DuplicateMatch[] } }>(
          '/crm/duplicate-check',
          body,
        );

        if (response.success && response.data?.matches?.length > 0) {
          setMatches(response.data.matches);
        } else {
          setMatches(EMPTY_MATCHES);
        }
      } catch {
        // Silently fail — duplicate check is non-blocking
        setMatches(EMPTY_MATCHES);
      } finally {
        setIsChecking(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey, excludeId, enabled]);

  const dismiss = useCallback((): void => {
    setIsDismissed(true);
  }, []);

  return {
    matches: isDismissed ? EMPTY_MATCHES : matches,
    isChecking,
    hasDuplicates: !isDismissed && matches.length > 0,
    dismiss,
    isDismissed,
  };
}
