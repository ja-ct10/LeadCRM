import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ login: vi.fn() }) }));
vi.mock('@/shared/services/auth.api', () => ({ authApi: { restoreLoginLockout: vi.fn().mockResolvedValue({ data: { locked: false } }) } }));
import ModernLoginPage from '../../pages/modern-login-page';
import { LEGAL_ORGANIZATION } from '../../legal/legal-documents';

afterEach(cleanup);

it('describes Camxian access without public signup or Google authentication', () => {
  render(<ModernLoginPage onNavigate={vi.fn()} />);
  expect(screen.getByText(/CAMXIAN TECHNOLOGIES/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /sign up|google/i })).toBeNull();
  expect(screen.getByLabelText(/email address/i)).toBeTruthy();
  expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Login' })).toBeTruthy();
  expect(screen.queryByText(/internal (?:CRM )?workspace/i)).toBeNull();
  expect(screen.queryByText('Camxian Technologies’ centralized workspace for leads, customers, pipelines, and workflows.')).toBeNull();
  expect(screen.queryByText(/^LeadCRM is Camxian Technologies/)).toBeNull();
  expect(screen.getByText('Use the registered staff email provided to your Client Administrator. Contact your administrator for access.')).toBeTruthy();
});

it('renders the login footer with brand, support, company links, and copyright', () => {
  render(<ModernLoginPage onNavigate={vi.fn()} />);
  const footer = within(screen.getByRole('contentinfo'));
  const brand = footer.getByRole('link', { name: 'LeadCRM' });
  expect(brand.getAttribute('href')).toBe('/login');
  expect(brand.querySelector('img')?.getAttribute('src')).toBe('/leadcrm_logo.png');
  expect(footer.getByText('A centralized CRM platform for Camxian Technologies, designed to manage leads, customers, sales pipelines, and automated workflows.')).toBeTruthy();
  expect(footer.getByText('Support:')).toBeTruthy();
  expect(footer.getByRole('link', { name: LEGAL_ORGANIZATION.supportEmail }).getAttribute('href')).toBe(`mailto:${LEGAL_ORGANIZATION.supportEmail}`);
  const company = within(footer.getByRole('navigation', { name: 'COMPANY' }));
  for (const [name, href] of [['Privacy Policy', '/privacy-policy'], ['Terms of Service', '/terms-of-service'], ['Help Center', '/help']]) {
    expect(company.getByRole('link', { name }).getAttribute('href')).toBe(href);
  }
  expect(footer.getByText('© 2026 LeadCRM. All rights reserved.')).toBeTruthy();
});
