import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { defaultQuotationContent } from '@leadcrm/shared';
import { clearPageCache } from '@/shared/cache/page-cache';
import { QuotationTemplates } from '../quotation-templates';

const mocks = vi.hoisted(() => ({ list: vi.fn(), canCreate: true }));
vi.mock('@/lib/config', () => ({ USE_MOCK_DATA: false }));
vi.mock('@/store/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user', tenantId: 'tenant' }, tenant: { id: 'tenant', name: 'Workspace' }, isLoading: false }) }));
vi.mock('@/shared/hooks/use-permissions', () => ({ useHasPermission: (key: string) => key === 'campaigns.create' && mocks.canCreate }));
vi.mock('@/shared/services/templates.api', () => ({ templatesApi: { list: mocks.list } }));
vi.mock('../campaign-variable-picker', async importOriginal => ({
  ...await importOriginal<typeof import('../campaign-variable-picker')>(),
  useCampaignVariableFields: () => ({ fields: [], error: null }),
}));
vi.mock('../quotation-wizard', () => ({ QuotationWizard: () => <div>Existing quotation wizard</div> }));

beforeEach(() => {
  clearPageCache(); vi.clearAllMocks(); mocks.canCreate = true;
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); clearPageCache(); vi.unstubAllGlobals(); });

function arrange(count: number) {
  const data = count ? [{ id: 'quotation-template', type: 'Quotation', name: 'Saved quotation', category: 'Sales', content: JSON.stringify(defaultQuotationContent()) }] : [];
  mocks.list.mockResolvedValue({ success: true, data, meta: { total: data.length, page: 1, limit: 10, hasMore: false } });
  return render(<QuotationTemplates />);
}

it.each([0, 1])('keeps Quotation copy and opens its editor from the only create action with %i templates', async count => {
  arrange(count);
  await screen.findByText(count ? 'Saved quotation' : 'No quotation templates found.');
  expect(screen.getByRole('heading', { level: 2, name: 'Quotation Templates' })).toBeTruthy();
  expect(screen.getByText('Create reusable PDF-formatted quotations for your customers.')).toBeTruthy();
  const buttons = screen.getAllByRole('button', { name: /New Quotation Template|Create a quotation template/i });
  expect(buttons).toHaveLength(1);
  expect(buttons[0].getAttribute('title')).toBe('New Quotation Template');
  expect(within(screen.getByRole('group', { name: 'templates actions' })).getByRole('button', { name: 'Refresh' })).toBeTruthy();
  fireEvent.click(buttons[0]);
  const editor = screen.getByRole('dialog', { name: 'Create Quotation Template' });
  expect(within(editor).getByLabelText('Template Name *')).toBeTruthy();
  expect(within(editor).getByLabelText('Quotation Title *')).toBeTruthy();
});

it.each([0, 1])('preserves denied creation access with %i quotation templates', async count => {
  mocks.canCreate = false; arrange(count);
  await screen.findByText(count ? 'Saved quotation' : 'No quotation templates found.');
  expect(screen.queryByRole('button', { name: /New Quotation Template|Create a quotation template/i })).toBeNull();
  expect(screen.queryByRole('dialog', { name: 'Create Quotation Template' })).toBeNull();
});
