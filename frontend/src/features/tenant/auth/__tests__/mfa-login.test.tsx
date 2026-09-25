import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ verify: vi.fn(), apply: vi.fn() }));
vi.mock('@/shared/services/auth.api', () => ({ authApi: { verifyMfa: mocks.verify } }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ applyAuthUser: mocks.apply }) }));
import { MfaLogin } from '../ui/mfa-login';
beforeEach(() => vi.resetAllMocks()); afterEach(cleanup);
it('does not authenticate before valid server verification', async () => {
  render(<MfaLogin onCancel={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123a56' } });
  fireEvent.click(screen.getByText('Verify'));
  expect(mocks.verify).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123456' } });
  mocks.verify.mockRejectedValueOnce(new Error('Invalid authentication code.'));
  fireEvent.click(screen.getByText('Verify'));
  expect(await screen.findByText('Invalid authentication code.')).toBeTruthy();
  expect(mocks.apply).not.toHaveBeenCalled();
  mocks.verify.mockResolvedValue({ data: { user: { id: 'verified' } } });
  fireEvent.click(screen.getByText('Verify'));
  await waitFor(() => expect(mocks.apply).toHaveBeenCalledWith({ id: 'verified' }));
});
it('supports a strict recovery-code input and clears it when changing methods', () => {
  render(<MfaLogin onCancel={vi.fn()} />);
  fireEvent.click(screen.getByText('Use recovery code'));
  fireEvent.change(screen.getByLabelText('Recovery code'), { target: { value: '1234abcd-5678ef90' } });
  fireEvent.click(screen.getByText('Use authenticator code'));
  expect((screen.getByLabelText('Authenticator code') as HTMLInputElement).value).toBe('');
});
