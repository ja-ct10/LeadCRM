import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import HelpLayout from '../ui/help-layout';
import { LEGAL_ORGANIZATION } from '../../legal/legal-documents';

const auth = vi.hoisted(() => ({ user: null as null | { id: string; mustChangePassword?: boolean }, isLoading: false, authError: null as string | null }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/features/tenant/layout/crm-layout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div><aside aria-label="CRM sidebar" /><header aria-label="CRM top bar" />{children}</div> }));
afterEach(() => { cleanup(); auth.user = null; auth.isLoading = false; auth.authError = null; });

it.each(['signed out', 'restoring session', 'session unavailable'])('renders public guides without workspace chrome when %s', state => {
  auth.isLoading = state === 'restoring session';
  auth.authError = state === 'session unavailable' ? 'Network unavailable' : null;
  render(<HelpLayout><h1>Help guide</h1></HelpLayout>);
  expect(screen.getByRole('heading', { name: 'Help guide' })).toBeTruthy();
  expect(screen.getByRole('main')).toBeTruthy();
  expect(screen.queryByRole('complementary')).toBeNull();
  expect(screen.queryByRole('banner')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull();
  const footerElement = screen.getByRole('contentinfo');
  expect(screen.getByRole('main').contains(footerElement)).toBe(false);
  const footer = within(footerElement);
  expect(footer.getByRole('link', { name: 'LeadCRM' }).getAttribute('href')).toBe('/login');
  expect(footer.getByText('A centralized CRM platform for Camxian Technologies, designed to manage leads, customers, sales pipelines, and automated workflows.')).toBeTruthy();
  expect(footer.getByRole('link', { name: LEGAL_ORGANIZATION.supportEmail }).getAttribute('href')).toBe(`mailto:${LEGAL_ORGANIZATION.supportEmail}`);
  expect(footer.getByText('© 2026 LeadCRM. All rights reserved.')).toBeTruthy();
  for (const [label, href] of [['Privacy Policy', '/privacy-policy'], ['Terms of Service', '/terms-of-service'], ['Help Center', '/help']]) {
    expect(footer.getByRole('link', { name: label }).getAttribute('href')).toBe(href);
  }
});
it.each([false, true])('uses the existing sidebar and top bar for a signed-in user (password setup pending: %s)', mustChangePassword => {
  auth.user = { id: 'test-user', mustChangePassword };
  render(<HelpLayout><h1>Help guide</h1></HelpLayout>);
  expect(screen.getByRole('complementary', { name: 'CRM sidebar' })).toBeTruthy();
  expect(screen.getByRole('banner', { name: 'CRM top bar' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Help guide' })).toBeTruthy();
  expect(screen.queryByRole('contentinfo')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull();
});
