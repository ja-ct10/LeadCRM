import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ login: vi.fn(), restore: vi.fn(), toast: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() } }));
vi.mock('@/lib/config', () => ({ USE_MOCK_AUTH: false }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ login: mocks.login, requestPasswordReset: vi.fn(), confirmPasswordReset: vi.fn() }) }));
vi.mock('@/shared/services/auth.api', () => ({ authApi: { restoreLoginLockout: mocks.restore } }));
vi.mock('sonner', () => ({ toast: mocks.toast }));
import ModernLoginPage from '../../pages/modern-login-page';
import { countdownDeadline, formatLoginCountdown } from '../use-login-lockout';

const email = 'lockout@camxian.com';
function lockedError(seconds = 300) {
  // Deliberate server/browser clock skew.
  const serverNow = new Date('2030-01-01T00:00:00Z').toISOString();
  return Object.assign(new Error('Cooldown'), { status: 429, code: 'AUTH_LOGIN_LOCKED', serverNow,
    retryAt: new Date(Date.parse(serverNow) + seconds * 1000).toISOString() });
}
async function advance(ms = 350) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function form() {
  const view = render(<ModernLoginPage onNavigate={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'SensitivePassword1!' } });
  await advance();
  return { view, form: screen.getByLabelText('Password').closest('form')! };
}
async function submit(element: HTMLFormElement) { await act(async () => { fireEvent.submit(element); }); }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-12T04:00:00Z'));
  mocks.login.mockReset(); mocks.restore.mockReset(); mocks.toast.error.mockReset(); mocks.toast.dismiss.mockReset();
  mocks.restore.mockImplementation(async () => ({ success: true, data: { locked: false, serverNow: new Date().toISOString() } }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('login lockout presentation and lifecycle', () => {
  it('displays the inactivity notice after the expired session redirects to Login', async () => {
    sessionStorage.setItem('leadcrm:idle-expired', '1');
    await form();
    expect(screen.getByRole('alert').textContent).toBe('Your session expired due to inactivity. Please log in again.');
    expect(sessionStorage.getItem('leadcrm:idle-expired')).toBeNull();
  });
  it('shows a permanent security-lock message without the temporary dialog or countdown', async () => {
    const message = 'Your account has been locked due to repeated failed login attempts. Please contact your administrator.';
    const { form: element } = await form();
    mocks.login.mockRejectedValue(Object.assign(new Error(message), { status: 423, code: 'AUTH_ACCOUNT_LOCKED' }));
    await submit(element);
    expect(screen.queryByRole('timer')).toBeNull(); expect(screen.queryByRole('dialog')).toBeNull();
    expect(mocks.toast.error).toHaveBeenCalledWith(message, { id: 'leadcrm-login-error' });
  });
  it('keeps five normal errors and opens only on the structured sixth response, without a duplicate toast', async () => {
    const { form: element } = await form();
    mocks.login.mockRejectedValue(new Error('Invalid email or password.'));
    for (let i = 0; i < 5; i++) { await submit(element); expect(screen.queryByRole('dialog')).toBeNull(); }
    expect(mocks.toast.error).toHaveBeenCalledTimes(5);
    mocks.login.mockRejectedValue(lockedError()); await submit(element);
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Too Many Login Attempts' })).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toBe('05:00'); expect(mocks.toast.error).toHaveBeenCalledTimes(5);
    expect(mocks.toast.dismiss).toHaveBeenCalledWith('leadcrm-login-error');
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('');
  });
  it('continues counting after closing/reopening, blocks form submissions and keeps recovery accessible', async () => {
    const { form: element } = await form(); mocks.login.mockRejectedValue(lockedError()); await submit(element);
    await advance(1000); expect(screen.getByRole('timer').textContent).toBe('04:59');
    fireEvent.click(screen.getByRole('button', { name: /^Close$/ })); await advance(1000);
    const button = screen.getByRole('button', { name: /Try again in/ }) as HTMLButtonElement; expect(button.disabled).toBe(true);
    await submit(element); expect(mocks.login).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'View timer' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1); expect(screen.getByRole('timer').textContent).toBe('04:58');
    fireEvent.keyDown(window, { key: 'Escape' }); await advance(200);
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' })); expect(screen.getByText('Forgot password?')).toBeTruthy();
  });
  it('restores remaining duration through the backend after refresh without local storage', async () => {
    const writes = vi.spyOn(Storage.prototype, 'setItem'); const error = lockedError(130);
    mocks.restore.mockResolvedValue({ success: true, data: { locked: true, retryAt: error.retryAt, serverNow: error.serverNow } });
    const first = render(<ModernLoginPage onNavigate={vi.fn()} />); await advance(1);
    expect(screen.getByRole('timer').textContent).toBe('02:10'); first.unmount();
    const updated = lockedError(87); mocks.restore.mockResolvedValue({ success: true, data: { locked: true, retryAt: updated.retryAt, serverNow: updated.serverNow } });
    render(<ModernLoginPage onNavigate={vi.fn()} />); await advance(1);
    expect(screen.getByRole('timer').textContent).toBe('01:27'); expect(writes).not.toHaveBeenCalled(); writes.mockRestore();
  });
  it('recalculates after sleep/focus and expires without an automatic login', async () => {
    const { form: element } = await form(); mocks.login.mockRejectedValue(lockedError()); await submit(element);
    vi.setSystemTime(Date.now() + 180_000); fireEvent.focus(window);
    expect(screen.getByRole('timer').textContent).toBe('02:00');
    vi.setSystemTime(Date.now() + 120_000); fireEvent.focus(window); await advance(250);
    expect((screen.getByRole('button', { name: /^Login$/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(mocks.login).toHaveBeenCalledOnce();
  });
  it('prevents duplicate submissions while a login request is pending', async () => {
    const { form: element } = await form(); let complete!: (value: boolean) => void;
    mocks.login.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    fireEvent.submit(element); fireEvent.submit(element); expect(mocks.login).toHaveBeenCalledOnce();
    await act(async () => complete(true));
  });
  it('validates a different identity separately', async () => {
    const { form: element } = await form(); mocks.login.mockRejectedValue(lockedError()); await submit(element);
    fireEvent.keyDown(window, { key: 'Escape' }); await advance(200);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'other@camxian.com' } }); await advance();
    expect(mocks.restore).toHaveBeenLastCalledWith('other@camxian.com');
    expect((screen.getByRole('button', { name: /^Login$/ }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('preserves ordinary IP-rate errors without showing an account lockout modal', async () => {
    const { form: element } = await form(); mocks.login.mockRejectedValue(Object.assign(new Error('Too many sign-in requests.'), { code: 'AUTH_LOGIN_RATE_LIMITED', status: 429 }));
    await submit(element); expect(screen.queryByRole('dialog')).toBeNull(); expect(mocks.toast.error).toHaveBeenCalledWith('Too many sign-in requests.', { id: 'leadcrm-login-error' });
  });
  it('formats boundaries and corrects server clock differences', () => {
    expect([300, 299, 30, 1, 0].map(formatLoginCountdown)).toEqual(['05:00', '04:59', '00:30', '00:01', '00:00']);
    const error = lockedError(); expect(countdownDeadline(error.retryAt, error.serverNow, 1000)).toBe(301_000);
  });
});
