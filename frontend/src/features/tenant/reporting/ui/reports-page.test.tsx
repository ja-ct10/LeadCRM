import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ loading: false, error: null as string | null, hasReport: true }));
vi.mock('@/features/tenant/dashboard/ui/dashboard', () => ({ default: ({ heading, renderToolbarActions, presentation }: any) => <div data-presentation={presentation}>{heading}{renderToolbarActions({ query: { range: 'last3', revenueInterval: 'week' }, report: state.hasReport ? { period: { start: '2026-08-01', end: '2026-10-10' }, metrics: { totalLeads: 0, totalDeals: 0 } } : null, error: state.error, loading: state.loading, className: 'existing-toolbar-style' })}</div> }));
import ReportsPage from './reports-page';
beforeEach(() => { state.loading = false; state.error = null; state.hasReport = true; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('uses the canonical reporting UI with its export and report title', () => {
  render(<ReportsPage />);
  expect(screen.getByText('Analytics & Reports')).toBeTruthy();
  expect(screen.getByText('Analytics & Reports').getAttribute('data-presentation')).toBe('reporting');
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Export CSV' })).toHaveProperty('disabled', false);
});

it.each(['initial', 'refresh', 'error', 'unavailable'])('keeps Reports export visible but disabled during %s', mode => {
  state.loading = mode === 'initial' || mode === 'refresh';
  state.hasReport = mode !== 'initial' && mode !== 'unavailable';
  state.error = mode === 'error' ? 'Unable to load report' : null;
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const view = render(<ReportsPage />);
  const button = screen.getByRole('button', { name: 'Export CSV' });
  expect(button).toHaveProperty('disabled', true); fireEvent.click(button); expect(fetch).not.toHaveBeenCalled();
  state.loading = false; state.error = null; state.hasReport = true;
  view.rerender(<ReportsPage />);
  expect(button).toHaveProperty('disabled', false);
});

it('allows one Reports download at a time', async () => {
  let finish!: (response: unknown) => void;
  const fetch = vi.fn().mockReturnValue(new Promise(resolve => { finish = resolve; }));
  vi.stubGlobal('fetch', fetch);
  URL.createObjectURL = vi.fn().mockReturnValue('blob:report'); URL.revokeObjectURL = vi.fn();
  const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<ReportsPage />);
  const button = screen.getByRole('button', { name: 'Export CSV' });
  fireEvent.click(button); fireEvent.click(button);
  expect(fetch).toHaveBeenCalledOnce(); expect(button).toHaveProperty('disabled', true);
  finish({ ok: true, blob: async () => new Blob(['report']) });
  await waitFor(() => expect(download).toHaveBeenCalledOnce());
  expect(button).toHaveProperty('disabled', false);
});

it('retains authorized CSV export with the current reporting filters', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['report']) });
  vi.stubGlobal('fetch', fetch);
  URL.createObjectURL = vi.fn().mockReturnValue('blob:report');
  URL.revokeObjectURL = vi.fn();
  const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<ReportsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  await waitFor(() => expect(download).toHaveBeenCalledOnce());
  expect(fetch).toHaveBeenCalledWith('/api/proxy/reporting/dashboard/export?range=last3&revenueInterval=week', { credentials: 'include', cache: 'no-store' });
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report');
});
