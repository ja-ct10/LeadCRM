'use client';

import { useRef, useState } from 'react';
import type { AuthResponse } from '@leadcrm/shared';
import { useAuth } from '@/store/AuthContext';
import { authApi } from '@/shared/services/auth.api';

export function useOnboarding() {
  const { user, applyAuthUser, refreshUser } = useAuth();
  const pending = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(request: () => Promise<AuthResponse>) {
    if (!user || pending.current) return;
    pending.current = true;
    setIsSaving(true);
    setError('');
    try {
      const response = await request();
      applyAuthUser(response.data.user, user.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save. Please try again.');
      if ((cause as { status?: number }).status === 409) {
        try { await refreshUser(); } catch { /* AuthContext displays the restore failure. */ }
      }
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  }

  return {
    user, isSaving, error,
    complete: () => save(() => authApi.completeOnboarding()),
  };
}
