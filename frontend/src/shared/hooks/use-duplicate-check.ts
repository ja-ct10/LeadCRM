'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { CrmEmailSchema } from '@leadcrm/shared';
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

/** Non-blocking checks belong to the normalized draft that requested them. */
export function useDuplicateCheck(options: UseDuplicateCheckOptions): UseDuplicateCheckResult {
  const { email, phone, firstName, lastName, companyName, excludeId, entityTypes, enabled = true } = options;
  const body: Record<string, unknown> = {};
  const parsedEmail = CrmEmailSchema.safeParse(email);
  if (parsedEmail.success) body.email = parsedEmail.data;
  if (phone && phone.replace(/\D/g, '').length >= 7) body.phone = phone.trim();
  if (firstName?.trim() && lastName?.trim()) { body.firstName = firstName.trim(); body.lastName = lastName.trim(); }
  if (companyName && companyName.trim().length >= 2) body.companyName = companyName.trim();
  const hasCriteria = Object.keys(body).length > 0;
  if (excludeId) body.excludeId = excludeId;
  body.entityTypes = [...new Set(entityTypes ?? ['lead', 'contact', 'account'])].sort();
  const searchKey = hasCriteria && (body.entityTypes as string[]).length ? JSON.stringify(body) : '';
  const identity = JSON.stringify([enabled && !USE_MOCK_DATA, searchKey]);
  const draft = useRef(identity);
  draft.current = identity;
  const [check, setCheck] = useState({ identity: '', matches: EMPTY_MATCHES, isChecking: false, isDismissed: false });

  useEffect(() => {
    setCheck({ identity, matches: EMPTY_MATCHES, isChecking: false, isDismissed: false });
    if (USE_MOCK_DATA || !enabled || !searchKey) return;
    const controller = new AbortController();
    const current = () => !controller.signal.aborted && draft.current === identity;
    const timer = setTimeout(async () => {
      setCheck(previous => ({ ...previous, isChecking: true }));
      try {
        const response = await apiClient.post<{ success: boolean; data: { matches: DuplicateMatch[] } }>(
          '/crm/duplicate-check', JSON.parse(searchKey), { signal: controller.signal },
        );
        if (current()) setCheck(previous => ({ ...previous, matches: response.success ? response.data?.matches ?? EMPTY_MATCHES : EMPTY_MATCHES }));
      } catch {
        if (current()) setCheck(previous => ({ ...previous, matches: EMPTY_MATCHES }));
      } finally {
        if (current()) setCheck(previous => ({ ...previous, isChecking: false }));
      }
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [searchKey, enabled, identity]);

  const dismiss = useCallback(() => setCheck(previous => ({ ...previous, isDismissed: true })), []);
  const current = enabled && !USE_MOCK_DATA && !!searchKey && check.identity === identity;
  const isDismissed = current && check.isDismissed;
  const matches = current && !isDismissed ? check.matches : EMPTY_MATCHES;
  return {
    matches, isChecking: current && check.isChecking, hasDuplicates: matches.length > 0, dismiss, isDismissed,
  };
}
