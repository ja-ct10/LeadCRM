import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error('redirect:' + path); } }));
import Home from '../page';
import Verify from '../verify-email/page';
import Company from '../company-setup/page';
afterEach(cleanup);
it('shows the public app overview and legal links without authentication', () => {
  render(<Home />);
  expect(screen.getByRole('heading', { level: 1, name: /LeadCRM/ })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Sign in to LeadCRM' }).getAttribute('href')).toBe('/login');
  for (const [name, href] of [['Privacy Policy', '/privacy-policy'], ['Terms of Service', '/terms-of-service']]) {
    expect(screen.getAllByRole('link', { name }).every(link => link.getAttribute('href') === href)).toBe(true);
  }
});
it.each([Verify, Company])('redirects retired public entry points to sign in', page => {
  expect(() => page()).toThrow('redirect:/login');
});
