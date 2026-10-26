import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
const auth = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ login: auth.login }) }));
vi.mock('@/shared/services/auth.api', () => ({ authApi: { restoreLoginLockout: vi.fn().mockResolvedValue({ data: { locked: false } }) } }));
import ModernLoginPage from '../../pages/modern-login-page';
import { LEGAL_ORGANIZATION } from '../../legal/legal-documents';
import { REMEMBERED_EMAIL_KEY } from '@/shared/auth/remembered-login';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); auth.login.mockReset().mockResolvedValue(true); });
afterEach(cleanup);

it('describes Camxian access without public signup or Google authentication', () => {
  render(<ModernLoginPage onNavigate={vi.fn()} />);
  expect(screen.getByRole('heading', { name: /Technology that will\s+shape your future\./ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /sign up|google/i })).toBeNull();
  expect(screen.getByLabelText(/email address/i)).toBeTruthy();
  expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Login' })).toBeTruthy();
  expect(screen.queryByText(/internal (?:CRM )?workspace/i)).toBeNull();
  expect(screen.queryByText('Camxian Technologies’ centralized workspace for leads, customers, pipelines, and workflows.')).toBeNull();
  expect(screen.queryByText(/^LeadCRM is Camxian Technologies/)).toBeNull();
  expect(screen.getByText('Use the registered staff email provided to your Client Administrator. Contact your administrator for access.')).toBeTruthy();
});

it.each([false, true])('passes Remember me to login with checked=%s', async checked => {
  render(<ModernLoginPage onNavigate={vi.fn()} />);
  const remember = screen.getByRole('checkbox', { name: 'Remember me' }) as HTMLInputElement;
  expect(remember.checked).toBe(false);
  expect(screen.queryByText('Remember password')).toBeNull();
  fireEvent.click(remember);
  expect(remember.checked).toBe(true);
  fireEvent.click(remember);
  expect(remember.checked).toBe(false);
  if (checked) fireEvent.click(remember);

  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: ' Staff@CAMXIAN.COM ' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ExistingPassword1!' } });
  await waitFor(() => expect((screen.getByRole('button', { name: 'Login' }) as HTMLButtonElement).disabled).toBe(false));
  await act(async () => { fireEvent.submit(screen.getByLabelText('Password').closest('form')!); });
  expect(remember.checked).toBe(checked);
  expect(auth.login).toHaveBeenCalledExactlyOnceWith('staff@camxian.com', 'ExistingPassword1!', checked);
  expect(localStorage.getItem(REMEMBERED_EMAIL_KEY)).toBe(checked ? 'staff@camxian.com' : null);
  expect(JSON.stringify({ ...localStorage })).not.toContain('ExistingPassword1!');
});

it('restores only a remembered email and immediately forgets it when unchecked', () => {
  localStorage.setItem(REMEMBERED_EMAIL_KEY, 'staff@camxian.com');
  const view = render(<ModernLoginPage onNavigate={vi.fn()} />);
  expect(screen.getByLabelText('Email address')).toHaveProperty('value', 'staff@camxian.com');
  expect(screen.getByLabelText('Password')).toHaveProperty('value', '');
  expect(screen.getByRole('checkbox', { name: 'Remember me' })).toHaveProperty('checked', true);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Remember me' }));
  expect(localStorage.getItem(REMEMBERED_EMAIL_KEY)).toBeNull();
  view.unmount(); render(<ModernLoginPage onNavigate={vi.fn()} />);
  expect(screen.getByLabelText('Email address')).toHaveProperty('value', '');
  expect(screen.getByRole('checkbox', { name: 'Remember me' })).toHaveProperty('checked', false);
});

it('does not replace remembered identity after a failed login', async () => {
  localStorage.setItem(REMEMBERED_EMAIL_KEY, 'original@camxian.com');
  auth.login.mockRejectedValueOnce(new Error('Invalid email or password.'));
  render(<ModernLoginPage onNavigate={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'other@camxian.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'WrongPassword1!' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Login' })).toHaveProperty('disabled', false));
  await act(async () => fireEvent.submit(screen.getByLabelText('Password').closest('form')!));
  expect(localStorage.getItem(REMEMBERED_EMAIL_KEY)).toBe('original@camxian.com');
});

it('renders the login footer with brand, support, company links, and copyright', () => {
  render(<ModernLoginPage onNavigate={vi.fn()} />);
  const footer = within(screen.getByRole('contentinfo'));
  const brand = footer.getByRole('link', { name: 'Camxian Technologies' });
  expect(brand.getAttribute('href')).toBe('/login');
  expect(brand.querySelector('img')?.getAttribute('src')).toBe('/camxian_logo.png');
  expect(footer.getByText('Powered by LeadCRM')).toBeTruthy();
  expect(footer.getByText('A centralized CRM platform for Camxian Technologies, designed to manage leads, customers, sales pipelines, and automated workflows.')).toBeTruthy();
  expect(footer.getByText('Support:')).toBeTruthy();
  expect(footer.getByRole('link', { name: LEGAL_ORGANIZATION.supportEmail }).getAttribute('href')).toBe(`mailto:${LEGAL_ORGANIZATION.supportEmail}`);
  const company = within(footer.getByRole('navigation', { name: 'COMPANY' }));
  for (const [name, href] of [['Privacy Policy', '/privacy-policy'], ['Terms of Service', '/terms-of-service'], ['Help Center', '/help']]) {
    expect(company.getByRole('link', { name }).getAttribute('href')).toBe(href);
  }
  expect(footer.getByText('© 2026 LeadCRM. All rights reserved.')).toBeTruthy();
});
