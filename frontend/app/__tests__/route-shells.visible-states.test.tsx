import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
vi.mock('next/navigation', () => ({
  redirect: (path: string) => { throw new Error('redirect:' + path); },
  useSearchParams: () => new URLSearchParams(),
}));
import Home from '../page';
import Verify from '../verify-email/page';
import Company from '../company-setup/page';
import PrivacyPolicy from '../privacy-policy/page';
import TermsOfService from '../terms-of-service/page';
import Help from '../help/page';
afterEach(cleanup);
it('redirects the root route directly to sign in on the server', () => {
  expect(() => Home()).toThrow('redirect:/login');
});
it.each([
  [PrivacyPolicy, 'Privacy Policy'],
  [TermsOfService, 'Terms of Service'],
  [Help, 'How can we help?'],
] as const)('renders public legal and help routes without authentication: %s', (Page, title) => {
  render(<Page />);
  expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
});
it.each([Verify, Company])('redirects retired public entry points to sign in', page => {
  expect(() => page()).toThrow('redirect:/login');
});
