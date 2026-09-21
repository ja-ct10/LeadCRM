import React from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ login: vi.fn() }) }));
import ModernLoginPage from '../../pages/modern-login-page';
it('describes Camxian access without public signup or Google authentication', () => {
  render(<ModernLoginPage onNavigate={vi.fn()} />);
  expect(screen.getByText(/CAMXIAN TECHNOLOGIES/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /sign up|google/i })).toBeNull();
  expect(screen.getByLabelText(/email address/i)).toBeTruthy();
  expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
});
