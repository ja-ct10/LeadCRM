import type { User } from './types';

/** Only used in explicitly enabled mock mode; real accounts always use API state. */
export function normalizeMockUser(user: User): User {
  const hasProgress = user.onboardingStep !== undefined;
  return {
    ...user,
    emailVerified: user.emailVerified ?? '2026-01-01T00:00:00.000Z',
    onboardingStep: hasProgress ? user.onboardingStep : 3,
    onboardingCompletedAt: hasProgress ? user.onboardingCompletedAt ?? null : '2026-01-01T00:00:00.000Z',
    isTenantOwner: user.isTenantOwner ?? true,
  };
}
