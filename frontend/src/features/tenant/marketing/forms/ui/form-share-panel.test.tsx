import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { defaultContactForm } from '@leadcrm/shared';
import { FormSharePanel } from './form-share-panel';
import { formsApi } from '@/shared/services/forms.api';
import { toast } from 'sonner';
vi.mock('@/shared/services/forms.api', () => ({ formsApi: { submissions: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const form = { ...defaultContactForm(), id: 'form', tenantId: 'tenant', publicId: 'public', revision: 1, publishedRevision: 1, publishedVersion: 1, status: 'published' as const, createdAt: '', updatedAt: '' };
const mount = (extra = {}) => render(<FormSharePanel form={form} dirty={false} shareLink="https://example.test/forms/public" embedCode="<iframe />" {...extra} />);
beforeEach(() => { vi.clearAllMocks(); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => {}) } }); });
afterEach(cleanup);
it('keeps sharing controls and never retrieves or renders submission history', () => {
  const view = mount();
  expect(screen.getByRole('heading', { name: 'Embed Code' })).toBeTruthy();
  expect(screen.getByRole('link').getAttribute('href')).toBe('https://example.test/forms/public');
  expect(formsApi.submissions).not.toHaveBeenCalled();
  expect(screen.queryByRole('region', { name: 'Submission History' })).toBeNull();
  expect(view.container.querySelector('details')).toBeNull();
});
it('copies the public URL and reports clipboard failures without claiming success', async () => {
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }));
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.test/forms/public'));
  vi.mocked(toast.success).mockClear(); vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('Denied'));
  fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Unable to copy'));
  expect(toast.success).not.toHaveBeenCalled();
});
it('retains publication requirements and unpublished-change feedback', () => {
  mount({ form: { ...form, publishedVersion: null }, dirty: true });
  expect(screen.getByText(/unpublished edits/)).toBeTruthy();
  expect(screen.getByText(/Publish this form to enable/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Copy code' })).toBeNull();
});
