import { expect, it, vi } from 'vitest';
import { workspaceReadyMiddleware } from '../tenant.middleware';
const user = {
  id: 'user', role: 'Client Admin', emailVerified: '2026-01-01',
  onboardingStep: 0, onboardingCompletedAt: null,
};
it.each([0, 1, 2, 3])('rejects direct CRM access at incomplete step %s', step => {
  const next = vi.fn();
  workspaceReadyMiddleware({ authUser: { ...user, onboardingStep: step } } as never, {} as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'ONBOARDING_REQUIRED' }));
});
it('permits a completed Guest workspace independently of paid subscription status', () => {
  const next = vi.fn();
  workspaceReadyMiddleware({ authUser: { ...user, onboardingStep: 3,
    onboardingCompletedAt: '2026-01-02' } } as never, {} as never, next);
  expect(next).toHaveBeenCalledWith();
});
it('requires a password change even when onboarding is marked complete', () => {
  const next = vi.fn();
  workspaceReadyMiddleware({ authUser: { ...user, mustChangePassword: true,
    onboardingStep: 3, onboardingCompletedAt: '2026-01-02' } } as never, {} as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'PASSWORD_CHANGE_REQUIRED' }));
});
