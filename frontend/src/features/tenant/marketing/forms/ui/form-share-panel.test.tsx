import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { defaultContactForm, SOURCE_LINK_PRESETS } from '@leadcrm/shared';
import { FormSharePanel } from './form-share-panel';
import { FormSettingsPanel } from './form-settings-panel';
import { formsApi } from '@/shared/services/forms.api';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/shared/utils/toast';
vi.mock('@/shared/services/forms.api', () => ({ formsApi: { submissions: vi.fn() } }));
vi.mock('@/lib/api/client', () => ({ apiClient: { download: vi.fn() } }));
vi.mock('@/shared/utils/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const form = { ...defaultContactForm(), id: 'form', tenantId: 'tenant', publicId: 'public', revision: 1, publishedRevision: 1, publishedVersion: 1, status: 'published' as const, createdAt: '', updatedAt: '' };
const mount = (extra = {}) => render(<FormSharePanel form={form} dirty={false} shareLink="https://example.test/forms/public" {...extra} />);
beforeEach(() => { vi.clearAllMocks(); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => {}) } }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('shows source sharing without redundant cards or submission history', () => {
  mount();
  expect(screen.getByRole('heading', { name: 'Source links and QR codes' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Embed Code' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Share Link' })).toBeNull();
  expect(formsApi.submissions).not.toHaveBeenCalled();
  expect(screen.queryByRole('region', { name: 'Submission History' })).toBeNull();
  for (const row of SOURCE_LINK_PRESETS) {
    const link = new URL(screen.getByRole('link', { name: `Open ${row.source} form` }).getAttribute('href')!);
    expect(link.origin + link.pathname).toBe('https://example.test/forms/public');
    expect(link.searchParams.get('utm_source')).toBe(row.source);
    expect(link.searchParams.get('utm_medium')).toBe(row.medium);
  }
  expect(screen.getByRole('link', { name: 'Open email' }).getAttribute('href')).toContain('mailto:goldenbits.1993@gmail.com');
  expect(screen.getByText('Call / SMS')).toBeTruthy();
});

it('copies the selected campaign link and reports clipboard failures accurately', async () => {
  mount();
  fireEvent.change(screen.getByLabelText('Campaign name'), { target: { value: 'defense_2026' } });
  fireEvent.click(screen.getByRole('button', { name: 'Copy google link' }));
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.test/forms/public?utm_source=google&utm_medium=cpc&utm_campaign=defense_2026'));
  vi.mocked(toast.success).mockClear(); vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('Denied'));
  fireEvent.click(screen.getByRole('button', { name: 'Copy facebook link' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Unable to copy'));
  expect(toast.success).not.toHaveBeenCalled();
});

it.each([
  ['unpublished edits', { dirty: true }],
  ['unpublished revision', { form: { ...form, revision: 2 } }],
  ['disabled tracking', { form: { ...form, settings: { ...form.settings, trackUrlParams: false } } }],
])('prevents unusable form actions for %s while keeping email available', (_name, extra) => {
  mount(extra);
  expect(screen.getByRole('button', { name: 'Copy google link' })).toHaveProperty('disabled', true);
  expect(screen.getByLabelText('Open google form').getAttribute('href')).toBeNull();
  expect(screen.getByRole('button', { name: 'Download links + QR PDF' })).toHaveProperty('disabled', true);
  expect(screen.getByRole('link', { name: 'Open email' })).toBeTruthy();
});

it('explains invalid campaigns and restores sharing after correction', () => {
  mount(); const input = screen.getByLabelText('Campaign name');
  fireEvent.change(input, { target: { value: 'invalid campaign' } });
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByRole('alert').textContent).toContain('1–100');
  expect(screen.getByRole('button', { name: 'Copy google link' })).toHaveProperty('disabled', true);
  fireEvent.change(input, { target: { value: 'valid-campaign' } });
  expect(screen.getByRole('button', { name: 'Copy google link' })).toHaveProperty('disabled', false);
});

it.each([{ ...form, publishedVersion: 0 }, { ...form, status: 'draft' as const }])('requires publication before rendering campaign actions', draft => {
  mount({ form: draft });
  expect(screen.getByText(/Publish this form to enable source links/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Copy google link' })).toBeNull();
});

it('downloads the selected PDF and recovers from a download failure', async () => {
  mount();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.mocked(apiClient.download).mockResolvedValueOnce(new Blob(['%PDF-test']));
  fireEvent.click(screen.getByRole('button', { name: 'Download links + QR PDF' }));
  await waitFor(() => expect(apiClient.download).toHaveBeenCalledWith('/marketing/forms/form/source-links.pdf?campaign=leadcrm_demo'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Download links + QR PDF' })).toHaveProperty('disabled', false));
  expect(URL.createObjectURL).toHaveBeenCalledOnce();
  vi.mocked(apiClient.download).mockRejectedValueOnce(new Error('Download unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Download links + QR PDF' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Download unavailable'));
  expect(screen.getByRole('button', { name: 'Download links + QR PDF' })).toHaveProperty('disabled', false);
});

it('preserves hidden embed settings when another setting changes', () => {
  const settings = { ...form.settings, allowedEmbedOrigins: ['https://company.example'] }, change = vi.fn();
  render(<FormSettingsPanel settings={settings} onChange={change} />);
  expect(screen.queryByLabelText('Company website origins for attribution')).toBeNull();
  fireEvent.change(screen.getByLabelText('Email notification for form submissions'), { target: { value: 'alerts@example.test' } });
  expect(change).toHaveBeenLastCalledWith({ ...settings, notificationEmail: 'alerts@example.test' });
});
