import { expect, it } from 'vitest';
import type { User } from '@/store/types';
import { getAccountDestination, getPostLoginDestination, resolveAuthRoute } from './auth-routing';
const returning = { id: 'staff', mustChangePassword: true, onboardingCompletedAt: '2026-01-01' } as User;
it('routes expired login and restored sessions to the existing change-password page', () => {
  expect(getPostLoginDestination(returning, '/crm/leads')).toBe('/change-password');
  expect(resolveAuthRoute(returning, '/settings')).toBe('/change-password');
  expect(resolveAuthRoute(returning, '/change-password')).toBeNull();
});
it('returns an established user to the dashboard after renewing their password', () => {
  expect(getAccountDestination({ ...returning, mustChangePassword: false })).toBe('/dashboard');
});
it('keeps temporary-password setup ahead of first-login onboarding', () => {
  expect(getAccountDestination({ ...returning, onboardingCompletedAt: null })).toBe('/change-password');
  expect(getAccountDestination({ ...returning, mustChangePassword: false, onboardingCompletedAt: null })).toBe('/onboarding');
});
