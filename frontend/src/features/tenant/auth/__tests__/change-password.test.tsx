import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const { changePassword, login } = vi.hoisted(() => ({ changePassword: vi.fn(), login: vi.fn() }));
vi.mock('@/shared/services/auth.api', () => ({ authApi: { changePassword } }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { email: 'employee@camxian.com' }, login, logout: vi.fn() }) }));
import ChangePasswordPage from '../ui/change-password-page';
beforeEach(() => { cleanup(); vi.resetAllMocks(); });
function fill(confirm = 'Personal2!') {
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Temporary1!' } });
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Personal2!' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'Change password and continue' }));
}
it('changes credentials on the server then signs in with a fresh session', async () => {
  changePassword.mockResolvedValue({ success: true }); login.mockResolvedValue(true);
  render(<ChangePasswordPage />); fill();
  await waitFor(() => expect(login).toHaveBeenCalledWith('employee@camxian.com', 'Personal2!'));
  expect(changePassword).toHaveBeenCalledWith('Temporary1!', 'Personal2!');
});
it('does not update authentication after the server rejects the current password', async () => {
  changePassword.mockRejectedValue(new Error('Current password is incorrect.'));
  render(<ChangePasswordPage />); fill();
  expect((await screen.findByRole('alert')).textContent).toContain('Current password is incorrect');
  expect(login).not.toHaveBeenCalled();
});
it('checks confirmation before sending credentials', async () => {
  render(<ChangePasswordPage />); fill('Different3!');
  expect(screen.getByRole('alert').textContent).toContain('Passwords do not match');
  expect(changePassword).not.toHaveBeenCalled();
});
