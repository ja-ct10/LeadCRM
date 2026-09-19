import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const complete = vi.hoisted(() => vi.fn());
const applyAuthUser = vi.hoisted(() => vi.fn());
vi.mock('@/shared/services/auth.api', () => ({ authApi: { completeOnboarding: complete } }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u' }, applyAuthUser, logout: vi.fn() }) }));
import OnboardingPage from '../ui/onboarding-page';
beforeEach(() => { cleanup(); vi.clearAllMocks(); });
it('requires explicit acknowledgment and applies the server response once', async () => {
  const user = { id: 'u', onboardingCompletedAt: '2026-01-01' };
  complete.mockResolvedValue({ data: { user } });
  render(<OnboardingPage />);
  expect(complete).not.toHaveBeenCalled();
  expect(screen.queryByText(/subscription|company setup|pricing/i)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Continue to dashboard' }));
  await waitFor(() => expect(applyAuthUser).toHaveBeenCalledWith(user, 'u'));
  expect(complete).toHaveBeenCalledOnce();
});
it('stays on onboarding and displays a failed save', async () => {
  complete.mockRejectedValue(new Error('Network unavailable'));
  render(<OnboardingPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Continue to dashboard' }));
  await screen.findByRole('alert');
  expect(applyAuthUser).not.toHaveBeenCalled();
});
