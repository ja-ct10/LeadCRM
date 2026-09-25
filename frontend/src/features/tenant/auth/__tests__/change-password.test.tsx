import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const { changePassword, applyAuthUser } = vi.hoisted(() => ({ changePassword: vi.fn(), applyAuthUser: vi.fn() }));
vi.mock('@/shared/services/auth.api', () => ({ authApi: { changePassword } }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'employee', email: 'employee@camxian.com' }, applyAuthUser, logout: vi.fn() }) }));
import ChangePasswordPage from '../ui/change-password-page';
beforeEach(() => { cleanup(); vi.resetAllMocks(); });
function fill(confirm = 'Personal2!') {
  fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'Temporary1!' } });
  fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'Personal2!' } });
  fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
}
it('changes credentials then applies the canonical response using the preserved session', async () => {
  changePassword.mockResolvedValue({ success: true, data: { user: { id: 'employee', mustChangePassword: false } } });
  render(<ChangePasswordPage />); fill();
  await waitFor(() => expect(applyAuthUser).toHaveBeenCalledWith({ id: 'employee', mustChangePassword: false }, 'employee'));
  expect(changePassword).toHaveBeenCalledWith('Temporary1!', 'Personal2!');
});
it('does not update authentication after the server rejects the current password', async () => {
  changePassword.mockRejectedValue(new Error('Current password is incorrect.'));
  render(<ChangePasswordPage />); fill();
  expect((await screen.findByRole('alert')).textContent).toContain('Current password is incorrect');
  expect(applyAuthUser).not.toHaveBeenCalled();
});
it('checks confirmation before sending credentials', async () => {
  render(<ChangePasswordPage />); fill('Different3!');
  expect(screen.getByRole('alert').textContent).toContain('Passwords do not match');
  expect(changePassword).not.toHaveBeenCalled();
});
